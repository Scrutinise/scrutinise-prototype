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
  /**
   * Collections this stream also retrieves that DO NOT sit under its `tier` in the built index.
   * Retrieved by a SECOND, corpus-only prefiltered call, merged with the main leg (query-router.ts).
   *
   * ⚠ WHY THIS AXIS HAS TO EXIST, and why it is not just a bad tier map. The tier is BAKED INTO
   * THE INDEX at build time and the server-side prefilter matches against the index, not against
   * `tierFor()` as it reads today. So a collection seeded after the tier map last covered it
   * carries `other` in the index forever, and no stream can select it however the map is edited —
   * only a full reindex moves it. `CORPUS_DISPLAY_OVERRIDE` in corpus-type-map.ts already corrects
   * the same staleness on the *display type* axis; this is the same correction on the *prefilter*
   * axis, and without it a display override produces a correctly-typed row that no stream can
   * retrieve — which is exactly the state erskine-may was in.
   *
   * ⚠ KEEP IT SMALL, AND KEEP IT NAMED. Each entry costs one extra retrieval call on every query
   * routed to that stream. It is a bridge to the next reindex, not a second way to define a
   * stream: the durable fix is `tierFor()` plus a rebuild, after which the entry is deleted.
   */
  extraCorpora?: string[]
}

export const STREAM_SCOPES: StreamScope[] = [
  { name: 'legislation', tier: 'legislation' },
  // `scottish-parliament-or` — 1,044,188 sections, 86% of the whole reachability gap S2C measured.
  // Same shape as erskine-may: already display-typed DEBATE, indexed under tier `other`, so no
  // stream could select it. Added 2026-08-10 on Charlie's decision (S2C2 §3) and shipped WITH a
  // before-and-after, not as a config line — it changes what the debates stream returns for every
  // query. Contamination and latency numbers are in CHANGE_LOG 2026-08-10.
  { name: 'debates', tier: 'parliamentary', types: ['DEBATE'], excludeCorpora: NON_DEBATE_PARLIAMENTARY, extraCorpora: ['scottish-parliament-or'] },
  { name: 'committees', tier: 'parliamentary', types: ['COMMITTEE'], corpora: COMMITTEE_CORPORA },
  { name: 'caselaw', tier: 'caselaw' },
  // `erskine-may` (1,873 indexed rows) is parliamentary PROCEDURE — what the House can and cannot
  // do with a proposal — and answers a narrow but real class of question for someone trying to
  // move one. It is indexed under tier `other`, so it joins here rather than through the tier.
  // ⚠ `scottish-parliament-or` is the same shape at 550× the size (1,044,188 sections, 83% of the
  // whole reachability gap) and is NOT listed: it is display-typed DEBATE, so it would join the
  // debates stream, and changing what a million sections do to that stream's results is a
  // measurement and a decision, not a line in a list. S2C reports it; Charlie decides it.
  { name: 'guidance', tier: 'guidance', extraCorpora: ['erskine-may'] },
]

/**
 * Could `stream` return a row of this corpus, sitting under this INDEXED tier, displayed as this
 * type? Pure set arithmetic over the scope — the same filters the retrieval path applies, in the
 * same order:
 *   1. `extraCorpora` — the second, corpus-only leg, which skips the tier prefilter entirely,
 *   2. the server-side tier prefilter,
 *   3. the server-side corpus prefilter (include list or exclude list),
 *   4. the client-side display-type filter (`types`), which is the backstop in query-router.ts.
 * A null `type` means the FTS adapter dropped the row before any stream saw it, so it is not
 * reachable by anything — and that is checked first, because it is true of every stream at once.
 */
export function streamCanSelect(
  scope: StreamScope,
  corpus: string,
  indexedTier: string,
  type: SearchResultType | null,
): boolean {
  if (type === null) return false
  // The extra leg is corpus-only: it does not pass `tier`, so the indexed tier is irrelevant to
  // it. `types` still applies — it is a client-side filter over whatever both legs return.
  if (scope.extraCorpora?.includes(corpus)) return !scope.types || scope.types.includes(type)
  if (indexedTier !== scope.tier) return false
  if (scope.corpora && !scope.corpora.includes(corpus)) return false
  if (scope.excludeCorpora && scope.excludeCorpora.includes(corpus)) return false
  if (scope.types && !scope.types.includes(type)) return false
  return true
}
