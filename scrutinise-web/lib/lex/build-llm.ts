// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A — one Gemini JSON call, with the two things the build harness needs
// that the existing callers do not: TOKEN USAGE (there is a cost ceiling on the row)
// and a FAILURE THAT NAMES ITSELF (§2 — hitting a ceiling is a FAILED build with a
// plain reason, never a silently shortened one).
//
// Written to CLAUDE.md §18 in full:
//   1. `finishReason` is checked BEFORE parsing, via the shared helper.
//   2. The reason is NAMED distinctly — `truncated` is not `bad-json` is not
//      `blocked` is not `http`. A caller that degrades must still log WHICH.
//   3. The budget and the tail travel with the message.
//   4. An absent `finishReason` is fine.
//   5. The budget is generous: output tokens are billed on what is generated, so a
//      large ceiling on a small object costs nothing and a tight one eventually fires.
//
// ⚠ USAGE IS RETURNED ON THE FAILURE PATHS TOO. A truncated call still burned tokens,
// and a cost ceiling that only counts successful calls is a ceiling a failing loop
// walks straight through.
// ─────────────────────────────────────────────────────────────────────────────

import { geminiFinishProblem } from './gemini-finish'

export interface LlmUsage {
  model: string
  tokensIn: number
  tokensOut: number
}

export type LlmFailureReason = 'no-key' | 'http' | 'timeout' | 'truncated' | 'blocked' | 'bad-json' | 'empty'

export interface LlmOk<T> { ok: true; value: T; usage: LlmUsage }
export interface LlmFail { ok: false; reason: LlmFailureReason; detail: string; usage: LlmUsage }
export type LlmResult<T> = LlmOk<T> | LlmFail

/**
 * ⚠ USE THESE, NOT `if (!result.ok)`.
 *
 * This project's tsconfig sets `strict: false`, which turns off `strictNullChecks` —
 * and without it TypeScript does NOT narrow a discriminated union by the truthiness of
 * its literal discriminant. `if (!result.ok) { result.reason }` therefore fails to
 * compile with "Property 'reason' does not exist", which reads as a broken type rather
 * than as a compiler-option consequence. A user-defined type predicate narrows in every
 * mode, so these two functions are the supported way to read an LlmResult.
 */
export function llmFailed<T>(r: LlmResult<T>): r is LlmFail { return r.ok === false }
export function llmOk<T>(r: LlmResult<T>): r is LlmOk<T> { return r.ok === true }

export interface LlmCallOptions {
  model: string
  system: string
  user: string
  /** JSON Schema Gemini is forced to answer in. */
  schema: Record<string, unknown>
  maxOutputTokens: number
  timeoutMs: number
  temperature?: number
  /** Diagnostic label — appears in every log line and in the failure detail. */
  label: string
}

const ZERO = (model: string): LlmUsage => ({ model, tokensIn: 0, tokensOut: 0 })

/**
 * Gemini's usage block. `thoughtsTokenCount` is billed as output when thinking is on,
 * so it is added here rather than quietly dropped — a cost ceiling that under-counts is
 * a ceiling that does not hold.
 */
function readUsage(model: string, data: unknown): LlmUsage {
  const u = (data as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    model,
    tokensIn: n(u?.promptTokenCount),
    tokensOut: n(u?.candidatesTokenCount) + n(u?.thoughtsTokenCount),
  }
}

export async function callJson<T>(opts: LlmCallOptions): Promise<LlmResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { ok: false, reason: 'no-key', detail: `[${opts.label}] GEMINI_API_KEY not set`, usage: ZERO(opts.model) }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.user }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.4,
            maxOutputTokens: opts.maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: opts.schema,
            // OFF, and this is not a preference. §19-D Task 2b: three generators were
            // silently returning nothing because thinking ate the whole output budget.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return {
        ok: false,
        reason: 'http',
        detail: `[${opts.label}] HTTP ${res.status} ${body.slice(0, 300)}`,
        usage: ZERO(opts.model),
      }
    }

    const data = (await res.json()) as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const usage = readUsage(opts.model, data)

    // BEFORE parsing. A truncated payload is broken JSON, and parsing first turns a
    // length limit into a parse error and sends the reader after a serialiser bug.
    const cut = geminiFinishProblem(data?.candidates?.[0], opts.maxOutputTokens, { label: opts.label })
    if (cut) return { ok: false, reason: cut.reason, detail: cut.detail, usage }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, reason: 'empty', detail: `[${opts.label}] no text part in the response`, usage }
    }

    try {
      return { ok: true, value: JSON.parse(text) as T, usage }
    } catch (err) {
      return {
        ok: false,
        reason: 'bad-json',
        detail: `[${opts.label}] ${err instanceof Error ? err.message : String(err)} …starts: ${JSON.stringify(text.slice(0, 120))}`,
        usage,
      }
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      ok: false,
      reason: aborted ? 'timeout' : 'http',
      detail: `[${opts.label}] ${aborted ? `timed out after ${opts.timeoutMs}ms` : err instanceof Error ? err.message : String(err)}`,
      usage: ZERO(opts.model),
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Human-readable, for a `failureReason` a user will read. Names the cause, not the code. */
export function plainFailure(reason: LlmFailureReason): string {
  switch (reason) {
    case 'no-key': return 'the drafting model is not configured on this deployment'
    case 'http': return 'the drafting model returned an error'
    case 'timeout': return 'the drafting model did not answer in time'
    case 'truncated': return 'the draft ran past its output limit and came back cut off'
    case 'blocked': return 'the drafting model refused to answer'
    case 'bad-json': return 'the drafting model returned something I could not read'
    case 'empty': return 'the drafting model returned nothing'
  }
}
