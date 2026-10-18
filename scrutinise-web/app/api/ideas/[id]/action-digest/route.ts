// 26-T1 §2 — THE ONE ROUTE BEHIND "Ask four models about this heading / the whole set". Every op calls `lib/lex/action-digest.ts`, the same
// functions Lex's tools call, so the button and the chat cannot drift. Owner or collaborator (authorizeIdea), exactly as /action-import.
// Nothing here writes an ACTION: `suggestGaps` writes suggestions that wait for the existing accept, and a model's extra condition is only
// ever a proposal in the conditions panel. `advance` is ONE stage per call (the four models, then the judge), so each request is far inside
// the function limit and a closed tab loses nothing.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { ActionDigestBody as Body, DIGEST_OP_WORDS, DIGEST_INPUT_WORDS, type ActionDigestOp } from '@/lib/lex/action-digest-schema'
import { describeIssues } from '@/lib/api-rejection'
import { enterSpendFor } from '@/lib/lex/build-context'
import * as D from '@/lib/lex/action-digest'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const [digests, quote] = await Promise.all([D.listDigests(id), D.digestQuote(id)])
  return NextResponse.json({ digests, quote })
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
    // CLAUDE.md §30 — a rejection names the input and the reason, in words. Never the flatten() object.
    const op = (raw as { op?: unknown } | null)?.op
    const action = typeof op === 'string' && op in DIGEST_OP_WORDS ? DIGEST_OP_WORDS[op as ActionDigestOp] : 'That request'
    const { message, rejected } = describeIssues(parsed.error.issues, { action, labels: DIGEST_INPUT_WORDS })
    console.warn('[action-digest] rejected', { op, rejected })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const b = parsed.data
  const uid = authz.user.id
  try {
    switch (b.op) {
      case 'start': return respond(await D.startDigest(id, uid, b.scope, b.scope === 'HEADING' ? b.headingId ?? null : null))
      case 'advance': return respond(await D.advanceDigest(id, uid, b.digestId))
      case 'retry': return respond(await D.retryModels(id, b.digestId))
      case 'suggestGaps': return respond(await D.suggestGaps(id, b.digestId, b.index))
    }
  } catch (err) {
    console.error('[action-digest] failed', b.op, err)
    return NextResponse.json({ error: `${DIGEST_OP_WORDS[b.op]} did not work: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}. Nothing further was changed.` }, { status: 500 })
  }
}

function respond(r: D.Result<unknown>): NextResponse {
  return r.ok
    ? NextResponse.json({ ok: true, result: r.data, error: null })
    : NextResponse.json({ ok: false, result: null, error: (r as { error: string }).error }, { status: 422 })
}
