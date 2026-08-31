// SPRINT 25-D §3 / §25.5 — the right-hand panel, organised by question.
//
// GET → the assembled panel. Pure reads and NO MODEL CALL, so it is cheap enough to poll —
// the same contract the agenda route keeps, for the same reason.
//
// `?field=` is what the user is currently reading (§3 rule 3). It ORDERS and MARKS; it
// never filters, because a finding that contradicts the diagnosis must not become invisible
// the moment the user moves to the next page.

//
// PATCH → 25-N §4, move one finding to a different heading. See the note on the handler.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { buildQuestionPanel } from '@/lib/lex/question-panel'
import { HEADING_ORDER, headingFor, isHeadingKey } from '@/lib/lex/question-headings'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const focusFieldRef = new URL(req.url).searchParams.get('field')
  return NextResponse.json(await buildQuestionPanel(id, { focusFieldRef }))
}

const MoveSchema = z.object({
  /** The `EvidenceItem` id — `PanelEntry.id` for anything that is not user material. */
  entryId: z.string().uuid(),
  /** The heading to file it under. Must be a live heading, not a retired one. */
  headingKey: z.string().min(1).max(64),
})

/**
 * ══ 25-N §4 — AN ITEM CAN BE MOVED BETWEEN SECTIONS ═════════════════════════════
 *
 * §4: *"Items must be movable between sections."* Charlie's example is a Braverman incident
 * filed under one heading that belongs under *"Who has argued about this"* or *"How hard will
 * this be to achieve"* — *"Keep it, move it."*
 *
 * ⚠⚠ THE MECHANISM ALREADY EXISTED AND HAD NO DOOR. `heading-map.ts`'s first rule is that the
 * STORED TAG ALWAYS WINS — `EvidenceItem.headingKey` overrides whatever the producer declared
 * — and it was written for exactly this: a filing decision that survives a later change to
 * the configuration. Nothing had ever written it except the producers themselves, so a
 * misfiled finding could only be set aside, which deletes the material §4 wants kept.
 *
 * ⚠ A MOVE IS NOT A JUDGEMENT ABOUT THE SOURCE, so it does not touch `IdeaSourceDecision`.
 * Excluded stays excluded, in the report stays in the report. Only the shelf changes.
 *
 * ⚠ AND A RETIRED HEADING IS REFUSED. `isHeadingKey` deliberately still accepts `'AGAINST'`
 * so stored rows resolve (see `question-headings.ts`); accepting it HERE would let a user
 * file something under a heading the panel no longer draws, and it would vanish.
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  let body: unknown = {}
  try { body = await req.json() } catch { /* falls to the 422 below */ }
  const parsed = MoveSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const { entryId, headingKey } = parsed.data
  if (!isHeadingKey(headingKey) || !HEADING_ORDER.includes(headingKey)) {
    return NextResponse.json(
      { error: `“${headingKey}” is not a section this panel has.` },
      { status: 422 },
    )
  }

  // ⚠ SCOPED TO THE IDEA. `authorizeIdea` proved access to THIS idea; an update by row id
  // alone would let anyone who owns any idea re-file a finding on somebody else's.
  const moved = await prisma.evidenceItem.updateMany({
    where: { id: entryId, ideaId: id },
    data: { headingKey },
  })
  if (moved.count === 0) {
    return NextResponse.json({ error: 'That is not on this idea.' }, { status: 404 })
  }

  console.warn('[lex-diag] 25n finding re-filed by the user', {
    ideaId: id, entryId, headingKey, heading: headingFor(headingKey)?.heading,
  })

  const focusFieldRef = new URL(req.url).searchParams.get('field')
  return NextResponse.json(await buildQuestionPanel(id, { focusFieldRef }))
}
