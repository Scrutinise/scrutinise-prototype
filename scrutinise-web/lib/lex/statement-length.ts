// ─────────────────────────────────────────────────────────────────────────────
// 26-O §4c — A LENGTH FLAG ON THE GUIDING POLICY STATEMENT, in the same "flagged for review, not a verdict" form as
// the compound flag (`testIsCompound`).
//
// ⚠ WHY IT EXISTS. The newer models ignore "one or two sentences": Opus 5.5 wrote six (MODEL_REVIEW 30 Sep §1). The
// guiding policy is now ruthlessly brief — a principle you can test an action against fits in a sentence or two, and a
// paragraph is usually a policy plus its actions plus its defence. A mechanical count cannot say a long statement is
// WRONG (some policies need a clause more), so it flags for review and says it is a wording check.
//
// Pure and import-free: shared by the judge (server), the card (a client component — CLAUDE.md §28) and the check, so
// there is ONE definition of "too long" (CLAUDE.md §26.5).
// ─────────────────────────────────────────────────────────────────────────────

/** More than this many sentences, or words, and the statement is flagged. */
export const MAX_STATEMENT_SENTENCES = 2
export const MAX_STATEMENT_WORDS = 60

export interface LengthTest {
  tooLong: boolean
  sentences: number
  words: number
}

/** Sentence count by terminal punctuation followed by space/end; abbreviations like "e.g." and "No." can over-count by one,
 *  which is why the flag is a prompt to re-read and never a verdict. */
export function testStatementLength(statement: string): LengthTest {
  const text = (statement || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return { tooLong: false, sentences: 0, words: 0 }
  const pieces: string[] = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? []
  const sentences = pieces.filter((s) => s.trim().length > 2).length
  const words = text.split(' ').filter(Boolean).length
  return { tooLong: sentences > MAX_STATEMENT_SENTENCES || words > MAX_STATEMENT_WORDS, sentences, words }
}

/** The one line the card prints. Fixed wording — it names the count, never quotes the statement. */
export function lengthFlagLine(t: LengthTest): string {
  return `⚠ Flagged for review (wording check, not a verdict) — ${t.sentences} sentence${t.sentences === 1 ? '' : 's'}, ${t.words} words. `
    + 'A guiding policy is meant to be a sentence or two; check whether this is one principle or a policy with its actions and defence attached.'
}
