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
import { flagEnabled } from '@/lib/env-flags'

export const RRF_K = parseInt(process.env.LEX_FUSION_RRF_K ?? '60', 10)
export const VECTOR_WEIGHT = parseFloat(process.env.LEX_FUSION_VECTOR_WEIGHT ?? '0.5')

// ═════════════════════════════════════════════════════════════════════════════════════════════
// S10 §3 — THE DIAL. A PER-STREAM FUSION WEIGHT, INSTEAD OF ONE NUMBER FOR EVERY COLLECTION.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// THE PROBLEM THIS REPLACES. Until now there were exactly two settings available to a stream:
// listed in `LEX_VECTOR_STREAMS` (dense fused at 0.5) or not listed (no dense leg at all). All or
// nothing, for five collections that behave completely differently. Debates is large, rhetorical
// and usually contains the exact words a user types, so its keyword leg is already close to its
// best and a noisy dense leg can drag correct hits down the merged ranking; judgments and
// regulator guidance are the opposite, because users describe those in their own words. If that
// is right, debates never wanted vector OFF — it wanted a small share of it, and the binary choice
// is why it measured 15pp worse in S7.
//
// ⚠ DEFAULT IS TODAY'S BEHAVIOUR, EXACTLY. `LEX_FUSION_WEIGHTS` is a boolean capability flag,
// default OFF, and with it off `streamVectorWeight()` returns `VECTOR_WEIGHT` for every stream —
// the same 0.5 constant every caller already used. So this change is a no-op until a weight is
// deliberately set: nothing is widened before it is measured. `scripts/check-s10-fusion.ts`
// asserts the no-op property by comparing rankings, not by reading the code.
//
// ⚠ TWO VARIABLES, NOT ONE, AND THAT IS THE EXISTING PATTERN. The boolean gates the mechanism
// (and so is readable through `flagEnabled`, never a bare `=== 'true'` — a capitalised `TRUE` in
// Vercel silently disabled the router once for an unknown period); the string carries the values.
// Exactly as `LEX_SEARCH_VECTOR` gates and `LEX_VECTOR_STREAMS` configures. One boolean is also
// what a rollback wants: flipping the gate off restores 0.5 everywhere without anyone having to
// remember what the string used to say.
//
//     LEX_FUSION_WEIGHTS=false                          → 0.5 everywhere. The default.
//     LEX_FUSION_WEIGHTS=true
//     LEX_FUSION_STREAM_WEIGHTS=debates:0.2             → debates 0.2, every other stream 0.5.
//     LEX_FUSION_STREAM_WEIGHTS=debates:0.2,caselaw:0.65
//
// A weight is the DENSE share: 0 is keyword-only, 1 is vector-only, 0.5 is today.
//
// ⚠ A STREAM NOT IN `LEX_VECTOR_STREAMS` HAS NO DENSE LEG AND SO NO WEIGHT TO SET. Giving
// `debates:0.2` to a stream whose dense leg is switched off does nothing at all, silently — which
// is the "OFF and FAILED look identical" trap of docs/CLAUDE.md §18. `fusedStream` logs the
// resolved weight next to the stream name on every fused call so the two states are told apart in
// the log rather than inferred.

/** Read at CALL time, not module load — so a harness can alternate arms in one process against
 *  the same warm services, and so a platform env change takes effect on redeploy. Memoising would
 *  reintroduce exactly the problem `routerStreamsV2`'s note describes. */
function parseStreamWeights(raw: string | undefined): Map<string, number> {
  const out = new Map<string, number>()
  if (!raw || !raw.trim()) return out
  for (const pair of raw.split(',')) {
    const [name, value] = pair.split(':').map((s) => s.trim())
    if (!name || value === undefined) {
      console.warn(`[fusion] LEX_FUSION_STREAM_WEIGHTS entry ${JSON.stringify(pair)} is not name:weight — IGNORED`)
      continue
    }
    const w = Number(value)
    // ⚠ FAIL LOUD AND FALL BACK TO THE DEFAULT, never clamp silently. A weight of 1.5 is a typo,
    // and silently treating it as 1.0 would ship vector-only retrieval on a stream while the
    // dashboard said something else entirely.
    if (!Number.isFinite(w) || w < 0 || w > 1) {
      console.warn(`[fusion] LEX_FUSION_STREAM_WEIGHTS ${JSON.stringify(pair)} — ${JSON.stringify(value)} is not a weight in [0,1]; IGNORED, ${name} keeps the ${VECTOR_WEIGHT} default`)
      continue
    }
    out.set(name, w)
  }
  return out
}

/** The resolved dense share for one stream. `VECTOR_WEIGHT` unless the dial is on AND names it. */
export function streamVectorWeight(stream: string): number {
  if (!flagEnabled('LEX_FUSION_WEIGHTS')) return VECTOR_WEIGHT
  const w = parseStreamWeights(process.env.LEX_FUSION_STREAM_WEIGHTS).get(stream)
  return w === undefined ? VECTOR_WEIGHT : w
}

/** Every weight the dial currently resolves, for the boot line and for a harness to print beside
 *  its numbers. Reports the DEFAULT for a stream with no entry rather than omitting it, because
 *  "not configured" and "configured to 0.5" must not look different when they are not. */
export function resolvedFusionWeights(streams: string[]): string {
  const on = flagEnabled('LEX_FUSION_WEIGHTS')
  const parts = streams.map((s) => `${s}=${streamVectorWeight(s)}`)
  return `[fusion] dial=${on ? 'ON' : 'off(default 0.5 everywhere)'} ${parts.join(' ')}`
}

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
  // The sort is over the FUSED value computed here, not over any incoming `score` — one
  // scorer by construction, which is why it is not routed through score-scope's sortByScore.
  // The `scorer: 'rrf'` stamp is the load-bearing line: it is what makes the overwrite of
  // `score` visible to anything downstream that might later be tempted to sort a list holding
  // both these results and an unfused stream's. See lib/lex/score-scope.ts.
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...byId.get(id)!, score, scorer: 'rrf' as const }))
}
