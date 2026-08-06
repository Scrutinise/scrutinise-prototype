/**
 * fts-core.ts — the pure BM25-search + query-time title-boost re-rank, shared by
 * the query service (HTTP) and the scoring harness (in-process). No side effects
 * on import (the query service's main() must not run when the harness imports).
 *
 * Title-boost rationale: see fts-query-service.ts header / FTS_BUILD_S1b §1.1.
 */
import { lancedb } from './lance'
import { ActIndex, parseCitation, resolveCitation, idPatternsFor } from './citation-resolver'

export const TITLE_BOOST = parseFloat(process.env.FTS_TITLE_BOOST ?? '2.5')
export const OVERSCAN = parseInt(process.env.FTS_OVERSCAN ?? '5', 10)
// Citation queries favour the legislation tier in the BM25 remainder (the brief's
// "favour the legislation tier for citation-style queries"). The exact section is
// pinned by the resolver; this lifts the SECONDARY legislation sources (e.g. the
// other regs of the cited act) above parliamentary chatter.
export const CITATION_TIER_BOOST = parseFloat(process.env.FTS_CITATION_TIER_BOOST ?? '1.6')
// Concept/keyword (NON-citation) queries under-surface the legislation tier: legislation
// section bodies usually have NULL sectionTitles, so they miss the ~2.5× title-boost that
// lifts titled parliamentary/guidance rows — pushing genuine anchor Acts/SIs out of the
// top-20 EVEN WHEN BM25 retrieved them (Finding B diag, 2026-06-24: for the MiFID concept
// query, FSMA 2000 / the 2017 MiFID SIs / retained MiFIR were all in the candidate set —
// MiFIR at cand#1 — yet only 1 legislation row reached the top-20). A modest legislation
// boost on the keyword path re-ranks them up. It is MULTIPLICATIVE on the BM25 body score,
// so it only moves rows BM25 ALREADY retrieved — it can never inject an irrelevant Act
// (a boost, not a reserved slot). Inert on lay-phrased queries whose anchor Act never
// entered the candidate set (vocabulary mismatch — that's the vector layer's job).
export const LEX_LEG_TIER_BOOST = parseFloat(process.env.FTS_LEX_LEG_TIER_BOOST ?? '1.8')
// How many exact / act-level rows the resolver may inject at the top.
const RESOLVE_EXACT_MAX = 4
const RESOLVE_ACTLEVEL_MAX = 12

/**
 * How a search is SCOPED TO A STREAM, server-side, at the query.
 *
 * WHY THIS EXISTS (2026-08-06). Four of the five streams were already scoped correctly by
 * `tier` alone, because their tier maps to exactly one stream. The two that share the
 * `parliamentary` tier — debates and committees — were not: they retrieved broadly across the
 * whole 14.17M-row tier and were separated AFTERWARDS, client-side, by display type in
 * query-router.ts.
 *
 * That is not merely inelegant, it is lossy, and the loss is invisible. `rankedSearch` slices
 * to `limit` BEFORE returning, so any committee document ranked below the cutoff is gone before
 * the client-side filter ever sees it. Committee content is 1.17% of the tier, so the cutoff
 * falls overwhelmingly on Hansard and the surviving committee rows are whatever happened to
 * rank high — for the Carillion question, nothing at all (GOLD_TEST_09).
 *
 * A `corpus` prefilter puts the stream's own subset in front of BM25, so the top-N is computed
 * WITHIN the stream rather than sampled from outside it. Same argument, and the same wording,
 * as vector-core.ts's note on why the tier filter must be a prefilter rather than a postfilter.
 */
export interface SearchScope {
  tier?: string
  /** Restrict to these corpora exactly (server-side prefilter). */
  corpora?: string[]
  /** Exclude these corpora (server-side prefilter). The complement form, for debates. */
  excludeCorpora?: string[]
}

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`

/**
 * Scope → a SQL predicate, or null when the scope is empty.
 *
 * Returned as ONE clause used by BOTH the BM25 query and the citation resolver's injection
 * fetch. The resolver previously fetched by `id LIKE` with no scope predicate at all, so a
 * citation-shaped query against the committees or debates stream could inject LEGISLATION rows
 * into a parliamentary-scoped result — a scoping hole that would have survived this whole fix
 * and quietly re-widened the very stream it is meant to narrow.
 */
export function scopePredicate(scope: SearchScope): string | null {
  const parts: string[] = []
  if (scope.tier) parts.push(`tier = ${sqlStr(scope.tier)}`)
  if (scope.corpora?.length) parts.push(`corpus IN (${scope.corpora.map(sqlStr).join(', ')})`)
  if (scope.excludeCorpora?.length) parts.push(`corpus NOT IN (${scope.excludeCorpora.map(sqlStr).join(', ')})`)
  return parts.length ? parts.join(' AND ') : null
}

export type Hit = {
  id: string; corpus: string; tier: string; jurisdiction: string
  sectionTitle: string | null; itemDate: string | null; speaker: string | null
  parentDocId: string | null; score: number; bodyScore: number; titleBoosted: boolean
  resolved: boolean
  body: string; snippet: string
}

export function queryTerms(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
}

function toHit(r: any, score: number, bodyScore: number, titleBoosted: boolean, resolved: boolean): Hit {
  const body = (r.body ?? '') as string
  return {
    id: r.id, corpus: r.corpus, tier: r.tier, jurisdiction: r.jurisdiction,
    sectionTitle: (r.sectionTitle ?? null) as string | null,
    itemDate: r.itemDate ?? null, speaker: r.speaker ?? null, parentDocId: r.parentDocId ?? null,
    score, bodyScore, titleBoosted, resolved,
    body, snippet: body.slice(0, 300).replace(/\s+/g, ' ').trim(),
  }
}

/** Known-item citation resolver: parse the query, resolve the act → gid, fetch the
 *  exact section (and a few act-level leaves) by id. Returns [] when the query is
 *  not a citation or the act doesn't resolve. */
async function resolveInjections(table: lancedb.Table, query: string, actIndex?: ActIndex, scope: SearchScope = {}): Promise<Hit[]> {
  if (!actIndex) return []
  const parsed = parseCitation(query)
  if (!parsed) return []
  const r = resolveCitation(parsed, actIndex)
  if (!r) return []
  const pats = idPatternsFor(r)
  const out: Hit[] = []
  const seen = new Set<string>()
  const scoped = scopePredicate(scope)
  const fetch = async (like: string, max: number) => {
    // Scope the injection the same way the BM25 half is scoped. Without this the resolver is a
    // hole straight through the stream boundary: it injects rows ABOVE the BM25 list, so an
    // out-of-scope injection does not merely appear, it appears FIRST.
    const where = scoped ? `id LIKE '${like}' AND ${scoped}` : `id LIKE '${like}'`
    const rows = (await table.query().where(where).limit(max).toArray()) as any[]
    for (const row of rows) { if (!seen.has(row.id)) { seen.add(row.id); out.push(toHit(row, 0, 0, false, true)) } }
  }
  if (pats.exact) {
    // Exact ref given (e.g. "section 149"): inject ONLY that section and let BM25
    // fill the rest — flooding the top with arbitrary same-act leaves would just
    // displace the genuinely-relevant secondary sources.
    await fetch(pats.exact, RESOLVE_EXACT_MAX)
  } else {
    // Act-level query ("Working Time Regulations 1998"): surface the act's leaves
    // (capped) so at least some of it lands in the top-20.
    await fetch(pats.actLevel, RESOLVE_ACTLEVEL_MAX)
  }
  return out
}

export async function rankedSearch(
  table: lancedb.Table,
  query: string,
  opts: { tier?: string; limit?: number; actIndex?: ActIndex; corpora?: string[]; excludeCorpora?: string[] } = {},
): Promise<Hit[]> {
  const limit = opts.limit ?? 20
  const k = Math.max(limit * OVERSCAN, 100)
  const scope: SearchScope = { tier: opts.tier, corpora: opts.corpora, excludeCorpora: opts.excludeCorpora }
  const scoped = scopePredicate(scope)
  // queryType MUST be 'fts' (+ the indexed column) — a string query with the wrong
  // type falls through to vector search ("No embedding functions are defined").
  let q = table.search(query, 'fts', 'body').limit(k)
  if (scoped) q = (q as any).where(scoped)
  const rows = await q.toArray()

  const terms = queryTerms(query)
  const isCitation = !!opts.actIndex && !!parseCitation(query)
  const bm25: Hit[] = rows.map((r: any) => {
    const bodyScore = typeof r._score === 'number' ? r._score : 0
    const title = (r.sectionTitle ?? null) as string | null
    const titleBoosted = !!title && terms.some((t) => title.toLowerCase().includes(t))
    const tierBoost = r.tier === 'legislation'
      ? (isCitation ? CITATION_TIER_BOOST : LEX_LEG_TIER_BOOST)
      : 1
    return toHit(r, bodyScore * (titleBoosted ? TITLE_BOOST : 1) * tierBoost, bodyScore, titleBoosted, false)
  })
  bm25.sort((a, b) => b.score - a.score)

  // Known-item resolver: inject exact-citation rows ABOVE the BM25 list. Scored
  // just above the top BM25 hit, preserving the resolver's own order (exact first).
  const injected = await resolveInjections(table, query, opts.actIndex, scope)
  if (injected.length) {
    const topScore = bm25.length ? bm25[0].score : 1
    injected.forEach((h, i) => { h.score = topScore + (injected.length - i) })
    const injectedIds = new Set(injected.map((h) => h.id))
    const merged = [...injected, ...bm25.filter((h) => !injectedIds.has(h.id))]
    return merged.slice(0, limit)
  }
  return bm25.slice(0, limit)
}
