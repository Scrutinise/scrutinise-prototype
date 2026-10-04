// 26-P ADDENDUM (CCh follow-up) — "ASK LEX" ON ONE CHECK.
//
// POST { checkKey } → Lex applies that test to the idea's CURRENT rows and reports what it finds: observations, and
// proposals as text. NOTHING IS CHANGED.
//
// ⚠ HOW "NOTHING CHANGED" IS ENFORCED, NOT PROMISED: the turn runs `readOnly` — the model is not OFFERED a single tool
// that writes, and a write tool named anyway is refused in the loop (loop.ts, defence in depth). The instruction also
// says so, but the instruction is the second line of defence, not the first.
//
// ⚠ THE REPLY IS CHECKED LIKE EVERY OTHER REPLY. It runs through the agent loop, so `checkReply` compares what it claims
// against this turn's tool results before it is shown — a reply that says "I've updated your causes" with no tool
// call is corrected or struck (honesty.ts). And every tool call the turn makes is recorded for the owner (§8c).
//
// ⚠ GATED BY THE AGENT SWITCH (LEX_AGENT), because it IS the tool-calling Lex. When the switch is off for this account
// the answer is a plain 403 that says so — OFF must not look like FAILED (CLAUDE.md §18).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { agentEnabledFor } from '@/lib/lex/agent/flag'
import { handleAgentTurn } from '@/lib/lex/agent/turn'
import { findCheck } from '@/lib/lex/section-checklists'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }
const Body = z.object({ checkKey: z.string().min(1).max(200) })

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let json: unknown = {}
  try { json = await req.json() } catch { /* 422 below */ }
  const parsed = Body.safeParse(json ?? {})
  if (!parsed.success) return NextResponse.json({ error: 'checkKey is required.' }, { status: 422 })
  const hit = findCheck(parsed.data.checkKey)
  if (!hit) return NextResponse.json({ error: 'That is not one of the checks.' }, { status: 422 })

  if (!agentEnabledFor({ id: authz.user.id, email: authz.user.email })) {
    return NextResponse.json({ error: 'Asking Lex to apply a check is not switched on for your account yet. The checks themselves work without it.', switchedOff: true }, { status: 403 })
  }

  const message = `${hit.check.title}: ${hit.check.question} — ${hit.check.askLex}`
  const out = await handleAgentTurn({
    ideaId: id, user: { id: authz.user.id, email: authz.user.email }, idea: authz.idea, message,
    ui: { stage: 'strategy', panel: 'checklist' }, clientTurnId: null, readOnly: true,
  })
  return NextResponse.json(out.body, { status: out.status })
}
