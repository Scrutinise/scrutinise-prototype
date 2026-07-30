// query-router.ts — the deterministic half of query routing (§ CC brief "build the
// query router"). query-expansion.ts's routeQuery() is the ONLY AI judgement: it
// decides which streams are relevant and writes each one's tailored query string.
// Everything here runs AFTER that call and contains no AI judgement at all — it is
// pure dispatch, config-driven, so adding a stream later (guidance, the web/X
// layer, principle streams, the graph) means adding a list entry, not touching
// this file's logic.
//
// Today's four streams share ONE underlying retrieval call (runFtsSearch, tier-
// filtered — the same filter mechanism already proven in the scoped B1/B3 test
// and already live on the wire via fts-query-service.ts's `tier` param). debates
// and committees share the FTS tier `parliamentary`; corpusToType's existing
// type split (already computed by runFtsSearch on every hit) is reused to
// separate them rather than inventing a second filter axis server-side.

import type { SearchResult, SearchResultType } from './page1-config'
import { runFtsSearch } from './fts-search'
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

export const STREAMS: StreamConfig[] = [
  { name: 'legislation', tier: 'legislation', search: ftsStream('legislation') },
  { name: 'debates', tier: 'parliamentary', types: ['DEBATE'], search: ftsStream('parliamentary', ['DEBATE']) },
  { name: 'committees', tier: 'parliamentary', types: ['COMMITTEE'], search: ftsStream('parliamentary', ['COMMITTEE']) },
  { name: 'caselaw', tier: 'caselaw', search: ftsStream('caselaw') },
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
