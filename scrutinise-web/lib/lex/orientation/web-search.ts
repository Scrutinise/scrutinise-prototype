// ─────────────────────────────────────────────────────────────────────────────
// S21 §1/§1a/§5 — THE PROVIDER-NEUTRAL WEB-SEARCH INTERFACE.
//
// Web orientation went dark from 6 August because it depended on ONE vendor's search API
// and that vendor withdrew it. The design goal here is that no single provider's
// withdrawal can switch this layer off again — so orientation calls ONE function
// (`webSearch`), never a vendor's SDK directly, and the function itself never assumes
// which vendor answered.
//
// ⚠ THIS IS NOT A REPLACEMENT FOR THE EXISTING TIER B/TIER C MACHINERY. `web-orientation.ts`
// (Gemini grounding → six-category structured analysis) and `x-orientation.ts` (Grok
// x_search → recency scan + argument mining) do rich, schema-specific extraction that a
// generic "list of search results" cannot express — that work stays as it is. This file is
// the NEW, lower-level primitive: a plain `query → results[]` call, each result carrying
// url/title/date/snippet/provider/cost, used (a) directly by any future caller that just
// wants search results, and (b) as `web-orientation.ts`'s FALLBACK when its primary
// (Gemini) pass fails outright, so Tier B degrades to a second provider instead of going
// dark — see the `webSearchFallback` export and its use in `web-orientation.ts`.
//
// §1a — PROVIDER AND EXCLUDE. The caller may ask a SPECIFIC provider (continue with the
// same one for more, or ask a second opinion), or EXCLUDE one (used by the fallback path
// to guarantee it never retries the provider that just failed). Two providers agreeing on
// a fact is stronger evidence; when they disagree, the CALLER's job is to say so — this
// function only reports who answered, once, per call. A caller wanting to compare two
// providers on the same query makes two calls, one with `provider: 'google'` and one with
// `provider: 'xai'`, and compares the results itself.
//
// §5 — FALLBACK ORDER. `webSearch` tries providers in order and stops at the first one
// that actually ANSWERS (even with zero results — an honest "found nothing" is not a
// failure). It only moves to the next provider when a call could not be completed at all
// (no key, HTTP error, timeout, unusable response) — never because the first provider's
// results were merely thin. The returned `provider` field says who answered; `ok: false`
// means every candidate failed to complete, and `reason` says why, so a caller can never
// mistake "nobody answered" for "the web has nothing to say" (CLAUDE.md §18's family rule).
//
// Verified against docs.x.ai on 2026-09-24 (web_search tool shape, citation annotations,
// Responses API field names) — see docs/SEARCH_S21_REPORT.md §2 for the exact pages read.
// ⚠ UNVERIFIED LIVE: no GROK_API_KEY on this machine. Built to the documented contract.
//
// Config:
//   WEB_SEARCH_XAI_MODEL       default grok-4.3 (reuses orientation.x's measured default)
//   WEB_SEARCH_GOOGLE_MODEL    default gemini-2.5-flash
//   WEB_SEARCH_ANTHROPIC_MODEL default claude-haiku-4-5-20251001
//   WEB_SEARCH_TIMEOUT_MS      default 30000 (per provider, per attempt)
// ─────────────────────────────────────────────────────────────────────────────

import type { Provider } from '../model-registry'
import { recordAnthropicUsage, recordGeminiUsage, recordOpenaiUsage, recordXaiUsage, type SpendStream } from '../spend-ledger'
import { normaliseDate } from './noise-filter'
import { fetchedContentIsData } from '../fetched-content-guard'
import { resolveGroundingUrls } from './resolve-redirect'
import { geminiFinishProblem } from '../gemini-finish'

/** S24b — Anthropic's native `web_search` tool added and measured against xai/google
 *  (docs/SEARCH_S24B_REPORT.md). S25 — OpenAI's ("Luna") adapter added too, built against
 *  docs alone (no OPENAI_API_KEY on this machine — see model-registry.ts). */
export type WebSearchProvider = Extract<Provider, 'xai' | 'google' | 'anthropic' | 'openai'>

export interface WebSearchResult {
  /** S24 — the RESOLVED final address for Google results (Gemini grounding never hands back
   *  the real page — see resolve-redirect.ts). Already the real URL for xAI results, which
   *  cites directly. */
  url: string
  /** S24 — present only for Google results: Gemini's own grounding-redirect wrapper URL,
   *  kept for provenance. Absent for xAI, which has no such indirection. */
  redirectUrl?: string
  title: string
  /** ISO yyyy-mm-dd, or null when neither the provider nor the model could date it. */
  date: string | null
  snippet: string
  provider: WebSearchProvider
}

export interface WebSearchOptions {
  query: string
  /** Steers the model's date preference; NOT a hard filter at the API level — see the
   *  header note that xAI's `web_search` tool has no from_date/to_date, unlike `x_search`.
   *  Results outside the window are not dropped, only de-prioritised in the prompt. */
  recencyDays?: number
  /** Per-provider attempt timeout. */
  budgetMs?: number
  /** §1a — ask a specific provider instead of the default order. */
  provider?: WebSearchProvider
  /** §1a — never ask these providers, even as a fallback. */
  exclude?: WebSearchProvider[]
  /** Ledger attribution — see spend-ledger.ts. */
  stream?: SpendStream
  pass?: string
  label?: string
  /** S21 §7 amendment — "each ledger row stamped with userId". Optional: orientation's own
   *  callers (no single user) leave it unset; a user-initiated caller (chat web search)
   *  passes the person who triggered it. */
  userId?: string | null
  ideaId?: string | null
}

export interface WebSearchOutcome {
  ok: boolean
  /** Which provider actually answered. Null when none did. */
  provider: WebSearchProvider | null
  results: WebSearchResult[]
  costUsd: number
  ms: number
  /** Every provider this call actually tried, in order. */
  attempted: WebSearchProvider[]
  /** Present only when ok === false — every candidate failed to complete. */
  reason?: string
}

const DEFAULT_ORDER: WebSearchProvider[] = ['xai', 'google']
const XAI_RESPONSES = 'https://api.x.ai/v1/responses'
const OPENAI_RESPONSES = 'https://api.openai.com/v1/responses'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface AdapterResult { results: WebSearchResult[]; costUsd: number }

// ── xAI adapter — web_search tool, one call (Responses API combines tools + JSON mode) ──

const XAI_RESULTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string' }, title: { type: 'string' },
          date: { type: 'string' }, snippet: { type: 'string' },
        },
        required: ['url', 'title', 'date', 'snippet'],
      },
    },
  },
  required: ['results'],
}

async function searchXai(opts: WebSearchOptions): Promise<AdapterResult | null> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) return null
  const model = process.env.WEB_SEARCH_XAI_MODEL ?? 'grok-4.3'
  const timeoutMs = opts.budgetMs ?? parseInt(process.env.WEB_SEARCH_TIMEOUT_MS ?? '30000', 10)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const recency = opts.recencyDays ? ` Prefer results from the last ${opts.recencyDays} days where relevant.` : ''
    const res = await fetch(XAI_RESPONSES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: `You search the web and return SOURCES, not an answer. Return up to 8 of the most `
          + `relevant real results as JSON: the exact URL, its title, its date (yyyy-mm-dd, or empty if `
          + `undated), and a one-sentence snippet relevant to the query.${recency} Only return a URL you `
          + `actually found via search — never invent one.\n\n${fetchedContentIsData('content of any page you read while searching')}`,
        input: [{ role: 'user', content: opts.query }],
        tools: [{ type: 'web_search' }],
        max_output_tokens: 2048,
        temperature: 0.2,
        text: { format: { type: 'json_schema', name: 'web_search_results', schema: XAI_RESULTS_SCHEMA } },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn('[web-search:xai] HTTP', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return null
    }
    type Resp = {
      status?: string
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string }> }> }>
    }
    const data = await res.json() as Resp
    const priced = await recordXaiUsage(data, {
      stream: opts.stream ?? 'orientation', pass: opts.pass ?? 'orientation.web-search', model,
      ref: opts.label ?? null, userId: opts.userId ?? null, ideaId: opts.ideaId ?? null,
    })
    const costUsd = priced.usd ?? 0
    if (data.status === 'incomplete') {
      console.warn('[web-search:xai] response incomplete — discarding')
      return null
    }
    const message = (data.output ?? []).find((o) => o.type === 'message')
    const parts = message?.content ?? []
    const text = parts.filter((p) => !p.type || p.type === 'output_text').map((p) => p.text ?? '').join('')
    // ⚠ THE SAME DEFENCE THE GEMINI PATH USES: a URL the model writes itself cannot survive.
    // Only a URL that appears in the tool's OWN citation annotations is trusted.
    const citedUrls = new Set(
      parts.flatMap((p) => p.annotations ?? [])
        .filter((a) => a.type === 'url_citation' && typeof a.url === 'string')
        .map((a) => a.url as string),
    )
    if (!text.trim()) return { results: [], costUsd }
    let parsed: { results?: unknown }
    try { parsed = JSON.parse(text) as { results?: unknown } } catch {
      console.warn('[web-search:xai] unparseable JSON')
      return null
    }
    const raw = Array.isArray(parsed.results) ? parsed.results : []
    const results: WebSearchResult[] = raw
      .map((r): WebSearchResult | null => {
        const e = r as Record<string, unknown>
        const url = typeof e.url === 'string' ? e.url.trim() : ''
        const title = typeof e.title === 'string' ? e.title.trim() : ''
        if (!url || !title || !citedUrls.has(url)) return null
        return { url, title, date: normaliseDate(e.date), snippet: typeof e.snippet === 'string' ? e.snippet.trim() : '', provider: 'xai' }
      })
      .filter((r): r is WebSearchResult => r !== null)
    return { results, costUsd }
  } catch (err) {
    console.warn('[web-search:xai] failed:', err instanceof Error ? err.message : err)
    return null
  } finally { clearTimeout(timer) }
}

// ── Google adapter — grounding, then structure (cannot combine, see web-orientation.ts) ──

async function callGeminiRaw(opts: {
  model: string; apiKey: string; timeoutMs: number; system?: string; user: string
  grounded: boolean; schema?: object
}): Promise<{ text: string; sources: Array<{ url: string; redirectUrl: string; title: string }>; usage: unknown } | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        ...(opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema, thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }
    if (opts.system) body.system_instruction = { parts: [{ text: opts.system }] }
    if (opts.grounded) body.tools = [{ google_search: {} }]
    const res = await fetch(`${GEMINI_BASE}/${opts.model}:generateContent?key=${opts.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn('[web-search:google] HTTP', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return null
    }
    type Resp = {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }>
      usageMetadata?: Record<string, unknown>
    }
    const data = await res.json() as Resp
    const cand = data.candidates?.[0]
    // CLAUDE.md §18 — BEFORE reading the body. A truncated grounded note reads as merely thin;
    // a truncated structured pass would surface as `JSON.parse` failing on the caller's side and
    // read as a serialiser bug rather than a length limit. Name it here, once, for both callers.
    const problem = geminiFinishProblem(cand, 2048, { label: 'web-search:google' })
    if (problem) {
      console.warn(`[web-search:google] ${problem.detail}`)
      return null
    }
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('')
    const rawSources = (cand?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => c.web).filter((w): w is { uri?: string; title?: string } => !!w)
      .map((w) => ({ redirectUrl: (w.uri ?? '').trim(), title: (w.title ?? '').trim() || 'web source' }))
      .filter((s) => s.redirectUrl.length > 0)
    // S24 — resolved before storage/display, same rule and same function as web-orientation.ts.
    const resolved = await resolveGroundingUrls(rawSources.map((s) => s.redirectUrl))
    if (resolved.size) {
      const vals = [...resolved.values()]
      const dead = vals.filter((r) => r.dead).length
      const blocked = vals.filter((r) => !r.dead && r.status != null && r.status >= 400).length
      console.log(`[web-search:google] redirect resolution: ${resolved.size - dead}/${resolved.size} resolved`
        + `, ${dead} dead, ${blocked} resolved-but-blocked (non-2xx)`)
    }
    const sources = rawSources.map((s) => {
      const r = resolved.get(s.redirectUrl)
      return { url: r?.url ?? s.redirectUrl, redirectUrl: s.redirectUrl, title: s.title }
    })
    return { text, sources, usage: data.usageMetadata }
  } catch (err) {
    console.warn('[web-search:google] failed:', err instanceof Error ? err.message : err)
    return null
  } finally { clearTimeout(timer) }
}

const GOOGLE_STRUCTURE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, date: { type: 'string' }, snippet: { type: 'string' }, sourceIndex: { type: 'integer' } },
        required: ['title', 'date', 'snippet', 'sourceIndex'],
      },
    },
  },
  required: ['results'],
}

async function searchGoogle(opts: WebSearchOptions): Promise<AdapterResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const model = process.env.WEB_SEARCH_GOOGLE_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = opts.budgetMs ?? parseInt(process.env.WEB_SEARCH_TIMEOUT_MS ?? '30000', 10)
  const recency = opts.recencyDays ? ` Prefer results from the last ${opts.recencyDays} days where relevant.` : ''

  const grounded = await callGeminiRaw({
    model, apiKey, timeoutMs, grounded: true,
    user: `Search the web for: ${opts.query}\n\nReport, in compact bullets, the most relevant real pages you find, each with its date.${recency}`,
  })
  if (!grounded) return null
  let costUsd = 0
  if (grounded.usage) {
    const priced = await recordGeminiUsage({ usageMetadata: grounded.usage }, {
      stream: opts.stream ?? 'orientation', pass: opts.pass ?? 'orientation.web-search', model,
      ref: opts.label ?? null, userId: opts.userId ?? null, ideaId: opts.ideaId ?? null,
    })
    costUsd += priced.usd ?? 0
  }
  if (!grounded.sources.length) return { results: [], costUsd }

  const sourceList = grounded.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n')
  const structured = await callGeminiRaw({
    model, apiKey, timeoutMs, grounded: false, schema: GOOGLE_STRUCTURE_SCHEMA,
    system: 'You convert a research note into a JSON list of search results. `sourceIndex` must be the number of the source in the SOURCES list that supports the item. If no source supports it, omit it — never guess an index.\n\n'
      + fetchedContentIsData('research note'),
    user: `RESEARCH NOTE:\n${grounded.text}\n\nSOURCES:\n${sourceList}`,
  })
  if (!structured) return { results: [], costUsd }
  if (structured.usage) {
    const priced = await recordGeminiUsage({ usageMetadata: structured.usage },
      { stream: opts.stream ?? 'orientation', pass: opts.pass ?? 'orientation.web-search', model, ref: opts.label ?? null })
    costUsd += priced.usd ?? 0
  }

  let parsed: { results?: unknown }
  try { parsed = JSON.parse(structured.text) as { results?: unknown } } catch {
    console.warn('[web-search:google] unparseable structuring JSON')
    return { results: [], costUsd }
  }
  const raw = Array.isArray(parsed.results) ? parsed.results : []
  const results: WebSearchResult[] = raw
    .map((r): WebSearchResult | null => {
      const e = r as Record<string, unknown>
      const idx = typeof e.sourceIndex === 'number' ? Math.trunc(e.sourceIndex) : NaN
      const source = grounded.sources[idx - 1]
      if (!source) return null
      const date = normaliseDate(e.date)
      const snippet = typeof e.snippet === 'string' ? e.snippet.trim() : ''
      return { url: source.url, redirectUrl: source.redirectUrl, title: source.title, date, snippet, provider: 'google' }
    })
    .filter((r): r is WebSearchResult => r !== null)
  return { results: dedupeFalseCorroboration(results), costUsd }
}

/**
 * S25 — FALSE CORROBORATION GUARD. Measured live: the structuring pass can attach the SAME
 * sentence to several different `sourceIndex` values (one grounded-note sentence, fanned out
 * across every source it was told to justify), which reads to a reviewer as N independent
 * sources corroborating a fact when it is really one sentence copy-pasted N times — found on
 * "How does Germany regulate short-term rental platforms like Airbnb?" (7 distinct URLs, one
 * identical sentence, docs/SEARCH_S25_REPORT.md).
 *
 * ⚠ THE INVARIANT IS "IDENTICAL TEXT ACROSS DIFFERENT URLS", NOT "ONE RESULT PER URL". A
 * legitimate case exists and must survive untouched: several DIFFERENT facts sourced to the
 * SAME page (e.g. four different Irish minimum-wage age bands, all correctly cited to one
 * page) is real corroboration-by-citation, not the defect. Dedupe strictly on snippet text:
 * a snippet is compared to every other snippet, and a group sharing IDENTICAL text (after
 * trimming/case/whitespace normalisation) collapses to its first member — whether that
 * group's urls are all different (the defect this exists for) or all the same (an ordinary
 * duplicate the model happened to emit twice). A result with no snippet text at all is never
 * collapsed — there is nothing to compare.
 */
export function dedupeFalseCorroboration(results: WebSearchResult[]): WebSearchResult[] {
  const bySnippet = new Map<string, WebSearchResult[]>()
  let noSnippetSeq = 0
  for (const r of results) {
    const normalised = r.snippet.trim().toLowerCase().replace(/\s+/g, ' ')
    const key = normalised ? normalised : `__no-snippet-${noSnippetSeq++}__`
    const group = bySnippet.get(key)
    if (group) group.push(r); else bySnippet.set(key, [r])
  }
  const deduped: WebSearchResult[] = []
  for (const [key, group] of bySnippet) {
    if (group.length > 1) {
      const distinctUrls = new Set(group.map((r) => r.url)).size
      console.warn(`[web-search:google] false-corroboration guard: identical snippet across ${group.length} result(s) `
        + `(${distinctUrls} distinct URL${distinctUrls === 1 ? '' : 's'}), collapsed to 1 — "${key.slice(0, 80)}"`)
    }
    deduped.push(group[0])
  }
  return deduped
}

// ── Anthropic adapter — native web_search tool + a forced-choice structuring tool ──
//
// ⚠ VERIFIED LIVE 2026-09-25 (S24b), not built to documentation alone. `tool_choice: 'auto'`
// with BOTH `web_search_20250305` (server-side) and `emit_results` (client-side, forces the
// SHAPE once the model decides to answer) in one call: the model runs the search itself,
// then calls `emit_results` with `stop_reason: 'tool_use'` — a real call returned five
// results with real, non-redirected URLs (a UK Parliament research briefing, ONS, Trading
// Economics) and `usage.server_tool_use.web_search_requests: 1`. Forcing `tool_choice` to
// `emit_results` directly was NOT tried and may reject the server tool outright — `auto` is
// what is proven to work, so that is what ships.
const ANTHROPIC_RESULTS_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { url: { type: 'string' }, title: { type: 'string' }, date: { type: 'string' }, snippet: { type: 'string' } },
        required: ['url', 'title', 'date', 'snippet'],
      },
    },
  },
  required: ['results'],
}

async function searchAnthropic(opts: WebSearchOptions): Promise<AdapterResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const model = process.env.WEB_SEARCH_ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
  const timeoutMs = opts.budgetMs ?? parseInt(process.env.WEB_SEARCH_TIMEOUT_MS ?? '30000', 10)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const recency = opts.recencyDays ? ` Prefer results from the last ${opts.recencyDays} days where relevant.` : ''
    const body = JSON.stringify({
      model,
      max_tokens: 2048,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
        {
          name: 'emit_results',
          description: 'Return the search results as structured data. Call this as your final action.',
          input_schema: ANTHROPIC_RESULTS_SCHEMA,
        },
      ],
      // ⚠ 'auto', NOT forced onto emit_results — the server-side web_search tool has to run
      // FIRST, and forcing tool_choice was never proven compatible with that. See header.
      tool_choice: { type: 'auto' },
      messages: [{
        role: 'user',
        content: `Search the web for: ${opts.query}\n\nThen call emit_results with up to 8 of the `
          + `most relevant real results: the exact URL, its title, its date (yyyy-mm-dd, or empty `
          + `if undated), and a one-sentence snippet relevant to the query.${recency} Only return a `
          + `URL your search actually found — never invent one.\n\n${fetchedContentIsData('content of any page found while searching')}`,
      }],
    })

    // ⚠ S24b — MEASURED, NOT SPECULATIVE: the FIRST fetch to api.anthropic.com in a fresh
    // Node process failed with a bare `TypeError: fetch failed` in 5 of 10 comparison
    // questions (fast failures, 60–150ms — a connection-level fault, not a slow timeout);
    // every later call in the SAME process succeeded, and Google's adapter (same process,
    // same script, its own back-to-back calls) never failed once. This is CLAUDE.md's
    // "genuinely transient" case (network-level, not a parse failure), and it matters
    // beyond this sandbox: a Vercel serverless cold start is also "the first fetch to this
    // host in a fresh process" — the same shape. ONE retry, network-layer failures only
    // (a `TypeError`, never an HTTP error response, which is handled separately below).
    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body, signal: ctrl.signal,
      })
    } catch (err) {
      if (!(err instanceof TypeError) || ctrl.signal.aborted) throw err
      // ⚠ THE DELAY IS LOAD-BEARING, MEASURED NOT GUESSED. An immediate retry re-failed 5/5
      // times (S24b) — almost certainly reusing the same bad pooled keep-alive socket. A short
      // pause lets the connection pool cycle to a fresh one before the retry.
      console.warn('[web-search:anthropic] first fetch failed at the network layer, retrying once:', err.message)
      await new Promise((r) => setTimeout(r, 800))
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', Connection: 'close' },
        body, signal: ctrl.signal,
      })
    }
    if (!res.ok) {
      console.warn('[web-search:anthropic] HTTP', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return null
    }
    type Resp = {
      stop_reason?: string
      content?: Array<{
        type?: string; input?: unknown
        content?: Array<{ type?: string; url?: string }>
      }>
    }
    const data = await res.json() as Resp
    const priced = await recordAnthropicUsage(data, {
      stream: opts.stream ?? 'orientation', pass: opts.pass ?? 'orientation.web-search', model,
      ref: opts.label ?? null, userId: opts.userId ?? null, ideaId: opts.ideaId ?? null,
    })
    const costUsd = priced.usd ?? 0
    if (data.stop_reason === 'max_tokens') {
      console.warn('[web-search:anthropic] truncated at max_tokens — discarding')
      return { results: [], costUsd }
    }
    // ⚠ THE SAME DEFENCE THE OTHER TWO ADAPTERS USE: a URL the model writes itself cannot
    // survive. Only a URL that appears in the tool's OWN `web_search_tool_result` blocks —
    // never a URL the model merely typed into `emit_results` — is trusted.
    const citedUrls = new Set(
      (data.content ?? [])
        .filter((c) => c.type === 'web_search_tool_result')
        .flatMap((c) => c.content ?? [])
        .filter((r) => r.type === 'web_search_result' && typeof r.url === 'string')
        .map((r) => r.url as string),
    )
    const emit = (data.content ?? []).find((c) => c.type === 'tool_use') as
      { input?: { results?: unknown } } | undefined
    const raw = Array.isArray(emit?.input?.results) ? emit!.input!.results as unknown[] : []
    const results: WebSearchResult[] = raw
      .map((r): WebSearchResult | null => {
        const e = r as Record<string, unknown>
        const url = typeof e.url === 'string' ? e.url.trim() : ''
        const title = typeof e.title === 'string' ? e.title.trim() : ''
        if (!url || !title || !citedUrls.has(url)) return null
        return { url, title, date: normaliseDate(e.date), snippet: typeof e.snippet === 'string' ? e.snippet.trim() : '', provider: 'anthropic' }
      })
      .filter((r): r is WebSearchResult => r !== null)
    return { results, costUsd }
  } catch (err) {
    console.warn('[web-search:anthropic] failed:', err instanceof Error ? err.message : err)
    return null
  } finally { clearTimeout(timer) }
}

/**
 * S25 — the OpenAI ("Luna") adapter. OpenAI's Responses API is close in shape to xAI's (both
 * `input`/`tools: [{type:'web_search'}]`/`output` array with `url_citation` annotations), so
 * this closely mirrors `searchXai` rather than `searchAnthropic`'s two-tool pattern.
 * `tool_choice: 'required'` (unlike xAI, which leaves it to `'auto'`) because this adapter's
 * whole purpose IS a web search — there is no other reason to call it.
 *
 * ⚠ NOT IN `DEFAULT_ORDER` — same status as Anthropic after S24b: built and measured, not a
 * live fallback. See this file's `DEFAULT_ORDER` comment and docs/SEARCH_S25_REPORT.md.
 */
async function searchOpenAI(opts: WebSearchOptions): Promise<AdapterResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = process.env.WEB_SEARCH_OPENAI_MODEL ?? 'gpt-6-luna'
  const timeoutMs = opts.budgetMs ?? parseInt(process.env.WEB_SEARCH_TIMEOUT_MS ?? '30000', 10)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const recency = opts.recencyDays ? ` Prefer results from the last ${opts.recencyDays} days where relevant.` : ''
    const res = await fetch(OPENAI_RESPONSES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: `You search the web and return SOURCES, not an answer. Return up to 8 of the most `
          + `relevant real results as JSON: the exact URL, its title, its date (yyyy-mm-dd, or empty if `
          + `undated), and a one-sentence snippet relevant to the query.${recency} Only return a URL you `
          + `actually found via search — never invent one.\n\n${fetchedContentIsData('content of any page you read while searching')}`,
        input: [{ role: 'user', content: opts.query }],
        tools: [{ type: 'web_search' }],
        tool_choice: 'required',
        max_output_tokens: 2048,
        temperature: 0.2,
        text: { format: { type: 'json_schema', name: 'web_search_results', schema: XAI_RESULTS_SCHEMA } },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn('[web-search:openai] HTTP', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return null
    }
    type Resp = {
      status?: string
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string }> }> }>
    }
    const data = await res.json() as Resp
    const priced = await recordOpenaiUsage(data, {
      stream: opts.stream ?? 'orientation', pass: opts.pass ?? 'orientation.web-search', model,
      ref: opts.label ?? null, userId: opts.userId ?? null, ideaId: opts.ideaId ?? null,
    })
    const costUsd = priced.usd ?? 0
    if (data.status === 'incomplete') {
      console.warn('[web-search:openai] response incomplete — discarding')
      return null
    }
    const message = (data.output ?? []).find((o) => o.type === 'message')
    const parts = message?.content ?? []
    const text = parts.filter((p) => !p.type || p.type === 'output_text').map((p) => p.text ?? '').join('')
    // ⚠ SAME DEFENCE AS THE OTHER THREE ADAPTERS: a URL the model writes itself cannot
    // survive. Only a URL that appears in the tool's OWN `url_citation` annotations is trusted.
    const citedUrls = new Set(
      parts.flatMap((p) => p.annotations ?? [])
        .filter((a) => a.type === 'url_citation' && typeof a.url === 'string')
        .map((a) => a.url as string),
    )
    if (!text.trim()) return { results: [], costUsd }
    let parsed: { results?: unknown }
    try { parsed = JSON.parse(text) as { results?: unknown } } catch {
      console.warn('[web-search:openai] unparseable JSON')
      return null
    }
    const raw = Array.isArray(parsed.results) ? parsed.results : []
    const results: WebSearchResult[] = raw
      .map((r): WebSearchResult | null => {
        const e = r as Record<string, unknown>
        const url = typeof e.url === 'string' ? e.url.trim() : ''
        const title = typeof e.title === 'string' ? e.title.trim() : ''
        if (!url || !title || !citedUrls.has(url)) return null
        return { url, title, date: normaliseDate(e.date), snippet: typeof e.snippet === 'string' ? e.snippet.trim() : '', provider: 'openai' }
      })
      .filter((r): r is WebSearchResult => r !== null)
    // ⚠ NOT run through `dedupeFalseCorroboration()` — that guard was built for a specific,
    // MEASURED defect in Google's two-pass grounding→structuring design (§7). This adapter's
    // single-pass JSON-with-citations shape is closer to xAI's (also untouched) than
    // Google's; extending the guard here without a measurement of the same defect would be
    // scope this brief didn't ask for.
    return { results, costUsd }
  } catch (err) {
    console.warn('[web-search:openai] failed:', err instanceof Error ? err.message : err)
    return null
  } finally { clearTimeout(timer) }
}

// ── the provider-neutral entry point ─────────────────────────────────────────

/**
 * ONE function `orientation` (and anything else) calls for a plain web search. Never
 * throws — the worst case is `ok: false` with every attempted provider named and why.
 */
export async function webSearch(opts: WebSearchOptions): Promise<WebSearchOutcome> {
  const t0 = Date.now()
  const order = opts.provider ? [opts.provider] : DEFAULT_ORDER
  const attempted = order.filter((p) => !(opts.exclude ?? []).includes(p))

  if (!attempted.length) {
    return { ok: false, provider: null, results: [], costUsd: 0, ms: Date.now() - t0, attempted: [], reason: 'every candidate provider was excluded' }
  }
  if (!opts.query.trim()) {
    return { ok: false, provider: null, results: [], costUsd: 0, ms: Date.now() - t0, attempted: [], reason: 'empty query' }
  }

  const failures: string[] = []
  let costUsd = 0
  const tried: WebSearchProvider[] = []
  for (const p of attempted) {
    tried.push(p)
    const out = p === 'xai' ? await searchXai(opts) : p === 'anthropic' ? await searchAnthropic(opts) : p === 'openai' ? await searchOpenAI(opts) : await searchGoogle(opts)
    if (out === null) { failures.push(`${p} did not complete`); continue }
    costUsd += out.costUsd
    // §5 — the answering provider is returned honestly, EMPTY RESULTS INCLUDED. A call
    // that completed and found nothing is a different fact from a call that failed, and
    // only the second one falls through to the next provider.
    return { ok: true, provider: p, results: out.results, costUsd, ms: Date.now() - t0, attempted: tried }
  }
  return {
    ok: false, provider: null, results: [], costUsd, ms: Date.now() - t0, attempted: tried,
    reason: `no provider could answer — ${failures.join('; ')}`,
  }
}
