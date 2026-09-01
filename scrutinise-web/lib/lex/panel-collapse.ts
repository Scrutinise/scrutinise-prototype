// ─────────────────────────────────────────────────────────────────────────────
// 25-R — WHICH STAGE SECTIONS OPEN BY DEFAULT, IN ONE PLACE.
//
// ⚠⚠ THIS EXISTS BECAUSE THE RULE LIVED INSIDE A COMPONENT'S RENDER BODY AND COULD NOT BE
// IMPORTED. `check:lex-25r` had to keep a copy of it plus a regex asserting the copy still
// matched — and on the very first run after the rule changed, that guard went red. It worked,
// and a guard against drift is a worse thing than not having drift.
//
// So the rule is a function now. The panel calls it; the check imports it; there is no copy.
//
// ══ THE RULE, AND WHY `visited` IS NOT IN IT ═══════════════════════════════════════════
//
// 25-N §A2 stated it as: *a stage you have finished opens collapsed, a stage you are working in
// opens expanded.* The implementation read `complete || visited`.
//
// ⚠⚠ `visited` IS NOT "FINISHED". `state.ts` derives it as *"any of its fields has left EMPTY"*,
// with a comment explaining that entering a page is what takes a field out of EMPTY. That was
// true when only the conductor wrote fields. **A BUILD WRITES A PROPOSAL INTO EVERY FIELD OF
// EVERY PAGE**, so one build marks all four pages `visited` — and the panel then collapsed
// everything the build had just produced, behind headings the user had never opened.
//
// Measured on production, 1 September 2026, on two ideas built that day: DIAGNOSIS `visited`,
// GUIDING_POLICY `visited`, both collapsed, both holding fields awaiting the user. That is why
// 25-O's causes commentary (generated, 2.3p of gemini-2.5-pro, complete in the database) appeared
// nowhere, and why 25-P's guiding-policy screen never mounted — and, because that screen was
// where the numbering happened, why a real idea's candidates had no numbers.
//
// ⚠ A COLLAPSED PAGE UNMOUNTS ITS FIELDS rather than hiding them, so "collapsed" here means
// "does not exist on the page", not "is a scroll away". That is what makes this a correctness
// rule and not a styling one.
// ─────────────────────────────────────────────────────────────────────────────

/** The four statuses `computeCanonicalState` gives a page. */
export type PageStatus = 'active' | 'complete' | 'visited' | 'locked'

/**
 * ⚠ FINISHED COLLAPSES. Everything else opens.
 *
 * `complete` means every field on the page is terminal — accepted or skipped — so there is
 * nothing on it waiting for anybody. A page holding a proposal the user has not answered is not
 * finished, whatever wrote the proposal.
 *
 * ⚠ THE USER OVERRULES THIS EITHER WAY. 25-N §1c's two override sets are untouched: a finished
 * stage can be expanded and an open one collapsed, and the choice sticks for the session. This
 * decides only where a page starts.
 */
export function collapsedByDefault(status: PageStatus | string): boolean {
  return status === 'complete'
}
