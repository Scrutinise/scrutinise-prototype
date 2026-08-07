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
 *
 * CONCURRENCY GUARD (B1, docs/VECTOR_DEPLOY_READINESS.md). This process opens ONE Lance
 * handle per table at boot and every request runs a native query against those SAME
 * handles — the exact pattern that took fts-query-service.ts down. The FTS measurement
 * is the evidence: 10 concurrent requests survived but took 226s (severe contention),
 * 15 concurrent killed the process outright with no JS-catchable error. query-router.ts
 * fans ONE user's search out to up to 5 concurrent stream calls, so five simultaneous
 * users is 25 concurrent calls, not 5. Fix, identical in shape to FTS: a global
 * in-process semaphore caps concurrent native work at VECTOR_MAX_CONCURRENT (default 4).
 *
 * TWO DELIBERATE DIFFERENCES FROM THE FTS GUARD, both stated so they are not read as drift:
 *
 *  1. The slot is acquired AFTER embedQuery, not before. The hazard being guarded is
 *     concurrent native calls against a Lance handle; embedQuery is an outbound HTTPS
 *     call to Gemini and touches no handle. Holding a slot across it would serialise
 *     ~4 requests' worth of pure network wait behind each other for no safety gain —
 *     at 25 concurrent and 4 slots that is ~6 rounds of embed latency added to the tail
 *     for nothing. Embeds now overlap with the queue wait instead.
 *  2. The queue is BOUNDED (VECTOR_MAX_QUEUE, default 64) and overflow is refused with
 *     503 + Retry-After rather than admitted. FTS's queue is unbounded, which converts
 *     overload into unbounded latency — the 226s result is what that looks like from
 *     the outside, and a caller behind Vercel's maxDuration has long since given up. A
 *     fast, counted refusal is information; a 226s wait is not. `rejections` is surfaced
 *     on /stats precisely so this is visible rather than silent.
 */
import http from 'http'
import { connectLance, lancedb } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'
import { embedQuery, vectorSearchSections } from './vector-core'
import { QueryCache } from './query-cache'

const PORT = parseInt(process.env.VECTOR_PORT ?? '8081', 10)
// Boot time, so a monitor can tell a restart from a quiet service: /stats counters are
// since-boot (docs/CLAUDE.md §17), and a counter that resets is only distinguishable
// from a counter that never moved if the process says when it started.
const STARTED_AT = new Date().toISOString()

// ── result cache ─────────────────────────────────────────────────────────────
// Sits IN FRONT of the embed, not just in front of Lance: a hit skips the Gemini
// call too, which is the per-query cost and the external-dependency outage mode
// that B2 flags. Set VECTOR_CACHE_TTL_MS=0 to disable entirely.
const CACHE_TTL_MS = parseInt(process.env.VECTOR_CACHE_TTL_MS ?? '300000', 10) // 5 min
const CACHE_MAX = parseInt(process.env.VECTOR_CACHE_MAX ?? '500', 10)
interface CachedHit { id: string; corpus: string; tier: string; score: number; snippet: string }
const cache = new QueryCache<CachedHit[]>({ ttlMs: CACHE_TTL_MS, maxEntries: CACHE_MAX })

// ── concurrency guard ────────────────────────────────────────────────────────
const MAX_CONCURRENT = parseInt(process.env.VECTOR_MAX_CONCURRENT ?? '4', 10)
const MAX_QUEUE = parseInt(process.env.VECTOR_MAX_QUEUE ?? '64', 10)
/** Internal sentinel: a full queue is signalled as a rejection so it unwinds the cache's
 *  single-flight bookkeeping the same way a real failure would (and is never cached). */
const SHED = '__QUEUE_FULL__'
let inFlight = 0
const waiters: Array<() => void> = []
let queueHighWaterMark = 0
let rejections = 0

/** Acquire a slot for the NATIVE (Lance) section of a request. Queues FIFO when all
 *  MAX_CONCURRENT slots are taken; returns null when the queue is already MAX_QUEUE
 *  deep, which the caller must turn into a 503. A non-null return is a release
 *  function the caller MUST call exactly once, in a finally block. */
function acquireSlot(): Promise<(() => void) | null> {
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
    } else if (waiters.length >= MAX_QUEUE) {
      rejections++
      resolve(null)
    } else {
      waiters.push(grant)
      queueHighWaterMark = Math.max(queueHighWaterMark, waiters.length)
    }
  })
}

let vecTbl: lancedb.Table
let chunksTbl: lancedb.Table
// latency bookkeeping (cold = first request after boot; warm = the rest), mirroring
// fts-query-service.ts so the two services' /stats can be read side by side.
//
// TWO SERIES, deliberately. `warm` holds only requests that DID the work; `all` holds
// every served request including cache hits. Folding hits into one series would drag
// p50 toward zero and hide the real database latency behind the cache — the alerting in
// step 6 needs the uncached number to mean what it says, while the cached number is what
// a user actually experiences. Both are reported.
const cold: number[] = []
const warm: number[] = []
const all: number[] = []
const embedMs: number[] = []
let served = 0
let errors = 0

// ── memory (B3) ──────────────────────────────────────────────────────────────
// Measured in-process, not inferred from a dashboard. Railway's per-replica cap is a
// MEASURED 8 GB (docs/CLAUDE.md §17) and exceeding it is a silent SIGKILL — no error
// line, no stack, the process simply ends. So the number that matters is PEAK, not
// current: a peak sampled only when someone happens to call /stats would miss the spike
// that kills us. A timer samples it continuously from boot.
const MEM_CAP_BYTES = parseInt(process.env.MEM_CAP_BYTES ?? '8000000000', 10) // Railway per-replica
let peakRss = 0
let peakRssAt = new Date().toISOString()
function sampleMem() {
  const rss = process.memoryUsage().rss
  if (rss > peakRss) { peakRss = rss; peakRssAt = new Date().toISOString() }
}
setInterval(sampleMem, 5_000).unref()
sampleMem()
const mb = (b: number) => Math.round(b / 1024 / 1024)

function memoryReport() {
  sampleMem()
  const m = process.memoryUsage()
  return {
    rss_mb: mb(m.rss),
    peak_rss_mb: mb(peakRss),
    peak_rss_at: peakRssAt,
    heap_used_mb: mb(m.heapUsed),
    external_mb: mb(m.external),
    cap_mb: mb(MEM_CAP_BYTES),
    pct_of_cap: Math.round((m.rss / MEM_CAP_BYTES) * 1000) / 10,
    peak_pct_of_cap: Math.round((peakRss / MEM_CAP_BYTES) * 1000) / 10,
  }
}

function pct(arr: number[], p: number): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10
}
function send(res: http.ServerResponse, code: number, obj: unknown, headers: Record<string, string> = {}) {
  res.writeHead(code, { 'content-type': 'application/json', ...headers })
  res.end(JSON.stringify(obj))
}

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
  if (req.method === 'GET' && req.url === '/stats') {
    return send(res, 200, {
      served, errors,
      cold_ms: cold[0] ?? null,
      // uncached — what the database actually costs
      warm_p50_ms: pct(warm, 50), warm_p95_ms: pct(warm, 95), warm_n: warm.length,
      // every served request, cache hits included — what a caller actually experiences
      all_p50_ms: pct(all, 50), all_p95_ms: pct(all, 95), all_n: all.length,
      embed_p50_ms: pct(embedMs, 50), embed_p95_ms: pct(embedMs, 95),
      concurrency: { max: MAX_CONCURRENT, maxQueue: MAX_QUEUE, inFlight, queued: waiters.length, queueHighWaterMark, rejections },
      cache: cache.stats(),
      memory: memoryReport(),
      uptime_s: Math.round(process.uptime()),
      started_at: STARTED_AT,
    })
  }
  if (req.method === 'POST' && req.url === '/vector-search') {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      // Declared out here so the finally can release a slot the compute() closure took.
      let release: (() => void) | null = null
      let shed = false
      try {
        // `tier` mirrors fts-query-service.ts's existing tier param, so the two retrieval
        // services take the same shape of request and a stream can be scoped identically on
        // both halves of a fusion. Optional — omitted means search everything, as before.
        // `noCache` is for the scoring harnesses: a measurement served from cache would be
        // measuring the cache, not retrieval.
        const { query, limit, tier, corpora, excludeCorpora, noCache } = JSON.parse(raw || '{}')
        if (!query || typeof query !== 'string') return send(res, 400, { error: 'query (string) required' })
        if (tier !== undefined && typeof tier !== 'string') return send(res, 400, { error: 'tier must be a string when given' })
        const okList = (v: unknown) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'))
        if (!okList(corpora) || !okList(excludeCorpora)) return send(res, 400, { error: 'corpora/excludeCorpora must be string arrays when given' })
        const lim = Math.min(Math.max(parseInt(limit ?? 20, 10) || 20, 1), 100)

        const t0 = Date.now()
        let thisEmbedMs: number | null = null

        // The work, run only on a miss. Everything expensive lives inside here — the Gemini
        // embed included — so a hit or a coalesced wait costs neither a Gemini call nor a
        // semaphore slot.
        const compute = async (): Promise<CachedHit[]> => {
          const tEmbedStart = Date.now()
          // Embed FIRST, outside the semaphore — see the header note. This is a Gemini
          // HTTPS call, not a Lance call, so it is not the thing the guard protects.
          const qv = await embedQuery(query)
          thisEmbedMs = Date.now() - tEmbedStart
          embedMs.push(thisEmbedMs)

          release = await acquireSlot()
          if (!release) { shed = true; throw new Error(SHED) }

          const hits = await vectorSearchSections(vecTbl, qv, lim, tier, { corpora, excludeCorpora })
          const snip = await snippets(hits.map((h) => h.sectionId))
          return hits.map((h) => ({ id: h.sectionId, corpus: h.corpus, tier: h.tier, score: h.score, snippet: snip.get(h.sectionId) ?? '' }))
        }

        let outcome: 'hit' | 'coalesced' | 'miss' = 'miss'
        const key = QueryCache.key({ query, tier, limit: lim, corpora, excludeCorpora })
        const results = noCache === true
          ? await compute()
          : await cache.resolve(key, compute, (o) => { outcome = o })

        const ms = Date.now() - t0
        // Only real work feeds the uncached series; every request feeds `all`.
        if (outcome === 'miss') (served === 0 ? cold : warm).push(ms)
        all.push(ms)
        served++
        // Echo the tier back: a caller that believes it scoped the search and a service that
        // silently ignored the field would be indistinguishable from the outside, and the
        // symptom (a fusion quietly mixing streams) is exactly what this sprint exists to prevent.
        send(res, 200, {
          query, tier: tier ?? null,
          corpora: corpora ?? null, excludeCorpora: excludeCorpora ?? null,
          ms, embedMs: thisEmbedMs, cached: noCache === true ? 'bypass' : outcome, count: results.length,
          results,
        })
      } catch (e) {
        // `shed` covers the request that hit the full queue itself; the message check covers
        // a request that had COALESCED onto it and must not be told "__SHED__" in a 500.
        if (shed || (e as Error).message === SHED) {
          // Queue full. Refuse fast and countably rather than admitting a request whose
          // wait would outlive the caller's own timeout. Not an error — a deliberate shed.
          return send(res, 503, { error: 'overloaded', queued: waiters.length, maxQueue: MAX_QUEUE }, { 'retry-after': '1' })
        }
        errors++; send(res, 500, { error: (e as Error).message })
      }
      finally { if (release) (release as () => void)() }
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
  console.log(`[vector-query] open. vec rows=${await vecTbl.countRows()}. max_concurrent=${MAX_CONCURRENT} max_queue=${MAX_QUEUE}`)
  try {
    const t0 = Date.now()
    const qv = await embedQuery('legislation')
    await vectorSearchSections(vecTbl, qv, 1)
    console.log(`[vector-query] warm-up ok in ${Date.now() - t0}ms`)
  } catch (e) { console.warn(`[vector-query] warm-up failed (non-fatal): ${(e as Error).message}`) }
  http.createServer(handle).listen(PORT, () => console.log(`[vector-query] listening on :${PORT}`))
}

main().catch((e) => { console.error('[vector-query] FATAL', e); process.exit(1) })
