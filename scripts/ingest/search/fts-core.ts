/**
 * fts-core.ts — the pure BM25-search + query-time title-boost re-rank, shared by
 * the query service (HTTP) and the scoring harness (in-process). No side effects
 * on import (the query service's main() must not run when the harness imports).
 *
 * Title-boost rationale: see fts-query-service.ts header / FTS_BUILD_S1b §1.1.
 */
import { lancedb } from './lance'

export const TITLE_BOOST = parseFloat(process.env.FTS_TITLE_BOOST ?? '2.5')
export const OVERSCAN = parseInt(process.env.FTS_OVERSCAN ?? '5', 10)

export type Hit = {
  id: string; corpus: string; tier: string; jurisdiction: string
  sectionTitle: string | null; itemDate: string | null; speaker: string | null
  parentDocId: string | null; score: number; bodyScore: number; titleBoosted: boolean
  body: string; snippet: string
}

export function queryTerms(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
}

export async function rankedSearch(
  table: lancedb.Table,
  query: string,
  opts: { tier?: string; limit?: number } = {},
): Promise<Hit[]> {
  const limit = opts.limit ?? 20
  const k = Math.max(limit * OVERSCAN, 100)
  // queryType MUST be 'fts' (+ the indexed column) — a string query with the wrong
  // type falls through to vector search ("No embedding functions are defined").
  let q = table.search(query, 'fts', 'body').limit(k)
  if (opts.tier) q = (q as any).where(`tier = '${opts.tier.replace(/'/g, "''")}'`)
  const rows = await q.toArray()

  const terms = queryTerms(query)
  const hits: Hit[] = rows.map((r: any) => {
    const bodyScore = typeof r._score === 'number' ? r._score : 0
    const title = (r.sectionTitle ?? null) as string | null
    const titleBoosted = !!title && terms.some((t) => title.toLowerCase().includes(t))
    const body = (r.body ?? '') as string
    return {
      id: r.id, corpus: r.corpus, tier: r.tier, jurisdiction: r.jurisdiction,
      sectionTitle: title, itemDate: r.itemDate ?? null, speaker: r.speaker ?? null,
      parentDocId: r.parentDocId ?? null,
      bodyScore,
      score: bodyScore * (titleBoosted ? TITLE_BOOST : 1),
      titleBoosted,
      body,
      snippet: body.slice(0, 300).replace(/\s+/g, ' ').trim(),
    }
  })
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}
