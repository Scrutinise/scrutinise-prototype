// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §3 — how the orientation is written into the background briefing.
//
// A pure module on purpose. It carries the sprint's single most important labelling
// decision — that the domain-transfer answer is REASONING and says so — and a rule that
// can only be checked by reading the source is a rule that gets checked once. Kept free
// of prisma and the search gateway so `check:build-25a` can execute it offline.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from './page1-config'

/**
 * The Initial Background document body.
 *
 * ⚠ THE REASONING LABEL IS NOT DECORATION. No corpus can answer "who else has this
 * problem, outside this sector" — that is exactly why §25.4 calls it the highest-yield
 * generic question we have, and exactly why presenting it as retrieval would be a
 * fabricated grounding claim. The label sits ABOVE the answer, not in a footnote.
 *
 * ⚠ AND A FAILED SEARCH SAYS SO. "The search didn't run" and "the record has nothing to
 * say" are different sentences to someone building a case for Parliament (§19-C Task 1a).
 */
export function briefingBody(
  terrain: string,
  domainTransfer: string,
  results: SearchResult[],
  searchFailed: boolean,
): string {
  return [
    '## What the record holds',
    searchFailed
      ? '⚠ At least one corpus search did not complete, so this is a partial picture. It is not a ' +
        'statement that there is nothing else there.'
      : '',
    terrain,
    '',
    '## Who else has solved a problem like this',
    '*Reasoning, not retrieval — this comes from Lex’s general knowledge, not from the corpus, and is ' +
      'worth checking.*',
    '',
    domainTransfer,
    '',
    '## Sources read',
    results.length
      ? results.slice(0, 12).map((r) => `- ${r.citation} — ${r.title}`).join('\n')
      : '_Nothing was returned by the corpus search._',
  ].filter(Boolean).join('\n')
}
