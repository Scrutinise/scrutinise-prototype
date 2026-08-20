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
import { recordGeminiUsage } from './spend-ledger'
import { providerFor } from './model-registry'
import { callModelJson } from './model-call'
import { thinkingConfigFor, outputBudgetFor } from './model-thinking'

/**
 * ⚠ 25-C §4c — THE RESULT TYPES LIVE IN `model-call.ts` AND ARE RE-EXPORTED HERE.
 *
 * They were declared in both files for about ten minutes and `tsc` immediately caught what that
 * costs: two structurally-identical unions that are not assignable to each other the moment one
 * grows a member the other lacks (`unroutable`). Every existing importer keeps importing from
 * here, so nothing downstream changes — but there is now one definition, which is the same rule
 * this sprint applied to the sift, the adversarial call and the evidence label.
 */
export type {
  LlmUsage, LlmFailureReason, LlmOk, LlmFail, LlmResult,
} from './model-call'
import type { LlmUsage, LlmResult, LlmOk, LlmFail, LlmFailureReason } from './model-call'

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
  // ⚠ BRIEF_SEARCH_S6 §3 addendum. Every build call funnels through here, so this is the one
  // place a build pass can be recorded without touching each caller. Fire-and-forget by design:
  // a ledger write must never take down the build it is measuring.
  void recordGeminiUsage(data, { stream: 'build', pass: 'build.draft', model })
  const u = (data as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    model,
    tokensIn: n(u?.promptTokenCount),
    tokensOut: n(u?.candidatesTokenCount) + n(u?.thoughtsTokenCount),
  }
}

/**
 * ⚠⚠ 25-C §4c — THIS NOW DISPATCHES BY PROVIDER, AND THAT IS THE WHOLE OF "A PASS MAY NAME ANY
 * MODEL IN CONFIG".
 *
 * Every build pass already routes through this one function, so making it provider-aware gives
 * all seven of them Anthropic and OpenAI at a single change point — rather than seven call sites
 * each growing their own vendor branch, which is precisely how the truncation guard came to be
 * missing from seven callers (CLAUDE.md §18).
 *
 * The Gemini path below is unchanged and is still the default for every pass; nothing about the
 * existing behaviour moves. What changes is that `LEX_BUILD_MODEL_ADVERSARIAL=claude-opus-5` now
 * works instead of sending a Claude id to Google's endpoint.
 */
export async function callJson<T>(opts: LlmCallOptions): Promise<LlmResult<T>> {
  const provider = providerFor(opts.model)
  if (provider && provider !== 'google') {
    return callModelJson<T>({
      model: opts.model,
      system: opts.system,
      user: opts.user,
      schema: opts.schema,
      maxOutputTokens: opts.maxOutputTokens,
      timeoutMs: opts.timeoutMs,
      temperature: opts.temperature,
      label: opts.label,
      stream: 'build',
      pass: 'build.draft',
    })
  }

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
            // 25-C §4c — per-model, and the ceiling rises for a model that must think.
            maxOutputTokens: outputBudgetFor(opts.model, opts.maxOutputTokens),
            responseMimeType: 'application/json',
            responseSchema: opts.schema,
            // OFF for every model that accepts it — §19-D Task 2b: three generators were
            // silently returning nothing because thinking ate the whole output budget. But it is
            // now decided PER MODEL: `gemini-2.5-pro` rejects a zero budget outright and was
            // unreachable through every one of our clients because of this line (25-C §4c).
            thinkingConfig: thinkingConfigFor(opts.model),
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
