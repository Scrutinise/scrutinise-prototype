// ─────────────────────────────────────────────────────────────────────────────
// SEARCH S26 — STAGE 3: THE FOUR-MODEL CHECK.
//
// Stage 3 of Charlie's research sequence (docs/SPRINT.md "Stage 3 — four-model check"). Each of four
// providers is given the user's problem, a compact summary of stages 1–2 (supplied by the caller) and
// Charlie's question, in parallel:
//
//   what has been tried, failed, succeeded or caused controversy anywhere; what legislation, debates
//   and proposals have dominated; what each would recommend; who has been most prominent and how they
//   fared — and, explicitly, what the summary LACKS.
//
// Providers, and how each searches:
//   google     webSearch({provider:'google'}) (Gemini grounding) → callModelJson(gemini) answers, citing by index
//   anthropic  webSearch({provider:'anthropic'}) (Haiku + native web_search) → callModelJson(haiku) answers
//   openai     webSearch({provider:'openai'}) (Luna, searchOpenAI) → callModelJson(gpt-6-luna) answers
//   xai        callGrok with x_search (ORIENTATION_X_POST_CAP posts, advisory as in v2) — one call
//
// ⚠ WHY SEARCH-THEN-ANSWER FOR THREE OF THEM. `callModelJson` (the uniform dispatcher the brief names)
// has no search tool; the web-search adapters return sources but no analysis. Composing the two reuses
// both unchanged. A source on a point is cited BY INDEX into the list the provider's own search
// returned — the adapters already discard any URL the model typed itself — so a URL on a point here is
// never one a model wrote. When the search half fails the answer still runs (the question asks for
// the model's view as well as sources); the call records `searchOk: false` and its points carry no
// source, so any point about a named person from it is dropped by the rule below.
//
// ⚠ ARGUMENTS, NOT FACTS (Amendment 1). Every point is something argued, tried or proposed, with the
// side that makes it. Keep every argument however weak; drop only by the named rule below, and log
// every drop. Provider labels (`providers`) are FOR ADMIN DIAGNOSTICS ONLY — never shown to users.
//
// ⚠ THE RULES THE CODE APPLIES, NOT THE MODEL (pure, exported, imported by check-stage3.ts):
//   mergePoints          restatements on the SAME side merge (jaccard ≥ 0.6 on tokens, as v2) and union
//                        their providers and sources; a recommendation merges only with a recommendation.
//   applyNamedPersonRule a point about a NAMED PERSON with no source URL is DROPPED, reason
//                        'named-person-unsourced', and logged.
//   crossCheckPeople     a named person who looks like an MP/peer is looked up in the people graph
//                        (lookupName) and the result STORED — none/one/many — never resolved by guess.
//
// ⚠ COST CAP ($2 per build by default). Checked BEFORE the round: if `spentUsd >= budgetUsd` nothing
// runs. A round's cost cannot be known in advance, so a round that itself overruns keeps its results
// and records the overrun. Reaching the cap returns `partial: true` with "partial: N of 4 providers"
// and raises the cap-breach alert — see `alertCapBreach` for why that is a TODO, not an email.
//
// ⚠ FAILURE HONESTY (CLAUDE.md §18). A provider that failed is recorded with its reason (truncated /
// bad-json / blocked / http / timeout / no-key …), never as "found nothing". `failed: true` only when
// every provider asked failed.
//
// ⚠ NOT WIRED. Lex decides where this goes in the build (SPRINT.md). Flag: LEX_ORIENTATION_STAGE3, off.
// ─────────────────────────────────────────────────────────────────────────────

import type { Side } from './v2'
import { webSearch, type WebSearchResult } from './web-search'
import { callGrok, ORIENTATION_X_POST_CAP } from './x-orientation'
import { callModelJson, KEY_ENV, type LlmFailureReason } from '../model-call'
import { recordUsage } from '../spend-ledger'
import { currentBuildContext, runWithSpendContext } from '../build-context'
import { fetchedContentIsData } from '../fetched-content-guard'
import { lookupName, type NameLookupResult } from '@/lib/graph/name-lookup'
import { flagEnabled } from '@/lib/env-flags'

// ── types ────────────────────────────────────────────────────────────────────

export type Stage3Provider = 'google' | 'anthropic' | 'openai' | 'xai'
export const STAGE3_PROVIDERS: readonly Stage3Provider[] = ['google', 'anthropic', 'openai', 'xai']

export type Stage3Kind =
  | 'tried' | 'failed' | 'succeeded' | 'controversy' | 'legislation' | 'debate' | 'proposal'
  | 'recommendation' | 'person' | 'gap'
export const STAGE3_KINDS: readonly Stage3Kind[] = ['tried', 'failed', 'succeeded', 'controversy', 'legislation', 'debate', 'proposal', 'recommendation', 'person', 'gap']

export interface Stage3Source { url: string; label: string }

/** The people-graph cross-check for one named person. Stored, never acted on here. */
export interface PersonCheck {
  name: string
  /** 'lookup-failed' = the graph could not be read; it is NOT 'none'. */
  status: 'none' | 'one' | 'many' | 'lookup-failed'
  /** Only when status is 'one' — with 'many' nothing is picked. */
  tier: string | null
  parlMemberId: number | null
  candidates: number
  reason?: string
}

export interface Stage3Point {
  point: string
  side: Side
  kind: Stage3Kind
  sources: Stage3Source[]
  /** ⚠ ADMIN DIAGNOSTICS ONLY (Amendment 1): which providers raised this. Never shown to users. */
  providers: Stage3Provider[]
  /** Named people the point is about, as the model wrote them. */
  people: string[]
  /** Present (true) on every recommendation: a model's suggestion, NEVER evidence. */
  suggestionNotEvidence?: true
  /** The MP/peer cross-check, one entry per person who looked parliamentary. */
  peopleCheck?: PersonCheck[]
  /**
   * Amendment 2 — LEFT UNDEFINED BY STAGE 3. Lex sets it when rendering ("Disputed by [side], e.g. in
   * [debate/source]" / "We haven't been able to find the evidence behind that"); stage 3 has no corpus
   * view and must not judge a claim.
   */
  disputeHint?: 'disputed-by' | 'no-evidence-found'
}

/** One point as a single provider returned it, before merging. */
export interface RawPoint {
  point: string
  side: Side
  kind: Stage3Kind
  sources: Stage3Source[]
  people: string[]
  /** the model's own flag that a named person is an MP or peer */
  parliamentarian: boolean
}

export type Stage3FailReason = LlmFailureReason | 'no-answer' | 'threw' | 'not-run-cap' | 'abandoned-budget'

export interface Stage3Call {
  provider: Stage3Provider
  ok: boolean
  ms: number
  costUsd: number
  /** true when any of this provider's ledger rows had no rate on file (cost understated) */
  unpriced?: boolean
  reason?: Stage3FailReason
  detail?: string
  /** the search half (google/anthropic/openai): did it complete, and how many sources it gave */
  searchOk?: boolean
  searchReason?: string
  sources?: number
  /** xai: posts the provider says it fetched, against ORIENTATION_X_POST_CAP */
  postsFetched?: number
  /** points this provider returned (before merge and drop) */
  points: number
}

export interface Stage3Dropped { what: string; reason: 'named-person-unsourced'; provider: Stage3Provider }

export interface Stage3Result {
  version: 1
  ranAt: string
  angle: string | null
  points: Stage3Point[]
  dropped: Stage3Dropped[]
  /** restatements merged into another point (kept, providers unioned) */
  merged: number
  pointsOnlyFromOneProvider: number
  calls: Stage3Call[]
  providersAsked: number
  /** providers that answered */
  providersRun: number
  /** true when the per-build cap was reached (before the round, or by it) */
  partial: boolean
  /** "partial: N of 4 providers" when partial; null otherwise */
  partialText: string | null
  budgetUsd: number
  spentBeforeUsd: number
  capAlert: { triggered: boolean; sent: boolean; reason: string } | null
  /** true only when EVERY provider asked failed */
  failed: boolean
  totalCostUsd: number
  totalMs: number
}

export interface Stage3Options {
  problem: string
  summary: string
  angle?: string
  providers?: Stage3Provider[]
  budgetUsd?: number
  spentUsd?: number
  userId?: string | null
  ideaId?: string | null
  buildId?: string | null
  /** Total wall-clock budget for the round. Default STAGE3_TOTAL_BUDGET_MS or 150 s. */
  budgetMs?: number
  /** Test seam: the people-graph lookup. Default `lookupName`. */
  lookup?: (name: string, opts: { kind?: 'person' | 'organisation' }) => Promise<NameLookupResult>
  /** Test seam: the cap-breach alert. Default `alertCapBreach`. */
  onCapBreach?: (incident: CapIncident) => Promise<{ sent: boolean; reason: string }>
}

export function stage3Enabled(): boolean {
  return flagEnabled('LEX_ORIENTATION_STAGE3')
}

// ── the question and the prompts ─────────────────────────────────────────────
// ⚠ CLAUDE.md §27: SHAPE only. No specimen sentence, subject or figure that could come back as content.

export const STAGE3_QUESTION = `Answer these, about the problem described, from what you know and what your search found:
  1. What has been TRIED anywhere (any country, region, sector or period) — and what FAILED, what SUCCEEDED, and what caused CONTROVERSY.
  2. Which LEGISLATION, DEBATES and PROPOSALS have dominated discussion of it.
  3. What YOU would recommend — this is your suggestion, and will be presented only as a suggestion, never as evidence.
  4. Who has been most PROMINENT on it, and how they fared.
  5. What the SUMMARY of earlier research LACKS: every significant issue, argument, precedent or actor it does not mention. Be specific to this problem; a gap is something missing from THIS summary, not a general caution.`

const STAGE3_RULES = `Report ARGUMENTS, NOT FACTS: each point is one thing argued, tried, proposed or done, which side it falls on ("for" the change the person wants, "against" it, or "nuanced"), and where it comes from. Keep every argument actually being made, however weak, unfashionable or minority; do not choose between them, and do not repair or strengthen one.
For each point give a "kind": tried | failed | succeeded | controversy | legislation | debate | proposal | recommendation | person | gap.
  "recommendation" is used ONLY for your own suggestions (question 3). "gap" is used ONLY for what the summary lacks (question 5). "person" is a point about who was prominent and how they fared.
In "people" list every named individual the point is about, written as the source writes them (empty when it names nobody). Set "parliamentarian" true when any of them is or was an MP or a member of the House of Lords.
A point that names a person MUST carry a source; one that cannot will be discarded.
Never carry over a subject, an example or a figure from these instructions. Take every point from the problem, your sources and your own knowledge of this subject.`

const SIDE_ENUM = ['for', 'against', 'nuanced']

// Gemini's responseSchema is the OpenAPI subset (no additionalProperties); closeSchema() adapts it for OpenAI.
export const STAGE3_WEB_SCHEMA = {
  type: 'object',
  properties: {
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          point: { type: 'string' },
          side: { type: 'string', enum: SIDE_ENUM },
          kind: { type: 'string', enum: [...STAGE3_KINDS] },
          sourceIndexes: { type: 'array', items: { type: 'integer' } },
          people: { type: 'array', items: { type: 'string' } },
          parliamentarian: { type: 'boolean' },
        },
        required: ['point', 'side', 'kind', 'sourceIndexes', 'people', 'parliamentarian'],
      },
    },
  },
  required: ['points'],
}

// xAI structured output is strict JSON Schema.
export const STAGE3_X_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    points: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          point: { type: 'string' },
          side: { type: 'string', enum: SIDE_ENUM },
          kind: { type: 'string', enum: [...STAGE3_KINDS] },
          sources: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, properties: { url: { type: 'string' }, author: { type: 'string' } }, required: ['url', 'author'] },
          },
          people: { type: 'array', items: { type: 'string' } },
          parliamentarian: { type: 'boolean' },
        },
        required: ['point', 'side', 'kind', 'sources', 'people', 'parliamentarian'],
      },
    },
  },
  required: ['points'],
}

/** The user message every provider receives: problem, summary, optional angle. Pure. */
export function stage3UserMessage(problem: string, summary: string, angle?: string | null): string {
  const a = (angle ?? '').trim()
  return [
    `THE PROBLEM, in the person's own words:\n${problem.trim()}`,
    `SUMMARY OF EARLIER RESEARCH (stages 1–2):\n${summary.trim() || '(no summary was supplied)'}`,
    a ? `ANGLE — narrow every answer to this question; leave out what does not bear on it:\n${a}` : '',
  ].filter(Boolean).join('\n\n')
}

/**
 * The prompt for a web provider (google / anthropic / openai): system carries the question, the rules
 * and the isolation guard; user carries the problem, summary, angle and the numbered SOURCES list.
 * Pure — exported so the check reads the prompt the call sends.
 */
export function buildWebPrompt(problem: string, summary: string, angle: string | null | undefined, sources: WebSearchResult[]): { system: string; user: string } {
  const a = (angle ?? '').trim()
  const list = sources.length
    ? sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}${s.date ? ` (${s.date})` : ''}\n   ${s.snippet}`).join('\n')
    : '(your search returned no sources — answer from your own knowledge, and leave sourceIndexes empty)'
  const system = `You are a UK policy researcher checking earlier research for what it missed. ${a ? 'Answer within the ANGLE the person gives. ' : ''}

${STAGE3_QUESTION}

${STAGE3_RULES}

You are given a numbered SOURCES list from a web search. "sourceIndexes" are the numbers of the sources that support a point; leave it empty when none does — never guess a number and never write a URL.
Maximum 30 points. Compact: one or two sentences per point, no preamble, no closing summary.

${fetchedContentIsData('summary, source list and problem text')}`
  const user = `${stage3UserMessage(problem, summary, a)}\n\nSOURCES:\n${list}`
  return { system, user }
}

/** The prompt for xAI with X search. Pure. */
export function buildXPrompt(problem: string, summary: string, angle: string | null | undefined, cap: number): { system: string; user: string } {
  const a = (angle ?? '').trim()
  const system = `You search X for what is being argued about the problem the person describes, to check earlier research for what it missed. What is on X is what is CIRCULATING — never treated as fact and never as "public opinion". ${a ? 'Answer within the ANGLE the person gives. ' : ''}

Read about ${cap} posts at most, then stop.

${STAGE3_QUESTION}

${STAGE3_RULES}

For each point give its "sources": the post URL and the author handle of each post it comes from (empty only for your own recommendations and for gaps).
Maximum 30 points. Compact: one or two sentences per point.

${fetchedContentIsData('post text, summary and problem text')}`
  return { system, user: stage3UserMessage(problem, summary, a) }
}

/** The search query handed to the web adapters: the angle (if any) and the head of the problem. Pure. */
export function stage3SearchQuery(problem: string, angle?: string | null): string {
  const head = problem.replace(/\s+/g, ' ').trim().slice(0, 400)
  const a = (angle ?? '').trim()
  return a
    ? `${a} — in relation to: ${head}`
    : `What has been tried, failed, succeeded or been controversial, and which laws, debates and people have been prominent: ${head}`
}

// ── parsing a provider's answer ──────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const readSide = (v: unknown): Side => { const s = str(v).toLowerCase(); return s === 'for' || s === 'against' ? s : 'nuanced' }
/** An unknown kind is kept as 'debate' (an argument), never dropped. */
const readKind = (v: unknown): Stage3Kind => { const k = str(v).toLowerCase() as Stage3Kind; return STAGE3_KINDS.includes(k) ? k : 'debate' }
const readPeople = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : []).map(str).filter((p) => p.length >= 2))].slice(0, 10)

/** A web provider's answer → raw points. Sources only by index into what the search returned. Pure. */
export function parseWebAnswer(value: unknown, sources: WebSearchResult[]): RawPoint[] {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const out: RawPoint[] = []
  for (const e of (Array.isArray(v.points) ? v.points : []) as Array<Record<string, unknown>>) {
    const point = str(e?.point)
    if (!point) continue
    const idx = (Array.isArray(e.sourceIndexes) ? e.sourceIndexes : []).filter((n): n is number => typeof n === 'number').map(Math.trunc)
    const srcs: Stage3Source[] = []
    for (const i of idx) {
      const s = sources[i - 1]
      if (s && !srcs.some((x) => x.url === s.url)) srcs.push({ url: s.url, label: s.title })
    }
    out.push({ point, side: readSide(e.side), kind: readKind(e.kind), sources: srcs, people: readPeople(e.people), parliamentarian: e.parliamentarian === true })
  }
  return out
}

/** xAI's answer → raw points. A source needs a URL; the handle is its label. Pure. */
export function parseXAnswer(value: unknown): RawPoint[] {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const out: RawPoint[] = []
  for (const e of (Array.isArray(v.points) ? v.points : []) as Array<Record<string, unknown>>) {
    const point = str(e?.point)
    if (!point) continue
    const srcs: Stage3Source[] = []
    for (const s of (Array.isArray(e.sources) ? e.sources : []) as Array<Record<string, unknown>>) {
      const url = str(s?.url)
      if (/^https?:\/\//i.test(url) && !srcs.some((x) => x.url === url)) srcs.push({ url, label: str(s.author) || 'an X account (handle not given)' })
    }
    out.push({ point, side: readSide(e.side), kind: readKind(e.kind), sources: srcs, people: readPeople(e.people), parliamentarian: e.parliamentarian === true })
  }
  return out
}

// ── the pure rules ───────────────────────────────────────────────────────────

// ⚠ RESTATED FROM v2.ts, deliberately identical (STOP list, token rule, jaccard). v2 does not export
// them and this module was not cleared to edit v2.ts; exporting them from v2 and importing here is the
// better shape and is flagged for the owner. Same threshold as v2's merge: 0.6.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'be', 'that', 'this', 'it', 'as', 'by', 'with', 'from', 'at', 'was', 'were', 'will', 'would', 'should', 'could', 'has', 'have', 'had', 'not', 'no', 'they', 'their', 'them', 'we', 'our', 'you', 'your'])
const toks = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let i = 0
  for (const t of a) if (b.has(t)) i++
  return i / (a.size + b.size - i)
}
export const MERGE_THRESHOLD = 0.6

/**
 * The named-person rule (Amendment 1): a point about a named person with no source URL is DROPPED and
 * logged. "About a named person" = it names someone (`people`) or its kind is 'person'. Pure.
 */
export function applyNamedPersonRule(provider: Stage3Provider, points: RawPoint[]): { kept: RawPoint[]; dropped: Stage3Dropped[] } {
  const kept: RawPoint[] = []
  const dropped: Stage3Dropped[] = []
  for (const p of points) {
    const aboutPerson = p.people.length > 0 || p.kind === 'person'
    if (aboutPerson && !p.sources.some((s) => s.url)) dropped.push({ what: p.point.slice(0, 300), reason: 'named-person-unsourced', provider })
    else kept.push(p)
  }
  return { kept, dropped }
}

/**
 * Merge restatements across providers. Same side AND jaccard ≥ MERGE_THRESHOLD → one point, providers,
 * sources and people unioned. A recommendation only merges with a recommendation, so a model's
 * suggestion can never be folded into (and lend its providers to) a point carrying evidence. Pure.
 */
export function mergePoints(perProvider: Array<{ provider: Stage3Provider; points: RawPoint[] }>): { points: Stage3Point[]; merged: number; parliamentarianNames: Set<string> } {
  const kept: Array<{ p: Stage3Point; t: Set<string> }> = []
  const parliamentarianNames = new Set<string>()
  let merged = 0
  for (const { provider, points } of perProvider) {
    for (const r of points) {
      if (r.parliamentarian) for (const n of r.people) parliamentarianNames.add(n)
      const t = toks(r.point)
      const isRec = r.kind === 'recommendation'
      const m = kept.find((k) => k.p.side === r.side && (k.p.kind === 'recommendation') === isRec && jaccard(k.t, t) >= MERGE_THRESHOLD)
      if (m) {
        merged++
        if (!m.p.providers.includes(provider)) m.p.providers.push(provider)
        for (const s of r.sources) if (!m.p.sources.some((x) => x.url === s.url)) m.p.sources.push(s)
        for (const n of r.people) if (!m.p.people.includes(n)) m.p.people.push(n)
        continue
      }
      kept.push({
        t,
        p: {
          point: r.point, side: r.side, kind: r.kind, sources: [...r.sources], providers: [provider], people: [...r.people],
          ...(isRec ? { suggestionNotEvidence: true as const } : {}),
        },
      })
    }
  }
  return { points: kept.map((k) => k.p), merged, parliamentarianNames }
}

/** A name that reads as an MP or peer even when the model did not flag it. Pure. */
export function looksParliamentary(name: string): boolean {
  return /\bMP\b/.test(name) || /^(the\s+)?(Lord|Baroness|Baron|Lady|Viscount|Viscountess|Earl|Countess|Marquess|Duke)\b/i.test(name.trim())
}

/**
 * The MP/peer cross-check. For every named person on a point who looks parliamentary (flagged by the
 * model or by `looksParliamentary`), look them up and STORE what came back. 'many' keeps every
 * candidate un-chosen (tier/parlMemberId null); a failed lookup is 'lookup-failed', never 'none'.
 */
export async function crossCheckPeople(
  points: Stage3Point[], flagged: Set<string>,
  lookup: (name: string, opts: { kind?: 'person' | 'organisation' }) => Promise<NameLookupResult>,
): Promise<void> {
  const cache = new Map<string, PersonCheck>()
  for (const p of points) {
    const checks: PersonCheck[] = []
    for (const name of p.people) {
      if (!flagged.has(name) && !looksParliamentary(name)) continue
      let c = cache.get(name)
      if (!c) {
        try {
          const r = await lookup(name, { kind: 'person' })
          const one = r.status === 'one' ? r.candidates[0] : null
          c = { name, status: r.status, tier: one?.identityTier ?? null, parlMemberId: one?.parlMemberId ?? null, candidates: r.candidates.length }
        } catch (err) {
          c = { name, status: 'lookup-failed', tier: null, parlMemberId: null, candidates: 0, reason: err instanceof Error ? err.message.slice(0, 200) : String(err) }
        }
        cache.set(name, c)
      }
      checks.push(c)
    }
    if (checks.length) p.peopleCheck = checks
  }
}

/** The cap decision, before a round. Pure. */
export function capReachedBefore(spentUsd: number, budgetUsd: number): boolean {
  return spentUsd >= budgetUsd
}

/** The exact partial wording the brief asks for. Pure. */
export function partialText(ran: number, asked: number): string {
  return `partial: ${ran} of ${asked} providers`
}

// ── the cap-breach alert ─────────────────────────────────────────────────────

export interface CapIncident { buildId: string | null; ideaId: string | null; userId: string | null; budgetUsd: number; spentUsd: number; partialText: string }

const alerted = new Set<string>()

/**
 * ⚠⚠ TODO(stage3-cap-email) — NOT AN EMAIL YET, AND WHY. Correction 3 says the cap-breach email reuses
 * S25's alert path and its one-email-per-incident rule, with no new notification helper. That path does
 * not exist in a form this module can reach:
 *   · S25's open/resolve/one-email-per-incident logic lives in `scripts/ingest/search/serve-observer.ts`
 *     — the ingest package, which the web app must not import (CLAUDE.md §20 check 0).
 *   · The web app's spend email, `sendCostAlertEmail` (lib/email.ts), is worded for a MONTHLY platform
 *     threshold ("platform spend has passed $X this month"), and its dedupe table `CostAlertSent` is keyed
 *     on (month, thresholdUsd) — it cannot hold "one per build" without a schema change.
 * Reusing either as-is would send a misleading email or dedupe the wrong incident. What is needed: a
 * `sendBuildCapEmail` beside `sendCostAlertEmail`, and a dedupe keyed on the build. Until then this
 * LOGS the incident (once per build per process) and reports `sent: false` with this reason, so a
 * caller can never mistake "not sent" for "sent".
 */
export async function alertCapBreach(incident: CapIncident): Promise<{ sent: boolean; reason: string }> {
  const key = incident.buildId ?? incident.ideaId ?? 'no-build'
  if (alerted.has(key)) return { sent: false, reason: 'already raised for this build in this process (one per incident)' }
  alerted.add(key)
  console.warn('[stage3] CAP REACHED — TODO(stage3-cap-email): no build-cap alert path exists to reuse; email NOT sent', incident)
  return { sent: false, reason: 'TODO(stage3-cap-email): no reusable build-cap email path (S25 one-per-incident logic is in the ingest package; sendCostAlertEmail/CostAlertSent are month-threshold)' }
}

// ── the provider branches ────────────────────────────────────────────────────

interface Branch { call: Stage3Call; points: RawPoint[] }

const MODEL: Record<Stage3Provider, () => string> = {
  google: () => process.env.STAGE3_GOOGLE_MODEL ?? 'gemini-2.5-flash',
  anthropic: () => process.env.STAGE3_ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
  openai: () => process.env.STAGE3_OPENAI_MODEL ?? 'gpt-6-luna',
  xai: () => process.env.STAGE3_XAI_MODEL ?? 'grok-4.3',
}

const fail = (provider: Stage3Provider, reason: Stage3FailReason, detail: string, ms = 0, costUsd = 0): Branch =>
  ({ call: { provider, ok: false, ms, costUsd, reason, detail, points: 0 }, points: [] })

async function webBranch(provider: 'google' | 'anthropic' | 'openai', o: Stage3Options, angle: string | null, deadline: number): Promise<Branch> {
  const t0 = Date.now()
  if (!process.env[KEY_ENV[provider]]?.trim()) return fail(provider, 'no-key', `${KEY_ENV[provider]} not set`)
  const search = await webSearch({
    query: stage3SearchQuery(o.problem, angle), provider, budgetMs: Math.min(45_000, Math.max(5000, deadline - Date.now())),
    stream: 'orientation', pass: 'orientation.stage3-search', label: `stage3:${provider}`,
    userId: o.userId ?? null, ideaId: o.ideaId ?? null,
  })
  const sources = search.ok ? search.results : []
  const { system, user } = buildWebPrompt(o.problem, o.summary, angle, sources)
  const model = MODEL[provider]()
  const res = await callModelJson<unknown>({
    model, system, user, schema: STAGE3_WEB_SCHEMA,
    maxOutputTokens: provider === 'openai' ? 16_000 : 8192,
    timeoutMs: Math.min(90_000, Math.max(5000, deadline - Date.now())),
    ...(provider === 'openai' ? { reasoningEffort: 'low' as const } : {}),
    label: `stage3:${provider}`, stream: 'orientation', pass: 'orientation.stage3-answer',
    ideaId: o.ideaId ?? null, userId: o.userId ?? null,
  })
  // Google records inside callModelJson (usage.recorded); Anthropic/OpenAI do not, so record here — once.
  // A call that never reached the vendor (no tokens either way) has nothing to record.
  let answerUsd = 0
  let unpriced = false
  if (res.usage.recorded) { answerUsd = res.usage.recorded.usd ?? 0; unpriced = res.usage.recorded.unpriced }
  else if (res.ok || res.usage.tokensIn + res.usage.tokensOut > 0) {
    const priced = await recordUsage(res.usage, {
      stream: 'orientation', pass: 'orientation.stage3-answer', ref: `stage3:${provider}`,
      userId: o.userId ?? null, ideaId: o.ideaId ?? null, buildId: o.buildId ?? null, failed: !res.ok,
    })
    answerUsd = priced.usd ?? 0; unpriced = priced.unpriced
  }
  const costUsd = search.costUsd + answerUsd
  const base = {
    provider, ms: Date.now() - t0, costUsd, ...(unpriced ? { unpriced } : {}),
    searchOk: search.ok, sources: sources.length, ...(search.ok ? {} : { searchReason: search.reason ?? 'search did not complete' }),
  }
  if (res.ok === false) return { call: { ...base, ok: false, reason: res.reason, detail: res.detail, points: 0 }, points: [] }
  const points = parseWebAnswer(res.value, sources)
  return { call: { ...base, ok: true, points: points.length }, points }
}

async function xBranch(o: Stage3Options, angle: string | null, deadline: number): Promise<Branch> {
  const t0 = Date.now()
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey?.trim()) return fail('xai', 'no-key', 'GROK_API_KEY not set')
  const { system, user } = buildXPrompt(o.problem, o.summary, angle, ORIENTATION_X_POST_CAP)
  const res = await callGrok({
    model: MODEL.xai(), apiKey, timeoutMs: Math.min(110_000, Math.max(5000, deadline - Date.now())),
    instructions: system, user, schema: STAGE3_X_SCHEMA, schemaName: 'stage3_check',
    logTag: 'stage3:x', pass: 'orientation.stage3-x', temperature: 0,
  })
  // callGrok returns null on HTTP error, empty message or unparseable JSON and does not say which
  // (its console line does). Recorded as exactly that — never as "X had nothing".
  if (!res) return fail('xai', 'no-answer', 'callGrok returned no result: HTTP error, empty message or unparseable JSON — it does not say which; see the [stage3:x] console line', Date.now() - t0)
  const points = parseXAnswer(res.parsed)
  return { call: { provider: 'xai', ok: true, ms: Date.now() - t0, costUsd: res.costUsd, postsFetched: res.postsFetched, points: points.length }, points }
}

// ── entry point ──────────────────────────────────────────────────────────────

/** Run stage 3. Never throws. See the header for every rule. */
export async function runStage3(opts: Stage3Options): Promise<Stage3Result> {
  const ambient = currentBuildContext()
  const ctx = {
    ...(ambient ?? {}),
    userId: opts.userId ?? ambient?.userId ?? null,
    ideaId: opts.ideaId ?? ambient?.ideaId ?? null,
    buildId: opts.buildId ?? ambient?.buildId ?? null,
    step: ambient?.step ?? 'stage3',
  }
  // Every ledger row the adapters write (some pass no ids of their own) is attributed to this build.
  return runWithSpendContext(ctx, () => runStage3Inner({ ...opts, userId: ctx.userId, ideaId: ctx.ideaId, buildId: ctx.buildId }))
}

async function runStage3Inner(opts: Stage3Options): Promise<Stage3Result> {
  const t0 = Date.now()
  const providers = [...new Set((opts.providers?.length ? opts.providers : STAGE3_PROVIDERS).filter((p) => STAGE3_PROVIDERS.includes(p)))]
  const budgetUsd = opts.budgetUsd ?? 2
  const spentBefore = opts.spentUsd ?? 0
  const angle = (opts.angle ?? '').trim() || null
  const budgetMs = opts.budgetMs ?? parseInt(process.env.STAGE3_TOTAL_BUDGET_MS ?? '150000', 10)
  const deadline = t0 + budgetMs
  const onCap = opts.onCapBreach ?? alertCapBreach

  const result = (over: Partial<Stage3Result>): Stage3Result => ({
    version: 1, ranAt: new Date().toISOString(), angle, points: [], dropped: [], merged: 0, pointsOnlyFromOneProvider: 0,
    calls: [], providersAsked: providers.length, providersRun: 0, partial: false, partialText: null,
    budgetUsd, spentBeforeUsd: spentBefore, capAlert: null, failed: false, totalCostUsd: 0, totalMs: Date.now() - t0, ...over,
  })

  // ── the cap, BEFORE the round ──
  if (capReachedBefore(spentBefore, budgetUsd)) {
    const text = partialText(0, providers.length)
    const alert = await onCap({ buildId: opts.buildId ?? null, ideaId: opts.ideaId ?? null, userId: opts.userId ?? null, budgetUsd, spentUsd: spentBefore, partialText: text })
    return result({
      partial: true, partialText: text, capAlert: { triggered: true, ...alert },
      calls: providers.map((p) => ({ provider: p, ok: false, ms: 0, costUsd: 0, reason: 'not-run-cap' as const, detail: `the build had spent $${spentBefore.toFixed(4)} of its $${budgetUsd.toFixed(2)} cap before stage 3`, points: 0 })),
    })
  }
  if (!opts.problem.trim()) {
    return result({ failed: true, calls: providers.map((p) => ({ provider: p, ok: false, ms: 0, costUsd: 0, reason: 'empty' as const, detail: 'no problem text was given', points: 0 })) })
  }

  const guarded = async (p: Stage3Provider, fn: () => Promise<Branch>): Promise<Branch> => {
    let timer: NodeJS.Timeout | undefined
    try {
      const guard = new Promise<'BUDGET'>((r) => { timer = setTimeout(() => r('BUDGET'), Math.max(0, deadline - Date.now())) })
      const out = await Promise.race([fn(), guard])
      // ⚠ an abandoned call may still complete and bill; its ledger row lands when it does, its cost is not in this total
      if (out === 'BUDGET') return fail(p, 'abandoned-budget', `abandoned at the ${budgetMs}ms stage budget — any spend it incurs is on the ledger, not in this total`, Date.now() - t0)
      return out
    } catch (err) {
      console.warn(`[stage3] ${p} threw:`, err instanceof Error ? err.message : err)
      return fail(p, 'threw', err instanceof Error ? err.message : String(err), Date.now() - t0)
    } finally { clearTimeout(timer) }
  }

  const branches = await Promise.all(providers.map((p) => guarded(p, () => (p === 'xai' ? xBranch(opts, angle, deadline) : webBranch(p, opts, angle, deadline)))))

  // ── drop, merge, cross-check ──
  const dropped: Stage3Dropped[] = []
  const perProvider = branches.map((b) => {
    const r = applyNamedPersonRule(b.call.provider, b.points)
    dropped.push(...r.dropped)
    return { provider: b.call.provider, points: r.kept }
  })
  const { points, merged, parliamentarianNames } = mergePoints(perProvider)
  await crossCheckPeople(points, parliamentarianNames, opts.lookup ?? lookupName)
  const kindRank = new Map(STAGE3_KINDS.map((k, i) => [k, i]))
  const sideRank = { for: 0, against: 1, nuanced: 2 } as const
  points.sort((a, b) => (kindRank.get(a.kind)! - kindRank.get(b.kind)!) || sideRank[a.side] - sideRank[b.side])

  const calls = branches.map((b) => b.call)
  const totalCostUsd = calls.reduce((s, c) => s + c.costUsd, 0)
  const ran = calls.filter((c) => c.ok).length

  // ── the cap, AFTER the round: kept, recorded, alerted ──
  let partial = false, pText: string | null = null, capAlert: Stage3Result['capAlert'] = null
  if (spentBefore + totalCostUsd >= budgetUsd) {
    partial = true
    pText = partialText(ran, providers.length)
    const alert = await onCap({ buildId: opts.buildId ?? null, ideaId: opts.ideaId ?? null, userId: opts.userId ?? null, budgetUsd, spentUsd: spentBefore + totalCostUsd, partialText: pText })
    capAlert = { triggered: true, ...alert }
  }

  const out = result({
    points, dropped, merged, pointsOnlyFromOneProvider: points.filter((p) => p.providers.length === 1).length,
    calls, providersRun: ran, partial, partialText: pText, capAlert,
    failed: ran === 0, totalCostUsd, totalMs: Date.now() - t0,
  })
  console.log('[stage3] complete', {
    ms: out.totalMs, costUsd: Number(totalCostUsd.toFixed(4)), points: points.length, merged, dropped: dropped.length,
    calls: calls.map((c) => `${c.provider}:${c.ok ? 'ok' : c.reason}`).join(' '), partial: pText,
  })
  return out
}
