// ─────────────────────────────────────────────────────────────────────────────
// SEARCH-29 OPTION B — WHAT LEX IS HANDED TO ANSWER FROM: every routed source that returned
// results gets at least `floor` places; the remaining places go by score.
//
// Charlie's decision. Today `general-chat.ts` takes the first N of the score-ordered result list
// (`slice(0, 16)`). With the judged merge on, that list is ordered by score across streams, so a
// stream whose best hit scores below another stream's sixteenth can reach NONE of the context
// (check:stream-coverage observed 3 of 3 multi-stream queries losing a whole stream, with 60 hits
// each). This is the other half of the trade S14 made on purpose: the merge stopped rationing
// slots, and the answer context inherited the consequence.
//
// WHAT THIS DOES, exactly:
//   1. For each routed stream that returned at least one non-orphaned hit, reserve that stream's
//      best `floor` hits (best = earliest in the incoming score order). A stream with fewer than
//      `floor` hits reserves what it has.
//   2. Fill the remaining places (limit − reserved) from the rest of the list in its incoming
//      order — i.e. by score.
//   3. Return the chosen set in the INCOMING order, so the [n] numbering still reads best-first
//      overall and a reserved low-scoring hit sits where its score puts it, not at the top.
//
// ⚠ NOTHING IS REORDERED AND NOTHING IS DROPPED FROM THE PRODUCT'S RESULT LIST — this selects a
// SUBSET for the answer call only; `search.results` is untouched and still goes to the panel.
// ⚠ WITH `floor` 0, OR WHEN EVERY STREAM IS ALREADY REPRESENTED, THE RESULT IS EXACTLY
// `results.slice(0, limit)` — the degenerate case is today's behaviour, and the check asserts it.
// ⚠ `limit` is a hard ceiling: if floor × streams exceeds it, the floor is cut back, and `report`
// says so (a floor of 2 across 9 routed streams cannot fit in 16 places — it is stated, not hidden).
// ─────────────────────────────────────────────────────────────────────────────

import { flagEnabled } from '@/lib/env-flags'

export const ANSWER_STREAM_FLOOR = 2

export function answerStreamFloorEnabled(): boolean { return flagEnabled('LEX_ANSWER_STREAM_FLOOR') }

export interface AnswerContextReport {
  limit: number
  floor: number
  /** floor actually applied per stream (lower than `floor` only when streams × floor exceeded the limit) */
  floorApplied: number
  reserved: number
  /** streams that returned results, and how many places each now holds */
  perStream: Array<{ stream: string; retrieved: number; inContextBefore: number; inContextAfter: number }>
  /** result ids in the chosen set that the plain prefix would NOT have contained */
  added: string[]
  /** result ids the plain prefix contained that this selection gave up */
  displaced: string[]
}

export function selectAnswerContext<T extends { id: string }>(
  results: T[],
  perStream: ReadonlyArray<{ stream: string; ids: string[] }> | undefined,
  limit: number,
  floor: number = ANSWER_STREAM_FLOOR,
): { context: T[]; report: AnswerContextReport } {
  const prefix = results.slice(0, limit)
  const emptyReport = (): AnswerContextReport => ({ limit, floor, floorApplied: 0, reserved: 0, perStream: [], added: [], displaced: [] })
  if (floor <= 0 || !perStream?.length || !results.length) return { context: prefix, report: emptyReport() }

  const index = new Map(results.map((r, i) => [r.id, i]))
  // each stream's hits that are actually in `results` (an id absent from it was an orphan, filtered before this call)
  const streams = perStream
    .map((s) => ({ stream: s.stream, ids: s.ids.filter((id) => index.has(id)).sort((a, b) => index.get(a)! - index.get(b)!) }))
    .filter((s) => s.ids.length > 0)
  if (!streams.length) return { context: prefix, report: emptyReport() }

  // never let the floor exceed what fits: reduce it until streams × floor ≤ limit (at least 1 while streams ≤ limit)
  let floorApplied = floor
  while (floorApplied > 1 && streams.length * floorApplied > limit) floorApplied--

  const chosen = new Set<string>()
  for (const s of streams) for (const id of s.ids.slice(0, floorApplied)) {
    if (chosen.size >= limit) break
    chosen.add(id)
  }
  const reserved = chosen.size
  for (const r of results) {
    if (chosen.size >= limit) break
    chosen.add(r.id)
  }
  const context = results.filter((r) => chosen.has(r.id))

  const before = new Set(prefix.map((r) => r.id))
  const after = new Set(context.map((r) => r.id))
  return {
    context,
    report: {
      limit, floor, floorApplied, reserved,
      perStream: streams.map((s) => ({
        stream: s.stream, retrieved: s.ids.length,
        inContextBefore: s.ids.filter((id) => before.has(id)).length,
        inContextAfter: s.ids.filter((id) => after.has(id)).length,
      })),
      added: [...after].filter((id) => !before.has(id)),
      displaced: [...before].filter((id) => !after.has(id)),
    },
  }
}
