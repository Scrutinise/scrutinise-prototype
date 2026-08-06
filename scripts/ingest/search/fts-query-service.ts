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
 *
 * CONCURRENCY GUARD (added investigating the query-router flip): this process
 * opens ONE Lance table handle at boot and every request's rankedSearch() call
 * runs a native query against that SAME handle. Direct load-testing (CC brief
 * "add guidance stream, then re-measure", step 3) confirmed concurrent calls
 * against one handle are unsafe at this scale — 10 concurrent requests survived
 * but took 226s (severe contention), 15 concurrent crashed the process outright
 * (no JS-catchable error, the process just died). This was previously assumed
 * safe because the trigger is independent HTTP requests rather than an in-process
 * Promise.all — that assumption was WRONG: the danger is concurrent native calls
 * against one handle, regardless of what triggers them. The query router
 * (query-router.ts) fans one user's search out to up to 5 concurrent stream
 * calls, so flipping LEX_QUERY_ROUTER on would multiply real-world concurrent
 * load against this exact vulnerability. Fix: a global in-process semaphore caps
 * concurrent rankedSearch calls at FTS_MAX_CONCURRENT (default 4 — chosen below
 * the 15 that crashed and below the 10 that already showed severe slowdown,
 * with headroom; re-tune from the p50/p95 /stats endpoint under real load).
 * Excess requests queue FIFO rather than fail — a request under load waits
 * longer, it does not error.
 */
import http from 'http'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE, lanceDbUri, lancedb } from './lance'
import { rankedSearch, TITLE_BOOST, OVERSCAN } from './fts-core'
import { ActIndex, loadActIndex } from './citation-resolver'

const PORT = parseInt(process.env.FTS_PORT ?? '8080', 10)

// ── concurrency guard ────────────────────────────────────────────────────────
const MAX_CONCURRENT = parseInt(process.env.FTS_MAX_CONCURRENT ?? '4', 10)
let inFlight = 0
const waiters: Array<() => void> = []
let queueHighWaterMark = 0

/** Acquire a slot (queues FIFO if all MAX_CONCURRENT slots are taken); returns
 *  a release function the caller MUST call exactly once, in a finally block. */
function acquireSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      inFlight++
      resolve(() => {
        inFlight--
        const next = waiters.shift()
        if (next) next()
      })
    }
    if (inFlight < MAX_CONCURRENT) {
      grant()
    } else {
      waiters.push(grant)
      queueHighWaterMark = Math.max(queueHighWaterMark, waiters.length)
    }
  })
}

let table: lancedb.Table
let actIndex: ActIndex | undefined

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
      concurrency: { max: MAX_CONCURRENT, inFlight, queued: waiters.length, queueHighWaterMark },
    })
  }
  if (req.method === 'POST' && req.url === '/fts-search') {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      const tQueueStart = Date.now()
      const release = await acquireSlot()
      try {
        // `corpora` / `excludeCorpora` scope a search to ONE stream within a shared tier —
        // debates and committees both live on `parliamentary`, and separating them after
        // retrieval is lossy (the result is truncated to `limit` before the caller can filter).
        const { query, tier, limit, corpora, excludeCorpora } = JSON.parse(raw || '{}')
        if (!query || typeof query !== 'string') return send(res, 400, { error: 'query (string) required' })
        if (tier !== undefined && typeof tier !== 'string') return send(res, 400, { error: 'tier must be a string when given' })
        const okList = (v: unknown) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'))
        if (!okList(corpora) || !okList(excludeCorpora)) return send(res, 400, { error: 'corpora/excludeCorpora must be string arrays when given' })
        const lim = Math.min(Math.max(parseInt(limit ?? 20, 10) || 20, 1), 100)
        const queueMs = Date.now() - tQueueStart
        const t0 = Date.now()
        const results = await rankedSearch(table, query, { tier, limit: lim, actIndex, corpora, excludeCorpora })
        const ms = Date.now() - t0
        ;(served === 0 ? cold : warm).push(ms)
        served++
        // Echo the scope back, for the same reason vector-query-service.ts does: a caller that
        // believes it scoped the search and a service too old to know the field would be
        // indistinguishable from the outside, and the symptom — a stream quietly serving another
        // stream's content — is exactly what this parameter exists to prevent.
        // body omitted from the wire payload; snippet is enough for inspection
        send(res, 200, {
          query, tier: tier ?? null,
          corpora: corpora ?? null, excludeCorpora: excludeCorpora ?? null,
          ms, queueMs, count: results.length, results: results.map(({ body, ...r }) => r),
        })
      } catch (e) {
        send(res, 500, { error: (e as Error).message })
      } finally {
        release()
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
  // Citation resolver index (archetype-A known-item lookups). Built once at boot
  // from LegislationItem; if NEON is unset the service still serves plain BM25.
  if (process.env.NEON_DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
    try { actIndex = await loadActIndex(pool); console.log(`[fts-query] act index: ${actIndex.byTitle.size} titles`) }
    finally { await pool.end() }
  } else { console.warn('[fts-query] NEON_DATABASE_URL unset — citation resolver disabled (plain BM25)') }
  console.log(`[fts-query] open. rows=${await table.countRows()}. title_boost=${TITLE_BOOST} overscan=${OVERSCAN}`)

  // Boot warm-up: the FIRST BM25 search after boot is cold — LanceDB pulls the FTS
  // index files from R2 on first touch (~15s), which used to land on a real user
  // query AND blow the platform adapter's timeout (→ silent stub fallback). Run a
  // throwaway self-query now so the index is hot before we accept traffic; the
  // first real query is then warm. Non-fatal: a warm-up failure must not stop us
  // serving (the next real query just pays the cold cost as before).
  try {
    const t0 = Date.now()
    const warm = await rankedSearch(table, 'legislation', { limit: 1, actIndex })
    console.log(`[fts-query] warm-up ok in ${Date.now() - t0}ms (index hot, ${warm.length} row)`)
  } catch (e) {
    console.warn(`[fts-query] warm-up failed (non-fatal, first real query pays cold cost): ${(e as Error).message}`)
  }

  http.createServer(handle).listen(PORT, () => console.log(`[fts-query] listening on :${PORT}`))
}

main().catch((e) => { console.error('[fts-query] FATAL', e); process.exit(1) })
