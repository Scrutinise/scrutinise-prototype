import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import {
  addAction,
  updateAction,
  removeAction,
  listActions,
  acceptField,
  skipField,
} from '@/lib/lex/field-machine'
import { orchestrateAfterWrite } from '@/lib/lex/orchestrator'
import { assertWritableField } from '@/lib/lex/stage'

type Params = { params: Promise<{ id: string }> }

// §18.2 cost range-with-basis (optionally tied to a benchmark / user-overridden).
const CostRange = z.object({
  low: z.number().nonnegative().optional().nullable(),
  high: z.number().nonnegative().optional().nullable(),
  unit: z.string().trim().max(40).optional().nullable(),
  basis: z.string().trim().max(2000).optional().nullable(),
  benchmarkId: z.string().max(60).optional().nullable(),
  userOverride: z.boolean().optional(),
  priceYear: z.number().int().min(1900).max(2100).optional().nullable(),
}).nullable()

const Benefits = z.object({
  financial: z.string().trim().max(2000).optional(),
  social: z.string().trim().max(2000).optional(),
  ongoing: z.string().trim().max(2000).optional(),
}).nullable()

const ActionFields = {
  practicalStep: z.string().trim().min(1).max(2000),
  mechanismType: z.string().trim().max(40).optional().nullable(),
  whoImplements: z.string().trim().max(2000).optional().nullable(),
  targetOrganisation: z.string().trim().max(2000).optional().nullable(),
  wording: z.string().trim().max(8000).optional().nullable(),
  benefits: Benefits.optional(),
  implementationCost: CostRange.optional(),
  enforcementCost: CostRange.optional(),
  regulatoryFriction: CostRange.optional(),
}

// The Page 4 actions loop (§18). Mutates LexCoherentAction child rows.
const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), ...ActionFields }),
  z.object({
    action: z.literal('update'),
    actionId: z.string().min(1),
    ...ActionFields,
    practicalStep: z.string().trim().min(1).max(2000).optional(),
  }),
  z.object({ action: z.literal('remove'), actionId: z.string().min(1) }),
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('skip') }),
])

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

  // §19-B Task 1 — write side of "chat page == state page".
  const blocked = await assertWritableField(id, 'actions')
  if (blocked) {
    return NextResponse.json({ error: 'You haven’t started the Coherent Actions yet.' }, { status: 409 })
  }

  let messages: string[] = []
  try {
    switch (body.action) {
      case 'add':
        await addAction(id, body)
        break
      case 'update': {
        const { action, actionId, ...patch } = body
        void action
        await updateAction(id, actionId, patch)
        break
      }
      case 'remove':
        await removeAction(id, body.actionId)
        break
      case 'confirm': {
        const actions = await listActions(id)
        if (!actions.length) {
          return NextResponse.json({ error: 'Add at least one action before continuing.' }, { status: 422 })
        }
        await acceptField(id, idea.creatorId, 'actions', 'confirmed')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
      }
      case 'skip':
        await skipField(id, 'actions')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
    }
  } catch (err) {
    console.error('[actions] transition failed:', err)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }

  const state = await computeCanonicalState(id)
  console.log('[lex-diag] actions write', { action: body.action, nextField: state?.currentField?.key ?? null })
  return NextResponse.json({ state, messages })
}
