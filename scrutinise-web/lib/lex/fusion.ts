// fusion.ts — weighted reciprocal-rank fusion, in ONE place.
//
// Extracted from search-gateway.ts on 2026-08-06 because there are now two callers: the
// gateway's legacy whole-query fusion (step 4b) and the per-stream fusion the legislation
// stream uses (query-router.ts). Two copies of a ranking formula is how two callers quietly
// start ranking differently — and the whole point of the per-stream work is that only ONE
// stream's behaviour changes, which is unprovable if the formula itself has forked.
//
// THE FORMULA (docs/FUSION_REPORT.md):
//   score = w/(k + rank_vec) + (1−w)/(k + rank_bm25),  w = 0.7, k = 60
// Tuned on the PILOT SUBSET: 70/30 beat naive equal-weight RRF (+3.5pp), vector-alone
// (+1.9pp) and BM25 (+19.5pp) for gemini, and is the coexistence point where the vector
// concept-win survives while the BM25 citation resolver still pins exact citations
// (archetype A stays 100%). Equal weight is NOT the safe default — the pilot showed it drags
// a strong vector model down.
//
// ⚠ THE WEIGHT IS CURRENTLY UNVALIDATED AGAINST THE LIVE INDEX. 0.7 was measured against an
// index that has since changed twice: the 4 Aug coverage fix (1,191,345 rows merged) and the
// 5 Aug dedup/orphan removal (19,161 rows removed, which changed BM25 document frequencies
// and therefore every BM25 rank this formula consumes). Re-sweeping the weight is deliberately
// OUT of scope until Charlie's answer-key validation pass lands — see docs/SPRINT.md. Treat
// 0.7 as a carried-forward placeholder, not a measured value, wherever it appears.

import type { SearchResult } from './page1-config'

export const RRF_K = parseInt(process.env.LEX_FUSION_RRF_K ?? '60', 10)
export const VECTOR_WEIGHT = parseFloat(process.env.LEX_FUSION_VECTOR_WEIGHT ?? '0.7')

/**
 * Fuse a dense ranking with a BM25 ranking. Order within each input IS the rank — callers
 * must pass them already sorted, which both retrieval paths do.
 *
 * Ties are resolved by the incoming order of the fused map (vector first), which is stable
 * across runs for identical inputs; nothing here depends on Map iteration being sorted.
 */
export function fuseWeightedRrf(
  vec: SearchResult[],
  bm25: SearchResult[],
  weight: number = VECTOR_WEIGHT,
  k: number = RRF_K,
): SearchResult[] {
  const scores = new Map<string, number>()
  const byId = new Map<string, SearchResult>()
  vec.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + weight / (k + i + 1))
    if (!byId.has(r.id)) byId.set(r.id, r)
  })
  bm25.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + (1 - weight) / (k + i + 1))
    if (!byId.has(r.id)) byId.set(r.id, r)
  })
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...byId.get(id)!, score }))
}
