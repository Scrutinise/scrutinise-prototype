// 26-S decision 163 (17 Oct 2026) — A CHALLENGE ALWAYS HAS A TITLE.
//
// `lib/lex/deepening.ts` wrote every adversarial issue with `title: null` (the adversarial call returns a string list), so 23 of the 255
// challenges on the pilot idea had none and `check:lex-25w` was red. A title is taken from the issue's OWN text — no model call, nothing
// invented — at most 12 words: the first clause, cut at a word boundary. Pure, no imports (the backfill script and the check use it too).

export const ISSUE_TITLE_MAX_WORDS = 12

export function titleFromText(text: string): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  // The first clause: up to the first sentence end, semicolon, colon or spaced dash — whichever comes first and leaves something to read.
  // A comma before a joining word ("…effective', but no source…") also ends the clause.
  const clause = flat.split(/(?<=[.!?])\s|;\s|:\s|\s[—–-]\s|,\s+(?=(?:but|and|though|while|which|so|yet|because)\b)/)[0].trim() || flat
  const words = clause.split(' ')
  const cut = words.length > ISSUE_TITLE_MAX_WORDS ? words.slice(0, ISSUE_TITLE_MAX_WORDS).join(' ') : clause
  // No dangling comma or joiner where the cut fell ("…the figure, but" is not a title).
  return cut.replace(/(?:[.,;:\s]|\b(?:but|and|or|that|which|the|of|to|a|an|in|for|with)\b)+$/i, '').trim()
}
