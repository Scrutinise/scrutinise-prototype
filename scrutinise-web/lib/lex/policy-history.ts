// ─────────────────────────────────────────────────────────────────────────────
// 25-S §1.2 — ONE LINE OF ITS OWN HISTORY, ON EVERY CARD THAT HAS ONE.
//
// Charlie's finding, and it is the right one: **he cannot tell whether the sort ran, because a
// sorted list looks exactly like an unsorted list.** His own phrase for the fix: *"a footer on
// the card saying 'moved from Guiding Policy' or something else to show its journey."*
//
// ⚠⚠ THIS IS 25-R's FAILURE ONE LEVEL UP. Those three produced correct data that never reached
// the screen. This one reaches the screen and says nothing about itself. **A result the user
// cannot distinguish from no result is not a result** — and a sort whose entire visible output is
// the order of a list is indistinguishable from no sort at all.
//
// ⚠ A CARD WITH NO HISTORY CARRIES NO LINE (§1.2, last sentence). Nothing here invents one. The
// function returns null, the card renders nothing, and a user reading down a list can tell the
// items Lex touched from the items it did not — which is the whole point.
//
// ⚠ PURE, SO THE COLD READ CAN RUN IT OVER REAL ROWS. CLAUDE.md §26: the check takes rows it did
// not create and calls what the browser calls. This is what the browser calls.
// ─────────────────────────────────────────────────────────────────────────────

/** The shape the screen holds for one candidate. A subset of `readPolicyState`'s policies. */
export interface PolicyForHistory {
  number: number | null
  kind: string
  kindReason: string | null
  status: string
  ruleOutReason: string | null
  sorted: boolean
  moveStatus: string | null
  mergedFrom: number[]
  causeNumbers: number[]
  phase: string | null
  phaseReason: string | null
  /** The policy this action implements, by number, where the sort named one. */
  implementsNumber?: number | null
}

/** Numbers as a person says them: "2 and 5", "2, 5 and 7". */
export function andList(ns: Array<number | string>): string {
  const xs = ns.map(String)
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/**
 * ══ THE ONE LINE ═══════════════════════════════════════════════════════════════════
 *
 * §1.2 gives the vocabulary and the examples; this is that list and nothing more.
 *
 * ⚠ ORDER MATTERS AND IT IS NOT ARBITRARY. A card can be several of these at once — a merged
 * policy that was later set aside, say — and the line has to name the thing that most recently
 * happened to it, because that is the one the user is looking at the consequence of. So the most
 * recent, most consequential state wins: ruled out, then set aside, then demoted, then merged,
 * then kept.
 *
 * ⚠ AND "KEPT" ONLY SAYS SO WHEN THE SORT ACTUALLY RAN. An unsorted card has no history — it has
 * not been anywhere. Printing "Guiding policy" over a row nothing has judged would be the sort
 * claiming credit for a list it never read, which is the failure this whole section is about.
 */
export function historyLine(p: PolicyForHistory): string | null {
  // ⚠ RULED OUT LEADS, and it keeps its reason: 25-P retains `ruleOutReason` through a restore
  // precisely so "we rejected this once, for this reason" survives.
  if (p.status === 'RULED_OUT') {
    return p.ruleOutReason?.trim()
      ? `Ruled out — ${p.ruleOutReason.trim()}`
      : 'Ruled out. No reason was recorded.'
  }

  if (p.kind === 'GOAL_RESTATEMENT') {
    return p.kindReason?.trim()
      ? `Set aside — this restates what you want, not how to get there. ${p.kindReason.trim()}`
      : 'Set aside — this restates what you want, not how to get there.'
  }

  if (p.kind === 'COHERENT_ACTION') {
    const where = p.implementsNumber != null ? ` It implements policy ${p.implementsNumber}.` : ''
    // ⚠ "WAS A CANDIDATE GUIDING POLICY" IS THE HALF THAT MATTERS. Without it the card reads as
    // an action that was always an action, and the user never learns that Lex moved it.
    return p.kindReason?.trim()
      ? `Was a candidate guiding policy. Moved because ${lowerFirst(p.kindReason.trim())}${where}`
      : `Was a candidate guiding policy. Lex moved it and recorded no reason.${where}`
  }

  if (p.mergedFrom.length > 0) {
    return `Merged from ${andList(p.mergedFrom)}.`
  }

  if (p.phase === 'LATER') {
    return p.phaseReason?.trim()
      ? `Kept for a later phase — ${p.phaseReason.trim()}`
      : 'Kept for a later phase.'
  }

  // ⚠ A KEPT POLICY. Only once something has judged it: see the note above.
  if (p.sorted) {
    const causes = p.causeNumbers.length
      ? ` · attacks cause ${andList(p.causeNumbers)}`
      : ''
    return `Guiding policy${causes}.`
  }

  // ⚠ NOTHING HAS HAPPENED TO THIS ONE. No line. §1.2: "A card with no history carries no line."
  return null
}

function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s
}

/**
 * ══ §1.2's CLUSTER LINE ═══════════════════════════════════════════════════════════
 *
 * *"Alternative to 2 and 5 — all three attack cause 3."*
 *
 * ⚠ SEPARATE FROM `historyLine` BECAUSE IT IS NOT HISTORY. A cluster is a RELATIONSHIP computed
 * from the causes each policy attacks (`pairPolicies`), not something that happened to the card —
 * nothing was written, and §1.3's undo therefore has nothing to undo here. Reporting it as
 * history would promise a control that cannot exist.
 */
export function clusterLine(
  number: number,
  pairings: Array<{ a: number; b: number; relationship: string; because?: string | null }>,
  causeNumbers: number[],
): string | null {
  const alts = pairings
    .filter((x) => x.relationship === 'ALTERNATIVES' && (x.a === number || x.b === number))
    .map((x) => (x.a === number ? x.b : x.a))
  if (!alts.length) return null
  const shared = causeNumbers.length === 1 ? ` — all of them attack cause ${causeNumbers[0]}` : ''
  return `Alternative to ${andList([...new Set(alts)].sort((m, n) => m - n))}${shared}.`
}

/**
 * The group headings, with the counts. §1.1: **the headings are the sort.**
 *
 * ⚠ A USER SEEING THREE NAMED GROUPS KNOWS SOMETHING SORTED THEM; a flat list tells them nothing
 * however good the sorting was. Declared here so the screen and the check read the same words.
 */
export const GROUP_HEADINGS = {
  GUIDING_POLICY: (n: number) => `Guiding policies (${n})`,
  COHERENT_ACTION: (n: number) => `These are really coherent actions (${n})`,
  GOAL_RESTATEMENT: (n: number) => `These restate your goal (${n})`,
} as const
