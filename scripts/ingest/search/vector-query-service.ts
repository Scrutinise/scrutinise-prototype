/**
 * vector-query-service.ts — dense-retrieval query service (INERT until corpus_vec
 * exists AND this is deployed). The vector analogue of fts-query-service.ts; the
 * platform adapter (scrutinise-web/lib/lex/vector-search.ts) POSTs to it, gated behind
 * the OFF-by-default LEX_SEARCH_VECTOR flag.
 *
 *   POST /vector-search  {query: string, limit?: number}
 *   GET  /health   GET /stats
 *
 * Opens corpus_vec (ANN search) + corpus_chunks (snippet hydration) once at boot and
 * self-warms (first ANN query pulls index files from R2). Returns vector-ALONE section
 * ranks — fusion with BM25 is the tuned follow-up owned by the gateway, deliberately not
 * done here (naive RRF hurts strong models — docs/PILOT_REPORT.md).
 */
import http from 'http'
import { connectLance, lancedb } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'
import { embedQuery, vectorSearchSections } from './vector-core'

const PORT = parseInt(process.env.VECTOR_PORT ?? '8081', 10)
let vecTbl: lancedb.Table
let chunksTbl: lancedb.Table
const warm: number[] = []
let served = 0

function pct(arr: number[], p: number): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10
}
function send(res: http.ServerResponse, code: number, obj: unknown) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }

/** one snippet per section (its first chunk body) for the top hits */
async function snippets(sectionIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!sectionIds.length) return out
  const inList = sectionIds.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')
  const rows = await chunksTbl.query().where(`sectionId IN (${inList})`).select(['sectionId', 'chunkId', 'body', 'sectionTitle']).limit(sectionIds.length * 4).toArray() as any[]
  rows.sort((a, b) => (a.chunkId < b.chunkId ? -1 : 1))
  for (const r of rows) if (!out.has(r.sectionId)) out.set(r.sectionId, (r.body ?? '').slice(0, 300))
  return out
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, vec: VEC_TABLE })
  if (req.method === 'GET' && req.url === '/stats') return send(res, 200, { served, warm_p50_ms: pct(warm, 50), warm_p95_ms: pct(warm, 95), warm_n: warm.length })
  if (req.method === 'POST' && req.url === '/vector-search') {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      try {
        const { query, limit } = JSON.parse(raw || '{}')
        if (!query || typeof query !== 'string') return send(res, 400, { error: 'query (string) required' })
        const lim = Math.min(Math.max(parseInt(limit ?? 20, 10) || 20, 1), 100)
        const t0 = Date.now()
        const qv = await embedQuery(query)
        const hits = await vectorSearchSections(vecTbl, qv, lim)
        const snip = await snippets(hits.map((h) => h.sectionId))
        const ms = Date.now() - t0
        warm.push(ms); served++
        send(res, 200, { query, ms, count: hits.length, results: hits.map((h) => ({ id: h.sectionId, corpus: h.corpus, tier: h.tier, score: h.score, snippet: snip.get(h.sectionId) ?? '' })) })
      } catch (e) { send(res, 500, { error: (e as Error).message }) }
    })
    return
  }
  send(res, 404, { error: 'not found' })
}

async function main() {
  console.log(`[vector-query] opening ${VEC_TABLE} + ${CHUNKS_TABLE}…`)
  const conn = await connectLance()
  vecTbl = await conn.openTable(VEC_TABLE)
  chunksTbl = await conn.openTable(CHUNKS_TABLE)
  console.log(`[vector-query] open. vec rows=${await vecTbl.countRows()}`)
  try {
    const t0 = Date.now()
    const qv = await embedQuery('legislation')
    await vectorSearchSections(vecTbl, qv, 1)
    console.log(`[vector-query] warm-up ok in ${Date.now() - t0}ms`)
  } catch (e) { console.warn(`[vector-query] warm-up failed (non-fatal): ${(e as Error).message}`) }
  http.createServer(handle).listen(PORT, () => console.log(`[vector-query] listening on :${PORT}`))
}

main().catch((e) => { console.error('[vector-query] FATAL', e); process.exit(1) })
