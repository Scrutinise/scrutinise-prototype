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
 * ══ CHARLIE'S DECISION, 25-R ADDENDUM A1 — AND IT IS NEITHER OPTION §6 OFFERED ══════════
 *
 * 25-R opened these sections, because a build marking every page `visited` was hiding
 * everything the build had made. §6 put the consequence to Charlie: after a build, DIAGNOSIS,
 * GUIDING_POLICY and COHERENT_ACTIONS would all open, and the middle panel would be very long.
 *
 * **A1: "After a build, all kernel sections are collapsed and tidy. Do not leave them open.
 * Instead, the build's completion is announced through the worklist."**
 *
 * ⚠⚠ SO THE COLLAPSE IS RESTORED AND THE ENTRY POINT MOVES. The panel is not the way in; the
 * worklist is — its first item after a build says the diagnosis is ready and asks the question
 * that starts the reading (see `WORKLIST_PARTS` / `read:diagnosis`). A tidy panel with a
 * worklist pointing into it is a better answer than a long panel that announces itself by being
 * long, and it is Charlie's call to make.
 *
 * ⚠⚠ AND THE ORIGINAL DEFECT MUST NOT RETURN (A4). Collapsing is only safe because opening a
 * section MOUNTS its contents and fetches them — measured live in production on 1 September:
 * shut → the fields are unmounted and the commentary is absent; re-opened → it fetches and
 * draws again. **A section that is shut must be shut, not absent**: the heading, its count and
 * its toggle all render while collapsed, so there is something to open.
 *
 * ⚠ `visited` IS BACK IN THE RULE, AND THIS TIME IT IS DELIBERATE RATHER THAN INHERITED. It
 * means "a build has written here", which is exactly the set of sections A1 wants tidy.
 */
export function collapsedByDefault(
  status: PageStatus | string,
  opts: { freshlyOpened?: boolean } = {},
): boolean {
  // ══ ⚠⚠ 25-Z §2a — A FRESHLY OPENED PAGE COLLAPSES EVERYTHING, INCLUDING THE ACTIVE ONE ══
  //
  // §2a asks why 25-R's addendum rule "did not hold". **It held.** A1 says a finished stage
  // opens collapsed and the one you are working in opens expanded, and that is exactly what
  // happened: `Idea.lexPage` pointed at COHERENT_ACTIONS, `computeCanonicalState` therefore
  // gave that page `active` — and a page is EITHER active OR visited, never both, because the
  // status is a single value and active wins. So three sections collapsed and the fourth,
  // the one the pointer named, expanded.
  //
  // ⚠⚠ THE GAP IS BETWEEN A1'S INTENT AND THE STATUS MODEL, NOT A BUG IN EITHER. A1 said
  // "after a build, all kernel sections are collapsed and tidy" — but a build does not clear
  // the page pointer, so there is always one page called `active` whether or not the user is
  // working in it. `lexPage` records where they got to, and it was being read as where they
  // are. On a page the user has only just opened, those are different things.
  //
  // ⚠ SO THE ANSWER IS A SECOND FACT, NOT A SECOND RULE. Nothing about the status rule
  // changes; it is asked a narrower question — *has the user done anything on this page yet?*
  // Until they have, everything is shut. The moment they touch a section the rule below
  // resumes exactly as written, so a user working in Coherent Actions still finds it open on
  // every subsequent render.
  if (opts.freshlyOpened) return true
  return status === 'complete' || status === 'visited'
}
