// 26-S browser pass (17 Oct 2026) — A BOUNDED INPUT SHOWS ITS LIMIT AND STOPS AT IT. ONE PLACE FOR THE NUMBERS.
//
// Charlie: an over-long rule-out reason was "not saved, no message, no limit shown". The text box had a bare `maxLength` (a browser cuts
// the text without a word) while the server said the limit only in a rejection the screen could not show. The numbers below are read by the
// route's schema AND by every counter on the screen, so the box, the server and the sentence cannot disagree. No imports (client-safe).

export const LIMITS = {
  ruleOutReason: 600,
  classificationLink: 200,
  actionTitle: 110,
  headingName: 60,
} as const

export type LimitKey = keyof typeof LIMITS

/** The characters left, and the sentence for it. At zero it says so in words, not only by a number. */
export function remainingWords(length: number, max: number): string {
  const left = max - length
  if (left > 0) return `${left} left`
  return `limit reached (${max})`
}

/** Cut text to the limit; say, in words, how much was cut (empty string when nothing was). */
export function clampToLimit(text: string, max: number): { text: string; cut: number; note: string } {
  if (text.length <= max) return { text, cut: 0, note: '' }
  const cut = text.length - max
  return { text: text.slice(0, max), cut, note: `Cut at ${max} characters — ${cut} more ${cut === 1 ? 'was' : 'were'} not kept.` }
}
