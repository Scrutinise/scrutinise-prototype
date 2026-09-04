// ─────────────────────────────────────────────────────────────────────────────────────────
// 26-A §3 (CHARLIE'S DECISION 70) — WHAT IS ACTUALLY BEHIND THE POSITIONS SECTION.
//
// ⚠⚠ WHAT PRODUCED IT. The heading reads *"Key people and groups likely to support or
// oppose"*, and on 3 September exactly ONE item in the entire database was filed under it —
// extracted by the file reader from a document **Charlie had uploaded himself**, on 30 August,
// by no Lex pass at all. So the section promised an assessment of who is for and against and
// handed the proposer back their own sentence.
//
// ⚠⚠ A READER MUST NEVER MISTAKE THE PROPOSER'S OWN WORDS FOR RESEARCH (§3a). That is the
// whole of this file. It is not a hedge about quality; it is an attribution.
//
// ⚠ IT IS COMPUTED, NEVER WRITTEN DOWN. `NO_PRODUCER_NOTE.POSITIONS` is the cautionary tale
// sitting next door: it says *"No pass writes findings under this heading yet"*, which was
// true when it was typed, stayed literally true (no *pass* does — a route and a script file
// them), and became misleading the day positions started appearing under it. A sentence with
// a number in it that is not read from the data is a sentence that will outlive its own truth.
//
// ⚠ §3c — PERMANENT, AND FOR EVERY USER AND EVERY IDEA. Not a note for one report. Which is
// why it is a function of the rows rather than a paragraph in one renderer.
//
// ⚠ ONE DEFINITION, THREE SURFACES. The panel and all three documents import this. Two copies
// of a caveat is one copy that will be updated — the fault this thread has now found six times.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** The only thing the caveat needs to know, from wherever the caller already holds the rows. */
export interface PositionsTally {
  /** Everything filed under the heading, whatever its origin. */
  total: number
  /** Of those, how many were extracted from a document or link the PROPOSER supplied. */
  fromProposerMaterial: number
}

/**
 * Count a set of rows carrying a `sourceType`, so no caller writes the predicate twice.
 *
 * ⚠ `USER_DOCUMENT` is the marker the extraction writes (`user-material.ts`) and is the same
 * string `evidence-scope.ts` exempts from the build's version filter. Restating it as a
 * comparison at each call site is how two surfaces come to disagree about whose a source is.
 */
export const PROPOSER_SOURCE_TYPE = 'USER_DOCUMENT'

/**
 * ⚠ TWO SURFACES CARRY THE SAME FACT UNDER TWO NAMES, so this accepts both rather than making
 * one of them convert. The evidence layer stores `sourceType`; the question panel derives
 * `yourSource` from the pass key that wrote the row (`isUserMaterialPass`). Either answers
 * "is this the proposer's own material", and a caller that had to translate would be the place
 * the two definitions drifted apart.
 */
export function tallyPositions(
  rows: Array<{ sourceType?: string | null; yourSource?: boolean }>,
): PositionsTally {
  return {
    total: rows.length,
    fromProposerMaterial: rows.filter(
      (r) => r.yourSource === true || r.sourceType === PROPOSER_SOURCE_TYPE,
    ).length,
  }
}

/**
 * The caveat, in one paragraph, from the tally.
 *
 * ⚠ IT SAYS WHAT IS THERE, INCLUDING WHEN NOTHING IS. An empty section with no sentence reads
 * as "nobody has taken a position", which is a claim about the world; "we have found nothing
 * and here is what that does and does not mean" is a claim about us, and is the true one.
 *
 * ⚠ IT NAMES THE PROPOSER'S OWN MATERIAL EVEN WHEN IT IS ALL OF IT — especially then. The
 * degenerate case that produced this file is one item, entirely the proposer's, under a
 * heading promising research.
 */
export function positionsCaveat(t: PositionsTally): string {
  const { total, fromProposerMaterial: own } = t
  const researched = total - own

  if (total === 0) {
    return 'Nothing has been filed under this heading for this proposal. That is a statement '
      + 'about what we have found, not about whether anybody has taken a position.'
  }

  const items = `${total} item${total === 1 ? '' : 's'}`
  if (own === 0) {
    return `${items} here, drawn from the public record and from research. Nothing under this `
      + 'heading is a forecast of how anybody will vote in future.'
  }
  if (researched === 0) {
    // ⚠ THE CASE THIS FILE EXISTS FOR. Everything under a heading promising an assessment of
    // who is for and against came from the proposer's own documents.
    return `${items} here, and ${total === 1 ? 'it was' : 'all of them were'} taken from `
      + `${total === 1 ? 'a document' : 'documents'} you supplied yourself — not from research `
      + 'we have done. Nothing here is our assessment of who is for or against this proposal.'
  }
  return `${items} here: ${researched} from the public record and from research, and ${own} `
    + `taken from ${own === 1 ? 'a document' : 'documents'} you supplied yourself, marked as `
    + 'yours. Nothing under this heading is a forecast of how anybody will vote in future.'
}
