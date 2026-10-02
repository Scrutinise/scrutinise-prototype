// 26-P §0/§10 — THE SWITCH. The mechanism of REPLACEMENT, not a hedge: the old Lex is removed in the
// sprint after the switch is flipped for everyone.
//
//   LEX_AGENT unset | off   → nobody (the default — the old Lex answers)
//   LEX_AGENT=all           → everybody (step 4 of §10, Charlie's to flip)
//   LEX_AGENT=a@b.com,uid2  → those emails / user ids only (step 2: Charlie's own account first)
//
// ⚠ A malformed or unknown value is OFF, never ON. A switch that fails open would put the new, acting
// Lex in front of every user because of a typo.

export type AgentSwitch = { mode: 'off' } | { mode: 'all' } | { mode: 'list'; ids: Set<string> }

export function parseAgentSwitch(raw: string | undefined | null): AgentSwitch {
  const v = (raw ?? '').trim()
  if (!v || v.toLowerCase() === 'off' || v === '0' || v.toLowerCase() === 'false') return { mode: 'off' }
  if (v.toLowerCase() === 'all') return { mode: 'all' }
  const ids = new Set(v.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.length > 2))
  return ids.size ? { mode: 'list', ids } : { mode: 'off' }
}

export function agentEnabledFor(
  user: { id: string; email?: string | null },
  raw: string | undefined | null = process.env.LEX_AGENT,
): boolean {
  const sw = parseAgentSwitch(raw)
  if (sw.mode === 'off') return false
  if (sw.mode === 'all') return true
  return sw.ids.has(user.id.toLowerCase()) || (!!user.email && sw.ids.has(user.email.toLowerCase()))
}
