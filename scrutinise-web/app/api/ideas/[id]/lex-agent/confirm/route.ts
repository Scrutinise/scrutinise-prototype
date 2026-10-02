// 26-P §3b/§4c — THE BUTTON. The only route that runs an asks-first action, and the only way to press an
// undo. A model has no mouse: nothing in the conversation — not a "yes", not a sentence in a filed document —
// can reach this handler. It takes the signed token the tool result carried, and `handleConfirm` verifies it.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { checkRateLimit } from '@/lib/rateLimit'
import { handleConfirm } from '@/lib/lex/agent/turn'

// Consolidation runs four models and a judge; the route it calls allows 300s.
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

const Body = z.object({ token: z.string().min(20).max(20000) })

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)
  const { user, idea } = authz

  if (!checkRateLimit(`lex-agent-confirm:${user.id}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many confirmations in the last hour.' }, { status: 429 })
  }
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Body.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A token is required.' }, { status: 422 })

  const out = await handleConfirm({ ideaId: id, user: { id: user.id, email: user.email }, idea, token: parsed.data.token })
  return NextResponse.json(out.body, { status: out.status })
}
