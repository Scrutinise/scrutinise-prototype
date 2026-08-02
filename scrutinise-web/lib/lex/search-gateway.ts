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
import { runVectorSearch } from './vector-search'
import { groupForPanel } from './search-stub'
import { expandQuery, routeQuery } from './query-expansion'
import { runRoutedSearch } from './query-router'

// ── Query intent (§14.2) — owned HERE, aligned to the search side's stream taxonomy.
// Add an intent when a new Lex moment needs retrieval; tell the search side so they
// can add/route the stream.
export type SearchIntent =
  | 'BACKGROUND_BRIEFING' // Page 1 keywords-accept; the broad landscape search. Gets stage-3 expansion first.
  | 'CAUSE_SEEDING'       // Page 2; past debates/committee reports where the problem was examined.
  | 'LEGAL_LANDSCAPE'     // §19-C Task 2 — DIAGNOSIS entry: what law governs this and where it falls short.
  | 'POLICY_ALTERNATIVES' // §19-C Task 2 — GUIDING_POLICY entry: how others have approached this.
  | 'AD_HOC_RESEARCH'     // §19-C Task 1c — the user asked, in chat, for a corpus search.
  // Reserved, later: 'AMENDABLE_SECTION' | 'COMPARATIVE_LAW'

// ── Capability flags (§14.3). Each search capability is adopted behind a flag,
// switched on when the search side ships it AND the gold set rewards it. Default OFF.
export interface CapabilityFlags {
  expansion: boolean      // Stage-3 LLM query expansion (shipped; A/B on the gold set)
  router: boolean         // per-stream query routing (generalises expansion; A/B on the gold set)
  webOrientation: boolean // Gemini-grounded current-state pass (not shipped)
  vector: boolean         // dense retrieval (not shipped)
  reranker: boolean       // cross-encoder rerank (not shipped)
  graph: boolean          // graph/effects layers (not shipped)
}

export function capabilityFlags(): CapabilityFlags {
  return {
    // Back-compat: the expansion switch is the existing LEX_QUERY_EXPANSION env.
    expansion: process.env.LEX_QUERY_EXPANSION === 'true',
    router: process.env.LEX_QUERY_ROUTER === 'true',
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
  /** §19-C Task 1a — TRUE when the search could not be completed. Distinct from an
   *  empty result set (a search that ran and found nothing). Callers MUST distinguish
   *  the two in what they store and in what Lex is allowed to say. */
  failed: boolean
  failureReason?: string
  /** Observability: which flags fired + terms the expansion added (query-only). */
  meta: { flags: CapabilityFlags; expansionAdded: string[]; routedStreams?: string[] }
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
    return { intent: q.intent, results: [], grouped: [], failed: false, meta: { flags, expansionAdded: [] } }
  }

  // 2. Query routing (capability flag) generalises Stage-3 expansion into
  //    per-stream retrieval: ONE LLM call decides which stream(s) the query
  //    belongs to and writes a tailored search string for each, then dispatch
  //    is pure deterministic code (query-router.ts). Router ON supersedes
  //    expansion for this call — it is the next generation of the same
  //    enrichment step, not an additional one, so the two are never combined.
  //    FAIL-OPEN (brief-mandated): if routeQuery returns null (disabled,
  //    missing key, HTTP failure, timeout, unparseable JSON) OR a parsed-but-
  //    empty decision (the LLM named zero streams — indistinguishable from a
  //    failure for our purposes), degrade to searching ALL streams unfiltered
  //    with the bare query — i.e. today's current (both-flags-off) behaviour.
  //    A router failure must never mean an empty result.
  let ftsResults: SearchResult[]
  let failed = false
  let failureReason: string | undefined
  let expansionAdded: string[] = []
  let routedStreams: string[] | undefined
  // Used only by the vector-fusion step below (4b), which routing doesn't touch
  // (out of this brief's scope) — defaults to the bare keywords when routed.
  let queryKeywords = keywords
  if (flags.router) {
    const route = await routeQuery(keywords, q.ideaContext ?? '')
    const streamNames = route ? Object.keys(route) : []
    if (route && streamNames.length) {
      routedStreams = streamNames
      ftsResults = await runRoutedSearch(route, limit)
      console.log('[search-gateway] router dispatched', { intent: q.intent, streams: streamNames })
    } else {
      console.log('[search-gateway] router fail-open — searching all streams unfiltered', { intent: q.intent })
      const out = await runFtsSearch(keywords, limit)
      ftsResults = out.results
      failed = !!out.failed
      failureReason = out.reason
    }
  } else {
    // 2b. Stage-3 expansion (capability flag). expandQuery is itself a no-op
    //     unless LEX_QUERY_EXPANSION=true; we also gate here so the flag is the
    //     single switch. Feeds the FTS query ONLY — never the briefing text
    //     (grounding guardrail §3).
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
    const out = await runFtsSearch(queryKeywords, limit)
    ftsResults = out.results
    failed = !!out.failed
    failureReason = out.reason
  }

  // 4b. Dense retrieval (capability flag; OFF by default — LEX_SEARCH_VECTOR).
  //     The full-corpus gemini-embedding-001 @768-d layer (docs/VECTOR_EMBED_REPORT.md).
  //     When ON, fuse BM25 with the vector ranking via the TUNED weighted RRF (70/30,
  //     docs/FUSION_REPORT.md) — NOT naive equal-weight RRF (the pilot showed that drags
  //     a strong vector model down). Flag stays OFF regardless until 70/30 is re-confirmed
  //     on the full-corpus ANN index + the gold key is validated (turning it on before
  //     that risks a regression). runVectorSearch also returns [] unless VECTOR_SEARCH_URL
  //     is set, so this is doubly inert.
  let results = ftsResults
  if (flags.vector) {
    const { results: vecResults } = await runVectorSearch(queryKeywords, limit)
    if (vecResults.length) {
      results = fuseWeightedRrf(vecResults, ftsResults)
      console.log('[search-gateway] vector fusion', { intent: q.intent, fts: ftsResults.length, vector: vecResults.length, fused: results.length })
    }
  }

  // 5. Group by display type — ≤3/type, ~20 cap. Kept INSIDE the gateway so that
  //    when the taxonomy lands as a shared corpus-type-map, only the gateway changes.
  const grouped = groupForPanel(results)

  console.log('[search-gateway] result', { intent: q.intent, results: results.length, failed, reason: failureReason ?? null })
  return { intent: q.intent, results, grouped, failed, failureReason, meta: { flags, expansionAdded, routedStreams } }
}

// ── fusion (§14, vector layer) — the SHIPPED spec from docs/FUSION_REPORT.md ──
// Weighted reciprocal-rank fusion: score = w/(k+rank_vec) + (1−w)/(k+rank_bm25), with
// w=0.7 (RRF_K=60). Tuned on the pilot subset: 70/30 beats naive equal-weight RRF
// (+3.5pp), vector-alone (+1.9pp) and BM25 (+19.5pp) for gemini, and — critically — is
// the coexistence point where the vector concept-win survives AND the BM25 citation
// resolver still pins exact citations (A stays 100%). NOT equal-weight (which the pilot
// showed drags a strong vector model down). Weight is env config so the full-corpus
// re-measure can adjust without a deploy. The flag stays OFF until 70/30 is re-confirmed
// on the full-corpus ANN index (see docs/VECTOR_EMBED_REPORT.md §4).
const RRF_K = parseInt(process.env.LEX_FUSION_RRF_K ?? '60', 10)
const VECTOR_WEIGHT = parseFloat(process.env.LEX_FUSION_VECTOR_WEIGHT ?? '0.7')

function fuseWeightedRrf(vec: SearchResult[], bm25: SearchResult[]): SearchResult[] {
  const w = VECTOR_WEIGHT
  const scores = new Map<string, number>()
  const byId = new Map<string, SearchResult>()
  vec.forEach((r, i) => { scores.set(r.id, (scores.get(r.id) ?? 0) + w / (RRF_K + i + 1)); if (!byId.has(r.id)) byId.set(r.id, r) })
  bm25.forEach((r, i) => { scores.set(r.id, (scores.get(r.id) ?? 0) + (1 - w) / (RRF_K + i + 1)); if (!byId.has(r.id)) byId.set(r.id, r) })
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...byId.get(id)!, score }))
}
