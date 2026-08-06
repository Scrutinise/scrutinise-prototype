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
import { runRoutedSearch, perStreamVectorActive } from './query-router'
import { fuseWeightedRrf } from './fusion'

// ── Query intent (§14.2) — owned HERE, aligned to the search side's stream taxonomy.
// Add an intent when a new Lex moment needs retrieval; tell the search side so they
// can add/route the stream.
export type SearchIntent =
  | 'BACKGROUND_BRIEFING' // Page 1 keywords-accept; the broad landscape search. Gets stage-3 expansion first.
  | 'CAUSE_SEEDING'       // Page 2; past debates/committee reports where the problem was examined.
  | 'LEGAL_LANDSCAPE'     // §19-C Task 2 — DIAGNOSIS entry: what law governs this and where it falls short.
  | 'POLICY_ALTERNATIVES' // §19-C Task 2 — GUIDING_POLICY entry: how others have approached this.
  | 'AD_HOC_RESEARCH'     // §19-C Task 1c — the user asked, in chat, for a corpus search.
  // ── The three legacy surfaces, repointed through the gateway (SPRINT §1). Before
  //    this they called `searchLegislation()` / raw SQL directly and never reached
  //    the fast index at all — see lib/lex/gateway-legacy.ts for what each one is.
  | 'IDEA_CHAT_GROUNDING' // app/api/ai/[ideaId] — legislation context for the Lex turn.
  | 'LEGISLATION_PANEL'   // /api/ideas/[id]/legislation-search — the CreateIdea side panel.
  | 'LEGISLATION_SEARCH'  // POST /api/search — the general search endpoint.
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
  /** Restrict retrieval to ONE corpus tier (`fts-query-service.ts`'s existing filter).
   *
   *  Only for callers whose contract is inherently single-tier — the three legacy
   *  legislation surfaces (§1), which rendered nothing but Acts/SIs before they were
   *  repointed and whose response shapes have no place to put a Hansard hit. A caller
   *  that merely *prefers* legislation must NOT set this: it turns off a stream the
   *  gold set says helps.
   *
   *  Setting it does NOT switch the router off. The router does two things — it picks
   *  the streams AND it rewrites the query for each one — and only the first is
   *  redundant here. The rewrite is what turns "what is the law on data protection
   *  currently?" into terms worth matching, so a tier-scoped call still routes, then
   *  keeps just this tier's tailored query and discards the stream selection. */
  tier?: string
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
  if (flags.router && q.tier) {
    // Tier-scoped + router ON: route for the QUERY REWRITE, not the stream choice.
    // If the router judged this tier irrelevant (no tailored query for it) we search
    // it anyway with the bare keywords — the caller's contract fixes the tier, so
    // "the router didn't pick legislation" cannot be allowed to mean "return
    // nothing". Same fail-open rule as the untiered path below.
    const route = await routeQuery(keywords, q.ideaContext ?? '')
    const tailored = route?.[q.tier as keyof typeof route]
    const streamQuery = tailored && tailored.trim() ? tailored.trim().split(/\s+/) : keywords
    if (tailored) {
      routedStreams = [q.tier]
      expansionAdded = streamQuery.filter((k) => !keywords.includes(k))
      console.log('[search-gateway] router rewrote tier query', { intent: q.intent, tier: q.tier, from: keywords, to: streamQuery })
    } else {
      // Two very different causes, same fallback — so the log must separate them or
      // a dead router looks identical to a router that simply judged this tier
      // irrelevant. The first is an incident; the second is the design working.
      console.log('[search-gateway] no tailored query for tier — bare keywords', {
        intent: q.intent,
        tier: q.tier,
        cause: route === null ? 'router-unavailable' : 'tier-not-selected',
        streamsNamed: route ? Object.keys(route) : [],
      })
    }
    queryKeywords = streamQuery
    const out = await runFtsSearch(streamQuery, limit, q.tier)
    ftsResults = out.results
    failed = !!out.failed
    failureReason = out.reason
  } else if (flags.router) {
    const route = await routeQuery(keywords, q.ideaContext ?? '')
    const streamNames = route ? Object.keys(route) : []
    if (route && streamNames.length) {
      routedStreams = streamNames
      ftsResults = await runRoutedSearch(route, limit)
      console.log('[search-gateway] router dispatched', { intent: q.intent, streams: streamNames })
    } else {
      console.log('[search-gateway] router fail-open — searching all streams unfiltered', { intent: q.intent })
      const out = await runFtsSearch(keywords, limit, q.tier)
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
    const out = await runFtsSearch(queryKeywords, limit, q.tier)
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
  //     SUPERSEDED BY PER-STREAM FUSION (2026-08-06). When LEX_VECTOR_STREAMS names any
  //     stream, the fusion has already happened inside that stream's own retrieval
  //     (query-router.ts::fusedStream), scoped to its tier. Running this whole-query fusion
  //     as well would fuse an already-fused ranking against a second, UNSCOPED dense ranking
  //     — double-counting the dense signal and, worse, reintroducing exactly the cross-stream
  //     leakage the per-stream design exists to prevent. So the two are mutually exclusive,
  //     and the per-stream one wins.
  let results = ftsResults
  if (flags.vector && !perStreamVectorActive()) {
    const { results: vecResults } = await runVectorSearch(queryKeywords, limit)
    if (vecResults.length) {
      results = fuseWeightedRrf(vecResults, ftsResults)
      console.log('[search-gateway] vector fusion (whole-query, legacy path)', { intent: q.intent, fts: ftsResults.length, vector: vecResults.length, fused: results.length })
    }
  } else if (flags.vector) {
    console.log('[search-gateway] whole-query fusion stood down — per-stream vector is active', {
      intent: q.intent, streams: process.env.LEX_VECTOR_STREAMS,
    })
  }

  // 5. Group by display type — ≤3/type, ~20 cap. Kept INSIDE the gateway so that
  //    when the taxonomy lands as a shared corpus-type-map, only the gateway changes.
  const grouped = groupForPanel(results)

  console.log('[search-gateway] result', { intent: q.intent, results: results.length, failed, reason: failureReason ?? null })
  return { intent: q.intent, results, grouped, failed, failureReason, meta: { flags, expansionAdded, routedStreams } }
}

// ── fusion moved to ./fusion.ts (2026-08-06) ──────────────────────────────────
// It now has two callers — this legacy whole-query path and query-router.ts's per-stream
// path — and a ranking formula kept in two places is a ranking formula that will eventually
// differ in one of them. The weight's provenance is documented there: it is 0.5 as of
// 2026-08-06, measured across all five streams against the current index
// (docs/GOLD_TEST_08_fusion_weight_decision.md), replacing the pilot-tuned 0.7.
