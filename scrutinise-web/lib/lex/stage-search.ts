// ─────────────────────────────────────────────────────────────────────────────
// Stage-aware search (§19-C Task 2) + ad-hoc research (Task 1c).
//
// Each stage entry fires ONE deterministic gateway search built from what the user
// has actually accepted, and the references are stored per stage on
// `Idea.stageSearches`. The right-hand panel then renders the ACTIVE stage's results
// grouped into five sections, with earlier stages folded away — so a Guiding-Policy
// screen never shows the Orientation briefing as though it were current.
//
// STORAGE IS REFERENCES ONLY — id, citation, url, snippet, score. No corpus full
// text is copied into the ideas database (the existing `legislationRefs` rule).
//
// A search that FAILS is recorded as failed, never as "nothing found" and never
// substituted (§19-C Task 1a). The distinction is load-bearing: "the search didn't
// run" and "the law has nothing to say" are different sentences to a user building
// a case for Parliament.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { SearchResult, SearchResultType } from './page1-config'
import { runSearch, type SearchIntent } from './search-gateway'
import { stripNullBytes, countNullBytes } from './json-safe'

export interface StageSearchRecord {
  intent: SearchIntent
  ranAt: string
  /** The search COMPLETED. `ok:true` with zero results means "ran, found nothing". */
  ok: boolean
  failureReason?: string
  query: string[]
  results: SearchResult[]
}

export interface ResearchRecord {
  query: string
  ranAt: string
  ok: boolean
  failureReason?: string
  results: SearchResult[]
}

export interface StageSearches {
  version: 2
  byStage: Record<string, StageSearchRecord>
  research: ResearchRecord[]
}

const EMPTY: StageSearches = { version: 2, byStage: {}, research: [] }

export function readStageSearches(raw: unknown): StageSearches {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY, byStage: {}, research: [] }
  const o = raw as Partial<StageSearches>
  return {
    version: 2,
    byStage: (o.byStage && typeof o.byStage === 'object' ? o.byStage : {}) as Record<string, StageSearchRecord>,
    research: Array.isArray(o.research) ? o.research : [],
  }
}

async function loadStageSearches(ideaId: string): Promise<StageSearches> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { stageSearches: true } })
  return readStageSearches(idea?.stageSearches)
}

async function saveStageSearches(ideaId: string, next: StageSearches): Promise<void> {
  // ⚠ STRIP NUL BYTES BEFORE THE WRITE. A single U+0000 anywhere in a retrieved snippet
  // makes PostgreSQL reject the whole `jsonb` update with "unsupported Unicode escape
  // sequence" — so one bad character in one corpus extract loses every stage search for
  // the idea, and the error names nothing that would lead a reader back to the corpus.
  // Found by the 25-A framing harness on 2026-08-17; see lib/lex/json-safe.ts.
  const nulls = countNullBytes(next)
  if (nulls) {
    console.warn('[lex-diag] stripped NUL byte(s) from a stage search before storing', { ideaId, nulls })
  }
  await prisma.idea.update({ where: { id: ideaId }, data: { stageSearches: stripNullBytes(next) as never } })
}

// ── which intent belongs to which stage ──────────────────────────────────────
export const STAGE_INTENT: Record<string, SearchIntent | null> = {
  ORIENTATION: 'BACKGROUND_BRIEFING',
  DIAGNOSIS: 'LEGAL_LANDSCAPE',
  GUIDING_POLICY: 'POLICY_ALTERNATIVES',
  // The actions stage reuses the LEGAL_LANDSCAPE result set until an
  // amendable-section intent exists on the search side (brief §19-C Task 2).
  COHERENT_ACTIONS: null,
}

/** The stage whose results the panel should show while on `pageKey`. */
export function displayStageFor(pageKey: string): string {
  return STAGE_INTENT[pageKey] === null ? 'DIAGNOSIS' : pageKey
}

// ── query construction from ACCEPTED signals only ────────────────────────────
/**
 * Build the query terms for a stage. Deliberately grounded in accepted state, not in
 * whatever the user last typed: keywords are the spine, the challenge is the sharpest
 * signal once it exists (hence the refresh on challenge-accept), and the pivotal
 * obstacle steers the policy-alternatives search.
 */
async function buildStageQuery(ideaId: string, pageKey: string): Promise<string[]> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { keywords: true, challenge: true, ideaNarrative: true, pivotalObstacle: true, chosenApproach: true },
  })
  if (!idea) return []
  const words = (s: string | null | undefined, n: number) =>
    (s ?? '').split(/\s+/).filter(Boolean).slice(0, n)

  const base = (idea.keywords ?? []).slice(0, 8)
  if (pageKey === 'GUIDING_POLICY') {
    return [...new Set([...base, ...words(idea.pivotalObstacle, 12), ...words(idea.chosenApproach, 8)])].filter(Boolean)
  }
  // DIAGNOSIS (and anything reusing it): keywords + challenge (best signal) or narrative.
  const sharpener = idea.challenge ? words(idea.challenge, 16) : words(idea.ideaNarrative, 16)
  return [...new Set([...base, ...sharpener])].filter(Boolean)
}

// ── running a stage search ───────────────────────────────────────────────────
/**
 * Fire the stage's search and store the references. Never throws — a search problem
 * is recorded honestly and the flow continues.
 */
export async function runStageSearch(ideaId: string, pageKey: string): Promise<StageSearchRecord | null> {
  const intent = STAGE_INTENT[pageKey]
  if (!intent) return null

  const query = await buildStageQuery(ideaId, pageKey)
  if (!query.length) {
    // §19-D Task 4 — RECORD THE SKIP. This used to `return null` and store nothing,
    // and a stage with no stored record is indistinguishable, in the panel, from a
    // stage that never had a search: `briefingIsCurrent = !stageSearch` sent the user
    // back to the Orientation briefing as though it were this stage's research. Same
    // family as CLAUDE.md §18's corollary — a search that did not RUN and a search
    // that was never DUE must not look identical from outside.
    console.log('[lex-diag] stage search skipped — no query signals yet', { pageKey })
    const skipped: StageSearchRecord = {
      intent, ranAt: new Date().toISOString(), ok: false,
      failureReason: 'no query signals yet — nothing accepted for this stage to search on',
      query: [], results: [],
    }
    const store0 = await loadStageSearches(ideaId)
    store0.byStage[pageKey] = skipped
    await saveStageSearches(ideaId, store0)
    return skipped
  }

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId }, select: { ideaNarrative: true, challenge: true },
  })
  const context = [idea?.challenge, idea?.ideaNarrative].filter(Boolean).join(' ').slice(0, 500)

  let record: StageSearchRecord
  try {
    const out = await runSearch({ keywords: query, intent, ideaContext: context, limit: 16 })
    record = {
      intent, ranAt: new Date().toISOString(),
      ok: !out.failed, failureReason: out.failureReason,
      query, results: out.grouped,
    }
  } catch (err) {
    record = {
      intent, ranAt: new Date().toISOString(), ok: false,
      failureReason: err instanceof Error ? err.message : String(err),
      query, results: [],
    }
  }

  const store = await loadStageSearches(ideaId)
  store.byStage[pageKey] = record
  await saveStageSearches(ideaId, store)
  console.log('[lex-diag] stage search', {
    pageKey, intent, ok: record.ok, results: record.results.length, reason: record.failureReason ?? null,
  })
  return record
}

/**
 * Store a stage record for a search the CALLER already ran (Sprint 25-A §3).
 *
 * The build's pass 1 issues its own gateway query — the whole point of §3a is that the
 * query framing is the variable under test, so it cannot come from `buildStageQuery` —
 * but its results belong in the same store, or the right-hand panel would show nothing
 * for an idea whose entire landscape had just been retrieved.
 *
 * Additive: no existing caller's behaviour changes, and `runStageSearch` still owns the
 * ordinary path.
 */
export async function storeStageSearch(
  ideaId: string, pageKey: string, record: StageSearchRecord,
): Promise<void> {
  const store = await loadStageSearches(ideaId)
  store.byStage[pageKey] = record
  await saveStageSearches(ideaId, store)
}

/** Task 1c — a corpus search the user asked for in chat. Appended, never replacing. */
export async function runAdHocResearch(ideaId: string, query: string): Promise<ResearchRecord> {
  const terms = query.split(/\s+/).filter(Boolean).slice(0, 24)
  let record: ResearchRecord
  try {
    const out = await runSearch({ keywords: terms, intent: 'AD_HOC_RESEARCH', ideaContext: query.slice(0, 300), limit: 12 })
    record = {
      query, ranAt: new Date().toISOString(),
      ok: !out.failed, failureReason: out.failureReason, results: out.grouped,
    }
  } catch (err) {
    record = {
      query, ranAt: new Date().toISOString(), ok: false,
      failureReason: err instanceof Error ? err.message : String(err), results: [],
    }
  }
  const store = await loadStageSearches(ideaId)
  store.research = [...store.research, record].slice(-6) // keep the last handful
  await saveStageSearches(ideaId, store)
  console.log('[lex-diag] ad-hoc research', { query: query.slice(0, 60), ok: record.ok, results: record.results.length })
  return record
}

// ── the five display groups (§19-C Task 2) ───────────────────────────────────
export type LandscapeGroupKey = 'legislation' | 'principles' | 'debates' | 'committees' | 'other'

export interface LandscapeGroup {
  key: LandscapeGroupKey
  label: string
  results: SearchResult[]
}

const LEGISLATION_TYPES: SearchResultType[] = ['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION']

/**
 * Shape a stage's results into the five sections the panel renders.
 *
 * NOTE on "principles appearing in other legislation": there is no principle
 * classifier in the corpus yet (the search workstream's G–I streams are the eventual
 * home). Until there is, this is an honest DISPLAY split of the same ranked set — the
 * strongest legislation hits lead, the remainder are offered as comparable provisions
 * to look across. It is labelled so the user knows what they are looking at, and it
 * never claims a relationship the data hasn't established.
 */
export function groupLandscape(results: SearchResult[]): LandscapeGroup[] {
  const legislation = results.filter((r) => LEGISLATION_TYPES.includes(r.type))
  const debates = results.filter((r) => r.type === 'DEBATE')
  const committees = results.filter((r) => r.type === 'COMMITTEE')
  const other = results.filter(
    (r) => !LEGISLATION_TYPES.includes(r.type) && r.type !== 'DEBATE' && r.type !== 'COMMITTEE',
  )
  const PRIMARY_CAP = 5
  const groups: LandscapeGroup[] = [
    { key: 'legislation', label: 'Possibly relevant legislation', results: legislation.slice(0, PRIMARY_CAP) },
    { key: 'principles', label: 'Comparable provisions elsewhere', results: legislation.slice(PRIMARY_CAP, PRIMARY_CAP + 4) },
    { key: 'debates', label: 'Relevant debates', results: debates.slice(0, 4) },
    { key: 'committees', label: 'Committee hearings and reports', results: committees.slice(0, 4) },
    { key: 'other', label: 'Anything else relevant', results: other.slice(0, 5) },
  ]
  return groups.filter((g) => g.results.length > 0)
}
