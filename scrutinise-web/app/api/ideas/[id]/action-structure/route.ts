// 26-Q — THE ONE ROUTE BEHIND THE COHERENT-ACTIONS LIST: titles, headings, order, park / rule out, facets, merge, compare,
// duplicates. Every op calls `lib/lex/action-structure.ts`, the same functions Lex's tools call, so the screen and the chat
// cannot drift. Owner or collaborator (authorizeIdea), exactly as the older /actions route. Nothing here deletes an action.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { computeCanonicalState } from '@/lib/lex/state'
import { assertWritableField } from '@/lib/lex/stage'
import * as S from '@/lib/lex/action-structure'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }
const ids = z.array(z.string().min(1)).min(1).max(300)
const Answer = z.object({
  verdict: z.enum(['MERGE', 'ONE_CONTAINS_THE_OTHER', 'SEQUENCE', 'CONTRADICTORY']),
  reasoning: z.string().max(4000),
  merged: z.object({ title: z.string().max(300), practicalStep: z.string().min(1).max(4000) }).nullable().optional(),
  subordinateNumber: z.number().int().nullable().optional(),
})
const Facets = z.object({
  targetCauseIds: z.array(z.string()).max(40).optional(),
  avenue: z.enum(['LEGISLATIVE', 'ORGANISATIONAL', 'FINANCIAL']).nullable().optional(),
  link: z.string().max(200).nullable().optional(),
  sequence: z.enum(['NOW', 'NEXT', 'LATER']).nullable().optional(),
  beforeIds: z.array(z.string()).max(100).optional(),
})
const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('createHeading'), name: z.string().min(1).max(80), colourKey: z.string().max(30).optional() }),
  z.object({ op: z.literal('updateHeading'), headingId: z.string(), name: z.string().min(1).max(80).optional(), colourKey: z.string().max(30).optional(), hidden: z.boolean().optional() }),
  z.object({ op: z.literal('deleteHeading'), headingId: z.string() }),
  z.object({ op: z.literal('assignHeading'), actionIds: ids, headingId: z.string().nullable() }),
  z.object({ op: z.literal('setTitle'), actionId: z.string(), title: z.string().max(300).nullable() }),
  z.object({ op: z.literal('acceptTitles'), ids: ids.optional() }),
  z.object({ op: z.literal('dismissTitles'), ids: ids.optional() }),
  z.object({ op: z.literal('proposeTitles') }),
  z.object({ op: z.literal('reorder'), order: z.array(z.string()).min(1).max(500) }),
  z.object({ op: z.literal('park'), ids, reason: z.string().max(600).nullable().optional() }),
  z.object({ op: z.literal('unpark'), ids }),
  z.object({ op: z.literal('ruleOut'), ids, reason: z.string().max(600) }),
  z.object({ op: z.literal('restore'), ids }),
  z.object({ op: z.literal('setFacets'), actionId: z.string(), patch: Facets }),
  z.object({ op: z.literal('acceptFacets'), ids: ids.optional() }),
  z.object({ op: z.literal('dismissFacets'), ids: ids.optional() }),
  z.object({ op: z.literal('proposeFacets') }),
  z.object({ op: z.literal('suggestHeadings') }),
  z.object({ op: z.literal('judgeMerge'), a: z.number().int(), b: z.number().int() }),
  z.object({ op: z.literal('applyMerge'), a: z.number().int(), b: z.number().int(), answer: Answer }),
  z.object({ op: z.literal('undoMerge'), mergedId: z.string() }),
  z.object({ op: z.literal('findDuplicates') }),
])

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const b = parsed.data

  if (await assertWritableField(id, 'actions')) return NextResponse.json({ error: 'You haven’t started the Coherent Actions yet.' }, { status: 409 })

  const uid = authz.user.id
  let result: S.Result | { ok: true; data: unknown }
  try {
    switch (b.op) {
      case 'createHeading': result = await S.createHeading(id, b.name, b.colourKey); break
      case 'updateHeading': result = await S.updateHeading(id, b.headingId, { name: b.name, colourKey: b.colourKey, hidden: b.hidden }); break
      case 'deleteHeading': result = await S.deleteHeading(id, b.headingId); break
      case 'assignHeading': result = await S.assignHeading(id, b.actionIds, b.headingId); break
      case 'setTitle': result = await S.setTitle(id, b.actionId, b.title); break
      case 'acceptTitles': result = await S.acceptTitleProposals(id, b.ids); break
      case 'dismissTitles': result = await S.dismissTitleProposals(id, b.ids); break
      case 'proposeTitles': result = await S.proposeTitles(id, uid); break
      case 'reorder': result = await S.reorder(id, b.order); break
      case 'park': result = await S.park(id, b.ids, b.reason); break
      case 'unpark': result = await S.unpark(id, b.ids); break
      case 'ruleOut': result = await S.ruleOut(id, b.ids, b.reason); break
      case 'restore': result = await S.restore(id, b.ids); break
      case 'setFacets': result = await S.setFacets(id, b.actionId, b.patch); break
      case 'acceptFacets': result = await S.acceptFacetProposals(id, b.ids); break
      case 'dismissFacets': result = await S.dismissFacetProposals(id, b.ids); break
      case 'proposeFacets': result = await S.proposeFacets(id, uid); break
      case 'suggestHeadings': result = await S.suggestHeadings(id, uid); break
      case 'judgeMerge': result = await S.judgeActionMerge(id, uid, b.a, b.b); break
      case 'applyMerge': result = await S.applyActionMerge(id, uid, b.a, b.b, { ...b.answer, merged: b.answer.merged ?? null, subordinateNumber: b.answer.subordinateNumber ?? null }); break
      case 'undoMerge': result = await S.undoActionMerge(id, b.mergedId); break
      case 'findDuplicates': result = { ok: true, data: await S.findDuplicates(id) }; break
    }
  } catch (err) {
    console.error('[action-structure] failed', b.op, err)
    return NextResponse.json({ error: `That did not work (${b.op}): ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}` }, { status: 500 })
  }
  const state = await computeCanonicalState(id)
  return NextResponse.json({ ok: result.ok, result: result.ok ? result.data : null, error: result.ok ? null : (result as { error: string }).error, state }, { status: result.ok ? 200 : 422 })
}
