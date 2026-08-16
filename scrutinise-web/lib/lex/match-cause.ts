// ─────────────────────────────────────────────────────────────────────────────
// MATCHING WHAT THE USER SAID TO A CAUSE ON THE LIST (§19-E Task 7).
//
// The root cause is a SELECTION, so a chat answer has to be resolved to a row before
// it can mean anything. Lex is asked to quote the cause closely, but a user says "the
// incentives one" and Lex passes that along, so the matcher has to be forgiving.
//
// FOUR RUNGS, tried in order, each stricter than the next is loose:
//   1. exact (normalised)
//   2. one string is a prefix of the other  — "no personal consequence" ⊂ the full row
//   3. one string contains the other        — a quoted fragment from the middle
//   4. content-word overlap above a bar     — "the incentives one"
//
// AND IT REFUSES WHEN IT CANNOT TELL. If two causes match equally well at the rung
// that fired, the answer is AMBIGUOUS and nothing is selected: the root cause is the
// most consequential single choice on the Diagnosis page, and guessing it on the user's
// behalf would be the platform making a strategic decision because a regex was close.
//
// // Refusing to choose is a valid answer. Choosing wrongly is not.
// ─────────────────────────────────────────────────────────────────────────────

export interface CauseRow { id: string; cause: string }

/** Returned when the answer fits more than one cause equally well. */
export const AMBIGUOUS = Symbol('ambiguous-cause')
export type CauseMatch = CauseRow | typeof AMBIGUOUS | null

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'that',
  'this', 'it', 'its', 'as', 'at', 'by', 'be', 'with', 'from', 'one', 'ones', 'cause',
  'causes', 'root', 'main', 'driver', 'think', 'reckon', 'say', 'would', 'because',
])

function normalise(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentWords(s: string): Set<string> {
  return new Set(normalise(s).split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w)))
}

/** The best cause for what the user said, AMBIGUOUS if more than one fits, or null. */
export function matchCause(said: string, causes: CauseRow[]): CauseMatch {
  const q = normalise(said)
  if (!q || !causes.length) return null

  const rows = causes.map((c) => ({ row: c, norm: normalise(c.cause) })).filter((r) => r.norm)

  // 1. exact
  const exact = rows.filter((r) => r.norm === q)
  if (exact.length === 1) return exact[0].row
  if (exact.length > 1) return AMBIGUOUS

  // 2. prefix, either direction. Requires enough characters to be a real quotation
  //    rather than a shared opening word.
  if (q.length >= 12) {
    const prefix = rows.filter((r) => r.norm.startsWith(q) || q.startsWith(r.norm))
    if (prefix.length === 1) return prefix[0].row
    if (prefix.length > 1) return AMBIGUOUS
  }

  // 3. containment, either direction, same length bar.
  if (q.length >= 12) {
    const contains = rows.filter((r) => r.norm.includes(q) || q.includes(r.norm))
    if (contains.length === 1) return contains[0].row
    if (contains.length > 1) return AMBIGUOUS
  }

  // 4. content-word overlap. Scored as a fraction of the SHORTER side's content words,
  //    so "the incentives one" can match a twenty-word cause without being penalised
  //    for its brevity — and a cause is only a candidate at 60% or better, which two
  //    unrelated policy sentences do not reach by accident.
  const qw = contentWords(said)
  if (!qw.size) return null
  let best: { row: CauseRow; score: number } | null = null
  let tied = false
  for (const r of rows) {
    const cw = contentWords(r.row.cause)
    if (!cw.size) continue
    let shared = 0
    for (const w of qw) if (cw.has(w)) shared++
    const score = shared / Math.min(qw.size, cw.size)
    if (score < 0.6) continue
    if (!best || score > best.score + 0.001) { best = { row: r.row, score }; tied = false }
    else if (Math.abs(score - best.score) <= 0.001) tied = true
  }
  if (!best) return null
  return tied ? AMBIGUOUS : best.row
}
