// stream-scopes.ts — WHICH PART OF THE CORPUS each router stream can reach.
//
// Extracted from query-router.ts on 2026-08-09 (BRIEF_SEARCH_S2B §1) because it now has a second
// reader: `scripts/ingest/search/corpus-reachability.ts`, which computes, per collection, whether
// any stream can select it at all. That measurement is worthless if it is taken against a COPY of
// this table — a copy is how the matrix would keep saying "reachable" for a month after someone
// narrowed a filter. So the scopes live here, with no runtime imports, and both readers take the
// same object.
//
// Runtime-dependency-free ON PURPOSE. query-router.ts pulls in the FTS client, the vector client,
// fusion and Prisma; the reachability script runs under `scripts/ingest`, outside the Next.js
// path alias, and could not import any of that. Every import below is `import type`, so this
// module compiles away to a single array of plain data.

import type { SearchResultType } from './page1-config'

/** The stream names the router can address today. Declared HERE, next to the scopes, and
 *  re-exported by query-expansion.ts (which owns the LLM decision that produces them). It used
 *  to live there, which meant anything wanting the name list imported a Gemini client. */
export type RouterStreamName = 'legislation' | 'debates' | 'committees' | 'caselaw' | 'guidance'

/**
 * COMMITTEE / DEBATE corpora, kept next to each other because they are complements and must
 * stay so. corpus-type-map.ts maps `corpus.startsWith('committees')` → COMMITTEE within the
 * parliamentary tier; everything else in that tier is DEBATE apart from a handful of BILL /
 * TREATY / null corpora, which the debates stream excludes here for the same reason it always
 * dropped them client-side.
 *
 * Listed explicitly rather than by prefix because the filter is a SQL `IN` evaluated in the
 * index, and because a new `committees-*` corpus should be a deliberate addition here rather
 * than something that silently joins a stream on the strength of its name.
 *
 * ⚠ The complement form has a cost the reachability matrix made visible: every corpus named in
 * NON_DEBATE_PARLIAMENTARY that is NOT in COMMITTEE_CORPORA is in the parliamentary tier and in
 * NEITHER stream — no router stream can select it, whatever the query. That is a deliberate
 * exclusion for `bills-api`/`uk-treaties`/`tax-treaties-dta`/`members-interests`/`erskine-may`
 * and it is the right default; it is also invisible unless something counts it, which is the
 * job of docs/CORPUS_REACHABILITY.md.
 */
export const COMMITTEE_CORPORA = ['committees-reports', 'committees-evidence']
export const NON_DEBATE_PARLIAMENTARY = [
  ...COMMITTEE_CORPORA, 'bills-api', 'uk-treaties', 'tax-treaties-dta', 'members-interests', 'erskine-may',
]

/** What one stream is allowed to retrieve. Mirrors the `tier`/`corpora`/`excludeCorpora`/`types`
 *  fields of StreamConfig; the `search` function stays in query-router.ts because it is code. */
export interface StreamScope {
  name: RouterStreamName
  /** FTS tier value passed to the server-side tier filter. Matched against the tier BAKED INTO
   *  THE INDEX at build time — not against `tierFor(corpus)` as it reads today. A corpus seeded
   *  after the tier map last changed carries the old tier in the live index, and the router
   *  filters on the index. */
  tier: string
  /** Further restricts to these display types — needed only when a tier is shared by more than
   *  one stream (parliamentary → debates vs committees). Absent = every type the tier yields. */
  types?: SearchResultType[]
  /** Server-side corpus PREfilter — the real stream boundary when a tier is shared. */
  corpora?: string[]
  /** Server-side corpus prefilter, complement form — "the rest of the tier". */
  excludeCorpora?: string[]
}

export const STREAM_SCOPES: StreamScope[] = [
  { name: 'legislation', tier: 'legislation' },
  { name: 'debates', tier: 'parliamentary', types: ['DEBATE'], excludeCorpora: NON_DEBATE_PARLIAMENTARY },
  { name: 'committees', tier: 'parliamentary', types: ['COMMITTEE'], corpora: COMMITTEE_CORPORA },
  { name: 'caselaw', tier: 'caselaw' },
  { name: 'guidance', tier: 'guidance' },
]

/**
 * Could `stream` return a row of this corpus, sitting under this INDEXED tier, displayed as this
 * type? Pure set arithmetic over the scope — the same three filters the retrieval path applies,
 * in the same order:
 *   1. the server-side tier prefilter,
 *   2. the server-side corpus prefilter (include list or exclude list),
 *   3. the client-side display-type filter (`types`), which is the backstop in query-router.ts.
 * A null `type` means the FTS adapter dropped the row before any stream saw it, so it is not
 * reachable by anything.
 */
export function streamCanSelect(
  scope: StreamScope,
  corpus: string,
  indexedTier: string,
  type: SearchResultType | null,
): boolean {
  if (type === null) return false
  if (indexedTier !== scope.tier) return false
  if (scope.corpora && !scope.corpora.includes(corpus)) return false
  if (scope.excludeCorpora && scope.excludeCorpora.includes(corpus)) return false
  if (scope.types && !scope.types.includes(type)) return false
  return true
}
