// interleave.ts — the ONE place that decides how several streams' results share a budget.
//
// WHY THIS FILE EXISTS. `runRoutedSearch` ended `perStream.flat()` — a concatenation with no
// cross-stream ordering — so the routed list was STREAM-BLOCKED: positions 1..limit were
// legislation, limit+1..2·limit debates, and so on. Every consumer that then took a prefix
// (`results.slice(0, 16)` in general-chat, `.slice(0, 8)` of the filtered set in the
// orchestrator, the top-K in score-ordering) was reading one stream and calling it the corpus.
// Live consequence, 9 Aug: Lex answered "the sources do not contain information on what select
// committees have said" while the committees stream had been routed, had returned hits, and was
// being counted in the source panel. Four streams out of five were retrieved, paid for, shown,
// and dropped before the answer was written.
//
// WHY ROUND-ROBIN AND NOT A GLOBAL SORT BY SCORE. A cross-stream sort looks more principled and
// is not. The scores are not comparable:
//   · BM25 is length- and corpus-normalised, so 12 means different things in a 250k-instrument
//     index and a 78k-section one;
//   · a fused stream carries an RRF score (`w/(k+rank)` ≈ 0.008–0.016, see fusion.ts) while an
//     unfused stream carries raw BM25 (~5–25) — three orders of magnitude apart, and the fused
//     stream loses every comparison for reasons that have nothing to do with relevance.
// Sorting those together produces a confident ordering with no meaning behind it. Round-robin
// makes the representation policy EXPLICIT and MEASURABLE (scripts/check-stream-coverage.ts).
// Once the ordering baseline exists and a reranker exists, a real cross-stream ordering can
// replace this — scored against a metric rather than assumed.
//
// ⚠ NOT FIXED HERE, AND ON RECORD: `groupForPanel` (search-stub.ts) still does exactly the
// global cross-stream score sort argued against above, then caps at 20. That is the panel path,
// it is a ranking-policy change rather than a truncation bug, and it belongs with the ordering
// baseline. It becomes actively destructive the moment LEX_VECTOR_STREAMS is set, because
// fuseWeightedRrf OVERWRITES `score` with the RRF value and the fused stream then sorts below
// every unfused one.

import type { SearchResult } from './page1-config'

/**
 * Slots a stream is guaranteed before round-robin resumes, when the budget can afford it.
 *
 * WHY 2 AND NOT 1. One document from a stream is usually not enough for the answer model to say
 * anything about that stream, so a single-slot representation reads to the user as the stream
 * having found nothing — which is the same failure this module exists to fix, in a quieter form.
 */
export const STREAM_FLOOR = 2

export interface InterleaveReport {
  /** Slots each stream received, in the order the streams were supplied. */
  taken: number[]
  /** Streams that returned hits but received NO slots — the budget could not seat them at the
   *  floor. Reported rather than inferred, so a silent omission is impossible. */
  starved: number[]
  /** Results dropped as duplicates of a hit already taken from an earlier stream. */
  deduped: number
}

export interface InterleaveOutcome {
  results: SearchResult[]
  report: InterleaveReport
}

/**
 * Round-robin several streams' rankings into one list: the floor first (up to STREAM_FLOOR from
 * each stream that has that many), then rank 3 from each stream, then rank 4, and so on until the
 * budget is filled or every stream is exhausted. Exhausted streams are skipped rather than
 * leaving gaps.
 *
 * `budget` is a hard ceiling on the returned length. Passing the total number of results turns
 * this into a pure REORDERING that drops nothing — which is how the search gateway calls it, so
 * that every prefix a downstream caller takes is stream-balanced without the gateway having to
 * guess what each caller's context budget is.
 *
 * A stream that cannot be seated at its floor gets nothing at all rather than a token slot, and
 * is reported in `starved`. A stream with only one hit IS seated with that one hit — that is full
 * representation, not under-representation.
 *
 * `floor` is a parameter because the rationale for 2 is about the ANSWER CONTEXT — a model needs
 * more than one document to say anything about a stream. Where the consumer is a LIST OF TITLES
 * (facts.ts, which tells Lex these are the only things it may say were found), one entry is
 * genuinely better than none and the caller passes 1. Defaults to STREAM_FLOOR; anything else is
 * a deliberate, stated choice at the call site.
 *
 * Duplicates are dropped by id, keeping the earlier stream's copy. Today's five streams are
 * disjoint by tier and by corpus so this should never fire; it is counted rather than assumed,
 * because a stream added later may overlap and silent double-counting would inflate one stream's
 * share of the budget.
 */
export function interleaveWithReport(
  perStream: SearchResult[][],
  budget: number,
  floor: number = STREAM_FLOOR,
): InterleaveOutcome {
  const results: SearchResult[] = []
  const taken = perStream.map(() => 0)
  if (budget <= 0 || !perStream.length) return { results, report: { taken, starved: [], deduped: 0 } }

  const seen = new Set<string>()
  let deduped = 0
  // Dedupe up-front so the floor phase counts real, distinct slots. Doing it during the take
  // would let a stream's floor be spent on duplicates and leave it under-represented anyway.
  const streams = perStream.map((s) => {
    const kept: SearchResult[] = []
    for (const r of s) {
      if (seen.has(r.id)) { deduped++; continue }
      seen.add(r.id)
      kept.push(r)
    }
    return kept
  })

  const cursor = streams.map(() => 0)
  const starved: number[] = []

  // ── phase 1: the floor ──────────────────────────────────────────────────────
  // `continue`, not `break`: a later stream may have only one hit, need only one slot, and fit
  // in room a two-slot stream could not use.
  for (let i = 0; i < streams.length; i++) {
    const need = Math.min(floor, streams[i].length)
    if (!need) continue
    if (results.length + need > budget) { starved.push(i); continue }
    for (let n = 0; n < need; n++) results.push(streams[i][cursor[i]++])
    taken[i] += need
  }

  // ── phase 2: round-robin over the seated streams ────────────────────────────
  let progressed = true
  while (results.length < budget && progressed) {
    progressed = false
    for (let i = 0; i < streams.length && results.length < budget; i++) {
      if (taken[i] === 0) continue // starved above — do not seat it with a single slot now
      if (cursor[i] >= streams[i].length) continue
      results.push(streams[i][cursor[i]++])
      taken[i]++
      progressed = true
    }
  }

  return { results, report: { taken, starved, deduped } }
}

/**
 * The list alone — the form every production caller wants. `opts.names` is used only to make the
 * warning line readable when the budget could not seat a stream; it never affects the allocation.
 */
export function interleaveStreams(
  perStream: SearchResult[][],
  budget: number,
  opts: { names?: string[]; label?: string; floor?: number } = {},
): SearchResult[] {
  const { results, report } = interleaveWithReport(perStream, budget, opts.floor ?? STREAM_FLOOR)
  if (report.starved.length || report.deduped) {
    const name = (i: number) => opts.names?.[i] ?? `stream${i}`
    console.warn('[interleave] budget could not seat every stream', {
      label: opts.label ?? null,
      budget,
      starved: report.starved.map(name),
      deduped: report.deduped,
      taken: Object.fromEntries(report.taken.map((n, i) => [name(i), n])),
    })
  }
  return results
}
