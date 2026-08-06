// ─────────────────────────────────────────────────────────────────────────────
// Web + X orientation — shared types (SEARCH_STRATEGY §6d).
//
// This layer produces BACKGROUND, never law. The tier on every item is what the
// renderer and the quarantine check key off, so it is carried on the item itself
// rather than inferred from which call produced it (§6d.4):
//
//   Tier A — corpus.       The only permissible source of legal claims. Not here.
//   Tier B — web.          News, government, academia, comparative practice. Dated, cited.
//   Tier C — X/social.     What is CIRCULATING. Attributed, dated, visually distinct,
//                          never a fact source and never "public opinion" (§6d.3).
//
// Nothing in this file may be used to state a fact. `quarantine.ts` enforces that
// on the rendered output; these types exist so the enforcement has something to
// key on.
// ─────────────────────────────────────────────────────────────────────────────

/** §6d.4 reliability tier. 'A' (corpus) never originates here — it is listed so
 *  the union matches the strategy document and a future corpus-sourced item has
 *  somewhere to go. */
export type Tier = 'A' | 'B' | 'C'

/** A dated, attributed source. `date` is REQUIRED — §6d.1 drops undated items. */
export interface OrientationSource {
  /** Publisher/domain (Tier B) or handle (Tier C). */
  label: string
  url: string
  /** ISO yyyy-mm-dd. Undated items never get this far. */
  date: string
  tier: Tier
}

/** One dated development, controversy or political risk. */
export interface RecencyItem {
  headline: string
  detail: string
  date: string
  tier: Tier
  source: OrientationSource
}

/** Who is talking about this and from what position (§6d.1 `who_is_talking`). */
export interface VoiceItem {
  who: string
  position: string
  date: string
  tier: Tier
  source: OrientationSource
}

/**
 * §6d.1 call 1 — the RECENCY SCAN, bounded to the recency window.
 * Feeds ONLY "Known issues & current context" and "Political risks" (§7.1).
 */
export interface RecencyScan {
  recentDevelopments: RecencyItem[]
  liveControversies: RecencyItem[]
  politicalRisks: RecencyItem[]
  whoIsTalking: VoiceItem[]
  /** 0–3. How live this is right now. 0 = nothing circulating. */
  salience: 0 | 1 | 2 | 3
  sources: OrientationSource[]
}

export const EMPTY_RECENCY: RecencyScan = {
  recentDevelopments: [], liveControversies: [], politicalRisks: [],
  whoIsTalking: [], salience: 0, sources: [],
}

/**
 * §6d.1 call 2 — ARGUMENT MINING, deliberately NOT time-bounded.
 * `repetitions` is how many near-identical statements collapsed into this one
 * exemplar. It raises SALIENCE and never strength (§6d.1) — the renderer must
 * never sort or weight by it, and it is displayed as a count, not a score.
 */
export interface ArgumentItem {
  claim: string
  /** The reason or evidence offered. An argument with no reason is noise (§6d.2). */
  reason: string
  stance: 'for' | 'against' | 'nuanced'
  date: string
  tier: Tier
  source: OrientationSource
  repetitions: number
}

/** How each source behaved on this run — reported honestly, never inferred from
 *  an empty array. "Found nothing" and "did not run" are different facts. */
export interface CallOutcome {
  /** 'web-recency' | 'x-recency' | 'x-arguments' */
  call: string
  ok: boolean
  /** Why it did not complete. Present only when ok === false. */
  reason?: string
  ms: number
  /** Measured spend for this call in USD where the provider reports it. */
  costUsd?: number
  /** Items kept after the noise filter, and how many it discarded. */
  kept?: number
  discarded?: number
}

/** Comparative practice — what other jurisdictions did. Tier B only. */
export interface ComparativeItem {
  jurisdiction: string
  whatTheyDid: string
  outcome: string
  date: string
  tier: Tier
  source: OrientationSource
}

export interface OrientationResult {
  /** ISO timestamp of the run. */
  ranAt: string
  /** The recency window actually applied, in days. */
  recencyDays: number
  recency: RecencyScan
  comparative: ComparativeItem[]
  argumentsMined: ArgumentItem[]
  /** Per-call outcomes — the honest record of what ran (§19-C 1a discipline). */
  calls: CallOutcome[]
  /** TRUE when every configured call failed. An orientation that produced nothing
   *  because it did not run must never look like "nothing is circulating". */
  failed: boolean
  /** Whether the §6d.2 noise filter was applied on this run. */
  noiseFilter: boolean
  totalMs: number
  totalCostUsd: number
}

export function emptyOrientation(recencyDays: number): OrientationResult {
  return {
    ranAt: new Date().toISOString(),
    recencyDays,
    recency: EMPTY_RECENCY,
    comparative: [],
    argumentsMined: [],
    calls: [],
    failed: true,
    noiseFilter: false,
    totalMs: 0,
    totalCostUsd: 0,
  }
}

/** Narrow a model-written stance to the union, or null. Shared so both providers
 *  reject the same set of values rather than each inventing its own tolerance. */
export function toStance(v: unknown): ArgumentItem['stance'] | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return s === 'for' || s === 'against' || s === 'nuanced' ? s : null
}

/** Every item this layer can emit, in one shape, for the quarantine sweep. */
export function allItems(o: OrientationResult): { text: string; tier: Tier }[] {
  const out: { text: string; tier: Tier }[] = []
  const push = (text: string, tier: Tier) => { if (text && text.trim()) out.push({ text: text.trim(), tier }) }
  for (const r of [...o.recency.recentDevelopments, ...o.recency.liveControversies, ...o.recency.politicalRisks]) {
    push(r.headline, r.tier); push(r.detail, r.tier)
  }
  for (const v of o.recency.whoIsTalking) { push(v.position, v.tier) }
  for (const c of o.comparative) { push(c.whatTheyDid, c.tier); push(c.outcome, c.tier) }
  for (const a of o.argumentsMined) { push(a.claim, a.tier); push(a.reason, a.tier) }
  return out
}
