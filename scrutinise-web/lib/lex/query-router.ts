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
import type { RouteResult, RouterStreamName } from './query-expansion'

export interface StreamConfig {
  name: RouterStreamName
  /** FTS tier value passed to runFtsSearch's server-side tier filter. */
  tier: string
  /** When set, further restricts results to these display types — needed only
   *  when a tier is shared by more than one stream (parliamentary → debates
   *  vs committees). Absent = every type the tier yields belongs to this stream. */
  types?: SearchResultType[]
  /** The stream's own retrieval call. Defaults differ only in tier/types today;
   *  a future non-FTS stream (web/X, graph) would supply a different function. */
  search: (query: string, limit: number) => Promise<SearchResult[]>
}

function ftsStream(tier: string, types?: SearchResultType[]) {
  return async (query: string, limit: number): Promise<SearchResult[]> => {
    const { results } = await runFtsSearch([query], limit, tier)
    return types ? results.filter((r) => types.includes(r.type)) : results
  }
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
 * The dense call is tier-scoped SERVER-side (a prefilter over corpus_vec). Filtering here
 * instead would keep whatever fraction of an unscoped ANN result happened to be legislation —
 * 8.6% of the index — and would look like weak recall rather than a scoping bug.
 */
function fusedStream(name: string, tier: string, types?: SearchResultType[]) {
  const bm25Only = ftsStream(tier, types)
  return async (query: string, limit: number): Promise<SearchResult[]> => {
    // Keyed on the STREAM NAME, not the tier. `debates` and `committees` both sit on the
    // `parliamentary` tier and are separated downstream by display type, so a tier-keyed flag
    // could not enable one without the other — and the two streams have entirely different
    // evidence behind them. Name-keying keeps the blast radius one stream wide.
    if (!vectorStreams().has(name)) return bm25Only(query, limit)
    const [bm25, dense] = await Promise.all([
      bm25Only(query, limit),
      runVectorSearch([query], limit, tier).catch(() => ({ results: [] as SearchResult[] })),
    ])
    const vec = types ? dense.results.filter((r) => types.includes(r.type)) : dense.results
    if (!vec.length) return bm25
    const fused = fuseWeightedRrf(vec, bm25).slice(0, Math.max(limit, bm25.length))
    console.log('[query-router] per-stream fusion', { stream: name, tier, bm25: bm25.length, vector: vec.length, fused: fused.length, weight: VECTOR_WEIGHT })
    return fused
  }
}

export const STREAMS: StreamConfig[] = [
  // Every stream can now fuse, but each is INERT unless LEX_VECTOR_STREAMS names it by name.
  // An unnamed stream calls exactly the ftsStream it always did (fusedStream delegates
  // straight to it), so "nothing else changed" stays structural rather than a thing to test.
  { name: 'legislation', tier: 'legislation', search: fusedStream('legislation', 'legislation') },
  { name: 'debates', tier: 'parliamentary', types: ['DEBATE'], search: fusedStream('debates', 'parliamentary', ['DEBATE']) },
  { name: 'committees', tier: 'parliamentary', types: ['COMMITTEE'], search: fusedStream('committees', 'parliamentary', ['COMMITTEE']) },
  { name: 'caselaw', tier: 'caselaw', search: fusedStream('caselaw', 'caselaw') },
  { name: 'guidance', tier: 'guidance', search: fusedStream('guidance', 'guidance') },
]

/**
 * Dispatch a router decision to only the streams it named, each with its own
 * tailored query. Pure fan-out + concat — no ranking judgement here; the
 * gateway's existing groupForPanel already re-sorts by score and buckets by
 * display type downstream, so cross-stream ordering doesn't need to be decided
 * twice.
 */
export async function runRoutedSearch(route: RouteResult, limit: number): Promise<SearchResult[]> {
  const active = STREAMS.filter((s) => route[s.name])
  const perStream = await Promise.all(active.map((s) => s.search(route[s.name]!, limit)))
  return perStream.flat()
}
