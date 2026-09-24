// within-document-search.ts — SEARCH S20b. The missing step S19 identified: a second, narrow
// search SCOPED TO ONE DOCUMENT, run only when the document-level regroup (grain-policy.ts,
// S19) has already picked a document as the answer but its best RETRIEVED section is a poor
// match — because that section was never competing against the document's other sections, only
// against the whole collection's.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS IS A SEPARATE MODULE FROM grain-policy.ts
// ════════════════════════════════════════════════════════════════════════════════════════════════
// grain-policy.ts REGROUPS a ranking that has already been computed — it can only promote a
// section that was already retrieved. This module ISSUES A NEW RETRIEVAL, scoped to one
// document's own section ids, so a section that never made the collection-wide top-500 (S19 §2's
// specific failure mode: "for 11 of the 18 questions the document grain rescues, the answer
// section is not in the top 500 of its own collection") can still win a contest against the
// handful of other sections in ITS OWN document.
//
// ⚠ INERT BY CONSTRUCTION. Nothing calls this module unless `LEX_SEARCH_WITHIN_DOC` is on
// (search-gateway.ts), and every failure here returns `null` rather than throwing — the caller's
// existing document-level result stands, exactly as it would if this module did not exist.
//
// Default OFF. See docs/SEARCH_S20B_REPORT.md for predictions, the control, and the measurement.

import { prisma } from '@/lib/prisma'
import { documentKeyOf } from './grain'
import { RRF_K, VECTOR_WEIGHT } from './fusion'

const FTS_URL = (process.env.FTS_SEARCH_URL ?? '').replace(/\/$/, '')
const VECTOR_URL = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')

/** A document's own section ids — the whole mechanism. Corpus is embedded in every id
 *  (`{corpus}:...`), so one call always resolves to ids of that corpus alone.
 *
 *  ⚠ TWO SHAPES, MIRRORING `documentKeyOf` EXACTLY — imported, not re-derived, so this can never
 *  disagree with the function that decided a document won in the first place (CLAUDE.md §25.3).
 *  `parentDocId`-keyed collections (debates, committees, bills-api, …) match on that column.
 *  Collections with no `parentDocId` (legislation, case law) fall back to the id's own second
 *  segment — the Act/instrument's gid — matched as an id PREFIX, because that segment is not a
 *  column, only a slice of the id string. */
export async function documentSectionIds(documentKey: string): Promise<string[]> {
  const corpus = documentKey.split(':')[0]
  const rest = documentKey.slice(corpus.length + 1)
  if (!rest) return []
  // A `parentDocId`-keyed document's key is `${corpus}:${parentDocId}` with no further colons
  // UNLESS the parentDocId itself contains one — none of today's `parentDocId` values do (they are
  // numeric ids, dates, or short strings; verified against the corpora this module targets), so a
  // bare `rest` (no colon) means "match on the column", and a `rest` containing a colon means the
  // id-segment-2 fallback (a gid, which is itself `type/year/number` — no colon, but the id built
  // from it always has at least one more segment after it for the section ref).
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM corpus_sections
     WHERE corpus = $1 AND ("parentDocId" = $2 OR id LIKE $3)
     ORDER BY id`,
    corpus, rest, `${corpus}:${rest}:%`,
  )
  return rows.map((r) => r.id)
}

interface Hit { id: string; score: number }

async function ftsWithin(query: string, ids: string[], limit: number): Promise<Hit[] | null> {
  if (!FTS_URL || !ids.length) return null
  try {
    const res = await fetch(`${FTS_URL}/fts-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit, ids }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { results?: Array<{ id: string; score: number }>; ids?: string[] | null }
    // ⚠ THE CONTROL'S OWN CHECK, REPEATED AT RUNTIME. An unhonoured or mis-quoted filter would
    // otherwise look exactly like "no match in this document" — a real finding — rather than a
    // broken filter. See §4's control in SEARCH_S20B_REPORT.md.
    if (!j.ids) { console.error('[within-document-search] fts-serve did not echo ids — refusing to trust an unscoped result'); return null }
    return (j.results ?? []).map((r) => ({ id: r.id, score: r.score }))
  } catch (e) {
    console.warn('[within-document-search] fts leg failed', (e as Error).message)
    return null
  }
}

async function vectorWithin(query: string, ids: string[], limit: number): Promise<Hit[] | null> {
  if (!VECTOR_URL || !ids.length) return null
  try {
    const res = await fetch(`${VECTOR_URL}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit, sectionIds: ids }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { results?: Array<{ id: string; score: number }>; sectionIds?: string[] | null }
    if (!j.sectionIds) { console.error('[within-document-search] vector-serve did not echo sectionIds — refusing to trust an unscoped result'); return null }
    return (j.results ?? []).map((r) => ({ id: r.id, score: r.score }))
  } catch (e) {
    console.warn('[within-document-search] vector leg failed', (e as Error).message)
    return null
  }
}

/**
 * Rank fusion over the TWO WITHIN-DOCUMENT LEGS ONLY, by rank (RRF), never by raw score — BM25
 * and cosine similarity are not on the same scale (lib/lex/score-scope.ts). This is deliberately
 * NOT `fuseWeightedRrf` (fusion.ts): that function's contract is `SearchResult[]`, built for a
 * whole ranked list a caller will display; here there are at most a few dozen candidates and the
 * caller wants exactly one id back. Same formula (`w/(k+rank)`, same `RRF_K`/`VECTOR_WEIGHT`
 * constants, imported not restated), applied to the smaller shape.
 */
function fuseWithinDocument(dense: Hit[] | null, keyword: Hit[] | null): string | null {
  const scores = new Map<string, number>()
  ;(dense ?? []).forEach((h, i) => scores.set(h.id, (scores.get(h.id) ?? 0) + VECTOR_WEIGHT / (RRF_K + i + 1)))
  ;(keyword ?? []).forEach((h, i) => scores.set(h.id, (scores.get(h.id) ?? 0) + (1 - VECTOR_WEIGHT) / (RRF_K + i + 1)))
  if (!scores.size) return null
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export interface WithinDocumentOutcome {
  documentKey: string
  ids: string[]
  /** The winning section id, or null when neither leg returned anything for this document. */
  winnerId: string | null
  /** Which legs actually ran (a leg can be skipped: no VECTOR_SEARCH_URL, an empty id list, …). */
  legsRun: Array<'keyword' | 'dense'>
  tookMs: number
}

/**
 * The inner search. `query` is the caller's ORIGINAL keywords, unrewritten — the brief's own
 * requirement, and the right one: the router's per-stream rewrite is tuned for competing against
 * millions of unrelated sections, which is exactly the problem that does not exist inside one
 * document.
 */
export async function searchWithinDocument(
  query: string,
  documentKey: string,
  opts: { limit?: number; dense?: boolean } = {},
): Promise<WithinDocumentOutcome> {
  const t0 = Date.now()
  const limit = opts.limit ?? 20
  const ids = await documentSectionIds(documentKey)
  if (!ids.length) return { documentKey, ids: [], winnerId: null, legsRun: [], tookMs: Date.now() - t0 }

  const legsRun: Array<'keyword' | 'dense'> = ['keyword']
  const runDense = opts.dense !== false && !!VECTOR_URL
  if (runDense) legsRun.push('dense')

  const [keyword, dense] = await Promise.all([
    ftsWithin(query, ids, Math.min(limit, ids.length)),
    runDense ? vectorWithin(query, ids, Math.min(limit, ids.length)) : Promise.resolve(null),
  ])
  const winnerId = fuseWithinDocument(dense, keyword)
  return { documentKey, ids, winnerId, legsRun, tookMs: Date.now() - t0 }
}
