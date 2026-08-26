// term-coverage.ts — HOW MUCH OF THE QUERY IS VISIBLE IN A RESULT. One definition, several readers.
//
// ⚠⚠ THIS FILE IS `merge-coverage.ts` WITHOUT THE MERGE. S13 §2 built a merge arm around this
// signal (`LEX_MERGE_COVERAGE`); S14 §2 replaced that arm and the flag is DELETED rather than
// defaulted off — a flag that survives its own replacement is how a dead branch gets re-enabled by
// somebody reading an old note. The SIGNAL survives because three other things read it: the S14
// judged merge's relevance gate, `scripts/verify-s13-passage.ts` (the §3 snippet number) and
// `scripts/s13-rekey-candidates.ts`. It is here rather than in `merge-judged.ts` so that a reader
// of the gate is not importing a merge, and vice versa.
//
// ── WHAT IT MEASURES, AND WHAT IT IS NOT. The fraction of the QUERY's distinct content terms that
// appear in what a result DISPLAYS. It is a property of the (query, document) pair, computed the
// same way for every stream, and it depends on no index statistic — which is what makes it one of
// the only two quantities in this system that are comparable ACROSS streams.
//
// ⚠ It is a COVERAGE HEURISTIC, NOT A RELEVANCE MODEL, and the difference has been measured rather
// than asserted. On GOLD V2 Q9 the two densest windows of the keyed speech are about the
// CONSEQUENCES of forced prepayment meters, while the paragraph answering WHY is elsewhere. Term
// density and "answers the question" are different things. That is precisely why S14 uses this as
// a GATE — a bar a result must clear to occupy a slot — and a model for the ORDER.

import type { SearchResult } from './page1-config'

/** ⚠ Kept in step with `scripts/ingest/search/passage.ts::passageTerms` — the same stopword
 *  problem, found by that module's own check: without this, "the" scores every document in every
 *  stream identically and any reallocation becomes a coin toss wearing a number. That check
 *  reported `matched: true` on a document containing nothing of the query, with a passage centred
 *  on a definite article, and the §3 verification figure would have come back near 100% for a
 *  system that had located nothing. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one',
  'our', 'out', 'has', 'have', 'had', 'his', 'she', 'him', 'they', 'them', 'their', 'there',
  'this', 'that', 'these', 'those', 'with', 'from', 'into', 'onto', 'upon', 'over', 'under',
  'about', 'after', 'before', 'when', 'what', 'which', 'who', 'whom', 'whose', 'why', 'how',
  'been', 'being', 'were', 'will', 'would', 'shall', 'should', 'could', 'may', 'might', 'must',
  'does', 'did', 'done', 'doing', 'its', 'than', 'then', 'also', 'such', 'some', 'more',
  'most', 'much', 'many', 'other', 'others', 'each', 'every', 'both', 'own', 'same', 'very',
  'just', 'only', 'still', 'yet', 'get', 'got', 'make', 'made', 'say', 'said', 'says',
])

/** The query's content terms. Falls back to the unfiltered token list when EVERY token is a
 *  stopword — an empty term list would score every document 0 and make the signal invisible
 *  rather than absent. */
export function contentTerms(query: string): string[] {
  const all = [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3))]
  const content = all.filter((t) => !STOPWORDS.has(t))
  return content.length ? content : all
}

/**
 * Distinct query terms present in what we can see of the document, as a fraction of the query.
 *
 * ⚠ IT IS A FRACTION, NOT A COUNT, AND THAT IS THE LENGTH-BIAS GUARD. A raw count of matched terms
 * would favour long documents purely for containing more words. Capping at the number of DISTINCT
 * query terms removes that: a 30,000-word speech and a 200-word regulation both top out at 1.0,
 * and neither can outscore the other by being longer.
 *
 * ⚠ Computed over title + citation + snippet, which is all a merge can see. With S13 §3 deployed
 * the snippet is the MATCHED PASSAGE rather than the head of the document, which is what makes
 * this worth anything — on the old services it was the first 300 characters and would have scored
 * a long document 0 for terms it definitely contains.
 */
export function coverageOf(r: Pick<SearchResult, 'title' | 'citation' | 'snippet'>, terms: string[]): number {
  if (!terms.length) return 0
  const hay = `${r.title ?? ''} ${r.citation ?? ''} ${r.snippet ?? ''}`.toLowerCase()
  let hits = 0
  for (const t of terms) {
    // Word-PREFIX match, as in passage.ts: `evict` finds `evicted`. Never mid-word — `art` must
    // not match `start`, or the score would rise on documents that contain nothing of the query.
    let i = 0, found = false
    for (;;) {
      const at = hay.indexOf(t, i)
      if (at < 0) break
      const before = at === 0 ? ' ' : hay[at - 1]
      if (!/[a-z0-9]/.test(before)) { found = true; break }
      i = at + 1
    }
    if (found) hits++
  }
  return hits / terms.length
}

/**
 * ⚠ THE SIGNAL CHECK, kept with the signal. `snippetMatched === undefined` on EVERY result means
 * the retrieval services predate S13 §3 and the snippet is still the head of the document.
 * Scoring coverage on that would measure how often a query term happens to appear in a document's
 * first 300 characters, report it as a ranking decision, and look exactly like a null result.
 * CLAUDE.md §18's corollary: OFF, FAILED and NOT-MEASURABLE must not look identical.
 */
export function coverageSignalPresent(perStream: SearchResult[][]): boolean {
  return perStream.some((s) => s.some((r) => r.snippetMatched !== undefined))
}
