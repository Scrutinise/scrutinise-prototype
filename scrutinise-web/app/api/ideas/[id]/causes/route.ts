import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import {
  addCause,
  updateCause,
  removeCause,
  listCauses,
  setRootCause,
  classifyCause,
  acceptField,
  skipField,
} from '@/lib/lex/field-machine'
import { orchestrateAfterWrite } from '@/lib/lex/orchestrator'
import { assertWritableField } from '@/lib/lex/stage'
import { wouldCreateCycle, reorderedIds } from '@/lib/lex/cause-tree'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// The Page 2 causes loop (§7.2) + root-cause selection. Kept separate from the scalar
// /fields endpoint because it mutates DiagnosisCause child rows, not IdeaFieldState.
const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    cause: z.string().trim().min(1).max(2000),
    whyPersisted: z.string().trim().max(4000).optional(),
    evidence: z.string().trim().max(4000).optional(),
    parentCauseId: z.string().min(1).optional(), // §16.2 — add a sub-cause beneath this one
  }),
  z.object({
    action: z.literal('classify'),
    causeId: z.string().min(1),
    classification: z.enum(['MATERIAL', 'CONTRIBUTORY', 'UNASSESSED']),
  }),
  z.object({
    action: z.literal('update'),
    causeId: z.string().min(1),
    cause: z.string().trim().min(1).max(2000).optional(),
    whyPersisted: z.string().trim().max(4000).optional(),
    evidence: z.string().trim().max(4000).optional(),
  }),
  z.object({ action: z.literal('remove'), causeId: z.string().min(1) }),
  z.object({ action: z.literal('confirm') }), // done adding — accept the causes field
  z.object({ action: z.literal('skip') }),    // no distinct causes → skip the field
  // ══════════ 25-S §2b/§2c/§2e — MOVE A CAUSE ══════════════════════════════════
  //
  // ⚠ TWO OPERATIONS, NOT ONE, BECAUSE THEY ARE TWO ACTS. Dragging a cause into a new position
  // changes the ORDER and nothing else; dragging it ONTO another changes its PARENT and nothing
  // else. A single "move" taking both would make every reorder a potential re-parenting, and the
  // undo for one is not the undo for the other.
  z.object({
    action: z.literal('reorder'),
    /** The ids in their new order. Anything omitted keeps its relative order and follows. */
    causeIds: z.array(z.string().min(1)).min(1).max(200),
  }),
  z.object({
    action: z.literal('nest'),
    causeId: z.string().min(1),
    /** null detaches it back to the top level — which is also §2e's undo. */
    parentCauseId: z.string().min(1).nullable(),
  }),
  z.object({ action: z.literal('setRoot'), causeId: z.string().min(1) }),
  z.object({ action: z.literal('skipRoot') }), // don't name a single root cause → skip it
])

// POST /api/ideas/[id]/causes — server-authoritative causes-loop transition.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea } = authz

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const body = parsed.data

  // §19-B Task 1 — the causes loop belongs to Diagnosis; refuse it until the state
  // machine has entered that page ("chat page == state page", write side).
  const blocked = await assertWritableField(id, 'causes')
  if (blocked) {
    return NextResponse.json({ error: 'You haven’t started the Diagnosis yet.' }, { status: 409 })
  }

  let messages: string[] = []
  try {
    switch (body.action) {
      case 'add':
        await addCause(id, {
          cause: body.cause, whyPersisted: body.whyPersisted, evidence: body.evidence,
          parentCauseId: body.parentCauseId, source: 'USER',
        })
        break
      case 'classify':
        await classifyCause(id, body.causeId, body.classification)
        break
      case 'update':
        await updateCause(id, body.causeId, { cause: body.cause, whyPersisted: body.whyPersisted, evidence: body.evidence })
        break
      // ══ §2b — THE ORDER CHANGES; THE NUMBERS DO NOT ═════════════════════════
      //
      // ⚠⚠ `orderIndex` IS REWRITTEN FOR THE WHOLE LIST AND `number` IS NEVER TOUCHED. That
      // separation is the point of §2a: a cause dragged to the top is still cause 7, so
      // "cause 7 is wrong" survives the drag. Rewriting the whole list rather than slotting a
      // value between two neighbours is deliberate — production has 22 causes using 6 distinct
      // `orderIndex` values, so there is frequently no gap to slot into.
      case 'reorder': {
        const all = await prisma.diagnosisCause.findMany({
          where: { ideaId: id }, select: { id: true }, orderBy: { orderIndex: 'asc' },
        })
        const order = reorderedIds(body.causeIds, all.map((c) => c.id))
        await prisma.$transaction(
          order.map((cid, i) => prisma.diagnosisCause.update({
            where: { id: cid }, data: { orderIndex: i },
          })),
        )
        break
      }

      // ══ §2c/§2d/§2e — NEST, AND REFUSE A LOOP ═══════════════════════════════
      case 'nest': {
        // ⚠ BOTH ENDS SCOPED TO THIS IDEA. `addCause` already does this for the same reason: a
        // bare id lookup would let a caller graft one idea's cause onto another idea's tree.
        const child = await prisma.diagnosisCause.findFirst({
          where: { id: body.causeId, ideaId: id }, select: { id: true },
        })
        if (!child) {
          return NextResponse.json({ error: 'That cause is not on this idea.' }, { status: 404 })
        }
        if (body.parentCauseId) {
          const parent = await prisma.diagnosisCause.findFirst({
            where: { id: body.parentCauseId, ideaId: id }, select: { id: true },
          })
          if (!parent) {
            return NextResponse.json({ error: 'That parent is not on this idea.' }, { status: 404 })
          }
        }
        // ⚠⚠ §2d — THE LOOP GUARD, AND IT SHIPS WITH THE OPERATION THAT MAKES A LOOP POSSIBLE.
        // Until this sprint nothing could re-parent a cause, so a cycle was unreachable rather
        // than guarded. `children` is walked recursively to render, so a loop is a HANG, not a
        // wrong answer — which is why this refuses by name rather than silently no-opping.
        const nodes = await prisma.diagnosisCause.findMany({
          where: { ideaId: id }, select: { id: true, parentCauseId: true },
        })
        if (wouldCreateCycle(body.causeId, body.parentCauseId, nodes)) {
          return NextResponse.json(
            { error: 'A cause cannot sit beneath one of its own sub-causes — that would be a loop.' },
            { status: 409 },
          )
        }
        await prisma.diagnosisCause.update({
          where: { id: body.causeId }, data: { parentCauseId: body.parentCauseId },
        })
        break
      }

      case 'remove':
        await removeCause(id, body.causeId)
        break
      case 'confirm': {
        const causes = await listCauses(id)
        if (!causes.length) {
          return NextResponse.json({ error: 'Add at least one cause before continuing.' }, { status: 422 })
        }
        await acceptField(id, idea.creatorId, 'causes', 'confirmed')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
      }
      case 'skip':
        await skipField(id, 'causes')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
      case 'setRoot': {
        const ok = await setRootCause(id, body.causeId)
        if (!ok) return NextResponse.json({ error: 'That cause was not found.' }, { status: 422 })
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
      }
      case 'skipRoot':
        await skipField(id, 'rootCause')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
    }
  } catch (err) {
    console.error('[causes] transition failed:', err)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }

  const state = await computeCanonicalState(id)
  console.log('[lex-diag] causes write', { action: body.action, nextField: state?.currentField?.key ?? null })
  return NextResponse.json({ state, messages })
}
