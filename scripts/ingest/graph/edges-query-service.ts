/**
 * edges-query-service.ts — small HTTP service over the legislation graph,
 * mirroring the FTS/vector serve pattern (fts-query-service.ts).
 *
 *   POST /impact  {gid: string, sectionRef?: string, depth?: 1|2, limit?: number}
 *                 → the grouped impact set (traverse-edges.impactSet)
 *   GET  /health  → {ok, edges}
 *   GET  /stats   → latency p50/p95 since boot
 *
 * Deliberately dependency-light: one Neon pool, no Lance/R2. Deployment mirrors
 * fts-serve-run.ts if/when it gets a Railway home; locally:
 *   EDGES_PORT=8091 npx tsx graph/edges-query-service.ts
 */
import http from 'http'
import { getNeonPool } from '../shared/neon-pool'
import { EDGE_TABLE } from './graph-common'
import { impactSet } from './traverse-edges'

const PORT = parseInt(process.env.EDGES_PORT ?? '8091', 10)

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
  if (req.method === 'GET' && req.url === '/health') {
    try {
      const { rows } = await getNeonPool().query(`SELECT COUNT(*)::bigint AS n FROM ${EDGE_TABLE}`)
      return send(res, 200, { ok: true, edges: Number(rows[0].n) })
    } catch (e) { return send(res, 500, { ok: false, error: (e as Error).message }) }
  }
  if (req.method === 'GET' && req.url === '/stats') {
    return send(res, 200, { served, p50_ms: pct(warm, 50), p95_ms: pct(warm, 95) })
  }
  if (req.method === 'POST' && req.url === '/impact') {
    let raw = ''
    req.on('data', c => { raw += c })
    req.on('end', async () => {
      try {
        const { gid, sectionRef, depth, limit } = JSON.parse(raw || '{}')
        if (!gid || typeof gid !== 'string' || !/^[a-z]+\/\d{4}\/\d+$/.test(gid)) {
          return send(res, 400, { error: 'gid (e.g. "ukpga/2022/30") required' })
        }
        const t0 = Date.now()
        const result = await impactSet(getNeonPool(), gid, typeof sectionRef === 'string' ? sectionRef : null, {
          depth: depth === 1 ? 1 : 2,
          limitPerGroup: Math.min(Math.max(parseInt(limit ?? 500, 10) || 500, 1), 2000),
        })
        const ms = Date.now() - t0
        warm.push(ms)
        served++
        send(res, 200, { ms, ...result })
      } catch (e) {
        send(res, 500, { error: (e as Error).message })
      }
    })
    return
  }
  send(res, 404, { error: 'not found' })
}

async function main() {
  const { rows } = await getNeonPool().query(`SELECT COUNT(*)::bigint AS n FROM ${EDGE_TABLE}`)
  console.log(`[edges-query] ${EDGE_TABLE}: ${rows[0].n} edges`)
  http.createServer(handle).listen(PORT, () => console.log(`[edges-query] listening on :${PORT}`))
}
main().catch(e => { console.error('[edges-query] FATAL', e); process.exit(1) })
