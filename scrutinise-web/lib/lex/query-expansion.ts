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
import { geminiFinishProblem } from './gemini-finish'

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
export type GeminiFailure = 'http-error' | 'timeout' | 'network-error' | 'empty-response' | 'truncated' | 'blocked'

// A STRING discriminant, deliberately: this project compiles with `strict: false`, and without
// strictNullChecks TypeScript will not narrow a union on a boolean literal (`ok: true | false`).
// A `kind` field narrows correctly either way, so the failure branch stays type-checked.
type GeminiJsonResult =
  | { kind: 'ok'; text: string }
  // `text` carries the PARTIAL payload on a `truncated` failure. Without it the truncated text was
  // read by the guard, named in the log, and then thrown away — so a caller that could recover
  // something from it (routeQuery's salvage, below) never got the chance. Absent on every other
  // failure reason, where there is no payload to salvage.
  | { kind: 'fail'; reason: GeminiFailure; detail: string; text?: string }

/**
 * Output budget. 512 was too small and cost us a live bug: the router emits up to five tailored
 * per-stream queries of up to 200 chars each, which does not fit, so two of four real questions
 * came back truncated mid-word on 2026-08-08 and — because nothing checked `finishReason` — the
 * truncation was reported as `bad-json`, i.e. as a serialiser fault rather than a length limit.
 *
 * Output tokens are billed on what is actually generated, so a generous ceiling on a call that
 * emits a small JSON object costs nothing and removes the failure mode. This is the FOURTH
 * recorded instance of the same MAX_TOKENS class (query-expansion 29 Jul, web-orientation 6 Aug,
 * general-chat 8 Aug), which is why the fix is a checked `finishReason` and not just a bigger
 * number — a bigger number alone would only move the cliff.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

async function callGeminiJson(opts: {
  model: string
  apiKey: string
  timeoutMs: number
  systemPrompt: string
  userMessage: string
  schema: object
  logTag: string
  maxOutputTokens?: number
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
            maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
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
    type GeminiResp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = await res.json() as GeminiResp
    const candidate = data?.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text

    // Check finishReason BEFORE parsing. A truncated payload is still syntactically broken JSON,
    // so parsing first would report `bad-json` and send the reader looking for a serialiser fault
    // instead of a length limit — which is exactly what happened on 2026-08-08.
    const cut = geminiFinishProblem(candidate, opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS, { label: opts.logTag })
    if (cut) return { kind: 'fail', reason: cut.reason, detail: cut.detail, text: typeof text === 'string' ? text : undefined }

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
//   QUERY_ROUTER_TIMEOUT_MS    per-call timeout (default 25000 — see the note at the call)

/** The stream names the router can address today (query-router.ts owns the
 *  matching {tier, types, search} config — this file only owns the LLM decision). */
export type RouterStreamName = 'legislation' | 'debates' | 'committees' | 'caselaw' | 'guidance'

const ROUTER_STREAMS: RouterStreamName[] = ['legislation', 'debates', 'committees', 'caselaw', 'guidance']

/** One tailored query string per stream the LLM judged relevant. A stream absent
 *  from the object was judged NOT relevant — the caller skips it entirely. */
export type RouteResult = Partial<Record<RouterStreamName, string>>

// ⚠ DO NOT add `maxLength` here. Tried 2026-08-09 to stop the model running past the output
// ceiling: it made things far worse, not better — fail-open went from 2/12 to 9/12, and the
// truncated tails showed the model degenerating into repetition ("…legal rules law OR data
// protection legal principles law"). Gemini's responseSchema evidently does not honour maxLength
// on a string, and supplying it destabilises generation rather than constraining it. Reverted
// after one measured pass; the length instruction stays in the prompt where it does work.
//
// ⚠ `propertyOrdering` IS DIFFERENT FROM `maxLength`, AND IT IS HERE FOR A MEASURED REASON.
// The salvage below assumed — as the brief did — that Gemini emits properties in the order this
// schema declares them, so a truncated payload would still hold `legislation`. It does not.
// Measured 2026-08-09 by forcing truncation (QUERY_ROUTER_MAX_TOKENS=60, 12 queries): every
// salvaged payload contained `caselaw, committees, debates` and NEVER `legislation` or
// `guidance`. Gemini was emitting ALPHABETICALLY, so the two streams a truncation destroys were
// the alphabetically-last ones — and `legislation` is the stream that carries dense retrieval and
// the one the ordering regression was observed on. Exactly the wrong one to lose.
// `propertyOrdering` is an ordering HINT, not a constraint on the content, which is why it does
// not carry `maxLength`'s failure mode; it was measured on its own pass regardless.
const ROUTER_SCHEMA = {
  type: 'object',
  properties: {
    legislation: { type: 'string' },
    debates: { type: 'string' },
    committees: { type: 'string' },
    caselaw: { type: 'string' },
    guidance: { type: 'string' },
  },
  propertyOrdering: ['legislation', 'debates', 'committees', 'caselaw', 'guidance'],
}

// ── measurement switches ─────────────────────────────────────────────────────
//
// Two env switches exist ONLY so the three §2 changes can be landed and measured one at a time on
// the same query mix, which is the sprint's own working rule. Both default to the shipped
// behaviour; setting either to 'off' restores what the code did before this sprint. They are here
// rather than in the measurement script because the alternative is a script that reimplements
// routeQuery — and a benchmark that measures a copy of the thing measures nothing.
//   QUERY_ROUTER_SALVAGE=off   don't recover streams from a truncated payload (§2.1)
//   QUERY_ROUTER_FEWSHOT=off   use the old one-line length instruction, no examples (§2.2)
//   QUERY_ROUTER_WORD_CAP=999  effectively disables the deterministic cap (§2.2)
const salvageEnabled = () => (process.env.QUERY_ROUTER_SALVAGE ?? 'on') !== 'off'
const fewShotEnabled = () => (process.env.QUERY_ROUTER_FEWSHOT ?? 'on') !== 'off'

const ROUTER_PROMPT_BASE = `You are a UK parliamentary research router. Given a set of keywords describing a policy idea, decide which of these corpora are relevant, and write ONE tailored search string for each relevant corpus. Omit a corpus entirely (leave the key out / empty string) if it is not relevant — do not force a query into every corpus.

Your output feeds BM25 keyword search only — it is never shown to users or cited as fact. A hallucinated Act name or search term simply scores zero and causes no harm.

Corpora:
- legislation: primary Acts, statutory instruments, retained-EU law. Tailor with full statutory names of likely anchor Acts/SIs and statutory terms-of-art (e.g. "Data Protection Act 2018", "data controller", "lawful basis").
- debates: Hansard chamber debates, written questions/statements. Tailor with the political/topical phrasing a debate would use.
- committees: select committee reports and evidence. Tailor with inquiry/evidence phrasing (e.g. "pre-legislative scrutiny", "committee evidence").
- caselaw: court judgments. Tailor with legal doctrine/case terminology.
- guidance: regulator and soft-law material — FCA/ICO/HMRC/Ofgem/Ofcom guidance, Law Commission reports, NAO reports, statutory inquiries, sentencing guidelines, CPS guidance, Codes of Practice. Tailor with the regulator/body name and the practical compliance terms-of-art it uses (e.g. "FCA Handbook COBS", "ICO guidance data protection", "sentencing guideline").

SPECIAL CASE — exact statutory citation: if the keywords are already an exact citation (e.g. "Section 21 Housing Act 1988", "Equality Act 2010 section 149"), route ONLY to legislation, and its query string must be the citation EXACTLY AS GIVEN with nothing added, removed, or reworded — any extra term dilutes the exact-match ranking. Do not route a citation query to any other corpus.

UK law/parliament/regulator only. No elaboration.`

/** What shipped before this sprint: a character budget, stated once, at the end. */
const ROUTER_LENGTH_LEGACY = `\n\nEach query string must be 200 characters or fewer.`

/**
 * §2.2 — instruct the length and SHOW it. 6–12 words is the shape that produced the measured
 * gold-set gains, and three worked examples say more about shape than any adjective. The examples
 * also demonstrate the other thing the model gets wrong: OMITTING a corpus it does not need (the
 * second example names three streams, not five).
 */
const ROUTER_LENGTH_FEWSHOT = `

LENGTH — this is the most common way this task goes wrong. Each query string must be SIX TO TWELVE WORDS. Not a sentence, not a list of alternatives joined by OR, not a paragraph. Six to twelve words is the shape that measurably improved retrieval; longer strings dilute BM25 and score worse. Write the shortest string that names the right thing.

Examples of the right shape:

Keywords: landlords evicting tenants without a reason
{"legislation":"Housing Act 1988 section 21 assured shorthold tenancy possession","debates":"no fault eviction section 21 abolition renters reform","committees":"select committee evidence private rented sector eviction","caselaw":"section 21 notice validity possession proceedings"}

Keywords: buy now pay later credit checks
{"legislation":"Consumer Credit Act 1974 regulated agreement exemption","guidance":"FCA buy now pay later affordability assessment guidance","committees":"Treasury Committee evidence unregulated consumer credit"}

Keywords: sewage discharge by water companies
{"legislation":"Water Industry Act 1991 Environmental Permitting Regulations discharge","debates":"storm overflows sewage discharge water companies","guidance":"Ofwat Environment Agency storm overflow enforcement guidance","caselaw":"water company nuisance discharge judicial review"}`

function routerSystemPrompt(): string {
  return ROUTER_PROMPT_BASE + (fewShotEnabled() ? ROUTER_LENGTH_FEWSHOT : ROUTER_LENGTH_LEGACY)
}

/**
 * Hard cap on the words in any one stream query, applied in OUR code after parsing.
 *
 * WHY A CAP AND NOT A SCHEMA CONSTRAINT. `maxLength` in the responseSchema was tried on
 * 2026-08-09 and made things far worse — fail-open went from 2/12 to 9/12 with the model
 * degenerating into repetition. Gemini does not honour it, and supplying it destabilised
 * generation. The prompt instruction above does work, but it is an instruction; this is the
 * deterministic floor under it. Ours, unignorable, and it cannot degrade the generation because
 * it runs after the generation is over.
 */
const QUERY_WORD_CAP = parseInt(process.env.QUERY_ROUTER_WORD_CAP ?? '12', 10)

/** Trim a stream query to the word cap. Returns the string unchanged when it is already short. */
function capWords(q: string, stream: string): string {
  const words = q.trim().split(/\s+/).filter(Boolean)
  if (words.length <= QUERY_WORD_CAP) return words.join(' ')
  const cut = words.slice(0, QUERY_WORD_CAP).join(' ')
  console.warn(`[query-router] stream query capped — ${stream}: ${words.length} words → ${QUERY_WORD_CAP}. Dropped: ${JSON.stringify(words.slice(QUERY_WORD_CAP).join(' ').slice(0, 120))}`)
  return cut
}

/** How the routing decision was obtained. Logged on every call (§2.3) so the intermittency rate
 *  is readable from production logs rather than inferred from a test script. */
export type RouteOutcome = 'full' | 'partial' | 'failed'

/**
 * Recover every stream whose value closed cleanly out of a payload that will not parse.
 *
 * Gemini emits the object in property order, so a truncated payload usually still contains one or
 * more complete stream entries; the old behaviour threw all of them away and failed open. That is
 * a bad trade — a fail-open costs the query its stream scoping AND its dense retrieval, whereas a
 * partial decision costs one stream. This is the cheap floor under every FUTURE truncation, not a
 * workaround for the current one.
 *
 * The regex matches only a value with its closing quote, so the trailing partial is discarded by
 * construction rather than by a length heuristic. `(?:[^"\\]|\\.)*` steps over escaped quotes, so
 * a value legitimately containing `\"` is recovered whole rather than cut at it.
 */
function salvageRoute(raw: string): RouteResult {
  const out: RouteResult = {}
  const re = /"(legislation|debates|committees|caselaw|guidance)"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  for (const m of raw.matchAll(re)) {
    let value: string
    try { value = JSON.parse(`"${m[2]}"`) } catch { continue } // not valid JSON string content — skip it
    if (value.trim()) out[m[1] as RouterStreamName] = value.trim()
  }
  return out
}

function parseRoute(raw: string): { route: RouteResult; mode: 'full' | 'partial' } | null {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch {
    const salvaged = salvageRoute(raw)
    return Object.keys(salvaged).length ? { route: capRoute(salvaged), mode: 'partial' } : null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const out: RouteResult = {}
  for (const stream of ROUTER_STREAMS) {
    const v = o[stream]
    if (typeof v === 'string' && v.trim().length > 0) out[stream] = v.trim()
  }
  return { route: capRoute(out), mode: 'full' }
}

/** Apply the word cap to every stream query. One place, so a salvaged route and a fully parsed
 *  one cannot end up under different rules. */
function capRoute(route: RouteResult): RouteResult {
  const out: RouteResult = {}
  for (const [stream, q] of Object.entries(route)) {
    const capped = capWords(q as string, stream)
    if (capped) out[stream as RouterStreamName] = capped
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
  // 10s was too tight and was the LAST cause of routing being intermittent. Measured 2026-08-09,
  // 10 consecutive calls with the truncation fix in place: 8 dispatched, 2 failed open, both
  // `timeout` at exactly 10,000ms — no bad-json at all, so the earlier fix held and this is what
  // was left. A fail-open costs the whole query its per-stream scoping AND its dense half, which
  // is a far worse outcome than waiting another few seconds for the one LLM call the routing
  // depends on. The retrieval that follows already takes 3.4–3.8s, so the ceiling was never the
  // thing protecting the user's latency.
  const timeoutMs = parseInt(process.env.QUERY_ROUTER_TIMEOUT_MS ?? '25000', 10)
  // The output ceiling, overridable ONLY so the truncation can be reproduced on demand. The
  // default is unchanged at DEFAULT_MAX_OUTPUT_TOKENS and raising it is not the fix — it buys a
  // longer runaway, as recorded there. What the override buys is a deterministic test: the live
  // runaway rate on the fixed mix is ~3%, far too rare to attribute a change to, whereas a small
  // budget truncates every call and makes the salvage measurable in one pass.
  const maxOutputTokens = parseInt(process.env.QUERY_ROUTER_MAX_TOKENS ?? String(DEFAULT_MAX_OUTPUT_TOKENS), 10)

  const userMessage = [
    `Keywords: ${keywords.join(', ')}`,
    ideaContext ? `Idea context: ${ideaContext}` : '',
  ].filter(Boolean).join('\n')

  const res = await callGeminiJson({
    model, apiKey, timeoutMs,
    systemPrompt: routerSystemPrompt(),
    userMessage,
    schema: ROUTER_SCHEMA,
    logTag: 'query-router',
    maxOutputTokens,
  })

  if (res.kind === 'fail') {
    // A truncated payload is the ONE failure with something left in it. Salvage before giving up:
    // the streams that closed cleanly are as usable as they would have been in a whole response.
    if (res.reason === 'truncated' && res.text && salvageEnabled()) {
      const salvaged = parseRoute(res.text)
      if (salvaged && Object.keys(salvaged.route).length) {
        return routeSucceeded('partial', salvaged.route,
          `recovered ${Object.keys(salvaged.route).length} stream(s) from a truncated payload; the trailing partial was discarded. ${res.detail}`)
      }
    }
    return routerFailOpen(res.reason, `${res.detail} (model=${model}, timeout=${timeoutMs}ms)`)
  }

  const parsed = parseRoute(res.text)
  if (!parsed) return routerFailOpen('bad-json', `model returned unparseable JSON: ${res.text.slice(0, 200)}`)
  if (Object.keys(parsed.route).length === 0) {
    // Parsed fine, named nothing. The caller degrades identically, so it must be as visible —
    // otherwise a router that has quietly stopped choosing looks exactly like one that is off.
    return routerFailOpen('no-streams-named', 'the model judged every stream irrelevant')
  }
  return routeSucceeded(parsed.mode, parsed.route)
}

// ── route_outcome, counted and logged (§2.3) ─────────────────────────────────
//
// STANDING RULE, from the August flag incident: a flip needs a POSITIVE SIGNAL that proves
// engagement, not an absence of errors. Until now the intermittency rate was inferred by running
// a test script; every routing call now says what it produced, and the running totals ride along
// so a single log line answers "how often is this failing?" without collecting a sample first.
// In-process counters reset on redeploy, like every other counter we keep — the per-call line is
// the record, the totals are the convenience.
const routeCounts: Record<RouteOutcome, number> = { full: 0, partial: 0, failed: 0 }

/** Read-only snapshot for tests and any future /stats surface. */
export function routeOutcomeCounts(): Record<RouteOutcome, number> {
  return { ...routeCounts }
}

function logRouteOutcome(outcome: RouteOutcome, streams: string[], note?: string) {
  routeCounts[outcome]++
  const line = `[query-router] route_outcome=${outcome} streams=${streams.length ? streams.join(',') : 'none'} ` +
    `totals=full:${routeCounts.full}/partial:${routeCounts.partial}/failed:${routeCounts.failed}${note ? ` — ${note}` : ''}`
  if (outcome === 'failed') console.error(line)
  else console.log(line)
}

function routeSucceeded(mode: 'full' | 'partial', route: RouteResult, note?: string): RouteResult {
  logRouteOutcome(mode, Object.keys(route), note)
  return route
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
  // Every fail-open produces a route_outcome line as well as the sentence above. The sentence
  // explains; the line counts. Zero SILENT fail-opens is the §2 exit criterion, and it is only
  // checkable if the counted form exists on every path out of here.
  logRouteOutcome('failed', [], reason)
  return null
}
