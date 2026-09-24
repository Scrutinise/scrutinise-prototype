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
//   WEB_SEARCH_XAI_MODEL      default grok-4.3 (reuses orientation.x's measured default)
//   WEB_SEARCH_GOOGLE_MODEL   default gemini-2.5-flash
//   WEB_SEARCH_TIMEOUT_MS     default 30000 (per provider, per attempt)
// ─────────────────────────────────────────────────────────────────────────────

import type { Provider } from '../model-registry'
import { recordGeminiUsage, recordXaiUsage, type SpendStream } from '../spend-ledger'
import { normaliseDate } from './noise-filter'

/** Only vendors this layer can actually reach today. Anthropic/OpenAI adapters follow the
 *  provider-neutral contract exactly and slot in here once Q2 is answered (brief §1). */
export type WebSearchProvider = Extract<Provider, 'xai' | 'google'>

export interface WebSearchResult {
  url: string
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
          + `actually found via search — never invent one.`,
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
    const priced = await recordXaiUsage(data, { stream: opts.stream ?? 'orientation', pass: opts.pass ?? 'orientation.web-search', model, ref: opts.label ?? null })
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
}): Promise<{ text: string; sources: Array<{ url: string; title: string }>; usage: unknown } | null> {
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
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }>
      usageMetadata?: Record<string, unknown>
    }
    const data = await res.json() as Resp
    const cand = data.candidates?.[0]
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('')
    const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => c.web).filter((w): w is { uri?: string; title?: string } => !!w)
      .map((w) => ({ url: (w.uri ?? '').trim(), title: (w.title ?? '').trim() || 'web source' }))
      .filter((s) => s.url.length > 0)
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
    const priced = await recordGeminiUsage({ usageMetadata: grounded.usage },
      { stream: opts.stream ?? 'orientation', pass: opts.pass ?? 'orientation.web-search', model, ref: opts.label ?? null })
    costUsd += priced.usd ?? 0
  }
  if (!grounded.sources.length) return { results: [], costUsd }

  const sourceList = grounded.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n')
  const structured = await callGeminiRaw({
    model, apiKey, timeoutMs, grounded: false, schema: GOOGLE_STRUCTURE_SCHEMA,
    system: 'You convert a research note into a JSON list of search results. `sourceIndex` must be the number of the source in the SOURCES list that supports the item. If no source supports it, omit it — never guess an index.',
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
      return { url: source.url, title: source.title, date, snippet, provider: 'google' }
    })
    .filter((r): r is WebSearchResult => r !== null)
  return { results, costUsd }
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
    const out = p === 'xai' ? await searchXai(opts) : await searchGoogle(opts)
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
