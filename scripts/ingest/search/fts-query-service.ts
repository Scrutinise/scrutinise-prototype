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
 *
 * ⚠ OPEN QUESTION, LOGGED NOT CHASED (7 Aug 2026, Charlie's call — do not spend a sprint
 * on this without being asked). The diagnosis above — "concurrent native calls against one
 * handle are unsafe" — did NOT reproduce on the vector path, which has the identical
 * one-handle-per-table shape. Measured on vector-query-service.ts: 64 concurrent ANN
 * queries against a single handle survived, and throughput SCALED ~4× from concurrency
 * 1→8, so a single handle is not a serial bottleneck and concurrency alone did not kill it.
 * Meanwhile the FTS symptom on record — the process simply dying with no JS-catchable
 * error — is precisely the signature docs/CLAUDE.md §17 attributes to an **OOM SIGKILL**,
 * not to handle contention.
 *
 * If that is what it was, this semaphore is guarding the wrong variable: it would be
 * limiting concurrency when the binding constraint is memory, which is why the number 4
 * "works" without anyone knowing what it is buying. Worth testing properly one day —
 * instrument peak RSS (now on /stats) and re-run the load that killed it, watching memory
 * rather than counting requests. Until then the guard STAYS: it is cheap, it demonstrably
 * prevents the crash, and an unexamined guard that works beats removing it on a hypothesis.
 *
 * ⚠⚠ RESOLVED, 27 Aug 2026 (S15/S16) — AND THE OPEN QUESTION ABOVE WAS RIGHT.
 * The dense service was characterised properly and the answer was neither handle contention nor
 * concurrency: **1,478,964 rows (6.5%) had fallen outside a scalar index and were brute-force
 * scanned on every lookup**, which is where both the latency AND the memory went — peak RSS under
 * load fell from 5,586 MB to 1,253 MB when the index was rebuilt, for €0.008. So "the semaphore is
 * guarding the wrong variable" was the correct diagnosis of a symptom whose cause was a stale
 * index. `check-index-coverage.ts` now asks that question of THIS service's indexes too, by
 * counting rows in versus out rather than asking whether an index exists.
 * ▶ Measured for `corpus_fts` on 27 Aug: **18,272,377 indexed, 0 unindexed.** Not the problem here.
 *
 * ⚠ AND THE WIDTH IS NO LONGER 4 IN PRODUCTION. `FTS_MAX_CONCURRENT` is set on Railway and the
 * running service reports **16** on `/stats`. The default below is still 4, so reading this file
 * alone tells you the wrong number — which is exactly why §5 of the S15 brief requires the width to
 * be read off `/stats` rather than off configuration.
 */
import http from 'http'
import os from 'os'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE, lanceDbUri, lancedb } from './lance'
import { rankedSearch, TITLE_BOOST, OVERSCAN } from './fts-core'
import { ActIndex, loadActIndex } from './citation-resolver'

const PORT = parseInt(process.env.FTS_PORT ?? '8080', 10)

// ── concurrency guard ────────────────────────────────────────────────────────
const MAX_CONCURRENT = parseInt(process.env.FTS_MAX_CONCURRENT ?? '4', 10)
/**
 * ⚠ S16 §1 — THE QUEUE IS BOUNDED NOW, AND SIZED FROM THE WIDTH.
 *
 * This service's queue was UNBOUNDED, which converts overload into unbounded latency: the 226 s
 * result on record is what that looks like from outside, and a caller behind Vercel's `maxDuration`
 * has long since given up. Worse, it cannot be SEEN — `/stats` reported `maxQueue: null,
 * rejections: null`, so a saturated service and a healthy one printed the same two nulls.
 *
 * A fast, counted refusal is information; an unbounded wait is not. Two service times is a wait a
 * caller can survive, and tracking the width means widening the service widens the queue in the
 * same proportion rather than leaving a constant behind that meant something at a width nobody runs.
 */
const MAX_QUEUE = parseInt(process.env.FTS_MAX_QUEUE ?? String(MAX_CONCURRENT * 2), 10)

/** Internal sentinels — see the equivalents in vector-query-service.ts. */
const SHED = '__QUEUE_FULL__'

let inFlight = 0
let queueHighWaterMark = 0
let rejections = 0
/** S16 §1 — requests never begun because their caller had already gone. */
let abandonedCount = 0

type SlotOutcome =
  | { kind: 'granted'; release: () => void }
  | { kind: 'shed' }
  | { kind: 'abandoned' }

interface Waiter { grant: () => void; isAbandoned: () => boolean; cancel: () => void }
const waiters: Waiter[] = []

/**
 * Hand a freed slot to the first waiter that still has a caller.
 *
 * ⚠⚠ THIS IS THE FIX THAT MATTERS, AND IT IS WHY THIS SERVICE IS MORE EXPOSED THAN THE DENSE ONE
 * WAS. `fts-serve` runs on EVERY query rather than on four streams of some queries, and it had an
 * unbounded queue — so the S14 failure mode (work executed for callers who left, the queue growing
 * faster than it drains) had no cap on it here at all. A queue is a list of promises to do work; a
 * promise to nobody is not one.
 */
function pump() {
  for (;;) {
    const w = waiters.shift()
    if (!w) return
    if (w.isAbandoned()) { abandonedCount++; w.cancel(); continue }
    w.grant()
    return
  }
}

/** Drop abandoned waiters so a dead request cannot hold a place a live one is refused for. */
function pruneWaiters() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (waiters[i].isAbandoned()) {
      const [w] = waiters.splice(i, 1)
      abandonedCount++
      w.cancel()
    }
  }
}

/**
 * Acquire a slot. Three outcomes, deliberately distinct:
 *   granted   — a release function the caller MUST call exactly once, in a finally block
 *   shed      — the queue was full; the caller turns this into a 503 with a machine-readable reason
 *   abandoned — the caller disappeared while queued; no work is owed and none is done
 *
 * ⚠ Unlike vector-query-service.ts this service has NO result cache and no single-flight
 * coalescing, so abandonment is per REQUEST rather than per cache key — there is never another
 * caller waiting on the same computation to be stranded. Stated because the two services are
 * deliberately kept in step and this is a real difference between them, not an oversight.
 */
function acquireSlot(isAbandoned: () => boolean): Promise<SlotOutcome> {
  return new Promise((resolve) => {
    const grant = () => {
      inFlight++
      let released = false
      resolve({ kind: 'granted', release: () => { if (released) return; released = true; inFlight--; pump() } })
    }
    if (isAbandoned()) return resolve({ kind: 'abandoned' })
    if (inFlight < MAX_CONCURRENT) return grant()
    pruneWaiters()
    if (waiters.length >= MAX_QUEUE) { rejections++; return resolve({ kind: 'shed' }) }
    waiters.push({ grant, isAbandoned, cancel: () => resolve({ kind: 'abandoned' }) })
    queueHighWaterMark = Math.max(queueHighWaterMark, waiters.length)
  })
}

// ── memory + identity (added for the serve observer, search/serve-observer.ts) ──
// Observability only — nothing about how this service serves is changed here.
// Railway's per-replica cap is a MEASURED 8 GB (docs/CLAUDE.md §17) and exceeding it is a
// silent SIGKILL, so what matters is PEAK, sampled continuously rather than only when
// someone happens to call /stats.
const MEM_CAP_BYTES = parseInt(process.env.MEM_CAP_BYTES ?? '8000000000', 10)
let peakRss = 0
let peakRssAt = new Date().toISOString()
function sampleMem() {
  const rss = process.memoryUsage().rss
  if (rss > peakRss) { peakRss = rss; peakRssAt = new Date().toISOString() }
}
setInterval(sampleMem, 5_000).unref()
sampleMem()
const mb = (b: number) => Math.round(b / 1024 / 1024)
// /stats counters are since-boot (§17), so a restart resets them. Without a boot time a
// reset counter is indistinguishable from one that never moved — which is exactly the
// signal the observer needs to report a crash/restart.
const STARTED_AT = new Date().toISOString()
let errors = 0

let table: lancedb.Table
let actIndex: ActIndex | undefined

// Latency bookkeeping (cold = first request after boot; warm = the rest).
//
// THESE INCLUDE THE QUEUE WAIT, and that is the whole point. Until 2026-08-08 the clock
// started AFTER acquireSlot(), so the recorded figure was Lance service time only. Under the
// router's fan-out — one user search becomes 5 parallel stream calls against a 4-wide
// semaphore — the queue IS the latency: a measured load of 10 concurrent users produced a
// client-side p95 of 12,176 ms while this service reported warm_p95 = 1,523 ms and the
// observer's `p95 > 5s` alert stayed silent. A metric that cannot see the dominant term is
// worse than no metric, because it reads as reassurance. vector-query-service.ts:205 already
// clocks from before its own semaphore; these two are now measuring the same thing and are
// comparable in the same digest. `serviceMs` below keeps the old number for diagnosis.
const cold: number[] = []
const warm: number[] = []
/** Queue wait alone, so a slow service and a saturated one stay distinguishable on /stats. */
const queueWaits: number[] = []
/** S16 §1 — CPU charged to the request, so "the box is busy" and "we are waiting on R2" cannot be
 *  confused. `cpu_over_wall` near 1 means cores buy width; near 0 means the object store is the
 *  block and more cores buy nothing. ⚠ os.cpus() reports the HOST on Railway, not our quota. */
const cpuMsArr: number[] = []
let served = 0

/**
 * ⚠ S16 §1 — THE DEPLOY MARKER. A redeploy is not a rebuild, and `fts-serve` has a repo trigger
 * (unlike `vector-serve`) so it rebuilds on a push to Main — which means a build can change under
 * you without anyone running a command. Bump this whenever a change to this file must be proven
 * live: it is false on every earlier build and true on this one, readable in one request.
 */
const BUILD = 'S16-fts-cancel-bounded'

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
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, dataset: `${lanceDbUri()}/${FTS_TABLE}`, build: BUILD })
  if (req.method === 'GET' && req.url === '/stats') {
    sampleMem()
    const m = process.memoryUsage()
    return send(res, 200, {
      build: BUILD,
      served, errors, cold_ms: cold[0] ?? null,
      // Total time on the wire, queue wait included — see the note by `warm`.
      warm_p50_ms: pct(warm, 50), warm_p95_ms: pct(warm, 95), warm_n: warm.length,
      // The split, so "the index got slower" and "we are saturated" cannot be confused.
      queue_p50_ms: pct(queueWaits, 50), queue_p95_ms: pct(queueWaits, 95),
      // ⚠ S16 §1 — `maxQueue` and `rejections` USED TO BE `null` HERE, and the comment explaining
      // why was accurate and is now obsolete: the queue was unbounded, so the service could never
      // refuse, and two nulls were the honest way to say so. It is bounded now, so these are real
      // numbers and the observer can alert on them like the dense service's.
      concurrency: {
        max: MAX_CONCURRENT, maxQueue: MAX_QUEUE, inFlight, queued: waiters.length,
        queueHighWaterMark, rejections, abandoned: abandonedCount,
      },
      // The host, because a width decision needs the CPU picture and this is the only place it can
      // be read off the running service. ⚠ `cpus` is the HOST's on Railway, NOT the cgroup quota —
      // the container's real limit is read from Railway's CPU_LIMIT metric (S15 §1.3).
      host: { cpus: os.cpus().length, loadavg: os.loadavg().map((n) => Math.round(n * 100) / 100) },
      cpu_p50_ms: pct(cpuMsArr, 50), cpu_p95_ms: pct(cpuMsArr, 95),
      cpu_over_wall: warm.length && cpuMsArr.length
        ? Math.round((cpuMsArr.reduce((a, b) => a + b, 0) / Math.max(1, warm.reduce((a, b) => a + b, 0))) * 100) / 100
        : null,
      memory: {
        rss_mb: mb(m.rss), peak_rss_mb: mb(peakRss), peak_rss_at: peakRssAt,
        heap_used_mb: mb(m.heapUsed), external_mb: mb(m.external),
        cap_mb: mb(MEM_CAP_BYTES),
        pct_of_cap: Math.round((m.rss / MEM_CAP_BYTES) * 1000) / 10,
        peak_pct_of_cap: Math.round((peakRss / MEM_CAP_BYTES) * 1000) / 10,
      },
      uptime_s: Math.round(process.uptime()),
      started_at: STARTED_AT,
    })
  }
  if (req.method === 'POST' && req.url === '/fts-search') {
    // ── S16 §1 — IS ANYBODY STILL THERE? ──────────────────────────────────────
    // `close` on the RESPONSE fires when the connection goes away. If it fires before we finished
    // writing, the client left. (`req.aborted` is deprecated and `req.destroyed` is true on a clean
    // finish too, so neither says what this says.)
    let clientGone = false
    res.on('close', () => { if (!res.writableFinished) clientGone = true })
    const isAbandoned = () => clientGone

    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      const tQueueStart = Date.now()
      const cpu0 = process.cpuUsage()
      // CHECK 1 — before the queue. Nothing is owed to a caller who has already gone.
      if (isAbandoned()) { abandonedCount++; if (!res.writableEnded) res.end(); return }
      const slot = await acquireSlot(isAbandoned)
      if (slot.kind === 'shed') {
        // ⚠ `reason: 'overloaded'` is machine-readable ON PURPOSE: the platform adapter must be
        // able to tell a saturated service from a broken one, because the first is a stated gap
        // the user should hear about and the second is an error.
        res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '1' })
        return res.end(JSON.stringify({ error: 'overloaded', reason: 'overloaded', queued: waiters.length, maxQueue: MAX_QUEUE }))
      }
      // CHECK 2 — THE ONE THAT MAKES THE QUEUE DRAIN. This request may have waited behind others
      // for a long time and the caller can easily have given up in the interval. Nothing has been
      // touched yet, and nothing will be.
      if (slot.kind === 'abandoned') { if (!res.writableEnded) res.end(); return }
      const release = slot.release
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
        const t0 = Date.now()
        const results = await rankedSearch(table, query, { tier, limit: lim, actIndex, corpora, excludeCorpora })
        const serviceMs = Date.now() - t0
        const c = process.cpuUsage(cpu0)
        cpuMsArr.push(Math.round((c.user + c.system) / 1000))
        // Total is measured from tQueueStart, NOT serviceMs + queueMs, so nothing between the
        // two clocks (JSON.parse, validation) can go unattributed.
        const ms = Date.now() - tQueueStart
        const queueMs = ms - serviceMs
        ;(served === 0 ? cold : warm).push(ms)
        queueWaits.push(queueMs)
        served++
        // Echo the scope back, for the same reason vector-query-service.ts does: a caller that
        // believes it scoped the search and a service too old to know the field would be
        // indistinguishable from the outside, and the symptom — a stream quietly serving another
        // stream's content — is exactly what this parameter exists to prevent.
        // body omitted from the wire payload; snippet is enough for inspection
        send(res, 200, {
          query, tier: tier ?? null,
          corpora: corpora ?? null, excludeCorpora: excludeCorpora ?? null,
          // `ms` is now TOTAL (queue + service), matching vector-query-service.ts. It used to be
          // service time alone; no caller read it, so the change is safe as well as necessary.
          ms, queueMs, serviceMs, count: results.length, results: results.map(({ body, ...r }) => r),
        })
      } catch (e) {
        errors++
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
