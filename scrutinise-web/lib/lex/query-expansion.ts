// query-expansion.ts — LLM query expansion for the Page 1 background search.
//
// Platform-side only. Inserted in fireSearchTrigger BEFORE the FTS call.
// Takes the user's concept keywords + idea context → returns anchor Acts/SIs,
// statutory terms-of-art, and rephrasings to widen the BM25 candidate set.
//
// Grounding guardrail: this output feeds ONLY the query string passed to the FTS
// engine. Nothing returned here may appear in briefing text. A hallucinated Act
// simply fails to score in BM25 and causes no harm.
//
// Config:
//   LEX_QUERY_EXPANSION=true        enable (default off — A/B scoreable on the gold set)
//   QUERY_EXPANSION_MODEL           Gemini model id (default gemini-2.5-flash)
//   QUERY_EXPANSION_TIMEOUT_MS      per-call timeout (default 10000)

import { flagEnabled } from '@/lib/env-flags'

export interface QueryExpansion {
  anchors: string[]     // candidate Acts / SIs / retained-EU by full statutory name
  termsOfArt: string[]  // statutory vocabulary for the concept
  rephrasings: string[] // alternative lay phrasings
}

const EMPTY: QueryExpansion = { anchors: [], termsOfArt: [], rephrasings: [] }

const EXPANSION_SCHEMA = {
  type: 'object',
  properties: {
    anchors:     { type: 'array', items: { type: 'string' } },
    termsOfArt:  { type: 'array', items: { type: 'string' } },
    rephrasings: { type: 'array', items: { type: 'string' } },
  },
  required: ['anchors', 'termsOfArt', 'rephrasings'],
}

const SYSTEM_PROMPT = `You are a UK parliamentary research assistant. Given a set of keywords describing a policy idea, return search terms that will locate the relevant primary legislation, statutory instruments, and parliamentary material in a full-text corpus search engine.

Your output feeds BM25 keyword search only — it is never shown to users or cited as fact. A hallucinated Act name simply scores zero and causes no harm.

Return three arrays:
- anchors: full statutory names of the likely anchor Acts, SIs, or retained-EU instruments (e.g. "Data Protection Act 2018", "UK GDPR", "Financial Services and Markets Act 2000") — up to 5 entries
- termsOfArt: statutory terms-of-art for this concept (e.g. "data controller", "personal data", "lawful basis") — up to 8 entries
- rephrasings: alternative lay phrasings of the same concept (e.g. "privacy law", "information rights") — up to 4 entries

UK law only. No elaboration. Each string must be 60 characters or fewer.`

function parseExpansion(raw: string): QueryExpansion | null {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { return null }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const toStrArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
      : []
  return {
    anchors:     toStrArr(o.anchors),
    termsOfArt:  toStrArr(o.termsOfArt),
    rephrasings: toStrArr(o.rephrasings),
  }
}

// ── shared Gemini JSON-mode call — the fetch/timeout/parse mechanics that
// expandQuery and routeQuery both need. Callers own their own schema, prompt,
// and result parsing; this only owns the HTTP round-trip and raw-text extraction.
// Returns null on ANY failure (HTTP error, timeout, abort, malformed response) —
// callers degrade to their own fail-open behaviour, never throw.
/** Why a call produced no usable text. Carried back to the caller so a deliberate degradation
 *  can say WHICH degradation it was — see the fail-open note on routeQuery. */
export type GeminiFailure = 'http-error' | 'timeout' | 'network-error' | 'empty-response'

// A STRING discriminant, deliberately: this project compiles with `strict: false`, and without
// strictNullChecks TypeScript will not narrow a union on a boolean literal (`ok: true | false`).
// A `kind` field narrows correctly either way, so the failure branch stays type-checked.
type GeminiJsonResult =
  | { kind: 'ok'; text: string }
  | { kind: 'fail'; reason: GeminiFailure; detail: string }

async function callGeminiJson(opts: {
  model: string
  apiKey: string
  timeoutMs: number
  systemPrompt: string
  userMessage: string
  schema: object
  logTag: string
}): Promise<GeminiJsonResult> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: opts.systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: opts.userMessage }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
            responseSchema: opts.schema,
            // Without this, gemini-2.5-flash's default "thinking" mode consumes the
            // entire maxOutputTokens budget before writing any output (finishReason:
            // MAX_TOKENS, truncated mid-JSON) — the call then always silently
            // degrades to failure. Verified 29 Jul 2026 (see handoff_summary.md).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { kind: 'fail', reason: 'http-error', detail: `HTTP ${res.status} ${body.slice(0, 200)}`.trim() }
    }
    type GeminiResp = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const data = await res.json() as GeminiResp
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') {
      return { kind: 'fail', reason: 'empty-response', detail: 'no candidates[0].content.parts[0].text in the response' }
    }
    return { kind: 'ok', text }
  } catch (err) {
    // An AbortError here is our own timeout firing, not a network fault — worth separating,
    // because "the model took too long" and "we could not reach the model" have different fixes.
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      kind: 'fail',
      reason: aborted ? 'timeout' : 'network-error',
      detail: aborted ? `aborted after ${opts.timeoutMs}ms` : (err instanceof Error ? err.message : String(err)),
    }
  } finally {
    clearTimeout(t)
  }
}

/**
 * Expand the user's keywords with anchor Acts, statutory terms, and rephrasings.
 * Returns EMPTY on any failure; the caller falls back to the original keywords only.
 */
export async function expandQuery(keywords: string[], ideaContext: string): Promise<QueryExpansion> {
  if (!flagEnabled('LEX_QUERY_EXPANSION')) return EMPTY

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[query-expansion] DEGRADED — LEX_QUERY_EXPANSION is ON but GEMINI_API_KEY is not set; searching with the bare keywords.')
    return EMPTY
  }

  const model = process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.QUERY_EXPANSION_TIMEOUT_MS ?? '10000', 10)

  const userMessage = [
    `Keywords: ${keywords.join(', ')}`,
    ideaContext ? `Idea context: ${ideaContext}` : '',
  ].filter(Boolean).join('\n')

  const res = await callGeminiJson({
    model, apiKey, timeoutMs,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    schema: EXPANSION_SCHEMA,
    logTag: 'query-expansion',
  })
  if (res.kind === 'fail') {
    console.error(`[query-expansion] DEGRADED — expansion is ON but produced nothing (${res.reason}): ${res.detail}. Searching with the bare keywords.`)
    return EMPTY
  }
  const parsed = parseExpansion(res.text)
  if (!parsed) {
    console.error('[query-expansion] DEGRADED — expansion is ON but the model returned unparseable JSON. Searching with the bare keywords.')
    return EMPTY
  }
  return parsed
}

// ── Query router (generalises the expansion above into per-stream routing) ──
//
// Config:
//   LEX_QUERY_ROUTER=true      enable (default off — A/B scoreable independently
//                              of LEX_QUERY_EXPANSION; see search-gateway.ts)
//   QUERY_ROUTER_MODEL         Gemini model id (default gemini-2.5-flash)
//   QUERY_ROUTER_TIMEOUT_MS    per-call timeout (default 10000)

/** The stream names the router can address today (query-router.ts owns the
 *  matching {tier, types, search} config — this file only owns the LLM decision). */
export type RouterStreamName = 'legislation' | 'debates' | 'committees' | 'caselaw' | 'guidance'

const ROUTER_STREAMS: RouterStreamName[] = ['legislation', 'debates', 'committees', 'caselaw', 'guidance']

/** One tailored query string per stream the LLM judged relevant. A stream absent
 *  from the object was judged NOT relevant — the caller skips it entirely. */
export type RouteResult = Partial<Record<RouterStreamName, string>>

const ROUTER_SCHEMA = {
  type: 'object',
  properties: {
    legislation: { type: 'string' },
    debates: { type: 'string' },
    committees: { type: 'string' },
    caselaw: { type: 'string' },
    guidance: { type: 'string' },
  },
}

const ROUTER_SYSTEM_PROMPT = `You are a UK parliamentary research router. Given a set of keywords describing a policy idea, decide which of these corpora are relevant, and write ONE tailored search string for each relevant corpus. Omit a corpus entirely (leave the key out / empty string) if it is not relevant — do not force a query into every corpus.

Your output feeds BM25 keyword search only — it is never shown to users or cited as fact. A hallucinated Act name or search term simply scores zero and causes no harm.

Corpora:
- legislation: primary Acts, statutory instruments, retained-EU law. Tailor with full statutory names of likely anchor Acts/SIs and statutory terms-of-art (e.g. "Data Protection Act 2018", "data controller", "lawful basis").
- debates: Hansard chamber debates, written questions/statements. Tailor with the political/topical phrasing a debate would use.
- committees: select committee reports and evidence. Tailor with inquiry/evidence phrasing (e.g. "pre-legislative scrutiny", "committee evidence").
- caselaw: court judgments. Tailor with legal doctrine/case terminology.
- guidance: regulator and soft-law material — FCA/ICO/HMRC/Ofgem/Ofcom guidance, Law Commission reports, NAO reports, statutory inquiries, sentencing guidelines, CPS guidance, Codes of Practice. Tailor with the regulator/body name and the practical compliance terms-of-art it uses (e.g. "FCA Handbook COBS", "ICO guidance data protection", "sentencing guideline").

SPECIAL CASE — exact statutory citation: if the keywords are already an exact citation (e.g. "Section 21 Housing Act 1988", "Equality Act 2010 section 149"), route ONLY to legislation, and its query string must be the citation EXACTLY AS GIVEN with nothing added, removed, or reworded — any extra term dilutes the exact-match ranking. Do not route a citation query to any other corpus.

UK law/parliament/regulator only. No elaboration. Each query string must be 200 characters or fewer.`

function parseRoute(raw: string): RouteResult | null {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { return null }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const out: RouteResult = {}
  for (const stream of ROUTER_STREAMS) {
    const v = o[stream]
    if (typeof v === 'string' && v.trim().length > 0) out[stream] = v.trim()
  }
  return out
}

/**
 * Decide which stream(s) the query belongs to and write a tailored search string
 * for each relevant one, in a single LLM call. Returns null on any failure
 * (disabled, missing key, HTTP error, timeout, unparseable JSON) — the caller
 * (search-gateway.ts) must then fail OPEN to searching all streams unfiltered
 * with the bare query, never to an empty result. An empty-but-parsed object
 * (the LLM judged nothing relevant) is treated the same as null by the caller —
 * a router that names zero streams is exactly the failure mode this guards
 * against, so it degrades the same way.
 */
export async function routeQuery(keywords: string[], ideaContext: string): Promise<RouteResult | null> {
  // OFF is not a failure — return quietly. Everything below this line runs only when an operator
  // has asked for routing, so anything that stops it from happening IS worth shouting about.
  if (!flagEnabled('LEX_QUERY_ROUTER')) return null

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return routerFailOpen('missing-key', 'GEMINI_API_KEY is not set in this environment')

  const model = process.env.QUERY_ROUTER_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.QUERY_ROUTER_TIMEOUT_MS ?? '10000', 10)

  const userMessage = [
    `Keywords: ${keywords.join(', ')}`,
    ideaContext ? `Idea context: ${ideaContext}` : '',
  ].filter(Boolean).join('\n')

  const res = await callGeminiJson({
    model, apiKey, timeoutMs,
    systemPrompt: ROUTER_SYSTEM_PROMPT,
    userMessage,
    schema: ROUTER_SCHEMA,
    logTag: 'query-router',
  })
  if (res.kind === 'fail') return routerFailOpen(res.reason, `${res.detail} (model=${model}, timeout=${timeoutMs}ms)`)

  const parsed = parseRoute(res.text)
  if (!parsed) return routerFailOpen('bad-json', `model returned unparseable JSON: ${res.text.slice(0, 200)}`)
  if (Object.keys(parsed).length === 0) {
    // Parsed fine, named nothing. The caller degrades identically, so it must be as visible —
    // otherwise a router that has quietly stopped choosing looks exactly like one that is off.
    return routerFailOpen('no-streams-named', 'the model judged every stream irrelevant')
  }
  return parsed
}

/**
 * Announce a degradation and return null.
 *
 * WHY error level, and why this function exists at all. The fail-open below is deliberate — a
 * router failure must never mean an empty result — but until 2026-08-08 it was also SILENT, and
 * from outside the process a failing router is indistinguishable from a disabled one: both
 * produce exactly one untiered `runFtsSearch` and no error. That ambiguity is what made the
 * capitalised-`TRUE` incident undiagnosable without counting requests arriving at the search
 * services. A deliberate degradation should still announce itself, with the reason attached.
 */
function routerFailOpen(reason: GeminiFailure | 'missing-key' | 'bad-json' | 'no-streams-named', detail: string): null {
  console.error(
    `[query-router] FAIL-OPEN — LEX_QUERY_ROUTER is ON but no routing decision was produced ` +
    `(${reason}): ${detail}. Falling back to ONE unfiltered search across all streams: ` +
    `per-stream scoping and dense fusion are BOTH skipped for this query.`,
  )
  return null
}
