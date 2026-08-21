// ─────────────────────────────────────────────────────────────────────────────
// 25-C §4c — ONE INTERFACE, THREE VENDORS. A pass may name any model in config.
//
// ⚠⚠ WHY THIS EXISTS. Until now every structured model call in the build spoke Gemini and only
// Gemini. `model-registry.ts` listed Anthropic and xAI models as REACHABLE, `MODEL_CONTRACT.md` §5
// recommended a stronger model for the adversarial pass, and pointing any pass at one would have
// sent a Claude id to Google's endpoint. The registry's own header says so: "providerFor() exists
// so a caller can fail loudly instead of sending a Claude model id to Google's endpoint" — that
// was the honest description of a gap, not a design.
//
// ANTHROPIC_API_KEY and OPENAI_API_KEY are now set in Vercel production, so the gap is worth
// closing rather than documenting.
//
// ⚠ EVERY VENDOR IS HELD TO THE SAME THREE RULES, because the failures they prevent are not
// vendor-specific (CLAUDE.md §18):
//
//   1. THE STOP REASON IS CHECKED BEFORE THE BODY IS PARSED. Gemini calls it `finishReason`,
//      Anthropic `stop_reason`, OpenAI `finish_reason`; all three mean the same thing and all
//      three turn a length limit into a JSON parse error if you parse first.
//   2. THE FAILURE NAMES ITSELF. `truncated` is not `bad-json` is not `blocked` is not `http`.
//   3. USAGE COMES BACK EVEN ON THE FAILURE PATHS. A truncated call still burned tokens, and a
//      cost ceiling that counts only successes is one a failing loop walks straight through.
//
// ⚠ AND STRUCTURED OUTPUT IS REQUESTED THREE DIFFERENT WAYS, which is the whole reason a shared
// helper is worth having:
//
//   google     `responseSchema` + `responseMimeType: application/json`
//   anthropic  a single TOOL whose `input_schema` is the schema, forced with `tool_choice`
//   openai     `response_format: { type: 'json_schema', strict: true }`
//
// A caller that had to know which would eventually get one wrong, quietly, and receive prose where
// it expected an object.
// ─────────────────────────────────────────────────────────────────────────────

import { providerFor, type Provider } from './model-registry'
import { thinkingConfigFor, outputBudgetFor } from './model-thinking'
import { samplingFor, samplingOmissions } from './model-sampling'
import { geminiFinishProblem } from './gemini-finish'
import { recordGeminiUsage, type SpendStream } from './spend-ledger'

export interface LlmUsage {
  /** What we ASKED for. */
  model: string
  tokensIn: number
  tokensOut: number
  /**
   * 25-D §1c — WHAT ANSWERED, as the response itself reported it. Null where the vendor did not
   * say, or where the call never reached one.
   *
   * ⚠ A 200 IS NOT PROOF YOU GOT THE MODEL YOU ASKED FOR. `grok-3-fast-beta` returned HTTP 200
   * for months while the body echoed `grok-4.3`, on every Lex turn that path served, with
   * nothing logged. `check:model-reachability` compares these two — but it runs on demand, and
   * a substitution that begins between runs is invisible until someone thinks to look. Carrying
   * the echoed id back on every call is what lets a caller notice at the moment it happens.
   */
  echoedModel?: string | null
}

export type LlmFailureReason =
  | 'no-key' | 'http' | 'timeout' | 'truncated' | 'blocked' | 'bad-json' | 'empty'
  /** The model id names a provider we have no client for. Never silently retried elsewhere. */
  | 'unroutable'

export interface LlmOk<T> { ok: true; value: T; usage: LlmUsage }
export interface LlmFail { ok: false; reason: LlmFailureReason; detail: string; usage: LlmUsage }
export type LlmResult<T> = LlmOk<T> | LlmFail

export interface ModelCallOptions {
  model: string
  system: string
  user: string
  /** JSON Schema the model is forced to answer in. Same object for all three vendors. */
  schema: Record<string, unknown>
  maxOutputTokens: number
  timeoutMs: number
  temperature?: number
  /** Diagnostic label — appears in every log line and in the failure detail. */
  label: string
  /** Ledger attribution. */
  stream?: SpendStream
  pass?: string
}

const ZERO = (model: string): LlmUsage => ({ model, tokensIn: 0, tokensOut: 0 })
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * Call a model and get a validated JSON object back, whoever makes it.
 *
 * ⚠ AN UNKNOWN PROVIDER IS A NAMED FAILURE, NOT A FALLBACK. Quietly routing an unrecognised model
 * to Gemini is how a pass would report results from a model nobody chose — the exact shape of the
 * xAI silent-substitution incident, where a retired id returned HTTP 200 and a different model's
 * output for months.
 */
export async function callModelJson<T>(opts: ModelCallOptions): Promise<LlmResult<T>> {
  const provider = providerFor(opts.model)
  if (!provider) {
    return {
      ok: false, reason: 'unroutable', usage: ZERO(opts.model),
      detail: `[${opts.label}] "${opts.model}" names no known provider — refusing to guess one`,
    }
  }
  switch (provider) {
    case 'google': return callGoogle<T>(opts)
    case 'anthropic': return callAnthropic<T>(opts)
    case 'openai': return callOpenAI<T>(opts)
    case 'xai': return {
      // xAI's chat API is OpenAI-shaped but its structured-output support is not verified here,
      // and an unverified claim is what this module exists to prevent.
      ok: false, reason: 'unroutable', usage: ZERO(opts.model),
      detail: `[${opts.label}] xAI has no structured-output client in this codebase yet`,
    }
  }
}

/** Which environment variable each provider's key lives in. */
export const KEY_ENV: Record<Provider, string> = {
  google: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  xai: 'GROK_API_KEY',
}

export function hasKeyFor(provider: Provider): boolean {
  return !!process.env[KEY_ENV[provider]]?.trim()
}

/**
 * 25-D §1b — THE SAMPLING DECISION IS TAKEN ONCE, FOR EVERY VENDOR, IN ONE PLACE.
 *
 * 25-C fixed `claude-sonnet-5`'s hard 400 on `temperature` with an Anthropic-local allow-list
 * inside `callAnthropic`. That was correct and too narrow in two ways, both of which are the
 * shape this codebase has already been bitten by:
 *
 *   · IT LIVED IN ONE VENDOR BRANCH. The next model to deprecate a knob will not be Anthropic's,
 *     and the fix would have had to be written a third time — which is exactly how the truncation
 *     guard came to be missing from seven callers (CLAUDE.md §18).
 *   · IT WAS AN ALLOW-LIST OF MODELS THAT ACCEPT, so an Anthropic id nobody had probed silently
 *     lost a parameter it supports. `REJECTS_TEMPERATURE` states the measured fact instead: these
 *     five refuse it, everything else gets it.
 *
 * `samplingFor()` returns the parameters this model may actually carry; the omission is logged
 * rather than silent, because a parameter that quietly stops being sent is a behaviour change
 * nobody can see. See `model-sampling.ts` for the probe evidence.
 */
function sampling(o: ModelCallOptions, fallback?: number): Record<string, number> {
  const want = { temperature: o.temperature ?? fallback }
  const dropped = samplingOmissions(o.model, want)
  if (dropped.length) {
    console.log('[model-call] sampling parameter omitted', { label: o.label, model: o.model, dropped })
  }
  return samplingFor(o.model, want) as Record<string, number>
}

// ── Google ───────────────────────────────────────────────────────────────────

async function callGoogle<T>(o: ModelCallOptions): Promise<LlmResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { ok: false, reason: 'no-key', detail: `[${o.label}] GEMINI_API_KEY not set`, usage: ZERO(o.model) }

  // ⚠ 25-C §4c — PER-MODEL, NOT GLOBAL. `gemini-2.5-pro` rejects a zero thinking budget outright
  // (400, "This model only works in thinking mode"), which made it unreachable through every one
  // of our clients while the registry listed it as available. The budget is now a property of the
  // model, and the output ceiling rises with it because thinking tokens count against it.
  const maxOutputTokens = outputBudgetFor(o.model, o.maxOutputTokens)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${o.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: o.system }] },
          contents: [{ role: 'user', parts: [{ text: o.user }] }],
          generationConfig: {
            ...sampling(o, 0.4),
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: o.schema,
            thinkingConfig: thinkingConfigFor(o.model),
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, reason: 'http', detail: `[${o.label}] HTTP ${res.status} ${body.slice(0, 300)}`, usage: ZERO(o.model) }
    }
    const data = await res.json() as {
      usageMetadata?: Record<string, unknown>
      modelVersion?: string
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
    }
    void recordGeminiUsage(data, { stream: o.stream ?? 'lex', pass: o.pass ?? o.label, model: o.model })
    const usage: LlmUsage = {
      model: o.model,
      tokensIn: n(data?.usageMetadata?.promptTokenCount),
      tokensOut: n(data?.usageMetadata?.candidatesTokenCount) + n(data?.usageMetadata?.thoughtsTokenCount),
      echoedModel: data?.modelVersion ?? null,
    }

    // Rule 1 — before parsing.
    const cut = geminiFinishProblem(data?.candidates?.[0], maxOutputTokens, { label: o.label })
    if (cut) return { ok: false, reason: cut.reason, detail: cut.detail, usage }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return parseJson<T>(text, usage, o.label)
  } catch (err) {
    return abortOrHttp(err, o)
  } finally { clearTimeout(timer) }
}

// ── Anthropic ────────────────────────────────────────────────────────────────

/**
 * ⚠ STRUCTURED OUTPUT VIA A FORCED TOOL. Anthropic has no `responseSchema`; the supported way to
 * get a guaranteed-shape object is to declare ONE tool whose `input_schema` is the schema and force
 * it with `tool_choice`. The model then "calls" it and the arguments ARE the object.
 *
 * That also means the answer arrives in a `tool_use` block rather than a text block — reading
 * `content[0].text` would find nothing and look like an empty response.
 */
async function callAnthropic<T>(o: ModelCallOptions): Promise<LlmResult<T>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, reason: 'no-key', detail: `[${o.label}] ANTHROPIC_API_KEY not set`, usage: ZERO(o.model) }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: o.model,
        max_tokens: o.maxOutputTokens,
        // ⚠ OMITTED where this model refuses it — see `model-sampling.ts`. Sending
        // `temperature` to a model that has deprecated it is a hard 400, not a warning.
        // No fallback here on purpose: Anthropic's own default is a deliberate choice and
        // substituting 0.4 for every caller that never asked would change behaviour silently.
        ...sampling(o),
        system: o.system,
        messages: [{ role: 'user', content: o.user }],
        tools: [{ name: 'emit', description: 'Return the result.', input_schema: o.schema }],
        tool_choice: { type: 'tool', name: 'emit' },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, reason: 'http', detail: `[${o.label}] HTTP ${res.status} ${body.slice(0, 300)}`, usage: ZERO(o.model) }
    }
    const data = await res.json() as {
      stop_reason?: string
      model?: string
      usage?: { input_tokens?: number; output_tokens?: number }
      content?: Array<{ type?: string; text?: string; input?: unknown }>
    }
    const usage: LlmUsage = {
      model: o.model,
      tokensIn: n(data?.usage?.input_tokens),
      tokensOut: n(data?.usage?.output_tokens),
      echoedModel: data?.model ?? null,
    }

    // Rule 1 — before reading the body. `max_tokens` is Anthropic's `MAX_TOKENS`.
    if (data.stop_reason === 'max_tokens') {
      return {
        ok: false, reason: 'truncated', usage,
        detail: `[${o.label}] cut off at max_tokens=${o.maxOutputTokens} — raise the budget or shorten the input`,
      }
    }
    if (data.stop_reason === 'refusal') {
      return { ok: false, reason: 'blocked', detail: `[${o.label}] the model refused to answer`, usage }
    }

    const tool = data.content?.find((c) => c.type === 'tool_use')
    if (!tool || tool.input == null) {
      return { ok: false, reason: 'empty', detail: `[${o.label}] no tool_use block in the response`, usage }
    }
    // The arguments are already an object — there is nothing to parse, which removes a whole
    // failure mode the other two vendors still have.
    return { ok: true, value: tool.input as T, usage }
  } catch (err) {
    return abortOrHttp(err, o)
  } finally { clearTimeout(timer) }
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

/**
 * ⚠ `strict: true` REQUIRES A CLOSED SCHEMA — every property in `required`, and
 * `additionalProperties: false` throughout. Our schemas are written for Gemini, which is laxer, so
 * `closeSchema` below adapts them rather than asking every caller to maintain two.
 */
async function callOpenAI<T>(o: ModelCallOptions): Promise<LlmResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ok: false, reason: 'no-key', detail: `[${o.label}] OPENAI_API_KEY not set`, usage: ZERO(o.model) }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: o.model,
        max_completion_tokens: o.maxOutputTokens,
        // ⚠ Through the same per-model gate as the other two vendors. Several OpenAI reasoning
        // models reject `temperature` outright as well; this path has never been exercised
        // end to end (no key on this machine), and hardcoding the parameter is precisely how
        // it would 400 on its first live call.
        ...sampling(o, 0.4),
        messages: [
          { role: 'system', content: o.system },
          { role: 'user', content: o.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'result', strict: true, schema: closeSchema(o.schema) },
        },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, reason: 'http', detail: `[${o.label}] HTTP ${res.status} ${body.slice(0, 300)}`, usage: ZERO(o.model) }
    }
    const data = await res.json() as {
      model?: string
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      choices?: Array<{ finish_reason?: string; message?: { content?: string; refusal?: string } }>
    }
    const usage: LlmUsage = {
      model: o.model,
      tokensIn: n(data?.usage?.prompt_tokens),
      tokensOut: n(data?.usage?.completion_tokens),
      echoedModel: data?.model ?? null,
    }

    const choice = data.choices?.[0]
    // Rule 1 — before parsing.
    if (choice?.finish_reason === 'length') {
      return {
        ok: false, reason: 'truncated', usage,
        detail: `[${o.label}] cut off at max_completion_tokens=${o.maxOutputTokens} — raise the budget or shorten the input`,
      }
    }
    if (choice?.message?.refusal) {
      return { ok: false, reason: 'blocked', detail: `[${o.label}] refused: ${choice.message.refusal.slice(0, 200)}`, usage }
    }
    return parseJson<T>(choice?.message?.content, usage, o.label)
  } catch (err) {
    return abortOrHttp(err, o)
  } finally { clearTimeout(timer) }
}

/**
 * Make a Gemini-shaped schema acceptable to OpenAI's `strict` mode.
 *
 * ⚠ It sets `additionalProperties: false` and promotes EVERY property into `required`, because
 * strict mode demands both. That is a real behavioural difference — a field our Gemini schemas
 * treat as optional becomes mandatory — and it is done here, once, rather than by asking every
 * caller to keep two copies of a schema in step. Where a field is genuinely optional the caller
 * should model it as a nullable type rather than by omission.
 */
export function closeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node
    const o = { ...(node as Record<string, unknown>) }
    if (o.type === 'object' && o.properties && typeof o.properties === 'object') {
      o.properties = Object.fromEntries(
        Object.entries(o.properties as Record<string, unknown>).map(([k, v]) => [k, walk(v)]),
      )
      o.required = Object.keys(o.properties as Record<string, unknown>)
      o.additionalProperties = false
    }
    if (o.items) o.items = walk(o.items)
    return o
  }
  return walk(schema) as Record<string, unknown>
}

// ── Shared ───────────────────────────────────────────────────────────────────

function parseJson<T>(text: string | undefined | null, usage: LlmUsage, label: string): LlmResult<T> {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, reason: 'empty', detail: `[${label}] no text in the response`, usage }
  }
  try {
    return { ok: true, value: JSON.parse(text) as T, usage }
  } catch (err) {
    return {
      ok: false, reason: 'bad-json', usage,
      detail: `[${label}] ${err instanceof Error ? err.message : String(err)} …starts: ${JSON.stringify(text.slice(0, 120))}`,
    }
  }
}

function abortOrHttp(err: unknown, o: ModelCallOptions): LlmFail {
  const aborted = err instanceof Error && err.name === 'AbortError'
  return {
    ok: false,
    reason: aborted ? 'timeout' : 'http',
    detail: `[${o.label}] ${aborted ? `timed out after ${o.timeoutMs}ms` : err instanceof Error ? err.message : String(err)}`,
    usage: ZERO(o.model),
  }
}
