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
import { flagEnabled } from '@/lib/env-flags'
import { runFtsSearch } from './fts-search'
import { runVectorSearch } from './vector-search'
import { groupForPanel } from './search-stub'
import { expandQuery, routeQuery, routerEnabled } from './query-expansion'
import { runRoutedSearch, perStreamVectorActive, STREAMS } from './query-router'
import { fuseWeightedRrf } from './fusion'
// SURFACE 1: the gateway is 'the SINGLE point of contact with search', so it is where repeal
// status is attached. Every consumer of a SearchResult then gets it without knowing it exists —
// the briefing, the Deepening, the build passes, the panels — and no caller can forget.
import { lookupRepeals, annotate, isHollowRepeal } from './repeal-status'
// S9 §4 — the statistics catalogue. Values never enter this file; only descriptors.
import { searchCatalogue, statsUseContext, type CatalogueSearchOutcome } from './stats-catalogue'

// ── Query intent (§14.2) — owned HERE, aligned to the search side's stream taxonomy.
// Add an intent when a new Lex moment needs retrieval; tell the search side so they
// can add/route the stream.
export type SearchIntent =
  | 'BACKGROUND_BRIEFING' // Page 1 keywords-accept; the broad landscape search. Gets stage-3 expansion first.
  | 'CAUSE_SEEDING'       // Page 2; past debates/committee reports where the problem was examined.
  | 'LEGAL_LANDSCAPE'     // §19-C Task 2 — DIAGNOSIS entry: what law governs this and where it falls short.
  | 'POLICY_ALTERNATIVES' // §19-C Task 2 — GUIDING_POLICY entry: how others have approached this.
  | 'AD_HOC_RESEARCH'     // §19-C Task 1c — the user asked, in chat, for a corpus search.
  | 'GENERAL_CORPUS_CHAT' // /admin/lex-general — an admin asking the whole corpus a question,
                          // outside any idea. Untiered by construction, so it exercises the
                          // ROUTED path (the tier-scoped branch bypasses fusedStream entirely).
                          // Intent is descriptive here — the gateway logs it and callers key off
                          // it; it does not select streams, so adding one changes no retrieval.
  // ── The three legacy surfaces, repointed through the gateway (SPRINT §1). Before
  //    this they called `searchLegislation()` / raw SQL directly and never reached
  //    the fast index at all — see lib/lex/gateway-legacy.ts for what each one is.
  | 'IDEA_CHAT_GROUNDING' // app/api/ai/[ideaId] — legislation context for the Lex turn.
  | 'LEGISLATION_PANEL'   // /api/ideas/[id]/legislation-search — the CreateIdea side panel.
  | 'LEGISLATION_SEARCH'  // POST /api/search — the general search endpoint.
  // ── The Deepening (§22 Pilot A, BRIEF_DEEPENING_RESTART §2.3). DESCRIPTIVE, like
  //    GENERAL_CORPUS_CHAT: these route like any other query and select no streams, so
  //    adding them changes no retrieval for anyone. They exist so a Deepening gather can
  //    be told apart from a stage entry in the logs and in what a pass records it searched.
  | 'PRECEDENT'         // has this been tried — what was it FOR (explanatory notes), what was
                        // PREDICTED (impact assessments), what actually HAPPENED (PIRs).
  | 'CAUSAL_EVIDENCE'   // is the problem real and measured — and does the evidence SUPPORT or
                        // CONTRADICT the diagnosis. Silence becomes a known unknown.
  | 'DEVOLUTION_SCOPE'  // is the subject reserved or devolved, and what follows for the vehicle.
  // Reserved, later: 'AMENDABLE_SECTION' | 'COMPARATIVE_LAW' | 'MECHANISM_ANALOGUE'
  // ⚠ MECHANISM_ANALOGUE stays reserved deliberately — the brief keeps mechanism analogues
  // and the full claims-check OUT of Pilot A. Naming it here is not scheduling it.

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

// Every read goes through flagEnabled (lib/env-flags.ts), never a bare `=== 'true'`.
// A capitalised `TRUE` in Vercel silently disabled the router and expansion for an unknown
// period — see env-flags.ts for the incident. scripts/check-flags.ts enforces this.
export function capabilityFlags(): CapabilityFlags {
  return {
    // Back-compat: the expansion switch is the existing LEX_QUERY_EXPANSION env.
    expansion: flagEnabled('LEX_QUERY_EXPANSION'),
    router: flagEnabled('LEX_QUERY_ROUTER'),
    webOrientation: flagEnabled('LEX_WEB_ORIENTATION'),
    vector: flagEnabled('LEX_SEARCH_VECTOR'),
    reranker: flagEnabled('LEX_SEARCH_RERANKER'),
    graph: flagEnabled('LEX_SEARCH_GRAPH'),
  }
}

/**
 * S9 §4 — retrieve the statistics catalogue for a routed query, or nothing.
 *
 * Returns `undefined` in the two cases that mean "not consulted" — the flag is off, or the
 * router did not select the stream — and an outcome object in every case where it WAS
 * consulted, including when it found nothing. Those are different statements and
 * `SEARCH_CONTRACT.md` §6 requires Lex to be able to tell them apart.
 *
 * ⚠ NEVER THROWS. A statistics store that is unconfigured, unreachable or slow must not break
 * a Lex turn; `searchCatalogue` already degrades to `unavailable: true`, and this catches
 * anything left so that a stats fault can never take out a legislation answer.
 */
async function retrieveStatistics(
  streamQuery: string | undefined,
  intent: SearchIntent,
): Promise<CatalogueSearchOutcome | undefined> {
  if (!flagEnabled('LEX_STATS_STREAM')) return undefined
  if (!streamQuery || !streamQuery.trim()) return undefined
  const t0 = Date.now()
  try {
    const useContext = statsUseContext()
    const out = await searchCatalogue(streamQuery, { limit: 8, useContext })
    console.log('[search-gateway] statistics catalogue', {
      intent, query: streamQuery, useContext,
      series: out.results.length, searchedOver: out.searchedOver,
      // ⚠ ALWAYS LOGGED, even at zero. A licence gate whose effect is invisible is a licence
      // gate nobody can tell is running — §3.3's own failure class.
      licenceWithheld: out.licenceWithheld,
      unavailable: out.unavailable, ms: Date.now() - t0,
    })
    return out
  } catch (err) {
    console.error('[search-gateway] statistics catalogue threw — reporting UNAVAILABLE rather than empty, ' +
      'so Lex cannot say "no such series exists" when it did not look:', err)
    return { results: [], unavailable: true, licenceWithheld: 0, searchedOver: 0 }
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
  /**
   * ⚠⚠ A PER-STREAM BUDGET, NOT A TOTAL — and this comment used to say the opposite.
   *
   * It read *"Max canonical results before grouping"*. It is not, and has never been: `limit` is
   * handed to EVERY routed stream, each stream over-fetches ×3 for fusion, and `results` is the
   * interleaved sum. Measured on the live stack with five streams routed
   * (`docs/FINDING_FOR_SEARCH_gateway-limit-fanout.md`, CC-Lex, 2026-08-20):
   *
   *     limit: 10  →  results 150   (30 per stream × 5)
   *     limit: 34  →  results 500   (100 per stream × 5, the ×3 over-fetch capped at 100)
   *
   * i.e. `min(3 × limit, 100) × streams`. A caller asking for ten receives a hundred and fifty.
   *
   * ⚠ `grouped` is 20 in both cases, which is why this stayed invisible for six weeks: every
   * caller that reads `grouped` is capped downstream and looks correct, so the cost showed up only
   * as latency and tokens nobody attributed to it. It surfaced when the Deepening's sift — which
   * reads `results` unfiltered AND pays a per-candidate model cost — hit its output ceiling.
   *
   * ▶ THE BEHAVIOUR IS DELIBERATELY UNCHANGED IN S11. Making `limit` a total would move recall on
   * every surface on the platform, and the validated set still has no debates or legislation
   * questions to measure that with (S10 §7 Q5). What S11 does instead is make it VISIBLE:
   * `meta.requested` now reports the asked-for limit beside `results.length` and the per-stream
   * fan-out, so no caller has to discover this the way the last one did. The decision is recorded
   * as pending in `docs/SEARCH_CONTRACT.md` §2.
   *
   * Callers that need a bounded set should take a PREFIX of `results` — it is interleaved
   * round-robin (interleave.ts), so any prefix is stream-balanced — or read `grouped`.
   */
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
  /**
   * ⚠⚠ S9 §4 — THE STATISTICS CATALOGUE, ON ITS OWN CHANNEL AND NOT IN `results`.
   *
   * Present only when `LEX_STATS_STREAM` is on AND the router selected `statistics`.
   * `undefined` means the stream was not consulted; `results: []` inside it means it WAS
   * consulted and no series matched — the failed-vs-empty distinction, one level down.
   *
   * THE SEPARATION IS STRUCTURAL, NOT COSMETIC. A `SearchResult` is a document: something
   * Lex may quote as evidence of a fact. A `SeriesDescriptor` is evidence that a
   * MEASUREMENT EXISTS, and carries no value at all. Interleaving the two into one list is
   * exactly how a catalogue heading would end up cited as though it were a finding — the
   * same reasoning that keeps `LegacySearchResult` and `EvidenceResult` apart
   * (SEARCH_STRATEGY §10), applied one collection further out.
   *
   * ⚠ A caller that wants the NUMBER must take `seriesKey` and make the exact call
   * (`lib/stats/stats-query.ts::getSeriesByKey` → `getSeriesObservations`). Search
   * establishes that a series exists; it does not and must not tell you what it says.
   */
  statistics?: import('./stats-catalogue').CatalogueSearchOutcome
  /** Observability: which flags fired + terms the expansion added (query-only). */
  meta: {
    flags: CapabilityFlags
    expansionAdded: string[]
    routedStreams?: string[]
    /** Retrieved ids per stream, present only on the routed (untiered) path. `results` is the
     *  interleaved union of these, so a caller taking a prefix can say exactly which streams
     *  its context covers — which is what scripts/check-stream-coverage.ts asserts and what the
     *  lex-general debugging view reports. Without it, stream membership has to be re-derived
     *  from corpus names, i.e. guessed. */
    perStream?: Array<{ stream: string; ids: string[] }>
    /**
     * S11 §5.1 — WHAT WAS ASKED FOR, BESIDE WHAT ARRIVED. Present on every non-empty search.
     *
     * `limit` is a per-stream budget and `results` is the interleaved sum across streams, each
     * over-fetched ×3 for fusion (see `GatewayQuery.limit`). Nothing in the result set said so, so
     * a caller comparing "I asked for 10" with `results.length === 150` had no way to tell an
     * intended fan-out from a bug — and for six weeks nobody did. `perStream` already carried the
     * ids; this carries the ONE NUMBER that makes them interpretable.
     *
     * ⚠ REPORTING ONLY. It changes no retrieval and no ranking, deliberately (§5.1). The point is
     * that the next person meets this in a result object rather than in a truncated model call.
     */
    requested?: {
      /** The `limit` the caller passed, after the gateway's default is applied. */
      limit: number
      /** `results.length` — the interleaved sum actually returned. */
      returned: number
      /** How many streams were dispatched. 1 on the tier-scoped and unrouted paths. */
      streams: number
      /** `returned / limit`, rounded to one decimal — the fan-out, stated rather than derivable. */
      fanout: number
    }
  }
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
  let perStream: Array<{ stream: string; ids: string[] }> | undefined
  let statistics: CatalogueSearchOutcome | undefined
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

    // S3 §1. A tier-scoped caller used to end up here on `runFtsSearch` — BM25 ONLY.
    // Per-stream fusion lives inside `fusedStream`, which only `runRoutedSearch`
    // reached, so the three legacy legislation surfaces got the router's query
    // REWRITE and no dense retrieval at all. Scoping and dense were accidentally
    // mutually exclusive.
    //
    // The brief's requirement 2 is that the router must be able to run WITHIN a
    // scope rather than the caller having to choose. `STREAMS` already carries a
    // per-stream fused retrieval keyed by name, so a tier-scoped call can use the
    // matching stream's own `search()` and get BM25+dense inside its scope, with no
    // change to `runSearch`'s signature.
    //
    // ⚠ Only when the tier maps to EXACTLY ONE stream. `debates` and `committees`
    // share the `parliamentary` tier and are separated downstream by display type,
    // so picking one would silently narrow a caller's scope. Ambiguous tiers keep
    // the old BM25 path and say so, rather than guessing.
    const tierStreams = STREAMS.filter((s) => s.tier === q.tier)
    if (!flagEnabled('LEX_TIER_FUSION')) {
      // Flag OFF is the shipped default and is byte-for-byte the old behaviour, so
      // "nothing changed until someone decides it should" is structural rather than
      // a thing to test. See env-flags.ts for the measured trade-off behind the flag.
      const out = await runFtsSearch(streamQuery, limit, q.tier)
      ftsResults = out.results; failed = !!out.failed; failureReason = out.reason
    } else if (tierStreams.length === 1) {
      const s = tierStreams[0]
      const hits = await s.search(streamQuery.join(' '), limit).catch((e) => {
        console.error(`[search-gateway] tier-scoped fused stream '${s.name}' threw — falling back to BM25`, e)
        return null
      })
      if (hits) {
        routedStreams = [s.name]
        ftsResults = hits
        console.log('[search-gateway] tier-scoped FUSED retrieval', {
          intent: q.intent, tier: q.tier, stream: s.name, results: hits.length,
          dense: perStreamVectorActive() ? 'on' : 'off',
        })
      } else {
        const out = await runFtsSearch(streamQuery, limit, q.tier)
        ftsResults = out.results; failed = !!out.failed; failureReason = out.reason
      }
    } else {
      console.log('[search-gateway] tier maps to !=1 stream — BM25 path retained', {
        intent: q.intent, tier: q.tier, streams: tierStreams.map((s) => s.name),
      })
      const out = await runFtsSearch(streamQuery, limit, q.tier)
      ftsResults = out.results; failed = !!out.failed; failureReason = out.reason
    }
  } else if (flags.router) {
    const route = await routeQuery(keywords, q.ideaContext ?? '')
    const streamNames = route ? Object.keys(route) : []
    if (route && streamNames.length) {
      routedStreams = streamNames
      // `results` arrives INTERLEAVED, not concatenated — see query-router.ts::runRoutedSearch.
      // Every downstream prefix (general-chat's answer context, the orchestrator's snippets,
      // score-ordering's top-K) is therefore stream-balanced without each caller re-deciding it.
      // S9 §4 — the statistics catalogue runs CONCURRENTLY with corpus retrieval, not after
      // it. It touches a different database and shares none of the corpus services, so it
      // adds no queueing against `vector-serve`'s width and its cost is hidden inside the
      // slowest corpus stream rather than added to it (measured: SEARCH_S9_REPORT.md §B3).
      //
      // ⚠ `runRoutedSearch` simply does not match `statistics` — there is no `StreamScope`
      // of that name — so the route object needs no filtering before it is passed on.
      const [routed, stats] = await Promise.all([
        runRoutedSearch(route, limit),
        retrieveStatistics(route.statistics, q.intent),
      ])
      ftsResults = routed.results
      perStream = routed.perStream
      statistics = stats
      console.log('[search-gateway] router dispatched', {
        intent: q.intent,
        streams: streamNames,
        perStream: Object.fromEntries(routed.perStream.map((s) => [s.stream, s.ids.length])),
        statistics: stats
          ? { series: stats.results.length, withheld: stats.licenceWithheld, unavailable: stats.unavailable }
          : 'not selected',
      })
    } else {
      // error, not log: routeQuery has already said WHY on the line above, and this is a real
      // capability loss for the query — no per-stream scoping and no dense fusion.
      // S3 §7.1: OFF and FAILED both land here, and calling both "fail-open" is what made
      // a disabled router read as a broken one. The retrieval consequence is identical;
      // the diagnosis is not, so the two are named apart.
      if (!routerEnabled()) {
        console.log(
          '[search-gateway] router DISABLED (LEX_QUERY_ROUTER off) — searching all streams unfiltered. ' +
          'This is configuration, NOT a failure: routing was never attempted.', { intent: q.intent })
      } else {
        console.error('[search-gateway] router FAIL-OPEN — router is ON but produced no decision; searching all streams unfiltered (reason logged by [query-router] above)', { intent: q.intent })
      }
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

    // 3. Web orientation — SHIPPED 2026-08-06, but NOT here. See lib/lex/orientation/.
    //
    //    The flag stays declared in this file because it is a search capability and
    //    this is where capabilities are read. The CALL is not in the gateway, and
    //    that is deliberate: the gateway's contract is `query → SearchResult[]` and
    //    it is shared by nine intents, whereas orientation produces briefing
    //    SEGMENTS (Tier B/C background, §6d.4) and is scoped to exactly one caller
    //    — the Page-1 background briefing. Running it here would have fired it for
    //    cause-seeding, ad-hoc research and the three legacy legislation surfaces
    //    as well, at ~$0.07 and ~25s a time.
    //
    //    So `fireSearchTrigger` calls runOrientation() in parallel with runSearch(),
    //    and this step is intentionally empty. If orientation is later widened to
    //    steer the QUERY (its other §6d use — web orients, the corpus is cited),
    //    that half belongs here and this is where it goes.

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
  //     ⚠ AND IT WOULD ALSO UNDO THE INTERLEAVE. fuseWeightedRrf re-sorts the whole list by a
  //     fused score, so running it over an interleaved routed list destroys the stream balance
  //     that check:stream-coverage asserts. Reachable only with LEX_SEARCH_VECTOR=true AND
  //     LEX_VECTOR_STREAMS unset — a combination the per-stream design already supersedes, and
  //     which is why this branch logs loudly rather than being left to be discovered.
  let results = ftsResults
  if (flags.vector && !perStreamVectorActive()) {
    const { results: vecResults } = await runVectorSearch(queryKeywords, limit)
    if (vecResults.length) {
      results = fuseWeightedRrf(vecResults, ftsResults)
      console.log('[search-gateway] vector fusion (whole-query, legacy path)', { intent: q.intent, fts: ftsResults.length, vector: vecResults.length, fused: results.length })
      if (routedStreams) {
        console.warn('[search-gateway] whole-query fusion re-sorted an INTERLEAVED routed list — stream balance is gone for this query. Set LEX_VECTOR_STREAMS instead of LEX_SEARCH_VECTOR.', { intent: q.intent, streams: routedStreams })
      }
    }
  } else if (flags.vector) {
    console.log('[search-gateway] whole-query fusion stood down — per-stream vector is active', {
      intent: q.intent, streams: process.env.LEX_VECTOR_STREAMS,
    })
  }

  // 5. Group by display type — ≤3/type, ~20 cap. Kept INSIDE the gateway so that
  //    when the taxonomy lands as a shared corpus-type-map, only the gateway changes.
  const grouped = groupForPanel(results)

  // ── SURFACE 1 — repeal status, attached HERE and nowhere else ────────────────────────────
  // ⚠ Annotated AFTER grouping and applied to BOTH arrays, because `grouped` is a filtered view
  // over `results` and a consumer may read either. Annotating only one is how a panel comes to
  // disagree with the answer beside it.
  // ⚠ ONE query per search, not one per result: twenty round trips inside a request that already
  // holds a retrieval call is a latency regression nobody would attribute to a label.
  const { statuses, ok: repealOk } = await lookupRepeals([...results, ...grouped].map((r) => r.id))
  const rawAnnotatedResults = annotate(results, statuses, repealOk)
  const rawAnnotatedGrouped = annotate(grouped, statuses, repealOk)

  // ── C3 LANE B2/B4 — THE EXCLUSION, NOT JUST THE ANNOTATION ──────────────────────────────
  //
  // ⚠ ANNOTATION WITHOUT EXCLUSION IS THE SAME DEFECT AS RETIRING A TARGET WITHOUT DELETING THE
  // ROWS, and this codebase has now shipped that shape twice. All 249,256 whole-body dot leaders
  // have been labelled in every search result since Surface 1 — and still returned. A row whose
  // entire text is `Article 31 . . . .` cannot answer anything: at best it displaces a result that
  // could, and at worst Lex renders it as the provision the user asked about.
  //
  // ⚠ IT IS FILTERED HERE, AT THE GATEWAY, so every consumer gets the same list. Filtering in one
  // caller is how the panel and the prompt come to disagree — the exact failure the annotation
  // block above was written to avoid, one layer along.
  //
  // ⚠ THE RULE IS `isHollowRepeal`, KEYED ON THE EVIDENCE. A repealed provision whose text we hold
  // is NOT suppressed: it is returned with its REPEALED label, which is what a user asking about
  // repeal history needs. A PARTIALLY repealed provision is not suppressed either — it is live law.
  //
  // ⚠ AND IT IS COUNTED AND LOGGED, never silent. A retrieval path that quietly drops rows is
  // indistinguishable from one that failed to find them.
  const hollowResults = rawAnnotatedResults.filter((r) => isHollowRepeal(r.repeal))
  const annotatedResults = rawAnnotatedResults.filter((r) => !isHollowRepeal(r.repeal))
  const annotatedGrouped = rawAnnotatedGrouped.filter((r) => !isHollowRepeal(r.repeal))
  if (hollowResults.length) {
    console.log('[search-gateway] B2 suppressed whole-body dot leaders — rows whose entire text is a repeal placeholder', {
      suppressed: hollowResults.length,
      of: rawAnnotatedResults.length,
      ids: hollowResults.slice(0, 5).map((r) => r.id),
    })
  }
  const repealedCount = annotatedResults.filter((r) => r.repeal && r.repeal.state !== 'no-record').length
  const partialCount = annotatedResults.filter((r) => r.repeal?.state === 'partially-repealed').length

  // S11 §5.1 — the fan-out, stated. Derived from what actually happened rather than recomputed
  // from the scope table: `perStream` is present only on the routed path, and the tier-scoped and
  // unrouted paths really do dispatch one stream, so `?? 1` is the fact and not a fallback.
  const requested = {
    limit,
    returned: annotatedResults.length,
    streams: perStream?.length ?? 1,
    fanout: limit > 0 ? Math.round((annotatedResults.length / limit) * 10) / 10 : 0,
  }

  console.log('[search-gateway] result', {
    intent: q.intent, results: results.length, failed, reason: failureReason ?? null,
    repealed: repealedCount, partiallyRepealed: partialCount,
    hollowSuppressed: hollowResults.length, repealLookup: repealOk ? 'ok' : 'FAILED',
    // ⚠ Logged as `asked → got` rather than as a bare count, because a bare count is what every
    // log line already had while the fan-out went unnoticed for six weeks (§5.1).
    limit: `asked ${requested.limit} → got ${requested.returned} across ${requested.streams} stream(s) (${requested.fanout}×)`,
  })
  return {
    intent: q.intent, results: annotatedResults, grouped: annotatedGrouped, failed, failureReason, statistics,
    meta: { flags, expansionAdded, routedStreams, perStream, requested },
  }
}

// ── fusion moved to ./fusion.ts (2026-08-06) ──────────────────────────────────
// It now has two callers — this legacy whole-query path and query-router.ts's per-stream
// path — and a ranking formula kept in two places is a ranking formula that will eventually
// differ in one of them. The weight's provenance is documented there: it is 0.5 as of
// 2026-08-06, measured across all five streams against the current index
// (docs/GOLD_TEST_08_fusion_weight_decision.md), replacing the pilot-tuned 0.7.
