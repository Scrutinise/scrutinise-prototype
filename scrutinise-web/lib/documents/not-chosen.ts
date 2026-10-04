// ─────────────────────────────────────────────────────────────────────────────
// 26-O §3b — "Alternatives ruled out" must list what settlement did not choose.
//
// `applyPolicyOp('settle')` leaves every other candidate CANDIDATE (the old route RULED_OUT the rest), so a
// document that listed only RULED_OUT rows printed "No alternative was formally ruled out" over a settled
// guiding policy that had beaten four drafts. Once a policy is CHOSEN, every other live candidate was, by that
// act, not chosen — and is listed with exactly that reason. A reason the user gave stays; "not chosen" is only
// what a row that has no reason of its own is given, and it is said as a fact about the settlement, not
// dressed up as a verdict on the idea.
//
// Imports nothing: pure, so documents and checks share ONE definition (CLAUDE.md §26.5).
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionLike {
  approach: string
  status: string
  ruleOutReason?: string | null
  caseFor?: string | null
}

export const NOT_CHOSEN_REASON = 'not chosen'

/**
 * The rows a document lists as "ruled out": every RULED_OUT row, plus — only when a policy is CHOSEN — every other
 * live CANDIDATE row with the reason "not chosen". With no policy chosen nothing was passed over, so nothing is added.
 */
export function notChosenOptions<T extends OptionLike>(options: readonly T[]): Array<T & { ruleOutReason: string | null; notChosen: boolean }> {
  const hasChosen = options.some((o) => o.status === 'CHOSEN')
  const out: Array<T & { ruleOutReason: string | null; notChosen: boolean }> = []
  for (const o of options) {
    if (o.status === 'RULED_OUT') out.push({ ...o, ruleOutReason: o.ruleOutReason ?? null, notChosen: false })
    else if (hasChosen && o.status === 'CANDIDATE') out.push({ ...o, ruleOutReason: NOT_CHOSEN_REASON, notChosen: true })
  }
  return out
}
