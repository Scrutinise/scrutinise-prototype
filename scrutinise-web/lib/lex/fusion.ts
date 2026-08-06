// fusion.ts — weighted reciprocal-rank fusion, in ONE place.
//
// Extracted from search-gateway.ts on 2026-08-06 because there are now two callers: the
// gateway's legacy whole-query fusion (step 4b) and the per-stream fusion the legislation
// stream uses (query-router.ts). Two copies of a ranking formula is how two callers quietly
// start ranking differently — and the whole point of the per-stream work is that only ONE
// stream's behaviour changes, which is unprovable if the formula itself has forked.
//
// THE FORMULA (docs/FUSION_REPORT.md):
//   score = w/(k + rank_vec) + (1−w)/(k + rank_bm25),  w = 0.5, k = 60
//
// THE WEIGHT IS 0.5, MEASURED — changed from 0.7 on 2026-08-06.
// Evidence: docs/GOLD_TEST_08_fusion_weight_decision.md, computed by
// scripts/ingest/search/weight-decision.ts from a full 8-point sweep
// [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1] run separately over all five streams (38 questions),
// against the CURRENT index and with Charlie's answer-key validation pass (6 Aug) landed.
//
// 0.5 is not a compromise between streams. It is the best-or-joint-best weight in EVERY one of
// the five, and the outright winner on both the per-stream and per-query averages, so adopting
// it as a single default trades nothing away and no per-stream weight table is warranted.
//   legislation  55.7% → 63.0%  (+7.3pp)
//   debates      80.0% → 95.0%  (+15.0pp — at 0.7, fusion was 10pp WORSE than BM25 alone)
//   caselaw / guidance / committees   unchanged, already at ceiling
//
// WHY THE OLD 0.7 WAS WRONG, since the reasoning it replaces was not silly. 0.7 was tuned on
// the PILOT SUBSET, where it beat equal-weight RRF by 3.5pp, and the note that "equal weight is
// NOT the safe default — it drags a strong vector model down" was true of that subset. It did
// not survive contact with the whole corpus or with per-stream scoping: on debates, 0.7 is the
// single worst fusion weight tested. The lesson is about the measurement, not the number — a
// weight tuned on a subset and then carried was always going to need re-deriving, which is why
// GOLD_TEST_08 is regenerable from sidecars rather than transcribed into prose.
//
// Still an offline recall@20 result. It says nothing about precision, latency or cost, and
// LEX_SEARCH_VECTOR remains OFF by default regardless.

import type { SearchResult } from './page1-config'

export const RRF_K = parseInt(process.env.LEX_FUSION_RRF_K ?? '60', 10)
export const VECTOR_WEIGHT = parseFloat(process.env.LEX_FUSION_VECTOR_WEIGHT ?? '0.5')

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
