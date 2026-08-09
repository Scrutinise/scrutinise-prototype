// score-scope.ts — scores are only comparable to scores from the SAME scorer.
//
// WHY THIS FILE EXISTS. `fuseWeightedRrf` OVERWRITES `score` with a reciprocal-rank value
// (w/(k+rank) ≈ 0.008–0.016) while an unfused stream carries raw BM25 (≈ 5–25). Three orders
// of magnitude apart, for reasons that have nothing to do with relevance. So the moment
// LEX_VECTOR_STREAMS names any stream, ANY list that mixes a fused stream with an unfused one
// and sorts it by `score` puts every fused hit below every unfused hit — and the panel's
// 20-cap then clips the fused stream out of the answer entirely. That was live in
// `groupForPanel` (search-stub.ts) until 2026-08-09; interleave.ts had recorded it, and Stage
// 2C ("turn per-stream vector on for the remaining four streams") is exactly the action that
// detonates it.
//
// THE FIX WAS A DELETION, NOT A NORMALISATION. groupForPanel stopped re-sorting: the list
// arriving from the routed path is already stream-balanced by construction (interleave.ts),
// so a cross-stream ordering was never needed there. A min-max or z-score normalisation across
// streams would produce numbers that LOOK comparable and are not — the distributions come from
// different indexes and, after fusion, from a different scoring function altogether. That is
// the same false precision wearing a more convincing face. A genuine cross-stream ordering
// arrives with the reranker, which scores documents against the QUERY rather than against
// their own corpus, and only if the pairwise-preference baseline rewards it.
//
// WHAT THIS FILE ADDS is the thing that makes the class unrepeatable rather than the instance
// fixed: every SearchResult now carries the identity of the scorer that produced its `score`,
// and the only sanctioned way to sort by `score` asserts that it is looking at exactly one
// scorer. `scripts/check-score-scope.ts` enforces both halves — the runtime assertion (proven
// able to FAIL before it is trusted to pass) and the SOURCE invariant that no other file
// sorts by score behind the guard's back.

/**
 * Who produced the `score` on a result.
 *
 * `bm25`   — raw BM25 from the FTS service (fts-search.ts). Length- and corpus-normalised,
 *            so it is not even comparable between two DIFFERENT indexes; within one stream's
 *            ranking it is fine, which is all it is ever used for.
 * `vector` — cosine similarity from the dense service (vector-search.ts), 0..1.
 * `rrf`    — weighted reciprocal-rank fusion (fusion.ts). A RANK statistic, not a relevance
 *            score; ≈ 0.008–0.016 whatever the inputs looked like.
 * `stub`   — the hand-written dev fixtures (search-stub.ts). Called out rather than lumped in
 *            with bm25 because "the stub answered" is a thing worth being able to see.
 *
 * Deliberately NOT a boolean `fused`. `vector` and `bm25` are as incomparable to each other as
 * either is to `rrf`, and a two-valued flag would have said they were the same thing.
 */
export type ScorerId = 'bm25' | 'vector' | 'rrf' | 'stub'

/** The minimum shape this module needs. Structural so it never imports page1-config (which
 *  imports ScorerId from here — a nominal dependency would be a cycle). */
export interface Scored {
  score: number
  scorer: ScorerId
}

/** The distinct scorers present, in first-appearance order. */
export function scorersIn(results: readonly Scored[]): ScorerId[] {
  const seen: ScorerId[] = []
  for (const r of results) if (!seen.includes(r.scorer)) seen.push(r.scorer)
  return seen
}

/**
 * Throw unless every result was scored by the same scorer.
 *
 * THROWS, rather than logging and continuing. A mixed-scorer sort does not fail loudly on its
 * own — it produces a confident, plausible, wrong ordering, and the only visible symptom is a
 * whole stream quietly missing from an answer. That is the failure-wearing-another-face shape
 * CLAUDE.md §18 is about. An empty or single-element list is trivially single-scorer.
 */
export function assertSingleScorer(results: readonly Scored[], label: string): void {
  const scorers = scorersIn(results)
  if (scorers.length <= 1) return
  throw new Error(
    `[score-scope] ${label} tried to compare scores across ${scorers.length} scorers ` +
    `(${scorers.join(', ')}). Scores from different scorers are not comparable — an RRF score ` +
    `(~0.01) always loses to a BM25 score (~5–25) regardless of relevance. Order the list by ` +
    `stream (lib/lex/interleave.ts) or rerank it against the query; do not normalise.`,
  )
}

/**
 * The ONE sanctioned sort-by-score. Descending, non-mutating, stable (Array#sort is stable in
 * every engine we run on), so equal scores keep their incoming — i.e. stream-balanced — order.
 *
 * Anything that wants results in score order goes through here. check:score-scope fails the
 * build if a `.sort()` comparing `.score` appears anywhere else, because a bare comparator is
 * exactly how this class came back the first time.
 */
export function sortByScore<T extends Scored>(results: readonly T[], label: string): T[] {
  assertSingleScorer(results, label)
  return [...results].sort((a, b) => b.score - a.score)
}
