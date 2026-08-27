// query-router.ts — the deterministic half of query routing (§ CC brief "build the
// query router"). query-expansion.ts's routeQuery() is the ONLY AI judgement: it
// decides which streams are relevant and writes each one's tailored query string.
// Everything here runs AFTER that call and contains no AI judgement at all — it is
// pure dispatch, config-driven, so adding a stream (guidance landed as the 5th,
// confirming the design; the web/X layer, principle streams, the graph are next)
// means adding a list entry, not touching this file's logic.
//
// Today's five streams share ONE underlying retrieval call (runFtsSearch, tier-
// filtered — the same filter mechanism already proven in the scoped B1/B3 test
// and already live on the wire via fts-query-service.ts's `tier` param). debates
// and committees share the FTS tier `parliamentary`; corpusToType's existing
// type split (already computed by runFtsSearch on every hit) is reused to
// separate them rather than inventing a second filter axis server-side. guidance
// is a single-type tier (corpusToType maps the whole `guidance` tier to
// SearchResultType 'GUIDANCE'), so — like legislation/caselaw — it needs no
// `types` filter of its own.

import { AsyncLocalStorage } from 'async_hooks'
import type { SearchResult, SearchResultType } from './page1-config'
import { runFtsSearch } from './fts-search'
import { runVectorSearch, type VectorFailureReason } from './vector-search'
import { fuseWeightedRrf, streamVectorWeight } from './fusion'
import { interleaveStreams } from './interleave'
import { mergeJudged, judgedMergeEnabled, minPerStream, relevanceFloorFromEnv } from './merge-judged'
import { coverageSignalPresent } from './term-coverage'
import { rerankCandidates, rerankerEnabled, type RerankCandidate, type RerankOutcome } from './reranker'
import { sortByScore } from './score-scope'
import { activeStreamScopes, type StreamScope } from './stream-scopes'
import type { RouteResult, RouterStreamName } from './query-expansion'
import { mapWithLimit, streamConcurrency } from './stream-batch'
import { flagEnabled } from '@/lib/env-flags'

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// S15 §3 — DEGRADATION IS COLLECTED PER SEARCH, NOT PER MODULE
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// A stream's dense leg can fail for reasons a user should be told about (the service was
// saturated and refused; the call timed out) and reasons they should not (the stream is simply
// not in `LEX_VECTOR_STREAMS`). `fusedStream` is where that is still known, and `runRoutedSearch`
// is where it must be reported — but `StreamConfig.search(query, limit)` is a fixed two-argument
// signature shared by every stream, so there is nowhere to thread a sink through.
//
// ⚠ A MODULE-LEVEL ARRAY WOULD BE A BUG, NOT A SHORTCUT. This process serves concurrent requests;
// one user's saturated caselaw leg would be reported inside another user's search, and the first
// symptom would be Lex telling somebody about a gap in a search they never ran. `AsyncLocalStorage`
// scopes the sink to the one call, which is what makes it correct under concurrency.
//
// ⚠ Node runtime only — which this already is, because everything downstream of the gateway
// touches Prisma and Prisma cannot run on the edge.
export interface DenseDegradation {
  stream: string
  tier: string
  reason: VectorFailureReason
  detail: string
}
const degradedStore = new AsyncLocalStorage<DenseDegradation[]>()

function reportDenseDegraded(d: DenseDegradation): void {
  // Logged unconditionally: a degradation outside a `runRoutedSearch` scope (the legacy
  // whole-query path, a direct caller, a harness) must still be visible even though there is
  // no result object to hang it on.
  console.warn('[query-router] dense leg DEGRADED', d)
  degradedStore.getStore()?.push(d)
}

/** A stream's SCOPE (which part of the corpus it may reach — see stream-scopes.ts, where the
 *  `types` backstop and the corpus prefilters are documented) plus its retrieval call. */
export interface StreamConfig extends StreamScope {
  /** The stream's own retrieval call. Defaults differ only in tier/types today;
   *  a future non-FTS stream (web/X, graph) would supply a different function. */
  search: (query: string, limit: number) => Promise<SearchResult[]>
}

// The corpus/tier/type scopes moved to ./stream-scopes.ts on 2026-08-09 (S2B §1). They now have
// a second reader — the corpus reachability matrix, which computes which collections NO stream
// can select — and a measurement taken against a copy of this table would keep reporting
// "reachable" for as long as it took anyone to notice the copy had drifted.

function ftsStream(tier: string, types?: SearchResultType[], corpora?: string[], excludeCorpora?: string[]) {
  return async (query: string, limit: number): Promise<SearchResult[]> => {
    const { results } = await runFtsSearch([query], limit, { tier, corpora, excludeCorpora })
    return types ? results.filter((r) => types.includes(r.type)) : results
  }
}

/** corpus_sections ids are `{corpus}:{…}` — the collection is the first segment. */
function corpusOf(id: string): string { return id.split(':')[0] }

/**
 * The EXTRA LEG: a corpus-only retrieval for collections a stream owns that do not sit under its
 * tier in the built index (stream-scopes.ts `extraCorpora`, which explains why that happens).
 *
 * ⚠ THE SERVICE-SIDE CORPUS FILTER IS NOT TRUSTED HERE, and this is the one place that matters.
 * Both fts-search.ts and vector-search.ts DEGRADE rather than fail when the service does not
 * honour `corpora` — correct for the main leg, where an unhonoured corpus filter still leaves the
 * tier prefilter and the `types` backstop standing. This leg passes NO tier, and `guidance` has no
 * `types`, so a service that ignored `corpora` would return the whole 18.4M-row index as if it
 * were 1,873 rows of Erskine May. So the collection is re-checked off the id, client-side, where
 * no deploy skew can reach it. It costs one string split per hit.
 */
function extraLeg(
  fetchLeg: (scope: { corpora: string[] }) => Promise<SearchResult[]>,
  extraCorpora: string[],
  types?: SearchResultType[],
) {
  return async (): Promise<SearchResult[]> => {
    const results = await fetchLeg({ corpora: extraCorpora })
    const scoped = results.filter((r) => extraCorpora.includes(corpusOf(r.id)))
    if (scoped.length !== results.length) {
      console.warn(`[query-router] extra leg: dropped ${results.length - scoped.length} of ${results.length} out-of-scope hits — the service did not honour corpora=${JSON.stringify(extraCorpora)}; redeploy it`)
    }
    return types ? scoped.filter((r) => types.includes(r.type)) : scoped
  }
}

/**
 * Merge the main leg with the extra leg into one ranking.
 *
 * Safe to order by score because both legs come from the SAME scorer: either both raw BM25 from
 * the same index (so the same IDF statistics — a prefilter selects rows, it does not rescore
 * them), or both RRF, because `fusedStream` fuses each leg before this runs. `sortByScore`
 * asserts exactly that and throws if it is ever untrue, which is the whole point of it existing
 * (score-scope.ts). The two legs are disjoint by construction — `extraCorpora` names collections
 * outside the stream's tier — so no de-duplication is needed and none is done silently.
 */
function mergeLegs(main: SearchResult[], extra: SearchResult[], label: string, limit: number): SearchResult[] {
  if (!extra.length) return main
  return sortByScore([...main, ...extra], label).slice(0, Math.max(limit, main.length))
}

// ── per-stream dense retrieval (LEX_VECTOR_STREAMS) ───────────────────────────
//
// WHY A STREAM LIST AND NOT A BOOLEAN. `LEX_SEARCH_VECTOR` can only say "vector on" for the
// WHOLE query — it sits in the gateway after retrieval and fuses one dense ranking over all
// 21.8M vectors into whatever BM25 returned. That cannot express "vector on, for legislation,
// only", which is what this sprint requires: legislation is where the concept-win was measured
// (docs/VECTOR_DOSSIER archetype B), and the other four streams have no measurement at all
// behind them. A list makes the blast radius the unit of configuration:
//
//     LEX_VECTOR_STREAMS=              (unset/empty)  → OFF everywhere. The default.
//     LEX_VECTOR_STREAMS=legislation   → exactly one stream changes.
//     LEX_VECTOR_STREAMS=legislation,caselaw → later, per stream, as each earns it.
//
// Read at CALL time, not module load, so a test can flip it without a module reset and so a
// platform env change takes effect on redeploy without a code change.
function vectorStreams(): Set<string> {
  return new Set(
    (process.env.LEX_VECTOR_STREAMS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

/** True when per-stream dense retrieval is active for ANY stream — the gateway uses this to
 *  stand down its legacy whole-query fusion, so a result can never be fused twice. */
export function perStreamVectorActive(): boolean {
  return vectorStreams().size > 0
}

/**
 * A stream that retrieves BM25 and dense IN PARALLEL, both scoped to this stream's tier, and
 * fuses them. Falls back to BM25 alone whenever the dense half returns nothing — which is the
 * normal state today, since `VECTOR_SEARCH_URL` is unset, so this is inert until the vector
 * query service is deployed.
 *
 * The dense call is scoped SERVER-side (a prefilter over corpus_vec). Filtering here
 * instead would keep whatever fraction of an unscoped ANN result happened to be legislation —
 * 8.6% of the index — and would look like weak recall rather than a scoping bug.
 *
 * BOTH HALVES TAKE THE SAME SCOPE. Scoping only the BM25 half would be worse than scoping
 * neither: the fusion would rank a committee-scoped keyword list against a tier-wide dense
 * list, so the dense half would contribute Hansard to a committees result and the weighting
 * would make it look deliberate. Committee content is 1.17% of the parliamentary tier, so an
 * unscoped dense half is ~99% out-of-stream by construction.
 *
 * ⚠ MERGE FIRST, FUSE ONCE (S2C). With `extraCorpora` a stream has TWO retrieval legs, and the
 * obvious shape — fuse each leg against its own dense half, then merge — is wrong: whenever one
 * leg's dense half comes back empty and the other's does not, the merge would compare an RRF
 * score (~0.01) with a BM25 score (~5–25), which is the exact defect S2B deleted from
 * `groupForPanel`, rebuilt one function lower down. So the two BM25 legs are merged into one BM25
 * ranking and the two dense legs into one dense ranking, and fusion happens once, over both. The
 * result is what a single query over the union of the scopes would have produced, and every list
 * that reaches `sortByScore` carries one scorer by construction rather than by luck.
 */
function fusedStream(name: string, tier: string, types?: SearchResultType[], corpora?: string[], excludeCorpora?: string[], extraCorpora?: string[]) {
  const bm25Only = ftsStream(tier, types, corpora, excludeCorpora)
  const hasExtra = !!extraCorpora?.length
  return async (query: string, limit: number): Promise<SearchResult[]> => {
    const extraFts = hasExtra
      ? extraLeg(async (scope) => (await runFtsSearch([query], limit, scope)).results, extraCorpora!, types)()
      : Promise.resolve([] as SearchResult[])

    // Keyed on the STREAM NAME, not the tier. `debates` and `committees` both sit on the
    // `parliamentary` tier and are separated downstream by display type, so a tier-keyed flag
    // could not enable one without the other — and the two streams have entirely different
    // evidence behind them. Name-keying keeps the blast radius one stream wide.
    if (!vectorStreams().has(name)) {
      const [main, extra] = await Promise.all([bm25Only(query, limit), extraFts])
      return mergeLegs(main, extra, `${name} bm25 legs`, limit)
    }

    const [mainB, denseMain, extraB, extraV] = await Promise.all([
      bm25Only(query, limit),
      runVectorSearch([query], limit, { tier, corpora, excludeCorpora })
        .catch((e) => ({ results: [] as SearchResult[], failure: { reason: 'error' as const, detail: (e as Error).message } })),
      extraFts,
      hasExtra
        ? extraLeg(async (scope) => (await runVectorSearch([query], limit, scope).catch(() => ({ results: [] as SearchResult[] }))).results, extraCorpora!, types)()
        : Promise.resolve([] as SearchResult[]),
    ])
    // ⚠⚠ S15 §3 — THE DEGRADATION IS RECORDED HERE, WHERE IT IS STILL KNOWN.
    //
    // This is the exact line S14 §0 was about. `mergeLegs` returns the BM25 list and every hit
    // keeps `scorer: 'bm25'`, which is byte-for-byte what a stream with no dense leg produces —
    // so one line further down, "dense retrieval is off" and "dense retrieval was refused by a
    // saturated service" become the same object and can never be told apart again. Recording it
    // costs one array push and is the difference between a stated gap and a silent one
    // (SEARCH_CONTRACT.md §6's never-claim rule; CLAUDE.md §18's corollary).
    if (denseMain.failure) reportDenseDegraded({ stream: name, tier, ...denseMain.failure })
    const denseScoped = types ? denseMain.results.filter((r) => types.includes(r.type)) : denseMain.results

    const bm25 = mergeLegs(mainB, extraB, `${name} bm25 legs`, limit)
    const vec = mergeLegs(denseScoped, extraV, `${name} vector legs`, limit)
    // S10 §3 — the weight is now resolved PER STREAM. With `LEX_FUSION_WEIGHTS` off this returns
    // the same 0.5 constant this line always used, so the shipped default is byte-identical.
    const weight = streamVectorWeight(name)
    // ⚠ CAPTURED BEFORE THE EARLY RETURN, so a stream whose dense half came back empty is recorded
    // as `vector: []` rather than not recorded at all. "No dense leg" and "not measured" are
    // different statements and a sweep that could not tell them apart would average over both.
    emitLegs({ stream: name, query, bm25, vector: vec, weight })
    if (!vec.length) return bm25
    const fused = fuseWeightedRrf(vec, bm25, weight).slice(0, Math.max(limit, bm25.length))
    // The resolved weight is logged next to the stream name on EVERY fused call. A stream that is
    // absent from `LEX_VECTOR_STREAMS` never reaches this line at all, so "dial set but dense off"
    // — which does nothing, silently — is told apart from "dial set and working" by reading the
    // log rather than by inferring from a config value nobody on this machine can read.
    console.log('[query-router] per-stream fusion', { stream: name, tier, corpora: corpora ?? null, extraCorpora: extraCorpora ?? null, bm25: bm25.length, vector: vec.length, fused: fused.length, weight })
    return fused
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// S10 §3 — THE LEG CAPTURE SEAM, so a weight sweep measures THIS code and not a copy of it.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// WHY IT EXISTS. Sweeping six fusion weights over five streams and fifty questions the obvious way
// means 1,500 retrieval passes against a service four requests wide — hours of wall-clock for a
// measurement whose inputs never change. The two INPUT rankings (BM25 and dense) do not depend on
// the weight at all; only the fusion of them does. So the legs are retrieved once and every weight
// is computed from them.
//
// ⚠ THE SEAM IS HERE, IN THE PRODUCTION PATH, AND NOT IN THE HARNESS — deliberately. A harness
// that rebuilt the scopes, the two legs and `mergeLegs` for itself would be measuring a COPY of
// the ranking pipeline, and stream-scopes.ts already records what a copy costs: "a copy is how the
// matrix would keep saying reachable for a month after someone narrowed a filter". What is
// captured here is exactly what `fuseWeightedRrf` was about to be handed.
//
// ⚠ INERT UNLESS A SINK IS INSTALLED. No sink is installed anywhere in the app; only a script
// calls `captureLegs`. The cost when nothing is listening is one null check per fused stream call.
export interface CapturedLegs {
  stream: string
  query: string
  /** The merged BM25 ranking, in rank order — what fusion receives as its sparse input. */
  bm25: SearchResult[]
  /** The merged dense ranking, in rank order. EMPTY is a real, recordable state (see above). */
  vector: SearchResult[]
  /** The weight this call actually resolved, so a recomputation can be checked against the real one. */
  weight: number
}

let legSink: ((legs: CapturedLegs) => void) | null = null

/** Install a sink to observe every fused stream's two input rankings. Returns the uninstall
 *  function. Measurement only — nothing in the app installs one. */
export function captureLegs(sink: (legs: CapturedLegs) => void): () => void {
  legSink = sink
  return () => { legSink = null }
}

function emitLegs(legs: CapturedLegs): void {
  if (!legSink) return
  try { legSink(legs) } catch (e) {
    // A measurement sink must never be able to break retrieval for a user.
    console.error('[query-router] leg capture sink threw — retrieval is unaffected', e)
  }
}

// Every stream can now fuse, but each is INERT unless LEX_VECTOR_STREAMS names it by name.
// An unnamed stream calls exactly the ftsStream it always did (fusedStream delegates straight
// to it), so "nothing else changed" stays structural rather than a thing to test.
//
// The list is BUILT from STREAM_SCOPES rather than restating it: the scope (tier / corpora /
// excludeCorpora / types) is data, shared with the reachability matrix; the retrieval function
// is code and stays here.
//
// S8 §4 — the three candidate streams join ONLY when `LEX_ROUTER_STREAMS_V2` is on. The flag is
// read here, on the runtime side, so `stream-scopes.ts` keeps its no-runtime-imports property.
//
// ⚠ READ PER CALL, MEMOISED PER FLAG VALUE — not frozen at module load. Module-load was the first
// design and it made the §4 measurement impossible to run fairly: comparing the two arms would
// have meant two processes, and therefore two different cache states, two different service warm-
// ups, and no way to alternate. A per-call read lets one process alternate arms against the same
// warm services, which is the only way the latency delta means anything.
//
// The consistency the module-load version was protecting is preserved by scope rather than by
// timing: a router DECISION and its DISPATCH both happen inside one `runSearch`, and the flag does
// not change inside a request in production. Memoising per value keeps the `fusedStream` closures
// stable, so an arm's second query reuses the first's stream objects rather than rebuilding them.
// ⚠ KEYED ON EVERY FLAG THAT SHAPES THE SCOPES. Today that is `LEX_ROUTER_STREAMS_V2` alone;
// until S11 it was also `LEX_GUIDANCE_CPS`, which changed the guidance stream's `extraCorpora`. A
// cache keyed on a subset of the flags hands back a stream built under the other arm, and the two
// arms then look identical in a measurement that alternates them — precisely what this cache
// exists to make possible. ⚠ ADD THE KEY WHENEVER A FLAG IS ADDED THAT SHAPES A SCOPE.
const STREAM_CACHE = new Map<string, StreamConfig[]>()
export function routerStreamsV2(): boolean { return flagEnabled('LEX_ROUTER_STREAMS_V2') }
export function streams(): StreamConfig[] {
  const v2 = routerStreamsV2()
  // `String()` rather than a lint suppression. Booleans stringify deterministically so there is no
  // bug here, and `allowBoolean: false` is deliberate: the rule cannot tell a cache key from a
  // sentence, and a boolean reaching a user-facing string almost always is one. Stating the intent
  // is cheaper than an exception that would also cover the next, real, case (S11 §5.2).
  const key = String(v2)
  const hit = STREAM_CACHE.get(key)
  if (hit) return hit
  const built = activeStreamScopes(v2).map((s) => ({
    ...s,
    search: fusedStream(s.name, s.tier, s.types, s.corpora, s.excludeCorpora, s.extraCorpora),
  }))
  STREAM_CACHE.set(key, built)
  console.log(`[query-router] streams in force: ${built.map((s) => s.name).join(', ')} (LEX_ROUTER_STREAMS_V2=${v2 ? 'ON' : 'off'})`)
  return built
}

/** ⚠ Back-compat for the existing readers (`search-gateway.ts`'s tier-scoped branch and
 *  `scripts/verify-stream-scoping.ts`). A getter, so it reflects the flag rather than freezing
 *  whatever it was when this module first loaded. */
export const STREAMS: StreamConfig[] = new Proxy([] as StreamConfig[], {
  get(_t, prop, recv) { return Reflect.get(streams(), prop, recv) },
  has(_t, prop) { return Reflect.has(streams(), prop) },
  ownKeys() { return Reflect.ownKeys(streams()) },
  getOwnPropertyDescriptor(_t, prop) { return Reflect.getOwnPropertyDescriptor(streams(), prop) },
})

/** What a routed search produced, per stream, before and after interleaving. The gateway
 *  puts this on `meta` so a caller — and scripts/check-stream-coverage.ts — can state which
 *  streams reached the answer without re-deriving stream membership from corpus names. */
export interface RoutedSearchResult {
  /** Every stream's hits, merged (see interleave.ts / merge-judged.ts). Nothing is dropped here. */
  results: SearchResult[]
  /** Retrieved ids per stream, in that stream's own rank order. */
  perStream: Array<{ stream: RouterStreamName; ids: string[] }>
  /**
   * S14 §2 — WHICH MERGE RAN, and what it did. Present on every routed search.
   *
   * ⚠ `merge` NAMES THE ARM RATHER THAN LEAVING IT TO BE INFERRED FROM A FLAG. A caller reading a
   * ranking has no other way to tell "the judged merge ran and changed nothing" from "the judged
   * merge did not run", and those are different facts (CLAUDE.md §18's corollary).
   */
  merge: {
    mode: 'round-robin' | 'judged'
    /**
     * Slots each stream took inside the top-20 window, keyed by stream name. The number Charlie's
     * rule is about: a source CAN hold all twenty, and this is where that is visible.
     *
     * ⚠ MEASURED BEFORE THE GATEWAY'S HOLLOW-REPEAL SUPPRESSION, because that filter runs one
     * layer up in `search-gateway.ts` and this function cannot see it. A caller comparing this
     * against what it displays will find small differences on legislation-heavy queries, where
     * whole-body dot-leader rows are removed after the merge. Stated rather than left to be found.
     */
    windowShare?: Record<string, number>
    /** The reranker's outcome when it ran — including when it ran and failed. */
    rerank?: Pick<RerankOutcome, 'applied' | 'reason' | 'read' | 'omitted' | 'invented' | 'duplicated' | 'model' | 'pence' | 'ms'>
  }
  /**
   * ⚠⚠ S15 §3 — STREAMS WHOSE DENSE HALF DID NOT RUN, AND WHY. Absent when every routed
   * stream retrieved as configured.
   *
   * This is the channel S14 §0 found missing. A stream whose dense leg was refused by a
   * saturated service returns a BM25-only ranking that is byte-for-byte identical to a stream
   * which never had a dense leg — so without this field the two are indistinguishable to every
   * caller, including a measurement harness. `SEARCH_CONTRACT.md` §6 requires Lex to say which
   * of "I could not look" and "I looked and found nothing" applies; this is what makes that
   * possible for the dense half.
   *
   * ⚠ IT IS A PARTIAL GAP, NOT A FAILED SEARCH. The BM25 half of the same stream did run, so
   * the results are real and `failed` is not set on their account — see search-gateway.ts,
   * where `failed` is reserved for a search that returned NOTHING while a leg was refused.
   */
  degraded?: DenseDegradation[]
}

/**
 * S14 §1(b)/§3 — everything the merge needs beyond the streams' own rankings.
 *
 * All optional, and every one of them absent is a defined state that reduces to today's ordering:
 * no confidence ⇒ uniform weights; no question ⇒ the reranker cannot run and says so.
 */
export interface RoutedSearchOptions {
  /** (b) The router's own view of where the answer sits, per stream, 0..1. */
  confidence?: Record<string, number> | null
  /**
   * (c) The USER'S question, verbatim — what the reranker judges relevance against.
   *
   * ⚠ NOT the union of the streams' tailored queries. Those are BM25 strings the router wrote to
   * maximise keyword overlap; a model asked to order documents against them would be scoring
   * vocabulary rather than whether the document answers anything, which is exactly the failure
   * term coverage already has and the reranker exists to avoid.
   */
  question?: string
}

/**
 * Dispatch a router decision to only the streams it named, each with its own tailored query,
 * then INTERLEAVE the streams into one list.
 *
 * ⚠ THIS USED TO END `perStream.flat()`, and that was the bug. A concatenation is stream-blocked:
 * the first `limit` positions are all legislation, so every downstream consumer that took a
 * prefix — general-chat's 16-document answer context above all — read one stream and never saw
 * the other four, which had been routed, retrieved, counted and shown in the source panel. See
 * interleave.ts for the full account and for why round-robin rather than a cross-stream sort.
 *
 * The budget here is the TOTAL number of hits, so this is a pure reordering and drops nothing.
 * Truncation stays where it belongs — with the caller that knows its own context budget — and is
 * now safe, because any prefix of an interleaved list is stream-balanced.
 */
export async function runRoutedSearch(
  route: RouteResult,
  limit: number,
  opts: RoutedSearchOptions = {},
): Promise<RoutedSearchResult> {
  // S15 §3 — one sink per search, so a concurrent request's degradation cannot leak into this
  // one. See the note on `degradedStore`.
  const degraded: DenseDegradation[] = []
  const out = await degradedStore.run(degraded, () => runRoutedSearchInner(route, limit, opts))
  return degraded.length ? { ...out, degraded } : out
}

async function runRoutedSearchInner(
  route: RouteResult,
  limit: number,
  opts: RoutedSearchOptions = {},
): Promise<RoutedSearchResult> {
  const active = streams().filter((s) => route[s.name])
  // ⚠⚠ S14 §2 — CHARLIE'S RULE, APPLIED AT RETRIEVAL: "we need at least 20 from each source … we
  // should never cut back the visibility when we add sources." `limit` is already a PER-STREAM
  // budget, so adding a stream has never reduced what any other stream RETRIEVES; what this adds
  // is a FLOOR under a small caller limit, so the judged pool is never thin because the gateway's
  // default is 12. It applies ONLY on the judged path — with the flag off, `perStreamLimit` is
  // `limit` and every byte of this function is what it was.
  //
  // ⚠ IT COSTS SOMETHING, AND THE COST HAS A KNOWN VICTIM. `results` is the interleaved sum, so
  // widening every stream widens `results` — and the Deepening's sift is the one caller that reads
  // `results` UNFILTERED and pays a per-candidate model cost (S11 §5.1, where a fan-out nobody had
  // noticed hit its output ceiling). That is why this is behind the flag rather than simply raised.
  const judged = judgedMergeEnabled()
  const perStreamLimit = judged ? Math.max(limit, minPerStream()) : limit
  // ⚠ BRIEF_SEARCH_S5 §2 — BATCHED, and this is a prerequisite rather than an optimisation.
  // This was `Promise.all(active.map(...))`: five streams fired at once against a search service
  // that handles four, so ONE USER SATURATED IT. S5 makes five streams the normal case for the
  // Lex conversation rather than the exception, which is what turns a latent problem into a live
  // one. `maxInFlight` below is OBSERVED, so a limiter that silently failed open would show.
  const { results: perStream, stats } = await mapWithLimit(
    active, streamConcurrency(), (s) => s.search(route[s.name]!, perStreamLimit))
  if (active.length > stats.limit) {
    console.log('[query-router] streams batched', {
      streams: active.length, cap: stats.limit, maxInFlight: stats.maxInFlight, ms: stats.ms,
    })
  }
  const total = perStream.reduce((n, s) => n + s.length, 0)

  // ── S14 §2 — the merge ──────────────────────────────────────────────────────────────────────
  //
  // ⚠ DEFAULT IS TODAY'S BEHAVIOUR, EXACTLY. With `LEX_SEARCH_JUDGED_MERGE` off this is the same
  // `interleaveStreams` call it always was, so "nothing changed until someone decides it should"
  // is structural rather than something to test.
  //
  // ⚠⚠ S13's `LEX_MERGE_COVERAGE` ARM IS GONE, NOT DEFAULTED OFF. It bought +2 of 65 while moving
  // 24 of 34 rankings and taking two documents their own stream ranked SECOND to merged 117 and
  // 149; D-5 recommended leaving it off and S14 §2 replaces it. A flag that survives its own
  // replacement is how a dead branch gets re-enabled by somebody reading an old note. The SIGNAL
  // it was built on survives in `term-coverage.ts`, where the judged merge uses it as a GATE
  // rather than as the whole ordering — which is the specific thing that made it too crude.
  const names = active.map((s) => s.name)
  let results: SearchResult[]
  const merge: RoutedSearchResult['merge'] = { mode: judged ? 'judged' : 'round-robin' }

  if (!judged) {
    results = interleaveStreams(perStream, total, { names, label: 'runRoutedSearch' })
  } else {
    // The query the coverage GATE is scored against is the union of the streams' tailored queries.
    // A cross-stream comparison needs ONE query, and using any single stream's would score every
    // other stream's documents against terms they were never retrieved for.
    const unionQuery = active.map((s) => route[s.name]!).join(' ')
    const relevanceFloor = relevanceFloorFromEnv()

    // ⚠ THE GATE REFUSES TO RUN WITHOUT THE SIGNAL, AND SAYS SO. Coverage is scored over
    // title+citation+snippet; on an `fts-serve`/`vector-serve` build older than S13 §3 the snippet
    // is the first 300 characters of the document, so the gate would be measuring how often a
    // query term lands in a document's opening — and would look exactly like a gate that does not
    // help. OFF, FAILED and NOT-MEASURABLE are three states (CLAUDE.md §18).
    let gate = relevanceFloor
    if (gate != null && !coverageSignalPresent(perStream)) {
      console.error('[query-router] merge=JUDGED — the relevance GATE is configured but the retrieval ' +
        'services are not sending `snippetMatched`, i.e. fts-serve/vector-serve predate S13 §3. ' +
        'THE GATE IS OFF FOR THIS QUERY; the ordering still ran. REDEPLOY the services — a restart ' +
        're-runs the existing build and will not fix this.', { streams: names })
      gate = null
    }

    // (c) The reranker, over the pooled candidates from ALL streams, after retrieval and before
    // display. It never sees the merged list, so the cap it reads cannot be shaped by the
    // rationing this sprint exists to remove (see reranker.ts on why the cap is round-robin).
    let priority: Map<string, number> | null = null
    if (rerankerEnabled()) {
      if (!opts.question || !opts.question.trim()) {
        console.error('[query-router] LEX_SEARCH_RERANKER is ON but no `question` reached runRoutedSearch — ' +
          'the reranker CANNOT run and the deterministic ordering stands. This is a wiring fault, not a model failure.')
        merge.rerank = { applied: false, reason: 'no-candidates', read: 0, omitted: 0, invented: 0, duplicated: 0, model: '(not called)', pence: null, ms: 0 }
      } else {
        const pool: RerankCandidate[][] = perStream.map((s, i) => s.map((r) => ({
          id: r.id, stream: names[i], title: r.title, citation: r.citation,
          snippet: r.snippet, snippetMatched: r.snippetMatched,
        })))
        const out = await rerankCandidates(opts.question, pool, { label: names.join('+') })
        if (out.applied) priority = out.priority
        merge.rerank = { applied: out.applied, reason: out.reason, read: out.read, omitted: out.omitted,
          invented: out.invented, duplicated: out.duplicated, model: out.model, pence: out.pence, ms: out.ms }
      }
    }

    const out = mergeJudged(perStream, {
      streamNames: names, query: unionQuery, budget: total,
      confidence: opts.confidence ?? null, relevanceFloor: gate, priority,
    })
    results = out.results
    merge.windowShare = Object.fromEntries(names.map((nm, i) => [nm, out.report.takenInWindow[i]]))
    console.log('[query-router] merge=JUDGED', {
      streams: names,
      perStreamLimit,
      // ⚠ THE WINDOW SHARE IS THE POINT OF THE WHOLE SPRINT, so it is logged on every call. The
      // round-robin's share was floor(20/S) for every stream by construction; anything else here
      // is the judgement doing something, and a share that is still flat is a null result stated
      // rather than a null result hidden.
      windowShare: merge.windowShare,
      confidence: out.report.confidence,
      gate: gate ?? 'off',
      gatedOut: out.report.gated,
      meanCoverage: out.report.meanCoverage,
      rerank: merge.rerank ? `${merge.rerank.model} applied=${merge.rerank.applied} read=${merge.rerank.read} omitted=${merge.rerank.omitted} ${merge.rerank.pence ?? '?'}p` : 'off',
    })
  }

  return {
    results,
    perStream: active.map((s, i) => ({ stream: s.name, ids: perStream[i].map((r) => r.id) })),
    merge,
  }
}
