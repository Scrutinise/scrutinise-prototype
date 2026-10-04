// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-G — TWO DOCUMENTS THAT LEAVE THE BUILDING.
//
// The briefing, the meeting pack and the proposal are documents the user READS. These two are
// documents the user SENDS — to a committee, or to somebody with two minutes — and they travel
// without the person who made them. Named here, one constant each, the same pattern
// `initial-background-name.ts` set: one file, no server imports, read by the client card
// (`DocumentExports.tsx`) and by the server builders alike, so the name on the tab, the name on
// the card and the title inside the file cannot drift apart.
// ─────────────────────────────────────────────────────────────────────────────

export const COMMITTEE_EVIDENCE_NAME = 'Written Evidence to a Committee'

export const COMMITTEE_EVIDENCE_BLURB =
  'A submission in the shape a select committee expects — who is submitting, the problem, the '
  + 'proposed approach, the objections and the response to them, what is still unresolved, and the '
  + 'sources. A template to adapt to a specific inquiry, not a ready-to-send form. A Word document '
  + 'and a PDF.'

/**
 * §2c — said on the document itself, not only in a report nobody reading the file sees. The
 * corpus holds PUBLISHED evidence, which by definition is evidence to inquiries that have
 * already happened; nothing in this platform tracks which inquiries are currently open. First
 * block after the beta/scrutiny notices, before the submission itself.
 */
export const COMMITTEE_EVIDENCE_OPENING =
  'This is not addressed to a specific inquiry. Written evidence is submitted against one '
  + 'inquiry’s own terms of reference, and this platform has no way to identify which inquiries '
  + 'are currently open — find the right one and its terms of reference on the committee’s own '
  + 'page, then adapt what follows to answer them directly. Formatted against real submissions in '
  + 'the corpus and current published guidance; check the specific committee’s own requirements '
  + 'before sending, since they vary and change.'

export const ONE_PAGE_SUMMARY_NAME = 'One-Page Summary'

export const ONE_PAGE_SUMMARY_BLURB =
  'For a minister, an MP between meetings, or a journalist — two minutes, one page, the case for '
  + 'and the strongest case against, never separated from the caveats that qualify them. A Word '
  + 'document and a PDF.'

/**
 * 26-H — REMOVED: `FIRST_SCRUTINY_NOTE` and `isFirstScrutiny(idea.stage)`. "First Scrutiny" is a REVIEW STATUS, not a stage,
 * and `Idea.stage` reaching 3 is not a review (nothing recorded one — BRIEF_26H §5b). The stage, the review status,
 * the seven stages and the caveat now open every document from `stage-banner.ts` (`withStageBanner`).
 */
