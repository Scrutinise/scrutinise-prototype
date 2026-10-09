// 26-Q — THE ONE ROUTE BEHIND THE COHERENT-ACTIONS LIST: titles, headings, order, park / rule out, facets, merge, compare,
// duplicates. Every op calls `lib/lex/action-structure.ts`, the same functions Lex's tools call, so the screen and the chat
// cannot drift. Owner or collaborator (authorizeIdea), exactly as the older /actions route. Nothing here deletes an action.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { ActionStructureBody as Body, OP_WORDS, INPUT_WORDS, type ActionStructureOp } from '@/lib/lex/action-structure-schema'
import { describeIssues } from '@/lib/api-rejection'
import { enterSpendFor } from '@/lib/lex/build-context'
import { computeCanonicalState } from '@/lib/lex/state'
import { assertWritableField } from '@/lib/lex/stage'
import * as S from '@/lib/lex/action-structure'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    // CLAUDE.md §30 — a rejection names the input and the reason, in words. Never the flatten() object.
    const op = (raw as { op?: unknown } | null)?.op
    const action = typeof op === 'string' && op in OP_WORDS ? OP_WORDS[op as ActionStructureOp] : 'That action'
    const { message, rejected } = describeIssues(parsed.error.issues, { action, labels: INPUT_WORDS })
    console.warn('[action-structure] rejected', { op, rejected })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
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
