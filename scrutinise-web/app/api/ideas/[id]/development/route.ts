// LEX 26-X §3, §5f (decisions 310, 317) — DEVELOPMENT: every live action's progress strip, the Drafting counts, and the Deepening's lock.
// Owner or collaborator reads (authorizeIdea, as /action-documents); only the OWNER overrides the lock, with a reason, recorded (appended).
//
//   GET                         { rows: [{ id, number, title, parked, progress }], counts, parked, override, deepeningOpen, toGo, overrideLine }
//   POST { op: 'override', reason }   "Deepen now": the owner opens the Deepening before every action is drafted; the reason is printed on the
//                                     Deepening page and on every output it produces

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { describeIssues } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import { DEEPENING_LOCK_UI } from '@/lib/lex/screen-labels'
import { developmentState, overrideLine, recordDeepenOverride } from '@/lib/lex/development'

type Params = { params: Promise<{ id: string }> }

const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('override'), reason: z.string().trim().min(3).max(LIMITS.deepenOverrideReason) }),
])
const OP_WORDS: Record<string, string> = { override: `“${DEEPENING_LOCK_UI.deepenNow}”` }
const INPUT_WORDS = { reason: 'the reason' }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const s = await developmentState(id)
  return NextResponse.json({ ...s, overrideLine: overrideLine(s) })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const op = (raw as { op?: unknown } | null)?.op
    const { message, rejected } = describeIssues(parsed.error.issues, { action: typeof op === 'string' && OP_WORDS[op] ? OP_WORDS[op] : 'That request', labels: INPUT_WORDS })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  if (authz.idea.creatorId !== authz.user.id) {
    return NextResponse.json({ error: `${OP_WORDS.override} was not done. Only the idea’s owner can open the Deepening before every action is drafted. Nothing was changed.` }, { status: 403 })
  }
  const r = await recordDeepenOverride(id, parsed.data.reason, authz.user.id)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 422 })
  const s = await developmentState(id)
  return NextResponse.json({ ok: true, result: { override: r.override, overrideLine: overrideLine(s) } })
}
