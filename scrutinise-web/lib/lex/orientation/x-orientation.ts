// ─────────────────────────────────────────────────────────────────────────────
// §6d — the X half of orientation (Tier C). Grok X-search: the layer that
// precedes and amplifies news — political temperature, who is agitating, what
// row is brewing, and where opposing positions are actually argued.
//
// TWO CALLS, TWO TIME WINDOWS (§6d.1) — and they are two calls precisely because
// they want different windows and feed different segments:
//
//   1. RECENCY SCAN    — bounded to the recency window (~90 days). Feeds ONLY
//                        "Known issues & current context" and "Political risks".
//   2. ARGUMENT MINING — deliberately NOT time-bounded. The strongest
//                        articulations for and against, wherever and whenever
//                        they appear; interesting arguments often fall outside
//                        any recency window and may only be reachable via X.
//
// ⚠ API SHAPE — VERIFIED 2026-08-06, NOT ASSUMED FROM THE OLD CODE.
// The Live Search API this was designed against is GONE: `search_parameters` on
// /v1/chat/completions now returns HTTP 410 "Live search is deprecated. Please
// switch to the Agent Tools API". The working shape is the Agent Tools API —
// POST /v1/responses with tools:[{type:'x_search'}] — and unlike Gemini it DOES
// combine server-side tools with structured output (`text.format.json_schema`).
// Date bounds are per-tool: from_date / to_date on the tool object.
//
// ⚠ Related, out of this brief's scope but found while probing: `grok-3-fast-beta`,
// the Lex fallback model hardcoded in app/api/ai/[ideaId]/route.ts and
// app/api/ai/public/route.ts, is NOT in /v1/models any more. Reported, not fixed.
//
// MODEL CHOICE — measured, not assumed (2026-08-06, same question, same schema):
//   grok-4.5                      57.1s   $0.2322   18 x_search calls   8 items
//   grok-4.3                      21.2s   $0.0344    3 x_search calls   6 items
//   grok-4.20-0309-non-reasoning  16.9s   $0.1084   12 x_search calls   7 items
// grok-4.3 gives comparable output for 1/7th of grok-4.5's cost, which is why it
// is the default — the brief's "start at the cheap/fast tier, escalate only if
// quality demands it". `max_tool_calls` was NOT honoured by grok-4.5 (18 calls
// against a cap of 4), so it is not relied on as a cost control.
//
// Config:
//   GROK_API_KEY               required; without it this half short-circuits
//   ORIENTATION_X_MODEL        default grok-4.3
//   ORIENTATION_X_TIMEOUT_MS   default 75000 (per call — measured 17–57s)
// ─────────────────────────────────────────────────────────────────────────────

import type { ArgumentItem, RecencyItem, RecencyScan, VoiceItem } from './types'
import { EMPTY_RECENCY, toStance } from './types'
import {
  NOISE_FILTER_PROMPT, NOISE_FILTER_PROMPT_OFF, dedupeRecency, normaliseDate, withinWindow,
} from './noise-filter'
import { recordXaiUsage } from '../spend-ledger'
import { fetchedContentIsData } from '../fetched-content-guard'

const XAI_RESPONSES = 'https://api.x.ai/v1/responses'

/** xAI reports actual billed spend as ticks; 1 USD = 1e10 ticks (docs, cost tracking). */
const TICKS_PER_USD = 1e10

export function xOrientationEnabled(): boolean {
  // Sub-flag so the X (Tier C) contribution can be measured on its own, exactly
  // as the noise filter can. Defaults ON when orientation is on.
  return process.env.LEX_ORIENTATION_X !== 'false'
}

// ── schemas ───────────────────────────────────────────────────────────────────
// xAI's structured output is strict JSON Schema: additionalProperties:false and
// every property listed in `required`.

const RECENCY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recentDevelopments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          headline: { type: 'string' }, detail: { type: 'string' },
          date: { type: 'string' }, author: { type: 'string' }, url: { type: 'string' },
        },
        required: ['headline', 'detail', 'date', 'author', 'url'],
      },
    },
    liveControversies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          headline: { type: 'string' }, detail: { type: 'string' },
          date: { type: 'string' }, author: { type: 'string' }, url: { type: 'string' },
        },
        required: ['headline', 'detail', 'date', 'author', 'url'],
      },
    },
    politicalRisks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          headline: { type: 'string' }, detail: { type: 'string' },
          date: { type: 'string' }, author: { type: 'string' }, url: { type: 'string' },
        },
        required: ['headline', 'detail', 'date', 'author', 'url'],
      },
    },
    whoIsTalking: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          who: { type: 'string' }, position: { type: 'string' },
          date: { type: 'string' }, url: { type: 'string' },
        },
        required: ['who', 'position', 'date', 'url'],
      },
    },
    salience: { type: 'integer' },
  },
  required: ['recentDevelopments', 'liveControversies', 'politicalRisks', 'whoIsTalking', 'salience'],
}

const ARGUMENTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    arguments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          reason: { type: 'string' },
          stance: { type: 'string', enum: ['for', 'against', 'nuanced'] },
          date: { type: 'string' },
          author: { type: 'string' },
          url: { type: 'string' },
          timesSeen: { type: 'integer' },
          lowCredibility: { type: 'boolean' },
        },
        required: ['claim', 'reason', 'stance', 'date', 'author', 'url', 'timesSeen', 'lowCredibility'],
      },
    },
    salience: { type: 'integer' },
  },
  required: ['arguments', 'salience'],
}

// ── the call ──────────────────────────────────────────────────────────────────

interface XCallResult { parsed: Record<string, unknown>; costUsd: number; postsFetched: number }

async function callGrok(opts: {
  model: string
  apiKey: string
  timeoutMs: number
  instructions: string
  user: string
  schema: object
  schemaName: string
  fromDate?: string
  toDate?: string
  logTag: string
  /** Ledger attribution (S21 §6 — every xAI call must reach LlmSpend). */
  pass: string
}): Promise<XCallResult | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const tool: Record<string, unknown> = { type: 'x_search' }
    if (opts.fromDate) tool.from_date = opts.fromDate
    if (opts.toDate) tool.to_date = opts.toDate

    const res = await fetch(XAI_RESPONSES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        instructions: opts.instructions,
        input: [{ role: 'user', content: opts.user }],
        tools: [tool],
        text: { format: { type: 'json_schema', name: opts.schemaName, schema: opts.schema } },
        temperature: 0.2,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn(`[${opts.logTag}] xai HTTP`, res.status, (await res.text()).slice(0, 300))
      return null
    }
    type Resp = {
      output?: Array<{ type?: string; content?: Array<{ text?: string }> }>
      usage?: {
        cost_in_usd_ticks?: number
        server_side_tool_usage_details?: { x_posts_fetched?: number; x_users_fetched?: number }
      }
    }
    const data = (await res.json()) as Resp
    // ⚠ S21 §6 — THE LEDGER WAS INERT FOR THIS VENDOR. This call already computed its own
    // costUsd and returned it up to the caller; nothing wrote it to LlmSpend. See
    // `recordXaiUsage`'s own header in spend-ledger.ts for the full reasoning.
    const priced = await recordXaiUsage(data, { stream: 'orientation', pass: opts.pass, model: opts.model, ref: opts.logTag })
    const costUsd = priced.usd ?? (data.usage?.cost_in_usd_ticks ?? 0) / TICKS_PER_USD
    const tools = data.usage?.server_side_tool_usage_details
    const postsFetched = tools ? (tools.x_posts_fetched ?? 0) + (tools.x_users_fetched ?? 0) : 0
    const message = (data.output ?? []).find((o) => o.type === 'message')
    const text = (message?.content ?? []).map((c) => c.text ?? '').join('')
    if (!text.trim()) {
      console.warn(`[${opts.logTag}] xai returned no message content`)
      return null
    }
    try {
      return { parsed: JSON.parse(text) as Record<string, unknown>, costUsd, postsFetched }
    } catch {
      console.warn(`[${opts.logTag}] xai returned unparseable JSON`)
      return null
    }
  } catch (err) {
    console.warn(`[${opts.logTag}] failed:`, err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const QUARANTINE_NOTE = `You are reporting what is CIRCULATING ON X. This is never treated as fact and never as "public opinion" — X is a skewed sample and downstream it is labelled as such. Report positions, attributed and dated. Do not state anything as established truth.

${fetchedContentIsData('post text')}`

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }

/** X handle or display name → a source label that reads as an attribution. */
function handleLabel(author: string): string {
  const a = author.trim()
  if (!a) return ''
  return a.startsWith('@') ? a : a
}

function toRecencyItems(raw: unknown, days: number | null): RecencyItem[] {
  if (!Array.isArray(raw)) return []
  const out: RecencyItem[] = []
  for (const entry of raw as Array<Record<string, unknown>>) {
    const headline = str(entry.headline)
    const date = normaliseDate(entry.date)
    const url = str(entry.url)
    const author = handleLabel(str(entry.author))
    if (!headline || !date || !url || !author) continue
    if (days !== null && !withinWindow(date, days)) continue
    out.push({
      headline, detail: str(entry.detail), date, tier: 'C',
      source: { label: author, url, date, tier: 'C' },
    })
  }
  return out
}

export interface XOrientationOutput {
  recency: RecencyScan
  argumentsMined: ArgumentItem[]
  costUsd: number
  /** Per-call outcome, so a half-failure is visible rather than silently thin. */
  recencyOk: boolean
  argumentsOk: boolean
  recencyMs: number
  argumentsMs: number
}

export const EMPTY_X: XOrientationOutput = {
  recency: EMPTY_RECENCY, argumentsMined: [], costUsd: 0,
  recencyOk: false, argumentsOk: false, recencyMs: 0, argumentsMs: 0,
}

/** §6d.1 call 1 — the bounded recency scan. */
export async function runXRecencyScan(
  topic: string, ideaContext: string, recencyDays: number,
): Promise<{ recency: RecencyScan; costUsd: number; postsFetched: number } | null> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) return null
  const model = process.env.ORIENTATION_X_MODEL ?? 'grok-4.3'
  const timeoutMs = parseInt(process.env.ORIENTATION_X_TIMEOUT_MS ?? '75000', 10)

  const from = new Date(Date.now() - recencyDays * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const to = new Date().toISOString().slice(0, 10)

  const instructions = [
    `You search X for UK policy signal. Report what is circulating about this policy idea IN THE LAST ${recencyDays} DAYS ONLY.`,
    '',
    'Return:',
    '- recentDevelopments: things that have actually happened and are being discussed — announcements, publications, incidents, rulings.',
    '- liveControversies: what is actively contested right now, and between whom.',
    '- politicalRisks: where a proposal here would meet organised resistance, and from which quarter.',
    '- whoIsTalking: named accounts, organisations, MPs, campaigners driving the conversation, and the position each takes.',
    '- salience: 0–3. 0 = nothing circulating; 1 = occasional posts; 2 = actively discussed; 3 = a live row happening now.',
    '',
    'Every item needs the real post date (yyyy-mm-dd), the author handle, and the post URL. Drop anything you cannot date and attribute.',
    '',
    QUARANTINE_NOTE,
  ].join('\n')

  const result = await callGrok({
    model, apiKey, timeoutMs,
    instructions,
    user: [`Policy idea: ${topic}`, ideaContext ? `Context: ${ideaContext}` : ''].filter(Boolean).join('\n'),
    schema: RECENCY_SCHEMA,
    schemaName: 'x_recency_scan',
    fromDate: from,
    toDate: to,
    logTag: 'orientation:x-recency',
    pass: 'orientation.x',
  })
  if (!result) return null

  const { parsed } = result
  const recentDevelopments = dedupeRecency(toRecencyItems(parsed.recentDevelopments, recencyDays), (i) => `${i.headline} ${i.detail}`)
  const liveControversies = dedupeRecency(toRecencyItems(parsed.liveControversies, recencyDays), (i) => `${i.headline} ${i.detail}`)
  // Political risk is the standing shape of the opposition, not an event —
  // the window is not applied to it (same rule as the web pass).
  const politicalRisks = dedupeRecency(toRecencyItems(parsed.politicalRisks, null), (i) => `${i.headline} ${i.detail}`)

  const whoIsTalking: VoiceItem[] = (Array.isArray(parsed.whoIsTalking) ? parsed.whoIsTalking : [])
    .map((raw: unknown) => {
      const e = raw as Record<string, unknown>
      const who = str(e.who)
      const date = normaliseDate(e.date)
      const url = str(e.url)
      if (!who || !date || !url) return null
      return { who, position: str(e.position), date, tier: 'C' as const, source: { label: who, url, date, tier: 'C' as const } }
    })
    .filter((v: VoiceItem | null): v is VoiceItem => v !== null)

  const salienceRaw = typeof parsed.salience === 'number' ? Math.trunc(parsed.salience) : 0
  const salience = Math.max(0, Math.min(3, salienceRaw)) as 0 | 1 | 2 | 3

  const sources = [
    ...recentDevelopments, ...liveControversies, ...politicalRisks,
  ].map((i) => i.source)
  const seen = new Set<string>()
  const uniqueSources = sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))

  return {
    recency: { recentDevelopments, liveControversies, politicalRisks, whoIsTalking, salience, sources: uniqueSources },
    costUsd: result.costUsd,
    postsFetched: result.postsFetched,
  }
}

/** §6d.1 call 2 — argument mining. NO date bound, by design. */
export async function runXArgumentMining(
  topic: string, ideaContext: string, noiseFilter: boolean,
): Promise<{ items: ArgumentItem[]; costUsd: number; postsFetched: number } | null> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) return null
  const model = process.env.ORIENTATION_X_MODEL ?? 'grok-4.3'
  const timeoutMs = parseInt(process.env.ORIENTATION_X_TIMEOUT_MS ?? '75000', 10)

  const instructions = [
    'You search X for the strongest articulations FOR and AGAINST a policy idea — wherever and whenever they appear.',
    'Do NOT restrict yourself to recent posts: the most interesting argument on a subject is often years old, and may only exist on X.',
    '',
    'For each argument return: the claim, the reason given for it, the stance (for / against / nuanced), the post date (yyyy-mm-dd), the author handle, the post URL, timesSeen (how many separate posts made substantially this same argument), and lowCredibility (true for anonymous-viral or bot-like sources).',
    'Also return salience 0–3 for how widely this subject is argued on X overall.',
    '',
    noiseFilter ? NOISE_FILTER_PROMPT : NOISE_FILTER_PROMPT_OFF,
    '',
    QUARANTINE_NOTE,
  ].join('\n')

  const result = await callGrok({
    model, apiKey, timeoutMs,
    instructions,
    user: [`Policy idea: ${topic}`, ideaContext ? `Context: ${ideaContext}` : ''].filter(Boolean).join('\n'),
    schema: ARGUMENTS_SCHEMA,
    schemaName: 'x_argument_mining',
    logTag: 'orientation:x-arguments',
    pass: 'orientation.x',
  })
  if (!result) return null

  const raw = Array.isArray(result.parsed.arguments) ? result.parsed.arguments : []
  const items: ArgumentItem[] = (raw as Array<Record<string, unknown>>)
    .map((e): ArgumentItem | null => {
      const claim = str(e.claim)
      const date = normaliseDate(e.date)
      const url = str(e.url)
      const author = handleLabel(str(e.author))
      const stance = toStance(e.stance)
      if (!claim || !date || !url || !author || !stance) return null
      const timesSeen = typeof e.timesSeen === 'number' && e.timesSeen > 0 ? Math.trunc(e.timesSeen) : 1
      // A low-credibility signal is DOWN-WEIGHTED BY BEING SAID, not by being
      // dropped (§6d.2): the reader sees the flag and judges. Silently binning
      // it would hide that the argument is circulating at all.
      const label = e.lowCredibility === true ? `${author} (low-credibility source)` : author
      return {
        claim, reason: str(e.reason), stance, date, tier: 'C',
        source: { label, url, date, tier: 'C' },
        repetitions: timesSeen,
      }
    })
    .filter((a): a is ArgumentItem => a !== null)

  return { items, costUsd: result.costUsd, postsFetched: result.postsFetched }
}

// ── S21 §3 — the per-briefing post cap, ENFORCED BEFORE THE CALL, LOGGED AFTER ──────────

/**
 * Hard cap on X posts fetched per briefing.
 *
 * ⚠ VALUE HISTORY, RECORDED BECAUSE IT CHANGED ONCE ALREADY. Charlie answered 20 when asked
 * directly mid-session (no Q1 answer existed on file at the time) and S21 shipped on that
 * number. The actual CCh brief, seen afterward, gives **30** — corrected here, same session,
 * before the 20 had been live in production for any real briefing (the flag was off the whole
 * time; see docs/SEARCH_S21_REPORT.md §9). No stale "20" is left anywhere as a default.
 *
 * ⚠ THERE IS NO API-LEVEL "MAX RESULTS" PARAMETER ON `x_search` (docs.x.ai, verified
 * 2026-09-24 — `from_date`/`to_date`/`allowed_x_handles`/`excluded_x_handles` only; see
 * docs/SEARCH_S21_REPORT.md §2). So "enforced before the call" is an APPLICATION-level
 * gate between the two calls a briefing makes, not a request parameter: the recency scan
 * runs first, and if it alone reached the cap, argument mining is SKIPPED — never sent —
 * rather than sent and its result discarded. "Logged after" is `postsFetched` on both
 * `CallOutcome`s and in `LlmSpend.postsFetched`, read off the provider's own usage figure.
 *
 * This is also why `index.ts` runs the two X calls SEQUENTIALLY rather than concurrently
 * with each other (they remain concurrent with the Gemini web pass) — a gate checked
 * before firing a call has no meaning if both calls have already started.
 */
export const ORIENTATION_X_POST_CAP = parseInt(process.env.ORIENTATION_X_POST_CAP ?? '30', 10)

export interface XSequentialHalf<T> { value: T | null; ms: number; skippedReason?: string }
export interface XSequentialResult {
  recency: XSequentialHalf<{ recency: RecencyScan; costUsd: number; postsFetched: number }>
  args: XSequentialHalf<{ items: ArgumentItem[]; costUsd: number; postsFetched: number }>
}

/**
 * Run the recency scan, then — ONLY if the cap has not already been reached — the
 * argument-mining call. Never throws: each half degrades to `value: null` on its own
 * failure, exactly like the rest of this layer.
 */
export async function runXOrientationSequential(
  topic: string, ideaContext: string, recencyDays: number, noiseFilter: boolean,
  capPosts: number = ORIENTATION_X_POST_CAP,
): Promise<XSequentialResult> {
  const t0 = Date.now()
  const recencyValue = await runXRecencyScan(topic, ideaContext, recencyDays)
  const recencyMs = Date.now() - t0
  const fetchedSoFar = recencyValue?.postsFetched ?? 0

  if (fetchedSoFar >= capPosts) {
    const skippedReason = `X post cap (${capPosts}) reached by the recency scan alone `
      + `(${fetchedSoFar} posts) — argument mining skipped BEFORE the call`
    console.warn(`[orientation:x] ${skippedReason}`)
    return { recency: { value: recencyValue, ms: recencyMs }, args: { value: null, ms: 0, skippedReason } }
  }

  const t1 = Date.now()
  const argsValue = await runXArgumentMining(topic, ideaContext, noiseFilter)
  const argsMs = Date.now() - t1
  const totalFetched = fetchedSoFar + (argsValue?.postsFetched ?? 0)
  if (totalFetched > capPosts) {
    // §3's cap is enforced BEFORE a call is made, not by truncating one already in
    // flight — x_search has no "stop after N posts" parameter (header note above). A
    // single call fetching more than the remaining headroom is logged, not prevented.
    console.warn(`[orientation:x] post cap exceeded AFTER the call: ${totalFetched}/${capPosts} — `
      + 'x_search has no in-flight limit; logged for the next briefing to see, not corrected here')
  }
  return { recency: { value: recencyValue, ms: recencyMs }, args: { value: argsValue, ms: argsMs } }
}
