// merge-judged.ts — SEARCH S14 §2. STOP RATIONING SLOTS; JUDGE THE WHOLE POOL.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THIS REPLACES, AND WHY IT IS NOT A TUNING CHANGE
//
// `interleaveStreams` gives every routed stream an equal share. S13 §1.3 measured what that costs
// and the answer is arithmetic, not judgement:
//
//     with S streams routed, a top-20 window can show at most the first floor(20/S) of EACH stream
//
// It held for 29 of the 34 keys that were found and merged. So the round-robin is not making bad
// trades — S13 §1.6 found ONE question across 65 where a weaker result displaced a stronger one,
// and even that was misattributed. **It is making a fair trade too few times.** With five sources
// and a twenty-slot window, an answer at in-stream rank five cannot be displayed whatever its
// score.
//
// Charlie's instruction, which is this file's specification:
//
//   "We need at least 20 from each source — it might be that one source has all the top 20. We
//    should never cut back the visibility when we add sources. Then something should be running a
//    value judgement on all of them to get a merged top 20."
//
// ── WHY NOT PLAIN RANK FUSION ACROSS STREAMS. Because it rebuilds exactly what is here today.
// The streams return DISJOINT sets (measured, S14 §1.2: 0 of 10 stream pairs shared a single
// document on any probe — they are separated by tier and corpus prefilter, so this is structural
// rather than lucky). An unweighted rank fusion over disjoint sets sorts by 1/(k + rank), which
// takes every stream's rank 1, then every stream's rank 2, and so on. **That is round-robin.**
// RRF carries no information about whose rank 1 is better; the only thing that can is a per-stream
// WEIGHT, which is why (b) below exists.
//
// ── WHY NOT SCORE NORMALISATION. Two reasons, and the second is the fatal one.
//   1. The scales genuinely differ — measured S14 §1.1 — and after fusion they are not even the
//      same FUNCTION: `fuseWeightedRrf` overwrites `score` with an RRF value (~0.01) while an
//      unfused stream carries raw BM25 (~26–197). This codebase has already shipped that defect
//      once (`groupForPanel`, deleted 2026-08-09; `score-scope.ts` is what stops it returning).
//   2. ⚠⚠ Normalisation rescales a stream RELATIVE TO ITS OWN CANDIDATES, so a stream that found
//      nothing good is promoted to parity with a stream that found something excellent. Its
//      best-of-a-bad-lot becomes a 1.0 exactly as a genuinely strong hit does. That is worse than
//      the round-robin, because it is confidently wrong rather than merely fair.
//
// ── WHAT IS ACTUALLY COMPARABLE ACROSS STREAMS, then, and it is only ever two things:
//   (b) how likely the ROUTER thought this stream was to hold the answer — a judgement made about
//       the streams TOGETHER, so it is a cross-stream quantity by construction; and
//   (d) an ABSOLUTE property of the (query, document) pair — here, the fraction of the query's own
//       content terms visible in the document — which depends on no index statistic and is
//       computed identically for every stream.
// (b) ORDERS. (d) GATES. They are separately switchable so each can be measured on its own.
//
// ⚠⚠ AND THE DEGENERATE CASE IS TODAY'S BEHAVIOUR, EXACTLY — NOT APPROXIMATELY. With a stream
// floor of 2, uniform confidence and no gate, this function returns the SAME LIST as
// `interleaveStreams`, id for id, and `check-s14-merge.ts` asserts that by comparing outputs
// rather than by reading the code. That property is what makes every arm interpretable: any
// difference a measurement shows is attributable to a switch that was thrown, never to the merge
// having been rewritten around it.
//
// ⚠⚠ NOTHING IS EVER DROPPED. `budget` is the total number of hits when `runRoutedSearch` calls
// this, so it is a pure REORDERING — the same contract `interleaveStreams` has. A candidate that
// fails the gate is DEMOTED below the candidates that pass it; it is not removed. A merge that
// silently discarded a document would be indistinguishable from retrieval that never found it,
// which is the failure this whole measurement programme exists to prevent.

import type { SearchResult } from './page1-config'
import { interleaveWithReport, STREAM_FLOOR } from './interleave'
import { contentTerms, coverageOf } from './term-coverage'
import { flagEnabled } from '@/lib/env-flags'
import { RRF_K } from './fusion'

/** ON only when deliberately switched on. Read through `flagEnabled` — never a bare `=== 'true'`;
 *  a capitalised `TRUE` in Vercel silently disabled the router once for an unknown period. */
export function judgedMergeEnabled(): boolean { return flagEnabled('LEX_SEARCH_JUDGED_MERGE') }

/**
 * ⚠ CHARLIE'S RULE, AS A NUMBER: "we need at least 20 from each source … we should never cut back
 * the visibility when we add sources."
 *
 * `limit` is already a PER-STREAM budget (SEARCH_CONTRACT §4), so adding a stream has never
 * reduced what any other stream RETRIEVES. What it reduced was what each could DISPLAY. This
 * constant closes the other half: a routed stream retrieves at least this many candidates
 * whatever the caller asked for, so the judged pool is never thin because a caller passed a small
 * limit. It applies ONLY on the judged path — the default path is byte-identical.
 *
 * ⚠⚠ AND IT IS NOT FREE ON THE DENSE SIDE. `limit` is over-fetched ×3 before it reaches a service,
 * so 20 asks each service for 60 rows; `vector-serve` then applies `chunkOverscan: 5` and
 * `refineFactor: 2`, i.e. 600 ANN probes over 22.6M vectors, once per dense stream. With four
 * streams in `LEX_VECTOR_STREAMS` against a service that runs 4 requests wide, that is what S14 §0
 * measured collapsing. **Turning this flag on without changing the dense side is a decision, not a
 * default** — which is why it is behind a flag and why §0 is the first section of the report.
 */
export const MIN_PER_STREAM = 20
export function minPerStream(): number {
  const raw = parseInt(process.env.SEARCH_MIN_PER_STREAM ?? String(MIN_PER_STREAM), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : MIN_PER_STREAM
}

/**
 * (d) THE ABSOLUTE RELEVANCE FLOOR — "a result must clear a bar to occupy a slot at all, rather
 * than being entitled to one."
 *
 * Expressed as the fraction of the query's DISTINCT content terms visible in what the result
 * displays (title + citation + snippet). A fraction rather than a count is the length-bias guard
 * that `term-coverage.ts` documents: a 30,000-word speech and a 200-word regulation both top out
 * at 1.0, so nothing is promoted for being long.
 *
 * ⚠ `null`/unset DISABLES the gate rather than defaulting to a number. A gate whose threshold was
 * guessed is a ranking change nobody decided on, and S14's own rule is not to tune to 64
 * questions — the report prints the SWEEP, and adopting a point value is Charlie's decision.
 */
export function relevanceFloorFromEnv(): number | null {
  const raw = process.env.SEARCH_RELEVANCE_FLOOR
  if (raw === undefined || raw.trim() === '') return null
  const v = Number(raw)
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    console.warn(`[merge-judged] SEARCH_RELEVANCE_FLOOR=${JSON.stringify(raw)} is not a fraction in [0,1] — IGNORED, the gate stays OFF`)
    return null
  }
  return v
}

export interface JudgedMergeOptions {
  /** Stream names in the same order as `perStream`. Used for confidence lookup and for the report. */
  streamNames: string[]
  /** The query the coverage gate is scored against — the UNION of the routed streams' tailored
   *  queries, because scoring one stream's documents against another stream's terms would measure
   *  something nobody searched for. */
  query: string
  /** Hard ceiling on the returned length. Pass the total to make this a pure reordering. */
  budget: number
  /**
   * Slots guaranteed per stream before judgement, as in `interleave.ts`.
   *
   * ⚠⚠ THE SHIPPED DEFAULT IS 0, AND THAT IS A DELIBERATE DEPARTURE FROM `STREAM_FLOOR`. The
   * brief's acceptance criterion is that "a source may occupy all twenty slots if that is where
   * the answer is"; a floor of 2 across five streams makes that arithmetically impossible, which
   * is the very defect being fixed. Set it to `STREAM_FLOOR` to recover today's guarantee — and
   * see `check-s14-merge.ts`, where floor 2 + uniform confidence + no gate is asserted to
   * reproduce `interleaveStreams` exactly.
   *
   * ⚠ The risk this trades against is real and is named rather than dismissed: `interleave.ts`
   * exists because four of five routed streams were once silently dropped and Lex told a user the
   * sources contained nothing from select committees. The protection now comes from MEASUREMENT
   * (`report.taken` is returned on every call and logged) rather than from a quota.
   */
  floor?: number
  /**
   * (b) ROUTER STREAM CONFIDENCE — how likely the router judged each stream to hold the answer.
   * Absent, or a stream missing from it, means 1 (uniform), which is the round-robin ordering.
   */
  confidence?: Record<string, number> | null
  /** (d) The gate. `null` = no gate. */
  relevanceFloor?: number | null
  /**
   * (c) THE RERANKER'S ORDERING — id → position, lower is better. Ids present here sort ahead of
   * every id that is not, in the model's own order. Ids absent from it are ordered by (b)/(d)
   * exactly as they would be without a reranker, so a bounded reranker that read only the top N
   * leaves the tail in a defined order rather than in Map order.
   */
  priority?: Map<string, number> | null
}

export interface JudgedMergeReport {
  /** Slots each stream received, in the order the streams were supplied. */
  taken: number[]
  /** Slots each stream received INSIDE the display window — the number the brief is about. */
  takenInWindow: number[]
  /** Candidates demoted by the (d) gate, per stream. Demoted, never dropped. */
  gated: number[]
  /** Mean coverage per stream — a flat set of means makes the gate meaningless, and that must be
   *  visible rather than inferred from an unchanged result. */
  meanCoverage: number[]
  /** Results dropped as duplicates of a hit already taken from an earlier stream. */
  deduped: number
  /** Resolved confidence per stream, so a run can print what actually weighted it. */
  confidence: number[]
}

export interface JudgedMergeOutcome {
  results: SearchResult[]
  report: JudgedMergeReport
}

/** The window the per-stream representation report is computed over. Reporting only. */
const REPORT_WINDOW = 20

/**
 * Merge several streams' rankings into one list by judgement over the whole pool.
 *
 * The order is decided by, in strict priority:
 *   1. the reranker's own ordering, for the candidates it read (§3);
 *   2. whether the candidate clears the absolute relevance floor (d);
 *   3. weighted reciprocal rank — `confidence(stream) / (k + rank)` (b);
 *   4. in-stream rank, then stream order — so a tie falls back to exactly today's behaviour
 *      rather than to Map iteration order.
 */
export function mergeJudged(
  perStream: SearchResult[][],
  opts: JudgedMergeOptions,
): JudgedMergeOutcome {
  const floor = opts.floor ?? 0
  const names = opts.streamNames
  const conf = names.map((nm) => {
    const v = opts.confidence?.[nm]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 1
  })
  const terms = contentTerms(opts.query ?? '')

  // Dedupe up-front, keeping the earlier stream's copy — identical to `interleaveWithReport`, and
  // for the same reason: doing it during the take lets a stream's floor be spent on duplicates.
  // Today's streams are disjoint by tier and corpus so this should never fire; it is COUNTED
  // rather than assumed, because a stream added later may overlap and silent double-counting
  // would inflate one stream's share.
  const seen = new Set<string>()
  let deduped = 0
  const streams = perStream.map((s) => {
    const kept: SearchResult[] = []
    for (const r of s) {
      if (seen.has(r.id)) { deduped++; continue }
      seen.add(r.id)
      kept.push(r)
    }
    return kept
  })

  const results: SearchResult[] = []
  const taken = streams.map(() => 0)
  const gated = streams.map(() => 0)
  const cursor = streams.map(() => 0)

  // ── phase 1: the floor, byte-identical to interleave.ts (and 0 by default) ──
  if (floor > 0 && opts.budget > 0) {
    for (let i = 0; i < streams.length; i++) {
      const need = Math.min(floor, streams[i].length)
      if (!need) continue
      if (results.length + need > opts.budget) continue
      for (let n = 0; n < need; n++) results.push(streams[i][cursor[i]++])
      taken[i] += need
    }
  }

  // ── phase 2: judge the whole remaining pool at once ─────────────────────────
  interface Pooled { r: SearchResult; stream: number; rank: number; cov: number; pass: boolean; rrf: number; pri: number }
  const pool: Pooled[] = []
  for (let i = 0; i < streams.length; i++) {
    for (let k = cursor[i]; k < streams[i].length; k++) {
      const r = streams[i][k]
      const cov = terms.length ? coverageOf(r, terms) : 0
      const pass = opts.relevanceFloor == null ? true : cov >= opts.relevanceFloor
      if (!pass) gated[i]++
      pool.push({
        r, stream: i, rank: k, cov, pass,
        rrf: conf[i] / (RRF_K + k + 1),
        // Absent from the reranker's list ⇒ sorts after every candidate it did read. Infinity
        // rather than a large constant, so no candidate count can accidentally overtake it.
        pri: opts.priority?.get(r.id) ?? Number.POSITIVE_INFINITY,
      })
    }
  }
  pool.sort((a, b) =>
    a.pri - b.pri ||
    Number(b.pass) - Number(a.pass) ||
    b.rrf - a.rrf ||
    a.rank - b.rank ||
    a.stream - b.stream)

  for (const p of pool) {
    if (results.length >= opts.budget) break
    results.push(p.r)
    taken[p.stream]++
  }

  // Per-stream representation inside the display window — the number the whole sprint is about.
  const streamOf = new Map<string, number>()
  for (let i = 0; i < streams.length; i++) for (const r of streams[i]) streamOf.set(r.id, i)
  const takenInWindow = streams.map(() => 0)
  for (const r of results.slice(0, REPORT_WINDOW)) {
    const i = streamOf.get(r.id)
    if (i !== undefined) takenInWindow[i]++
  }

  const meanCoverage = streams.map((s) =>
    s.length && terms.length
      ? Math.round((s.reduce((n2, r) => n2 + coverageOf(r, terms), 0) / s.length) * 1000) / 1000
      : 0)

  return { results, report: { taken, takenInWindow, gated, meanCoverage, deduped, confidence: conf } }
}

/**
 * ⚠ THE EQUIVALENCE, AS CODE RATHER THAN AS A CLAIM. Exposed so `check-s14-merge.ts` can assert
 * that the judged merge in its degenerate configuration reproduces `interleaveStreams` id for id.
 * It is here, beside the thing it describes, so the two cannot drift apart in a refactor.
 */
export function roundRobinEquivalent(perStream: SearchResult[][], budget: number): SearchResult[] {
  return interleaveWithReport(perStream, budget, STREAM_FLOOR).results
}
