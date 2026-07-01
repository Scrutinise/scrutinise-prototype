// ─────────────────────────────────────────────────────────────────────────────
// The search gateway (design §14). The SINGLE point of contact with search.
//
// Every search caller — the Page 1 background briefing, Page 2 cause-seeding, and
// later amendable-section lookups — goes through runSearch(). It owns, in order:
//   1. Build the query from accepted context (keywords).
//   2. Stage-3 expansion         (capability flag) — enrich lay terms before retrieval.
//   3. Web orientation           (capability flag) — Gemini-grounded current-state pass.
//   4. Call the retrieval service (fts-search) with the query + intent.
//   5. Map results to canonical SearchResult[] (done by the adapter) and group by
//      display type (consumed from corpus-type-map via groupForPanel).
//
// Single seam — when search grows (vectors, reranker, graph), only this file changes.
// Panels, conductor, and briefing synthesis are insulated.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from './page1-config'
import { runFtsSearch } from './fts-search'
import { groupForPanel } from './search-stub'
import { expandQuery } from './query-expansion'

// ── Query intent (§14.2) — owned HERE, aligned to the search side's stream taxonomy.
// Add an intent when a new Lex moment needs retrieval; tell the search side so they
// can add/route the stream.
export type SearchIntent =
  | 'BACKGROUND_BRIEFING' // Page 1 keywords-accept; the broad landscape search. Gets stage-3 expansion first.
  | 'CAUSE_SEEDING'       // Page 2; past debates/committee reports where the problem was examined.
  // Reserved, later: 'AMENDABLE_SECTION' | 'POLICY_ALTERNATIVES' | 'COMPARATIVE_LAW'

// ── Capability flags (§14.3). Each search capability is adopted behind a flag,
// switched on when the search side ships it AND the gold set rewards it. Default OFF.
export interface CapabilityFlags {
  expansion: boolean      // Stage-3 LLM query expansion (shipped; A/B on the gold set)
  webOrientation: boolean // Gemini-grounded current-state pass (not shipped)
  vector: boolean         // dense retrieval (not shipped)
  reranker: boolean       // cross-encoder rerank (not shipped)
  graph: boolean          // graph/effects layers (not shipped)
}

export function capabilityFlags(): CapabilityFlags {
  return {
    // Back-compat: the expansion switch is the existing LEX_QUERY_EXPANSION env.
    expansion: process.env.LEX_QUERY_EXPANSION === 'true',
    webOrientation: process.env.LEX_WEB_ORIENTATION === 'true',
    vector: process.env.LEX_SEARCH_VECTOR === 'true',
    reranker: process.env.LEX_SEARCH_RERANKER === 'true',
    graph: process.env.LEX_SEARCH_GRAPH === 'true',
  }
}

export interface GatewayQuery {
  /** Accepted context terms that build the query. */
  keywords: string[]
  /** Why we are searching — routes per-stream and shapes the caller's use of results. */
  intent: SearchIntent
  /** Extra idea context for query expansion ONLY. Never enters briefing/cited text
   *  (grounding guardrail §3): web/expansion steer retrieval; the corpus is cited. */
  ideaContext?: string
  /** Max canonical results before grouping. Grouping caps ~20 downstream. */
  limit?: number
}

export interface GatewayResult {
  intent: SearchIntent
  /** Canonical, ranked results (already mapped by the FTS adapter / corpus-type-map). */
  results: SearchResult[]
  /** Grouped by display type, ≤3 per type, ~20 cap — the panel-ready set. */
  grouped: SearchResult[]
  /** Observability: which flags fired + terms the expansion added (query-only). */
  meta: { flags: CapabilityFlags; expansionAdded: string[] }
}

/**
 * The one gateway. Build → expand → orient → retrieve → map+group.
 * Resilient by construction: the FTS adapter falls back to the stub on any failure,
 * so a caller always gets a well-shaped SearchResult[] and the flow never breaks.
 */
export async function runSearch(q: GatewayQuery): Promise<GatewayResult> {
  const flags = capabilityFlags()
  const keywords = q.keywords.map((k) => k.trim()).filter(Boolean)
  const limit = q.limit ?? 12

  if (!keywords.length) {
    return { intent: q.intent, results: [], grouped: [], meta: { flags, expansionAdded: [] } }
  }

  // 2. Stage-3 expansion (capability flag). expandQuery is itself a no-op unless
  //    LEX_QUERY_EXPANSION=true; we also gate here so the flag is the single switch.
  //    Feeds the FTS query ONLY — never the briefing text (grounding guardrail §3).
  let queryKeywords = keywords
  let expansionAdded: string[] = []
  if (flags.expansion) {
    const expansion = await expandQuery(keywords, q.ideaContext ?? '')
    const expanded = [
      ...new Set([...keywords, ...expansion.anchors, ...expansion.termsOfArt, ...expansion.rephrasings]),
    ]
    expansionAdded = expanded.filter((k) => !keywords.includes(k))
    queryKeywords = expanded
    if (expansionAdded.length) {
      console.log('[search-gateway] expansion terms added', {
        intent: q.intent,
        original: keywords,
        added: expansionAdded,
      })
    }
  }

  // 3. Web orientation (capability flag; OFF — the search side hasn't shipped it).
  //    Reserved: a Gemini-grounded current-state pass (SEARCH_STRATEGY §3b). Web
  //    steers and orients; the corpus is what gets cited as law.
  if (flags.webOrientation) {
    // Not wired until the search side ships it; flag exists so only this file changes.
  }

  // 4. Retrieval. The adapter overscans and drops corpus families with no display
  //    type; it also owns the canonical SearchResult[] mapping (§14.4 — the type
  //    taxonomy is owned by the search side via corpus-type-map, consumed here).
  const { results } = await runFtsSearch(queryKeywords, limit)

  // 5. Group by display type — ≤3/type, ~20 cap. Kept INSIDE the gateway so that
  //    when the taxonomy lands as a shared corpus-type-map, only the gateway changes.
  const grouped = groupForPanel(results)

  return { intent: q.intent, results, grouped, meta: { flags, expansionAdded } }
}
