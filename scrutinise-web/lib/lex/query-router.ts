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

import type { SearchResult, SearchResultType } from './page1-config'
import { runFtsSearch } from './fts-search'
import { runVectorSearch } from './vector-search'
import { fuseWeightedRrf, VECTOR_WEIGHT } from './fusion'
import { interleaveStreams } from './interleave'
import { sortByScore } from './score-scope'
import { activeStreamScopes, type StreamScope } from './stream-scopes'
import type { RouteResult, RouterStreamName } from './query-expansion'
import { mapWithLimit, streamConcurrency } from './stream-batch'
import { flagEnabled } from '@/lib/env-flags'

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
      runVectorSearch([query], limit, { tier, corpora, excludeCorpora }).catch(() => ({ results: [] as SearchResult[] })),
      extraFts,
      hasExtra
        ? extraLeg(async (scope) => (await runVectorSearch([query], limit, scope).catch(() => ({ results: [] as SearchResult[] }))).results, extraCorpora!, types)()
        : Promise.resolve([] as SearchResult[]),
    ])
    const denseScoped = types ? denseMain.results.filter((r) => types.includes(r.type)) : denseMain.results

    const bm25 = mergeLegs(mainB, extraB, `${name} bm25 legs`, limit)
    const vec = mergeLegs(denseScoped, extraV, `${name} vector legs`, limit)
    if (!vec.length) return bm25
    const fused = fuseWeightedRrf(vec, bm25).slice(0, Math.max(limit, bm25.length))
    console.log('[query-router] per-stream fusion', { stream: name, tier, corpora: corpora ?? null, extraCorpora: extraCorpora ?? null, bm25: bm25.length, vector: vec.length, fused: fused.length, weight: VECTOR_WEIGHT })
    return fused
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
const STREAM_CACHE = new Map<boolean, StreamConfig[]>()
export function routerStreamsV2(): boolean { return flagEnabled('LEX_ROUTER_STREAMS_V2') }
export function streams(): StreamConfig[] {
  const v2 = routerStreamsV2()
  const hit = STREAM_CACHE.get(v2)
  if (hit) return hit
  const built = activeStreamScopes(v2).map((s) => ({
    ...s,
    search: fusedStream(s.name, s.tier, s.types, s.corpora, s.excludeCorpora, s.extraCorpora),
  }))
  STREAM_CACHE.set(v2, built)
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
  /** Every stream's hits, interleaved (see interleave.ts). Nothing is dropped here. */
  results: SearchResult[]
  /** Retrieved ids per stream, in that stream's own rank order. */
  perStream: Array<{ stream: RouterStreamName; ids: string[] }>
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
export async function runRoutedSearch(route: RouteResult, limit: number): Promise<RoutedSearchResult> {
  const active = streams().filter((s) => route[s.name])
  // ⚠ BRIEF_SEARCH_S5 §2 — BATCHED, and this is a prerequisite rather than an optimisation.
  // This was `Promise.all(active.map(...))`: five streams fired at once against a search service
  // that handles four, so ONE USER SATURATED IT. S5 makes five streams the normal case for the
  // Lex conversation rather than the exception, which is what turns a latent problem into a live
  // one. `maxInFlight` below is OBSERVED, so a limiter that silently failed open would show.
  const { results: perStream, stats } = await mapWithLimit(
    active, streamConcurrency(), (s) => s.search(route[s.name]!, limit))
  if (active.length > stats.limit) {
    console.log('[query-router] streams batched', {
      streams: active.length, cap: stats.limit, maxInFlight: stats.maxInFlight, ms: stats.ms,
    })
  }
  const total = perStream.reduce((n, s) => n + s.length, 0)
  const results = interleaveStreams(perStream, total, {
    names: active.map((s) => s.name),
    label: 'runRoutedSearch',
  })
  return {
    results,
    perStream: active.map((s, i) => ({ stream: s.name, ids: perStream[i].map((r) => r.id) })),
  }
}
