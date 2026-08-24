// merge-coverage.ts — SEARCH S13 §2. THE ONE CROSS-STREAM SIGNAL THAT IS ACTUALLY COMPARABLE.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THE §1 AUDIT FOUND, AND WHY THIS IS THE FIX IT POINTS AT
//
// The merge does not compare scores at all — `interleaveStreams` round-robins and never sorts, so
// the brief's first question ("does a cross-stream comparison ever compare raw scores computed on
// different scales?") answers NO for the merge. What it does instead is give every routed stream
// an equal share, which makes the visible window a piece of arithmetic:
//
//     with S streams routed, a top-20 window can show at most the first floor(20/S) of EACH stream
//
// Measured over the 65 validated questions (docs/census/s13-merge-audit.json): `merged ≈
// in-stream × streams` holds for 29 of the 34 keys found and merged. That relation IS the
// round-robin. Of the 35 questions where retrieval found the answer in some stream's own list,
// **19 sit at or beyond their own question's ceiling** and 16 sit inside it — and 15 of those 16
// are shown. So the merge loses nothing it could have shown; what it loses is everything ranked
// deeper than an equal share allows. **12 of the 65 are recoverable by the merge alone** (the
// answer is inside its own stream's top 20 and outside the merged top 20).
//
// ── WHY NOT JUST SORT BY SCORE. Because that is the defect this codebase has already shipped
// twice. `fuseWeightedRrf` overwrites `score` with an RRF value (~0.01) while an unfused stream
// carries raw BM25 (~5–25); sorting those together puts every fused hit last for reasons that
// have nothing to do with relevance (lib/lex/score-scope.ts, and the `groupForPanel` sort deleted
// on 2026-08-09). Normalising them — min-max, z-score — produces numbers that LOOK comparable and
// are not, because the distributions come from different indexes and, after fusion, from a
// different scoring function altogether.
//
// ── WHAT IS COMPARABLE. How many of the QUERY's own content terms a document contains. It is a
// property of the (query, document) pair, computed the same way for every stream, and it depends
// on no index statistic. It is not a relevance model and this file does not pretend otherwise: it
// is term coverage, which is why the reranker stays the real answer to cross-stream ordering.
//
// ⚠⚠ THE FLOOR IS PRESERVED, AND THAT IS NON-NEGOTIABLE. `interleave.ts` exists because
// `perStream.flat()` let four of five routed streams be silently dropped, and Lex told a user the
// sources contained nothing from select committees while the committees stream had been routed,
// had returned hits and was being counted in the source panel. Reallocating slots by ANY quality
// signal can recreate that if a stream can reach zero, so the floor is applied first, exactly as
// today, and only the slots AFTER the floor are reallocated.
//
// ⚠⚠ IT REFUSES TO RUN WITHOUT THE SIGNAL, AND SAYS SO. The coverage signal needs the retrieval
// services to send `snippetMatched` (S13 §3). An older `fts-serve`/`vector-serve` build does not,
// and `undefined` would silently score every document 0 — every stream tying, the sort collapsing
// back to incoming order, and the arm reporting "no effect" while measuring nothing at all. That
// is CLAUDE.md §18's corollary: OFF and FAILED must not look identical. So `mergeByCoverage`
// returns `applied: false` with a reason when the signal is absent, and the caller logs it.

import type { SearchResult } from './page1-config'
import { interleaveWithReport, STREAM_FLOOR } from './interleave'
import { flagEnabled } from '@/lib/env-flags'

/** ON only when deliberately switched on. Read through `flagEnabled` — never a bare `=== 'true'`;
 *  a capitalised `TRUE` in Vercel silently disabled the router once for an unknown period. */
export function mergeCoverageEnabled(): boolean { return flagEnabled('LEX_MERGE_COVERAGE') }

/** The query's content terms. ⚠ Kept in step with `scripts/ingest/search/passage.ts::passageTerms`
 *  — the same stopword problem, found by that module's own check: without this, "the" scores every
 *  document in every stream identically and the reallocation becomes a coin toss wearing a number. */
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

export function contentTerms(query: string): string[] {
  const all = [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3))]
  const content = all.filter((t) => !STOPWORDS.has(t))
  return content.length ? content : all
}

/**
 * Distinct query terms present in what we can see of the document, as a fraction of the query.
 *
 * ⚠ IT IS A FRACTION, NOT A COUNT, AND THAT IS THE LENGTH-BIAS GUARD. §1.3 asked whether length is
 * the mechanism; the audit's answer was that the raw comparison is confounded by collection (a
 * legislation section is a few hundred words, a Hansard speech a few thousand) and that every
 * within-collection cell has n ≤ 5, so no trend is established either way. A raw count of matched
 * terms would nonetheless favour long documents purely for containing more words. Capping at the
 * number of DISTINCT query terms removes that: a 30,000-word speech and a 200-word regulation both
 * top out at 1.0, and neither can outscore the other by being longer.
 *
 * ⚠ Computed over title + citation + snippet, which is all the merge can see. With S13 §3 deployed
 * the snippet is the matched passage rather than the head of the document, which is exactly what
 * makes this signal worth anything — on the old services it was the first 300 characters and would
 * have scored a long document 0 for terms it definitely contains.
 */
export function coverageOf(r: SearchResult, terms: string[]): number {
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

export interface CoverageMergeOutcome {
  results: SearchResult[]
  /** FALSE means the arm did not run. `reason` says which of the two non-running states it is. */
  applied: boolean
  reason?: 'signal-absent' | 'no-streams' | 'no-query-terms'
  /** Slots each stream received after the floor, in the order streams were supplied. */
  taken?: number[]
  /** Mean coverage per stream — printed beside the numbers so a flat set of means (which makes the
   *  reallocation meaningless) is visible rather than inferred from an unchanged result. */
  meanCoverage?: number[]
}

/**
 * Merge several streams' rankings, floor first, then by cross-stream term coverage.
 *
 * Phase 1 is `interleaveWithReport`'s floor, unchanged and reused rather than reimplemented —
 * a second copy of the representation policy is how two callers quietly start representing
 * differently. Phase 2 replaces the strict rotation: every remaining result from every stream is
 * pooled and ordered by coverage, ties broken by the result's own in-stream rank (so a tie falls
 * back to exactly today's behaviour rather than to Map order).
 */
export function mergeByCoverage(
  perStream: SearchResult[][],
  query: string,
  budget: number,
  floor: number = STREAM_FLOOR,
): CoverageMergeOutcome {
  if (!perStream.length) return { results: [], applied: false, reason: 'no-streams' }
  const terms = contentTerms(query)
  if (!terms.length) {
    const fb = interleaveWithReport(perStream, budget, floor)
    return { results: fb.results, applied: false, reason: 'no-query-terms' }
  }
  // ⚠ THE SIGNAL CHECK. `snippetMatched === undefined` on every result means the services predate
  // S13 §3 and the snippet is still the head of the document. Scoring coverage on that would
  // measure how often a query term happens to appear in a document's first 300 characters, report
  // it as a merge experiment, and look exactly like a null result.
  const anySignal = perStream.some((s) => s.some((r) => r.snippetMatched !== undefined))
  if (!anySignal) {
    const fb = interleaveWithReport(perStream, budget, floor)
    return { results: fb.results, applied: false, reason: 'signal-absent' }
  }

  const seen = new Set<string>()
  const streams = perStream.map((s) => {
    const kept: SearchResult[] = []
    for (const r of s) { if (seen.has(r.id)) continue; seen.add(r.id); kept.push(r) }
    return kept
  })

  const results: SearchResult[] = []
  const taken = streams.map(() => 0)
  const cursor = streams.map(() => 0)

  // ── phase 1: the floor, identical to interleave.ts ──────────────────────────
  for (let i = 0; i < streams.length; i++) {
    const need = Math.min(floor, streams[i].length)
    if (!need) continue
    if (results.length + need > budget) continue
    for (let n = 0; n < need; n++) results.push(streams[i][cursor[i]++])
    taken[i] += need
  }

  // ── phase 2: the remainder, ordered by coverage across all streams at once ──
  interface Pooled { r: SearchResult; stream: number; rank: number; cov: number }
  const pool: Pooled[] = []
  for (let i = 0; i < streams.length; i++) {
    if (taken[i] === 0) continue // starved at the floor — do not seat it here either
    for (let k = cursor[i]; k < streams[i].length; k++) {
      pool.push({ r: streams[i][k], stream: i, rank: k, cov: coverageOf(streams[i][k], terms) })
    }
  }
  pool.sort((a, b) => b.cov - a.cov || a.rank - b.rank || a.stream - b.stream)
  for (const p of pool) {
    if (results.length >= budget) break
    results.push(p.r)
    taken[p.stream]++
  }

  const meanCoverage = streams.map((s) =>
    s.length ? Math.round((s.reduce((n, r) => n + coverageOf(r, terms), 0) / s.length) * 1000) / 1000 : 0)
  return { results, applied: true, taken, meanCoverage }
}
