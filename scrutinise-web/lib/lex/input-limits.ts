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
  /** 26-S2 188: one condition the proposal must meet (lib/lex/action-conditions.ts CONDITION_MAX is the same number). */
  conditionText: 400,
  /** Decision 181 (17 Oct 2026): the action STATEMENT. It was 600 in 26-Q without a decision; the COMMENTARY beside it is unlimited and takes whatever a limit cuts. */
  actionStatement: 1000,
  /** 26-S2 §5 (177): an answer in one of the step-2 slots (Incentive now, What changes it, Skill, How, Against, What tells us it worked). */
  slotAnswer: 1200,
  /** Who — a body or a role — kept in `whoImplements` (it was 200 in the tools already). */
  whoAnswer: 200,
  /** 26-S2 sec 6: "no cost, because ...". */
  noCostReason: 400,
  /** 26-T2 §6: a comment on an action is a notebook note's comment (the notebook route allows 8,000), and a reply beneath it 4,000. */
  actionComment: 8000,
  actionReply: 4000,
} as const

export type LimitKey = keyof typeof LIMITS

/** The characters left, and the sentence for it. At zero it says so in words, not only by a number. */
export function remainingWords(length: number, max: number): string {
  const left = max - length
  if (left > 0) return `${left} left`
  if (left === 0) return `limit reached (${max})`
  return `${(-left).toLocaleString('en-GB')} over the limit of ${max.toLocaleString('en-GB')} — shorten it to save`
}

/** Cut text to the limit; say, in words, how much was cut (empty string when nothing was). */
export function clampToLimit(text: string, max: number): { text: string; cut: number; note: string } {
  if (text.length <= max) return { text, cut: 0, note: '' }
  const cut = text.length - max
  return { text: text.slice(0, max), cut, note: `Cut at ${max} characters — ${cut} more ${cut === 1 ? 'was' : 'were'} not kept.` }
}
