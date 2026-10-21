// ─────────────────────────────────────────────────────────────────────────────
// SEARCH-29 — ORIENTATION v2: what is being ARGUED about this idea, and the VOCABULARY around it.
//
// Stage 1 of Charlie's research sequence. It is given the user's FULL input (not a keyword list),
// searches the web (Gemini grounding) and X (Grok x_search) in parallel, and returns two things:
//
//   arguments   — every argument actually made: claim, reason, side, source.
//   vocabulary  — the terms the debate uses: key terms, statutory terms if found, people,
//                 organisations, places it has been tried. Stage 2 feeds these to the router.
//
// ⚠ WHY THIS EXISTS AS A SECOND VERSION. v1 (`index.ts`) is called only from the legacy Page-1
// trigger (`fireSearchTrigger`); the build pipeline's ORIENT pass never called it, so on 25 Sep
// the last `orientation.*` ledger row was written and none has been since, while the flag read ON.
// v1 also dropped every argument without a date, and had no vocabulary output. v2 is called from
// `orientPass` (build.ts) and keeps an argument that has no date, flagged as undated.
//
// ⚠ THE FILTER DROPS ONLY WHAT CHARLIE NAMED: abuse, sarcasm, pile-ons, and posts with no
// argument. Every drop is LOGGED with its reason (`dropped`). Nothing else is removed, and a
// near-duplicate is MERGED (counted in `repetitions`), never dropped. With the filter OFF the
// same call is made with a neutral instruction and nothing is dropped, so the two runs are
// comparable and what the filter removes is a measured number.
//
// ⚠ THE 30-POST CAP IS ADVISORY HERE AND LOGGED. `x_search` has no max-results parameter
// (orientation/x-orientation.ts, ORIENTATION_X_POST_CAP). v1 enforced the cap by sequencing two
// calls; v2 makes ONE X call, so the model is told the cap and the provider's own `postsFetched`
// is recorded against it. `xCapExceeded` says when it was passed. This is stated in every report.
//
// Tier B (web) is cited by index into the grounded source list, never by a URL the model wrote.
// Tier C (X) is what is circulating — attributed, never fact, never "public opinion".
// Nothing here may be used to state a fact; the renderer/quarantine rules of v1 still apply.
// ─────────────────────────────────────────────────────────────────────────────

import type { CallOutcome, Tier } from './types'
import { normaliseDate } from './noise-filter'
import { callGemini } from './web-orientation'
import { callGrok, ORIENTATION_X_POST_CAP } from './x-orientation'
import { fetchedContentIsData } from '../fetched-content-guard'
import { flagEnabled } from '@/lib/env-flags'

export type Side = 'for' | 'against' | 'nuanced'

export interface V2Source { label: string; url: string; date: string; tier: Tier; /** false = the model named no source we could verify */ verified: boolean }
export interface V2Argument { claim: string; reason: string; side: Side; source: V2Source; repetitions: number; undated: boolean }
export interface V2Vocabulary { keyTerms: string[]; statutoryTerms: string[]; people: string[]; organisations: string[]; places: string[] }
export type DropReason = 'abuse' | 'sarcasm' | 'pile-on' | 'no-argument'
export interface V2Dropped { what: string; reason: DropReason; tier: Tier }

export interface OrientationV2 {
  version: 2
  ranAt: string
  noiseFilter: boolean
  arguments: V2Argument[]
  vocabulary: V2Vocabulary
  dropped: V2Dropped[]
  /** arguments merged into another because they said the same thing (kept, counted in repetitions) */
  merged: number
  calls: CallOutcome[]
  failed: boolean
  xCapExceeded: boolean
  totalMs: number
  totalCostUsd: number
}

export function orientationV2Enabled(): boolean {
  return flagEnabled('LEX_WEB_ORIENTATION') && flagEnabled('LEX_ORIENTATION_V2')
}
export function orientationTermsEnabled(): boolean {
  return flagEnabled('LEX_ORIENTATION_TERMS')
}

const EMPTY_VOCAB = (): V2Vocabulary => ({ keyTerms: [], statutoryTerms: [], people: [], organisations: [], places: [] })

// ── schemas ──────────────────────────────────────────────────────────────────

const VOCAB_PROPS = {
  keyTerms: { type: 'array', items: { type: 'string' } },
  statutoryTerms: { type: 'array', items: { type: 'string' } },
  people: { type: 'array', items: { type: 'string' } },
  organisations: { type: 'array', items: { type: 'string' } },
  places: { type: 'array', items: { type: 'string' } },
}
const VOCAB_REQUIRED = ['keyTerms', 'statutoryTerms', 'people', 'organisations', 'places']

// Gemini's responseSchema is the OpenAPI subset (no additionalProperties).
const WEB_SCHEMA = {
  type: 'object',
  properties: {
    arguments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' }, reason: { type: 'string' },
          side: { type: 'string', enum: ['for', 'against', 'nuanced'] },
          date: { type: 'string' }, sourceIndex: { type: 'integer' },
        },
        required: ['claim', 'reason', 'side', 'date', 'sourceIndex'],
      },
    },
    vocabulary: { type: 'object', properties: VOCAB_PROPS, required: VOCAB_REQUIRED },
  },
  required: ['arguments', 'vocabulary'],
}

// xAI's structured output is strict JSON Schema.
const X_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    arguments: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          claim: { type: 'string' }, reason: { type: 'string' },
          side: { type: 'string', enum: ['for', 'against', 'nuanced'] },
          date: { type: 'string' }, author: { type: 'string' }, url: { type: 'string' },
          timesSeen: { type: 'integer' }, lowCredibility: { type: 'boolean' },
        },
        required: ['claim', 'reason', 'side', 'date', 'author', 'url', 'timesSeen', 'lowCredibility'],
      },
    },
    vocabulary: { type: 'object', additionalProperties: false, properties: VOCAB_PROPS, required: VOCAB_REQUIRED },
    dropped: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { what: { type: 'string' }, reason: { type: 'string', enum: ['abuse', 'sarcasm', 'pile-on', 'no-argument'] } },
        required: ['what', 'reason'],
      },
    },
  },
  required: ['arguments', 'vocabulary', 'dropped'],
}

// ── prompts ──────────────────────────────────────────────────────────────────
// ⚠ CLAUDE.md §27: these illustrate the SHAPE of a good answer and carry no specimen sentence
// that could come back as content.

const WHAT_TO_REPORT = `ARGUMENTS: every distinct argument made about the proposal described — for it, against it, or mixed. Each is a claim, the reason given for it, which side it is on, and who made it. Keep every argument actually made, including weak, unfashionable and minority ones; do not choose between them and do not repair, strengthen or complete one.
VOCABULARY: the words the debate itself uses —
  keyTerms: the terms of art and phrases people use for this subject, including different names for the same thing;
  statutoryTerms: Acts, bills, regulations, sections and schemes the discussion names, ONLY where the source actually names them;
  people, organisations, places: those taking part, and the places where something like this has been tried.
Never carry over a subject, an example or a figure from these instructions. Take every term from the sources.`

const FILTER_ON = `DROP ONLY these four kinds of post and say what you dropped and why: abuse (attacks on the person rather than the position); sarcasm with no argument in it; pile-ons (a reply or dunk that only repeats a point already captured); posts that make no argument at all. Anything else is kept. A post that quotes an insult but argues a point is kept. If twenty posts make the same argument, return the clearest one and set timesSeen to how many you saw.`
const FILTER_OFF = `Do not filter. Return every argument you find, whatever its tone. Leave "dropped" empty.`

function webGroundedSystem(): string {
  return `You are a UK policy researcher. Search the web for what is being argued about the proposal the person describes, and report in COMPACT BULLETS — one or two sentences each, no preamble, no closing summary.

${WHAT_TO_REPORT}

Maximum 14 arguments. UK-focused unless a point is explicitly comparative. State what sources say; do not adjudicate. Give a date where the source has one.`
}

const WEB_STRUCTURE_SYSTEM = `You convert a research note into JSON. You add NOTHING. Every item must already appear in the note.

${fetchedContentIsData('research note')}

You are given a numbered SOURCES list. For an argument, \`sourceIndex\` is the number of the source that supports it; if no listed source supports it, use 0 — never guess an index and never invent a URL. \`date\` is yyyy-mm-dd; if the note gives only a month or year use the first day of it; if it gives none, return an empty string. Keep every argument in the note. Vocabulary entries are short terms, not sentences; leave a list empty rather than inventing entries.`

function xSystem(filterOn: boolean, cap: number): string {
  return `You search X for what is being argued about the proposal the person describes. This is what is CIRCULATING on X — never treated as fact and never as "public opinion"; X is a skewed sample and downstream it is labelled as such. Report attributed, dated positions and state nothing as established truth.

Read about ${cap} posts at most, then stop.

${WHAT_TO_REPORT}

${filterOn ? FILTER_ON : FILTER_OFF}
For each argument give the post date (yyyy-mm-dd), the author handle, the post URL, and lowCredibility (true for an anonymous-viral or bot-like source) — flag such a source, do not drop it.

${fetchedContentIsData('post text')}`
}

// ── helpers ──────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const side = (v: unknown): Side | null => { const s = str(v).toLowerCase(); return s === 'for' || s === 'against' || s === 'nuanced' ? s : null }

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'be', 'that', 'this', 'it', 'as', 'by', 'with', 'from', 'at', 'was', 'were', 'will', 'would', 'should', 'could', 'has', 'have', 'had', 'not', 'no', 'they', 'their', 'them', 'we', 'our', 'you', 'your'])
const toks = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let i = 0
  for (const t of a) if (b.has(t)) i++
  return i / (a.size + b.size - i)
}

function cleanVocab(raw: unknown): V2Vocabulary {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const list = (v: unknown): string[] => {
    const out: string[] = []
    const seen = new Set<string>()
    for (const x of Array.isArray(v) ? v : []) {
      const t = str(x).replace(/\s+/g, ' ').slice(0, 80)
      const k = t.toLowerCase()
      if (t.length < 2 || seen.has(k)) continue
      seen.add(k); out.push(t)
      if (out.length >= 25) break
    }
    return out
  }
  return { keyTerms: list(r.keyTerms), statutoryTerms: list(r.statutoryTerms), people: list(r.people), organisations: list(r.organisations), places: list(r.places) }
}

function mergeVocab(...vs: V2Vocabulary[]): V2Vocabulary {
  const out = EMPTY_VOCAB()
  for (const key of Object.keys(out) as Array<keyof V2Vocabulary>) {
    const seen = new Set<string>()
    for (const v of vs) for (const t of v[key]) { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out[key].push(t) } }
    out[key] = out[key].slice(0, 30)
  }
  return out
}

/** The terms stage 2 hands to the router: what the debate calls things, the statutes it names, and who regulates. */
export function termsForSearch(o: OrientationV2 | null | undefined, cap = 20): string[] {
  if (!o || o.failed) return []
  const v = o.vocabulary
  const seen = new Set<string>()
  const out: string[] = []
  // statutory terms first (the router can route on them), then the debate's own phrases, then organisations
  for (const t of [...v.statutoryTerms, ...v.keyTerms, ...v.organisations]) {
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k); out.push(t)
    if (out.length >= cap) break
  }
  return out
}

// ── the two branches ─────────────────────────────────────────────────────────

interface Branch { arguments: V2Argument[]; vocabulary: V2Vocabulary; dropped: V2Dropped[]; costUsd: number; postsFetched?: number; ms: number; ok: boolean; reason?: string }
const failedBranch = (reason: string, ms: number): Branch => ({ arguments: [], vocabulary: EMPTY_VOCAB(), dropped: [], costUsd: 0, ms, ok: false, reason })

async function webBranch(input: string, deadline: number): Promise<Branch> {
  const t0 = Date.now()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return failedBranch('GEMINI_API_KEY not set', 0)
  const model = process.env.ORIENTATION_WEB_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = Math.min(parseInt(process.env.ORIENTATION_WEB_TIMEOUT_MS ?? '40000', 10), Math.max(5000, deadline - Date.now()))
  const user = `The proposal, in the person's own words:\n${input}`
  const ground = () => callGemini({ model, apiKey, timeoutMs, system: webGroundedSystem(), user, grounded: true, maxOutputTokens: 8192 })
  let grounded = await ground()
  if (grounded && !grounded.sources.length) grounded = await ground() // one retry, as v1: a grounded call with no sources answered from memory
  if (!grounded) return failedBranch('the grounded search did not answer', Date.now() - t0)
  const noSources = !grounded.sources.length
  const sourceList = grounded.sources.map((s, i) => `${i + 1}. ${s.label} — ${s.url}`).join('\n') || '(no sources were returned)'
  const structured = await callGemini({
    model, apiKey, timeoutMs, system: WEB_STRUCTURE_SYSTEM,
    user: `RESEARCH NOTE:\n${grounded.text}\n\nSOURCES:\n${sourceList}`,
    grounded: false, schema: WEB_SCHEMA, maxOutputTokens: 8192,
  })
  const cost = grounded.costUsd + (structured?.costUsd ?? 0)
  if (!structured) return { ...failedBranch('the structuring call did not answer', Date.now() - t0), costUsd: cost }
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(structured.text) } catch { return { ...failedBranch('the structuring call returned unparseable JSON', Date.now() - t0), costUsd: cost } }

  const args: V2Argument[] = []
  for (const e of (Array.isArray(parsed.arguments) ? parsed.arguments : []) as Array<Record<string, unknown>>) {
    const claim = str(e.claim); const sd = side(e.side)
    if (!claim || !sd) continue
    const idx = typeof e.sourceIndex === 'number' ? Math.trunc(e.sourceIndex) : 0
    const src = idx >= 1 ? grounded.sources[idx - 1] : undefined
    const date = normaliseDate(e.date) ?? ''
    args.push({
      claim, reason: str(e.reason), side: sd, repetitions: 1, undated: !date,
      source: src
        ? { label: src.label, url: src.url, date, tier: 'B', verified: true }
        : { label: 'web (no source could be matched to this point)', url: '', date, tier: 'B', verified: false },
    })
  }
  return {
    arguments: args, vocabulary: cleanVocab(parsed.vocabulary), dropped: [], costUsd: cost, ms: Date.now() - t0, ok: true,
    reason: noSources ? 'the search returned no source list; arguments are unverified' : undefined,
  }
}

async function xBranch(input: string, filterOn: boolean, deadline: number): Promise<Branch> {
  const t0 = Date.now()
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) return failedBranch('GROK_API_KEY not set', 0)
  const model = process.env.ORIENTATION_X_MODEL ?? 'grok-4.3'
  const timeoutMs = Math.min(parseInt(process.env.ORIENTATION_X_TIMEOUT_MS ?? '75000', 10), Math.max(5000, deadline - Date.now()))
  const res = await callGrok({
    model, apiKey, timeoutMs,
    instructions: xSystem(filterOn, ORIENTATION_X_POST_CAP),
    user: `The proposal, in the person's own words:\n${input}`,
    schema: X_SCHEMA, schemaName: 'x_orientation_v2', logTag: 'orientation:v2-x', pass: 'orientation.x',
  })
  if (!res) return failedBranch('the X search did not answer', Date.now() - t0)
  const p = res.parsed
  const args: V2Argument[] = []
  for (const e of (Array.isArray(p.arguments) ? p.arguments : []) as Array<Record<string, unknown>>) {
    const claim = str(e.claim); const sd = side(e.side)
    if (!claim || !sd) continue
    const date = normaliseDate(e.date) ?? ''
    const author = str(e.author); const url = str(e.url)
    const label = (author || 'an X account (handle not given)') + (e.lowCredibility === true ? ' (low-credibility source)' : '')
    args.push({
      claim, reason: str(e.reason), side: sd, undated: !date,
      repetitions: typeof e.timesSeen === 'number' && e.timesSeen > 0 ? Math.trunc(e.timesSeen) : 1,
      source: { label, url, date, tier: 'C', verified: !!(author && url) },
    })
  }
  const dropped: V2Dropped[] = filterOn
    ? ((Array.isArray(p.dropped) ? p.dropped : []) as Array<Record<string, unknown>>)
        .map((d): V2Dropped | null => {
          const r = str(d.reason) as DropReason; const what = str(d.what)
          return what && ['abuse', 'sarcasm', 'pile-on', 'no-argument'].includes(r) ? { what: what.slice(0, 300), reason: r, tier: 'C' } : null
        })
        .filter((d): d is V2Dropped => d !== null)
    : []
  return { arguments: args, vocabulary: cleanVocab(p.vocabulary), dropped, costUsd: res.costUsd, postsFetched: res.postsFetched, ms: Date.now() - t0, ok: true }
}

// ── entry point ──────────────────────────────────────────────────────────────

/**
 * Run stage 1. Never throws: a failed branch is recorded as failed (never as "nothing is being
 * argued"), and the result says `failed: true` only when BOTH branches failed.
 */
export async function runOrientationV2(opts: {
  /** The user's full input, in their own words. */
  input: string
  /** Default: LEX_ORIENTATION_NOISE_FILTER (on unless 'false'). Passed explicitly for the on/off measurement. */
  noiseFilter?: boolean
  /** Turn the X half off (web only). Default on. */
  x?: boolean
  budgetMs?: number
}): Promise<OrientationV2> {
  const t0 = Date.now()
  const filterOn = opts.noiseFilter ?? (process.env.LEX_ORIENTATION_NOISE_FILTER !== 'false')
  const xOn = opts.x ?? (process.env.LEX_ORIENTATION_X !== 'false')
  const input = opts.input.trim().slice(0, 6000)
  const budgetMs = opts.budgetMs ?? parseInt(process.env.ORIENTATION_TOTAL_BUDGET_MS ?? '90000', 10)
  const deadline = t0 + budgetMs

  const empty: OrientationV2 = {
    version: 2, ranAt: new Date().toISOString(), noiseFilter: filterOn, arguments: [], vocabulary: EMPTY_VOCAB(), dropped: [],
    merged: 0, calls: [], failed: true, xCapExceeded: false, totalMs: 0, totalCostUsd: 0,
  }
  if (!input) return empty

  const guarded = async (name: string, fn: () => Promise<Branch>): Promise<Branch> => {
    let timer: NodeJS.Timeout | undefined
    try {
      const guard = new Promise<'BUDGET'>((r) => { timer = setTimeout(() => r('BUDGET'), Math.max(0, deadline - Date.now())) })
      const out = await Promise.race([fn(), guard])
      if (out === 'BUDGET') return failedBranch(`abandoned at the ${budgetMs}ms stage budget`, Date.now() - t0)
      return out
    } catch (err) {
      console.warn(`[orientation:v2] ${name} threw:`, err instanceof Error ? err.message : err)
      return failedBranch('threw: ' + (err instanceof Error ? err.message : String(err)), Date.now() - t0)
    } finally { clearTimeout(timer) }
  }

  const [web, x] = await Promise.all([
    guarded('web', () => webBranch(input, deadline)),
    xOn ? guarded('x', () => xBranch(input, filterOn, deadline)) : Promise.resolve(null),
  ])

  // pool, then merge restatements of the same argument on the same side (kept, counted)
  const pooled = [...web.arguments, ...(x?.arguments ?? [])]
  const kept: Array<{ a: V2Argument; t: Set<string> }> = []
  let merged = 0
  for (const a of pooled) {
    const t = toks(`${a.claim} ${a.reason}`)
    const m = kept.find((k) => k.a.side === a.side && jaccard(k.t, t) >= 0.6)
    if (m) { m.a.repetitions += Math.max(1, a.repetitions); merged++; continue }
    kept.push({ a: { ...a }, t })
  }
  // the deterministic half of the filter: an argument with no reason is "no argument" and is logged, not silently lost
  const dropped: V2Dropped[] = [...(x?.dropped ?? [])]
  let finalArgs = kept.map((k) => k.a)
  if (filterOn) {
    for (const a of finalArgs) if (!a.reason) dropped.push({ what: a.claim.slice(0, 300), reason: 'no-argument', tier: a.source.tier })
    finalArgs = finalArgs.filter((a) => a.reason)
  }
  // stable, meaning-free order: side, then tier (web first), then oldest first. Never by repetitions.
  const sideRank = { for: 0, against: 1, nuanced: 2 } as const
  finalArgs.sort((p, q) => sideRank[p.side] - sideRank[q.side] || p.source.tier.localeCompare(q.source.tier) || (p.source.date || '9').localeCompare(q.source.date || '9'))

  const calls: CallOutcome[] = [
    { call: 'v2-web', ok: web.ok, ms: web.ms, provider: 'google', costUsd: web.costUsd, ...(web.reason ? { reason: web.reason } : {}) },
  ]
  if (x) calls.push({ call: 'v2-x', ok: x.ok, ms: x.ms, provider: 'xai', costUsd: x.costUsd, postsFetched: x.postsFetched, kept: x.arguments.length, discarded: x.dropped.length, ...(x.reason ? { reason: x.reason } : {}) })
  const xCapExceeded = (x?.postsFetched ?? 0) > ORIENTATION_X_POST_CAP

  const result: OrientationV2 = {
    version: 2, ranAt: new Date().toISOString(), noiseFilter: filterOn,
    arguments: finalArgs, vocabulary: mergeVocab(web.vocabulary, x?.vocabulary ?? EMPTY_VOCAB()), dropped, merged,
    calls, failed: !web.ok && !(x?.ok ?? false), xCapExceeded,
    totalMs: Date.now() - t0, totalCostUsd: web.costUsd + (x?.costUsd ?? 0),
  }
  console.log('[orientation:v2] complete', {
    ms: result.totalMs, costUsd: Number(result.totalCostUsd.toFixed(4)), web: web.ok, x: x ? x.ok : 'off',
    arguments: result.arguments.length, merged, dropped: dropped.length, posts: x?.postsFetched, xCapExceeded, filter: filterOn,
    terms: termsForSearch(result).length,
  })
  return result
}
