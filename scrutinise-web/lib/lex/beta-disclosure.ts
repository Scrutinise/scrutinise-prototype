// ─────────────────────────────────────────────────────────────────────────────
// 25-V §11 — WHAT THE PRODUCT SAYS ABOUT ITSELF WHILE IT IS IN PILOT.
//
// Charlie's standing instruction: every defect is either **fixed permanently** — it cannot occur
// in this or any future build, for any user — or **disclosed honestly**, so a user meets it having
// been told. ⚠ Cleaning one document by hand is neither, and is forbidden: *"this document exists
// to show people what Scrutinise does, and a demo cleaned of faults that users then hit is worse
// than no demo."*
//
// ⚠⚠ THE SCOPE IS DELIBERATELY NARROW, AND §11c IS EXPLICIT ABOUT WHY. This covers a search that
// returns material which turns out not to bear on the proposal — a wide net, which is a property
// of retrieval and will not stop being true. It does NOT cover a citation labelled as one document
// that opens another. That is a wrong label, not a wide net.
//
// ⚠⚠ AND THAT ONE IS FIXED, SO THE HARSHER FALLBACK IS NOT NEEDED. Charlie offered it —
// *"Citation labels are generated and have not all been verified against the source. Open the link
// before relying on any citation."* — against the possibility that §1 could not be closed in time.
// It was: `committeeUrl` can no longer emit the address that caused it, 37 links were rewritten
// from Parliament's own API, the 6 with no published address had the link removed and the citation
// kept, and all 141 checkable citations on the pilot proposal name the document they claim.
// Printing that sentence now would disclose a defect that no longer exists and teach a reader to
// distrust sound work.
//
// ⚠ ONE MODULE BECAUSE THE WORDING MUST NOT DRIFT. It appears on the research surfaces, in four
// generated documents and in the welcome email; four copies is three that will be updated late.
// ─────────────────────────────────────────────────────────────────────────────

/** The short marker, for a header or a document footer. */
export const BETA_MARKER = 'Beta'

/**
 * ⚠ WHAT "BETA" MEANS HERE, SAID ONCE. A badge on its own is decoration — the reader has to know
 * what is being claimed and what is not.
 */
export const BETA_TOOLTIP =
  'Scrutinise is in pilot. The research and drafting work, and are still being improved; '
  + 'check anything you intend to rely on.'

/**
 * §11b — the evidence-base disclosure. **Charlie's wording, 2 September 2026, used verbatim.**
 *
 * ⚠ ITS THIRD SENTENCE IS THE ONE THAT MATTERS AND IS EASIEST TO LOSE. "Refining and focusing the
 * evidence base is the proposer's first task" turns the wide net from an apology into an
 * instruction — it tells the user what to DO about what they are seeing, which no amount of
 * hedging does.
 *
 * ⚠⚠ AND IT DOES NOT SAY "SOME CITATIONS MAY BE WRONG". They may not: every one of the 141
 * citations that could be checked on the pilot proposal named the document it said it did.
 */
export const EVIDENCE_DISCLOSURE =
  'Beta. This evidence base is assembled by automated search. Some results will be off-topic — '
  + 'a word can match in a very different context — and we would rather include too much than miss '
  + 'something important. Refining and focusing the evidence base is the proposer’s first task.'

/**
 * §11d — the pilot line for the welcome email. **Charlie's wording, used verbatim.**
 *
 * ⚠ IT ASKS FOR SOMETHING RATHER THAN WARNING ABOUT SOMETHING. "Telling us where it falls short is
 * the single most useful thing you can do" is what makes a rough edge a contribution instead of a
 * disappointment, and it is why this does not read as a disclaimer.
 */
export const PILOT_WELCOME_LINE =
  'Scrutinise is in pilot. You’re among the first people to use it, and it will have rough '
  + 'edges. Telling us where it falls short is the single most useful thing you can do — that’s '
  + 'what the pilot is for.'
