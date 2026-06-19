/**
 * fts-query-service.ts — Search S1b query service (INERT until the index exists).
 *
 * Opens the Lance FTS dataset on R2 once at startup (LanceDB caches hot index
 * files locally after first touch), then serves:
 *   POST /fts-search  {query: string, tier?: string, limit?: number}
 *   GET  /stats       latency p50/p95 (cold vs warm) since boot
 *   GET  /health
 *
 * The BM25 search + query-time ~2.5× title boost live in fts-core (shared with
 * the scoring harness). Title-boost only moves rows in tiers that have titles
 * (parliamentary/guidance); it is inert for legislation & caselaw (NULL titles).
 */
import http from 'http'
import { connectLance, FTS_TABLE, lanceDbUri, lancedb } from './lance'
import { rankedSearch, TITLE_BOOST, OVERSCAN } from './fts-core'

const PORT = parseInt(process.env.FTS_PORT ?? '8080', 10)

let table: lancedb.Table

// latency bookkeeping (cold = first request after boot; warm = the rest)
const cold: number[] = []
const warm: number[] = []
let served = 0

function pct(arr: number[], p: number): number | null {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10
}

function send(res: http.ServerResponse, code: number, obj: unknown) {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(obj))
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, dataset: `${lanceDbUri()}/${FTS_TABLE}` })
  if (req.method === 'GET' && req.url === '/stats') {
    return send(res, 200, {
      served, cold_ms: cold[0] ?? null,
      warm_p50_ms: pct(warm, 50), warm_p95_ms: pct(warm, 95), warm_n: warm.length,
    })
  }
  if (req.method === 'POST' && req.url === '/fts-search') {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      try {
        const { query, tier, limit } = JSON.parse(raw || '{}')
        if (!query || typeof query !== 'string') return send(res, 400, { error: 'query (string) required' })
        const lim = Math.min(Math.max(parseInt(limit ?? 20, 10) || 20, 1), 100)
        const t0 = Date.now()
        const results = await rankedSearch(table, query, { tier, limit: lim })
        const ms = Date.now() - t0
        ;(served === 0 ? cold : warm).push(ms)
        served++
        // body omitted from the wire payload; snippet is enough for inspection
        send(res, 200, { query, tier: tier ?? null, ms, count: results.length, results: results.map(({ body, ...r }) => r) })
      } catch (e) {
        send(res, 500, { error: (e as Error).message })
      }
    })
    return
  }
  send(res, 404, { error: 'not found' })
}

async function main() {
  console.log(`[fts-query] opening ${lanceDbUri()}/${FTS_TABLE} …`)
  const conn = await connectLance()
  table = await conn.openTable(FTS_TABLE)
  console.log(`[fts-query] open. rows=${await table.countRows()}. title_boost=${TITLE_BOOST} overscan=${OVERSCAN}`)
  http.createServer(handle).listen(PORT, () => console.log(`[fts-query] listening on :${PORT}`))
}

main().catch((e) => { console.error('[fts-query] FATAL', e); process.exit(1) })
