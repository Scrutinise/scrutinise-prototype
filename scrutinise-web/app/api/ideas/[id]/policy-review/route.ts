// 26-S §6 — THE POLICY REVIEW ROUTE. GET: what bears on the Guiding Policy (the header's two numbers and the list behind them).
// POST: one judgement. Every op calls `lib/lex/policy-review.ts`. Owner or collaborator (authorizeIdea). Nothing here deletes;
// dismiss and set aside both REQUIRE a reason, and say so in words (CLAUDE.md §30).

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { describeIssues } from '@/lib/api-rejection'
import { PolicyReviewBody as Body, REVIEW_OP_WORDS, REVIEW_INPUT_WORDS, type PolicyReviewOp } from '@/lib/lex/policy-review-schema'
import * as P from '@/lib/lex/policy-review'
import type * as RN from '@/lib/lex/research-notes'

export const maxDuration = 60
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const viewer: RN.Viewer = { id: authz.user.id, isOwner: authz.idea.creatorId === authz.user.id }
  const review = await P.readPolicyReview(id, viewer)
  return NextResponse.json({ ...review, sentence: P.headerSentence(review.counts), viewer })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const op = (raw as { op?: unknown } | null)?.op
    const action = typeof op === 'string' && op in REVIEW_OP_WORDS ? REVIEW_OP_WORDS[op as PolicyReviewOp] : 'That judgement'
    const { message, rejected } = describeIssues(parsed.error.issues, { action, labels: REVIEW_INPUT_WORDS })
    console.warn('[policy-review] rejected', { op, rejected })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const b = parsed.data
  const viewer: RN.Viewer = { id: authz.user.id, isOwner: authz.idea.creatorId === authz.user.id }
  let r: P.Result
  try {
    switch (b.op) {
      case 'accept': r = await P.acceptFinding(id, b.evidenceId); break
      case 'dismiss': r = await P.dismissFinding(id, b.evidenceId, b.reason); break
      case 'setAside': r = await P.setAsideFinding(id, b.evidenceId, b.reason); break
      case 'restore': r = await P.restoreFinding(id, b.evidenceId); break
      case 'noteAccept': r = await P.acceptNote(id, viewer, b.noteId); break
      case 'noteNotOnPolicy': r = await P.dismissNoteFromPolicy(id, viewer, b.noteId, b.reason); break
      case 'noteSetAside': r = await P.setAsideNote(id, viewer, b.noteId, b.reason); break
      case 'noteRestore': r = await P.restoreNote(id, viewer, authz.idea.creatorId, b.noteId); break
    }
  } catch (err) {
    console.error('[policy-review] failed', b.op, err)
    return NextResponse.json({ error: `${REVIEW_OP_WORDS[b.op]} did not work: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}. Nothing further was changed.` }, { status: 500 })
  }
  const review = await P.readPolicyReview(id, viewer)
  return r.ok
    ? NextResponse.json({ ok: true, result: r.data, error: null, review: { ...review, sentence: P.headerSentence(review.counts) } })
    : NextResponse.json({ ok: false, result: null, error: (r as { error: string }).error }, { status: 422 })
}
