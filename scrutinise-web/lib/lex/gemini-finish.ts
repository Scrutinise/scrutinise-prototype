/**
 * gemini-finish.ts — one guard for one recurring failure: a truncated model response that
 * arrives disguised as something else.
 *
 * THE CLASS, recorded four times before this file existed:
 *   29 Jul  query-expansion — thinking mode ate the whole budget; every call "failed to parse"
 *   6 Aug   web-orientation — grounded call truncating on every call, discarding the Tier B half
 *   8 Aug   general-chat    — "Unterminated string in JSON at position 2488" over 16 sources
 *   8 Aug   query-router    — two of four real questions failed open as `bad-json`, cut mid-word
 *
 * Every one presented as a parse error, a serialiser bug, or a silent degradation. None of them
 * said "I ran out of output tokens", because nothing looked at `finishReason`. The debugging cost
 * is paid at the wrong end every time: you go looking for a fault in the JSON, and the fault is a
 * number in the request.
 *
 * THE RULE (CLAUDE.md §18): a truncated LLM response must name itself as truncated, everywhere,
 * and the guard belongs in the shared helper rather than in each caller. This file is that helper.
 * `maxOutputTokens` is a request parameter, so the caller always knows the budget; passing it in
 * means the message can say what the ceiling was rather than leaving the reader to find it.
 */

/** The subset of a Gemini candidate this guard needs. */
export interface GeminiCandidateLike {
  finishReason?: string
  content?: { parts?: Array<{ text?: string }> }
}

export interface GeminiFinishProblem {
  /** `truncated` = hit maxOutputTokens. `blocked` = anything else non-STOP (SAFETY, RECITATION…). */
  reason: 'truncated' | 'blocked'
  detail: string
}

/**
 * Returns a problem when the candidate did NOT finish cleanly, or null when it did.
 *
 * Call this BEFORE parsing. A truncated payload is still syntactically broken JSON, so parsing
 * first reports `bad-json` and sends the reader after a serialiser fault instead of a length
 * limit — which is exactly how this class has hidden every time.
 *
 * An ABSENT finishReason is treated as fine: some responses omit it, and failing closed on a
 * missing field would turn a working call into an outage.
 */
export function geminiFinishProblem(
  candidate: GeminiCandidateLike | undefined,
  budget: number,
  opts: { label?: string } = {},
): GeminiFinishProblem | null {
  const finish = candidate?.finishReason
  if (!finish || finish === 'STOP') return null

  const text = candidate?.content?.parts?.[0]?.text
  // The tail is the single most useful thing in the log: a cut-off mid-word is instantly
  // recognisable, and it distinguishes truncation from a model that simply stopped early.
  const tail = typeof text === 'string' && text.length ? ` …ends: ${JSON.stringify(text.slice(-80))}` : ''
  const where = opts.label ? `[${opts.label}] ` : ''

  if (finish === 'MAX_TOKENS') {
    return {
      reason: 'truncated',
      detail: `${where}cut off at maxOutputTokens=${budget} — raise the budget or shorten the input${tail}`,
    }
  }
  return { reason: 'blocked', detail: `${where}finishReason=${finish}${tail}` }
}

/**
 * Throwing form, for call sites whose contract is "return text or throw" (lex-client and friends)
 * rather than "return a result object". The thrown Error carries `kind` so existing LexError
 * handling keeps working and the cause survives into the log.
 */
export function assertGeminiFinished(
  candidate: GeminiCandidateLike | undefined,
  budget: number,
  label: string,
): void {
  const problem = geminiFinishProblem(candidate, budget, { label })
  if (!problem) return
  const e = new Error(problem.detail) as Error & { kind?: string }
  e.kind = problem.reason === 'truncated' ? 'truncated' : 'blocked'
  throw e
}
