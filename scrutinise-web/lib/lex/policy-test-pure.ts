// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X X3 (311, 6b) — THE POLICY TEST OVER DRAFTS: how its calls are made up, and its price. PURE; CLIENT-SAFE (imports nothing), so the
// server's batching (action-structure.ts testAgainstPolicy) and the button's price are one definition (CLAUDE.md §26.5).
//
//   CCh-Lex 7 Nov (2), 2: the test reads the WHOLE accepted draft; an action whose draft is long is tested in a call of its own; the rest are
//   batched as before (25 a call), with a line on how many characters of drafts one batch may carry.
//   The price is MEASURED (POLICY_TEST_RUNS), fitted as a fixed part per call plus a part per character read, because a draft is tens of
//   times longer than a statement and a price per action would be wrong by exactly that.
// ─────────────────────────────────────────────────────────────────────────────

import { fitPrice, priceOf } from './price-fit-pure'

/** Statements per call, as before X3. */
export const POLICY_TEST_BATCH = 25
/** A draft longer than this is tested in a call of its own. */
export const POLICY_TEST_LONG_DRAFT = 4000
/** A batch of short items carries at most this many characters of drafts. */
export const POLICY_TEST_BATCH_CHARS = 40_000
/** The characters one item costs the model besides its draft: the title and statement as sent (120 + 600 at most). */
export const POLICY_TEST_ITEM_CHARS = 720

/**
 * Is an action due a test when the button is pressed with no actions named? Never tested, or NOT_TESTED, or its verdict is OUT OF DATE (what it
 * read is not what it would read now). `current` is testIsCurrent(stored, now) (accepted-drafts-pure.ts), computed by the caller.
 */
export const policyTestDue = (verdict: string | null | undefined, current: boolean): boolean => !verdict || verdict === 'NOT_TESTED' || !current

/** Which items go in which call: each long draft alone; the rest in batches of 25 under the character line. Indexes into `items`. */
export function policyTestCalls(items: ReadonlyArray<{ draftChars: number }>): number[][] {
  const calls: number[][] = []
  let cur: number[] = [], curChars = 0
  items.forEach((x, i) => {
    if (x.draftChars > POLICY_TEST_LONG_DRAFT) { calls.push([i]); return }
    if (cur.length >= POLICY_TEST_BATCH || (cur.length && curChars + x.draftChars > POLICY_TEST_BATCH_CHARS)) { calls.push(cur); cur = []; curChars = 0 }
    cur.push(i); curChars += x.draftChars
  })
  if (cur.length) calls.push(cur)
  return calls
}

/**
 * MEASURED runs over drafts, one entry per real run on a scratch copy (n = the count). `calls` and `chars` (the characters of items sent, drafts
 * included) are what the fit reads. Empty: the price says it is not measured yet, and is never guessed.
 */
export const POLICY_TEST_RUNS: Array<{ calls: number; chars: number; pence: number; on: string }> = [
  // 7 Nov 2026, scratch copy of 452c5ade with its live documents (scripts/measure-26x3.ts --policy). Both on gemini (STRUCTURE_MODEL).
  { calls: 1, chars: 9110, pence: 5.231, on: '20 statements, no drafts: 51 s (n=1)' },
  { calls: 1, chars: 16230, pence: 8.086, on: '#207\'s accepted Code, D.207.2 v1, 15,606 characters, alone: 71 s (n=1)' },
]

export interface PolicyTestPrice { pence: number | null; calls: number; words: string }

/** The price of testing these items: fixed per call + per character, fitted to the runs (least squares on two unknowns; one run → per char only). */
export function policyTestPrice(items: ReadonlyArray<{ draftChars: number; statementChars: number }>): PolicyTestPrice {
  const calls = policyTestCalls(items).length
  const chars = items.reduce((n, x) => n + x.draftChars + Math.min(x.statementChars, POLICY_TEST_ITEM_CHARS), 0)
  if (!items.length) return { pence: 0, calls: 0, words: 'nothing to test' }
  const runs = POLICY_TEST_RUNS
  if (!runs.length) return { pence: null, calls, words: `${calls} call${calls === 1 ? '' : 's'}; the price over drafts is not measured yet, so it is shown when the run finishes` }
  const pence = priceOf(fitPrice(runs), calls, chars)
  return { pence, calls, words: `measured over drafts (n=${runs.length}): about ${pence < 1 ? pence.toFixed(2) : pence.toFixed(1)}p, ${calls} call${calls === 1 ? '' : 's'}, ${Math.round(chars / 1000)}k characters` }
}
