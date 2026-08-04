// ─────────────────────────────────────────────────────────────────────────────
// gateway-legacy.ts — the three legacy search surfaces, repointed through
// `search-gateway.ts` (SPRINT §1).
//
// WHY THIS FILE EXISTS
//
// Until now the fast FTS index reached exactly one surface: the Lex rebuild
// (`field-machine.ts` / `orchestrator.ts`), which is preview-only and NOT
// promoted. Everything a real user touches went somewhere else entirely:
//
//   app/api/ai/[ideaId]          → searchLegislation()  (lib/search.ts, Postgres GIN
//                                  over the 914k-row legacy LegislationSection)
//   /api/ideas/[id]/legislation-search → raw SQL over the same legacy table
//   POST /api/search             → searchLegislation() again
//
// So the 17.7M-section corpus and the 94x latency fix were invisible to users.
// Worse, `lib/search.ts:buildTsQuery()` AND-joins every surviving token, which is
// how "what is the law on data protection currently?" became the hard conjunction
// `law & data & protection & current:*` and returned the Road Traffic Act — every
// token mandatory, "currently" promoted to a content term, no intent routing.
// BM25 over the corpus has neither property.
//
// THE DISCIPLINE (sprint-mandated): these callers go through the GATEWAY, never
// straight at FTS. The gateway is the single seam where expansion, routing, vector
// fusion and grouping get adopted — a caller wired directly to `runFtsSearch` would
// silently opt out of every one of them, which is the scattered-caller problem this
// repoint exists to end.
//
// WHAT IS DELIBERATELY *NOT* CHANGED: each function below returns the exact shape
// its caller already consumed. This is a retrieval swap, not a contract change —
// the UI, the Lex prompt and the response JSON all keep working unchanged. That
// keeps the blast radius at "which index answered" rather than "everything".
//
// TIER SCOPING: all three surfaces are legislation-shaped — their response types
// have `actTitle` / `sectionNumber` / `legislationGovUkId` fields with nowhere to
// put a Hansard hit, and the panel renders "Act 1988 — s.21" headers. So they pass
// `tier: 'legislation'`. That is a faithful repoint of what they did before (they
// only ever queried LegislationSection), not a narrowing of scope.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { runSearch, type SearchIntent } from './search-gateway'
import type { SearchResult } from './page1-config'

/** The corpus tier that holds Acts, SIs and retained EU law (scripts/ingest/search/corpus-map.ts). */
const LEGISLATION_TIER = 'legislation'

/** Gateway result types that are actual legislation (vs guidance/debate/caselaw). */
const LEGISLATION_TYPES = new Set(['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION'])

// ── id decomposition ─────────────────────────────────────────────────────────
// corpus_sections ids are `{corpus}:{gid}:{ref}`, e.g.
//   primary-acts-2000plus:ukpga/2011/20:schedule-24-paragraph-7
//   si-pre-2010:uksi/1999/1095:schedule-part-5-paragraph-4n19
//   eur-lex:31973R1057:1                     (CELEX — no gid slashes, no section ref)
// The legacy contracts want `legislationGovUkId` (the gid), a `sectionNumber` and a
// `year`, all of which are derivable without a second query.

/** `…:ukpga/2011/20:section-21` → `ukpga/2011/20`; CELEX-style ids → null. */
export function gidFromId(id: string): string | null {
  const parts = id.split(':')
  const gid = parts.length >= 2 ? parts[1] : null
  return gid && gid.includes('/') ? gid : null
}

/** `…:section-21` → `section-21`; whole-document rows → ''. */
function refFromId(id: string): string {
  const parts = id.split(':')
  if (parts.length < 3) return ''
  const ref = parts.slice(2).join(':').trim()
  if (!ref || ref === 'full' || ref === 'full-doc-html') return ''
  return ref.replace(/[.\s]+$/g, '')
}

/**
 * Legacy `sectionNumber` from a corpus ref.
 *
 * The legacy column held a bare number-ish token ("21", "3A"), which is what the
 * panel renders as "s.{n}" and what `buildLegislationUrl` concatenates. Corpus refs
 * are richer (`schedule-24-paragraph-7`), so:
 *   `section-21`                  → `21`          (the common case, lossless)
 *   `article-58A`                 → `58A`
 *   `schedule-24-paragraph-7`     → `schedule-24-paragraph-7`  (kept whole — there is
 *                                   no single "section number" to reduce it to, and
 *                                   truncating to `24` would cite the wrong provision)
 *   whole-document rows           → ''
 */
function sectionNumberFromRef(ref: string): string {
  if (!ref) return ''
  const simple = /^(section|regulation|article|rule|paragraph)-([0-9]+[A-Za-z]*)$/.exec(ref)
  return simple ? simple[2] : ref
}

/** `ukpga/2011/20` → 2011. Falls back to the result date, then 0. */
function yearFromGid(gid: string | null, date: string): number {
  const fromGid = gid ? /\/(\d{4})\//.exec(gid) : null
  if (fromGid) return parseInt(fromGid[1], 10)
  const fromDate = /^(\d{4})/.exec(date ?? '')
  return fromDate ? parseInt(fromDate[1], 10) : 0
}

/** Strip the FTS snippet's `<<match>>` delimiters — the legacy consumers render plain text. */
function plainSnippet(s: string): string {
  return (s ?? '').replace(/<<|>>/g, '')
}

/**
 * A title fit to be shown to a user, or handed to Lex as `actTitle`.
 *
 * `fts-search.ts` falls back to the raw CORPUS NAME when a hit has no section title
 * and no LegislationItem row — so an eur-lex hit arrives titled literally "eur-lex".
 * Down the legacy contract that string lands in `actTitle`, which the panel prints as
 * a heading and which the Lex prompt presents as the name of a piece of law. "The
 * law here is eur-lex" is a false statement in a system whose whole grounding rule is
 * that cited law must be real.
 *
 * eur-lex ids ARE the CELEX number, which is a genuine, checkable identifier, so it
 * is used rather than invented prose. Anything else falls back to the citation, then
 * to the id — never to the corpus name.
 */
function displayTitle(rawTitle: string, citation: string, id: string, gid: string | null): string {
  const corpus = id.split(':')[0]
  const looksLikeCorpusName = !rawTitle || rawTitle === corpus
  if (!looksLikeCorpusName) return rawTitle
  if (corpus === 'eur-lex') {
    const celex = id.split(':')[1]
    if (celex) return `CELEX ${celex}`
  }
  if (citation) return citation
  return gid ?? id
}

// ── shared retrieval ─────────────────────────────────────────────────────────

interface LegacyHit {
  result: SearchResult
  gid: string | null
  ref: string
  sectionNumber: string
}

/**
 * One gateway call, filtered to legislation and decomposed.
 *
 * Overscans: `groupForPanel` is not used here (these surfaces want a flat ranked
 * list, not per-type groups), but the adapter still drops corpus families with no
 * display type, so ask for headroom and slice at the end.
 */
async function legislationHits(
  query: string,
  intent: SearchIntent,
  limit: number,
): Promise<{ hits: LegacyHit[]; failed: boolean; failureReason?: string }> {
  const keywords = query.trim().split(/\s+/).filter(Boolean)
  if (!keywords.length) return { hits: [], failed: false }

  const out = await runSearch({
    keywords,
    intent,
    limit: Math.max(limit * 2, 20),
    tier: LEGISLATION_TIER,
  })

  const hits = out.results
    .filter((r) => LEGISLATION_TYPES.has(r.type))
    .slice(0, limit)
    .map((result) => {
      const gid = gidFromId(result.id)
      const ref = refFromId(result.id)
      return { result, gid, ref, sectionNumber: sectionNumberFromRef(ref) }
    })

  return { hits, failed: out.failed, failureReason: out.failureReason }
}

// ── 1. POST /api/search + app/api/ai/[ideaId] — the `lib/search.ts` contract ──

/** Byte-identical in shape to `lib/search.ts`'s SearchResult, so both callers of
 *  `searchLegislation()` swap over without touching their own mapping code. */
export interface LegacySearchResult {
  type: string
  actId: string
  actTitle: string
  sectionId: string
  sectionNumber: string
  title: string | null
  snippet: string
  rank: number
}

/**
 * Drop-in replacement for `searchLegislation({ q, limit })`, served by the corpus
 * index via the gateway.
 *
 * Differences the callers must be able to live with, stated rather than hidden:
 *  - `rank` is a BM25 score, not `ts_rank_cd`. Both are unbounded and used only for
 *    ordering here, but a `minRank` threshold tuned against ts_rank_cd does NOT
 *    transfer — so this function does not take one, and the callers stop passing it.
 *  - `totalMatches` was already documented in lib/search.ts as the window size, not a
 *    corpus count. It stays exactly that (`results.length`), with no new claim implied.
 */
export async function searchLegislationViaGateway(opts: {
  q: string
  limit?: number
  intent?: SearchIntent
}): Promise<{ results: LegacySearchResult[]; totalMatches: number; failed: boolean; failureReason?: string }> {
  const limit = opts.limit ?? 20
  const { hits, failed, failureReason } = await legislationHits(
    opts.q,
    opts.intent ?? 'LEGISLATION_SEARCH',
    limit,
  )

  const results: LegacySearchResult[] = hits.map(({ result, gid, sectionNumber }) => ({
    // The legacy `type` was a lowercased legislationType ('ukpga'/'uksi'). The gid's
    // first path segment IS that value, so this stays faithful for gid-bearing rows.
    type: gid ? gid.split('/')[0] : result.type.toLowerCase(),
    actId: gid ?? result.id,
    actTitle: displayTitle(result.title, result.citation, result.id, gid),
    sectionId: result.id,
    sectionNumber,
    title: result.citation || null,
    snippet: plainSnippet(result.snippet),
    rank: result.score,
  }))

  return { results, totalMatches: results.length, failed, failureReason }
}

// ── 2. /api/ideas/[id]/legislation-search — the LegislationPanel contract ─────

/** Exactly what `components/LegislationPanel.tsx` consumes today. */
export interface PanelResult {
  id: string
  sectionNumber: string
  sectionTitle: string | null
  compiledText: string | null
  lexSummary: string | null
  isTnaVerified: boolean
  actTitle: string
  year: number
  legislationGovUkId: string
  amendmentCount: number
  confidence: string | null
  tags: string[]
}

/**
 * Panel search: ranking comes from the corpus index, the rich per-section display
 * fields are ENRICHED from the legacy tables where a matching row still exists.
 *
 * Why enrich rather than drop: the panel renders compiled text, a plain-English Lex
 * summary, a TNA-verified badge, amendment counts and tags. None of those live in
 * `corpus_sections` (it stores pointers and FTS fields — see docs/CLAUDE.md §6), and
 * the audit measured `compiledTextKey` as populated for only 2.7% of legacy rows
 * anyway. So: rank on the good index, then left-join the legacy row by
 * (legislationGovUkId, sectionNumber) and fill in what it has.
 *
 * Where there is no legacy row, the fields come back null/0 and the panel degrades to
 * title + snippet — which is strictly more than it could show before, because before
 * the result simply would not have been found. The snippet is used as `compiledText`
 * so the card is never blank; it is the matched fragment, not the full provision, and
 * the panel already labels that region as compiled text rather than quoting it as
 * statutory wording.
 */
export async function searchPanelViaGateway(query: string, limit: number): Promise<{
  results: PanelResult[]
  failed: boolean
  failureReason?: string
}> {
  const { hits, failed, failureReason } = await legislationHits(query, 'LEGISLATION_PANEL', limit)
  if (!hits.length) return { results: [], failed, failureReason }

  // ONE batched lookup for the legacy enrichment rows.
  //
  // Queried as two INs (gid set × sectionNumber set) rather than an OR of exact
  // pairs: an OR-of-pairs degrades into a per-pair scan, while both INs ride the
  // existing indexes. It can over-fetch — a section "21" belonging to a different
  // Act in the same result set — so the exact pair match is re-applied in memory
  // via `legacyByKey`, which is keyed on gid AND sectionNumber. Bounded by `limit`
  // (≤10 for this route), so the over-fetch is small by construction.
  const pairs = hits.filter((h) => h.gid && h.sectionNumber)
  const gids = [...new Set(pairs.map((h) => h.gid!))]
  const sectionNumbers = [...new Set(pairs.map((h) => h.sectionNumber))]
  const legacyRows = pairs.length
    ? await prisma.legislationSection.findMany({
        where: {
          sectionNumber: { in: sectionNumbers },
          legislationItem: { legislationGovUkId: { in: gids } },
        },
        select: {
          sectionNumber: true,
          sectionTitle: true,
          compiledTextKey: true,
          lexSummaryKey: true,
          compiledBy: true,
          amendmentCount: true,
          confidence: true,
          tags: true,
          legislationItem: { select: { legislationGovUkId: true, title: true, year: true } },
        },
      })
    : []

  const legacyByKey = new Map(
    legacyRows.map((r) => [`${r.legislationItem.legislationGovUkId}::${r.sectionNumber}`, r]),
  )

  // R2 hydration, same as the route did before — but only for rows that have a key.
  const results = await Promise.all(
    hits.map(async ({ result, gid, sectionNumber }): Promise<PanelResult> => {
      const legacy = gid ? legacyByKey.get(`${gid}::${sectionNumber}`) : undefined
      const [compiledText, lexSummary] = await Promise.all([
        legacy?.compiledTextKey ? r2Get(legacy.compiledTextKey) : Promise.resolve(null),
        legacy?.lexSummaryKey ? r2Get(legacy.lexSummaryKey) : Promise.resolve(null),
      ])
      return {
        id: result.id,
        sectionNumber,
        sectionTitle: legacy?.sectionTitle ?? (result.citation || null),
        compiledText: compiledText ?? plainSnippet(result.snippet),
        lexSummary,
        isTnaVerified: legacy?.compiledBy === 'tna-direct',
        actTitle: legacy?.legislationItem.title ?? displayTitle(result.title, result.citation, result.id, gid),
        year: legacy?.legislationItem.year ?? yearFromGid(gid, result.date),
        legislationGovUkId: gid ?? '',
        amendmentCount: legacy?.amendmentCount ?? 0,
        confidence: legacy?.confidence ?? null,
        tags: legacy?.tags ?? [],
      }
    }),
  )

  return { results, failed, failureReason }
}
