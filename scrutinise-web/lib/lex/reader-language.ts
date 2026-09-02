// ─────────────────────────────────────────────────────────────────────────────
// 25-V §3 — THE WORDS AN OUTWARD DOCUMENT USES, IN ONE PLACE.
//
// §3a: *"`KERNEL TEST FAILED` in capitals, thirty-two times, is the loudest thing on the page and
// it is our test apparatus talking to itself. Rename to language a reader can use — what was
// tested, what the answer was, and what it means for the proposal."*
//
// ⚠⚠ THESE ARE NOT COSMETIC. A stranger meeting "KERNEL TEST FAILED" thirty-two times reads it as
// the software reporting its own errors, and stops reading the sentence after it — which is the
// sentence that says what is actually weak about the proposal. The content was always good; the
// label was throwing it away.
//
// ⚠ ONE MODULE, SO THE DOCUMENT AND THE SCREEN CANNOT DRIFT. These strings are written in two
// passes and read in four documents; a copy in each is a copy that will be updated in one.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A model-generated fork key — `guidingPolicy:instrument`, `diagnosis:rootCause` — rendered for a
 * reader.
 *
 * ⚠ IT TRANSFORMS, IT DOES NOT TRANSLATE. There is no label map for these: the keys are composed
 * by the model at build time and 15 distinct ones already exist, including
 * `policy:approach:leverageExistingPowers`. Inventing prose for each would be guessing at what the
 * model meant. Splitting the path and un-camel-casing it is a faithful rendering of what is
 * actually stored, and it stays correct for a key nobody has seen yet.
 */
export function readableForkKey(key: string): string {
  return key
    .split(':')
    .map((part) => part
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .toLowerCase())
    .filter(Boolean)
    .join(' — ')
}

/**
 * The heading for a kernel test the proposal does not yet meet.
 *
 * ⚠ IT SAYS WHAT WAS TESTED AND WHAT IT MEANS, which "KERNEL TEST FAILED" did not. The word
 * "kernel" is ours (docs/CLAUDE.md §4 keeps it for the product's own vocabulary, where the user
 * has been taught it); a think tank reading a printed proposal has not been taught it.
 *
 * ⚠ AND IT IS NOT SOFTENED. "Does not yet meet" is the honest verdict — the test genuinely was
 * not met. What changes is that a reader can tell it is a judgement about the STRATEGY rather
 * than an error in the software.
 */
export function strategyTestHeading(test: string): string {
  return `The strategy does not yet meet this test — ${test}.`
}

/** The heading for a fork the critique thinks may have been taken the wrong way. */
export function forkDoubtHeading(forkKey: string): string {
  return `A choice that may have been made the wrong way, on ${readableForkKey(forkKey)}`
}

/**
 * How an action that Lex drafted is attributed in an outward document.
 *
 * ⚠ "Drafted by Lex from the toolkit" named our assistant and our internal mechanism list to a
 * reader who knows neither, and read as an admission that the document was assembled. The fact
 * worth keeping is the PROVENANCE — this wording was not the proposer's own — and that is what a
 * reader needs in order to weigh it.
 */
export const DRAFTED_ATTRIBUTION = 'Drafted during analysis rather than proposed by the author.'
