/**
 * vector-core.ts — shared query-side vector retrieval (used by vector-query-service.ts).
 *
 * Two pieces:
 *   1. embedQuery(text) — embed a LIVE user query. Uses the SYNCHRONOUS embedContent
 *      path (not the Batch API): a single real-time query, negligible cost, with the
 *      RETRIEVAL_QUERY task type (the asymmetric partner of the documents' RETRIEVAL_DOCUMENT).
 *   2. vectorSearchSections(table, qvec) — ANN search corpus_vec, collapse chunk hits
 *      to their parent section (best cosine similarity per section), return the top
 *      sections. Mirrors the pilot's collapse (pilot-score.ts) so ranking semantics match.
 *
 * INERT until corpus_vec exists + the serve is deployed. Fusion with BM25 is NOT done
 * here (the pilot showed naive equal-weight RRF hurts strong models) — that's the tuned
 * follow-up. This module returns vector-alone section ranks; the gateway owns fusion.
 */
import { GoogleGenAI } from '@google/genai'
import { lancedb } from './lance'
import { VECTOR_MODEL, VECTOR_DIMS, TASK_QUERY } from './vector-common'

const CHUNK_OVERSCAN = parseInt(process.env.VECTOR_CHUNK_OVERSCAN ?? '5', 10) // fetch limit×this chunks before section-collapse
const NPROBES = parseInt(process.env.VECTOR_NPROBES ?? '24', 10)              // IVF probe count (recall/latency knob)
const REFINE = parseInt(process.env.VECTOR_REFINE_FACTOR ?? '2', 10)          // re-rank top matches with exact distance

let _ai: GoogleGenAI | null = null
function ai(): GoogleGenAI {
  if (!_ai) { const k = process.env.GEMINI_API_KEY; if (!k) throw new Error('GEMINI_API_KEY not set'); _ai = new GoogleGenAI({ apiKey: k }) }
  return _ai
}

export async function embedQuery(text: string): Promise<number[]> {
  const res: any = await ai().models.embedContent({
    model: VECTOR_MODEL,
    contents: text,
    config: { taskType: TASK_QUERY, outputDimensionality: VECTOR_DIMS },
  })
  const values = res.embeddings?.[0]?.values ?? res.embedding?.values
  if (!Array.isArray(values)) throw new Error('embedQuery: no embedding values in response')
  return values
}

export interface VecSectionHit { sectionId: string; corpus: string; tier: string; score: number }

/**
 * ANN over corpus_vec → best-similarity section ranking (chunks collapsed to sections).
 *
 * `tier` restricts the search to one stream (e.g. 'legislation'). It MUST be a PREfilter, and
 * relies on prefiltering being LanceDB's default here — `postfilter()` is the opt-in. The
 * distinction is not cosmetic at this ratio: legislation is 1,868,316 of 21,846,364 vectors
 * (8.6%), so post-filtering an ANN result of ~60-200 chunks would leave a handful of
 * legislation hits and silently gut recall, in a way that looks like "vector is weak on
 * legislation" rather than like a filtering bug. Prefiltering searches the legislation
 * subspace properly and the overscan below then applies WITHIN that subspace.
 */
export async function vectorSearchSections(
  table: lancedb.Table,
  qvec: number[],
  limit = 20,
  tier?: string,
  /** Corpus-level stream scope, the dense twin of fts-core.ts's. Needed because `tier` alone
   *  cannot separate debates from committees, and an unscoped dense half fused against a
   *  scoped BM25 half is worse than scoping neither — committee content is 1.17% of the
   *  parliamentary tier, so ~99% of the dense contribution would be out-of-stream. */
  scope?: { corpora?: string[]; excludeCorpora?: string[] },
): Promise<VecSectionHit[]> {
  let q = table.vectorSearch(Float32Array.from(qvec))
    .distanceType('cosine')
    .nprobes(NPROBES)
    .refineFactor(REFINE)
    .limit(Math.max(limit * CHUNK_OVERSCAN, 60))
  const sql = (s: string) => `'${s.replace(/'/g, "''")}'`
  const preds: string[] = []
  if (tier) preds.push(`tier = ${sql(tier)}`)
  if (scope?.corpora?.length) preds.push(`corpus IN (${scope.corpora.map(sql).join(', ')})`)
  if (scope?.excludeCorpora?.length) preds.push(`corpus NOT IN (${scope.excludeCorpora.map(sql).join(', ')})`)
  if (preds.length) q = q.where(preds.join(' AND '))
  const rows = await q.toArray() as any[]
  // cosine distance → similarity; keep best per section
  const best = new Map<string, VecSectionHit>()
  for (const r of rows) {
    const sim = 1 - (typeof r._distance === 'number' ? r._distance : 1)
    const cur = best.get(r.sectionId)
    if (!cur || sim > cur.score) best.set(r.sectionId, { sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, score: sim })
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}
