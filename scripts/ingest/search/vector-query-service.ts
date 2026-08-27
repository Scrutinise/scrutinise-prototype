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
import os from 'os'
import { connectLance, lancedb } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'
import { MAX_CHUNKS } from './chunk'
import { embedQuery, vectorSearchSections, retrievalConfig } from './vector-core'
import { QueryCache } from './query-cache'
import { bestPassage, passageTerms, passageLocation, PASSAGE_CHARS } from './passage'

/** Rows the snippet lookup may read per requested section. Taken from the chunker's own cap so the
 *  two cannot drift: if MAX_CHUNKS rises, the snippet budget rises with it. See `snippets()`. */
const SNIPPET_ROWS_PER_SECTION = MAX_CHUNKS

/**
 * S13 §3 — SHOW THE PASSAGE THAT MATCHED, NOT THE HEAD OF THE DOCUMENT. ON by default.
 *
 * ⚠ THE KILL-SWITCH IS A SWITCH, NOT A DEFAULT. `SEARCH_PASSAGE_SNIPPET=false` restores exactly
 * the old behaviour — first chunk, `.slice(0, 300)` — and is here because a serving change to
 * text that reaches the answer model should be revertible without a rebuild. It ships ON because
 * the behaviour it replaces is not defensible under measurement: for the validated debates set
 * the keyed speeches run 920–5,714 words and the user was shown the first ~50, from the top.
 * ⚠ It is read through an explicit `!== 'false'` rather than a truthiness test, so an unset
 * variable and a misspelt one both mean ON — the state a reader would assume.
 */
const PASSAGE_SNIPPET = (process.env.SEARCH_PASSAGE_SNIPPET ?? 'true') !== 'false'

const PORT = parseInt(process.env.VECTOR_PORT ?? '8081', 10)

/**
 * ⚠ S15 §7 — THE DEPLOY MARKER, AND IT EXISTS BECAUSE THIS HAS COST THREE SPRINTS.
 *
 * `vector-serve` has no repo trigger (the project token cannot create one), so it does NOT
 * auto-deploy on a push to Main, and `restart` re-runs the SAME artefact rather than
 * building a new one. S14 found the service pinned to a 12 August commit while its own
 * metadata said `branch: Main`. A process that restarted, a mutation that returned an id and
 * an absence of errors are all things the OLD build does equally well.
 *
 * So: a string that is FALSE on the old build and TRUE on the new, readable in one request.
 * Bump it whenever this file changes in a way a deploy must carry.
 */
const BUILD = 'S15-cancel-bounded-batch'

/** Monotonic id for `noCache` requests, which must never share a cancellation key. */
let noCacheSeq = 0
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
// ⚠ S13 §3 — `snippetMatched` / `snippetLocation` / `chunkId` are cached WITH the hit. The cache
// key already includes the query (QueryCache.key), and the passage is selected FROM the query, so
// a cached entry carries a passage chosen for that same query and cannot be served for another.
interface CachedHit {
  id: string; corpus: string; tier: string; score: number; snippet: string
  snippetMatched: boolean; snippetLocation: string | null; chunkId: string
}
const cache = new QueryCache<CachedHit[]>({ ttlMs: CACHE_TTL_MS, maxEntries: CACHE_MAX })

// ── concurrency guard ────────────────────────────────────────────────────────
/**
 * ⚠⚠ S15 §1.1 — WHERE THE 4 CAME FROM, BECAUSE IT IS NOT WHAT IT LOOKS LIKE.
 *
 * It is a plain constant. It is NOT derived from CPU count and NOT derived from memory —
 * it was copied from `fts-query-service.ts`'s `FTS_MAX_CONCURRENT` when the guard was added
 * here as blocker B1, and the measurement behind that number ("10 concurrent took 226 s,
 * 15 killed the process outright") was taken on the FTS service, against the FTS table.
 *
 * `fts-query-service.ts` itself records, in a note dated 7 Aug 2026, that the diagnosis did
 * NOT reproduce on this path: **64 concurrent ANN queries against this single handle
 * survived, and throughput scaled ~4× from concurrency 1→8.** So a service that has never
 * been shown to break above 4 has been rationed to 4 on another service's evidence, and
 * S14 §0 is what that finally cost.
 */
const MAX_CONCURRENT = parseInt(process.env.VECTOR_MAX_CONCURRENT ?? '4', 10)
/**
 * ⚠ S15 §3 — THE QUEUE IS SIZED FROM THE WIDTH NOW, not fixed at 64.
 *
 * 64 deep on a 4-wide service promises the last caller in line SIXTEEN service times. At the
 * measured mean service time that is minutes, behind a 25 s client timeout — so the promise
 * cannot be kept, and the caller who is told "queued" has in fact been told nothing. Two
 * service times is a wait a caller can survive, and it TRACKS the width by default, so
 * widening the service widens the queue in the same proportion rather than leaving a number
 * behind that meant something at a width nobody runs any more.
 */
const MAX_QUEUE = parseInt(process.env.VECTOR_MAX_QUEUE ?? String(MAX_CONCURRENT * 2), 10)

/** Internal sentinel: a full queue is signalled as a rejection so it unwinds the cache's
 *  single-flight bookkeeping the same way a real failure would (and is never cached). */
const SHED = '__QUEUE_FULL__'
/** Internal sentinel: the caller had gone before this work started, so it never started. */
const ABANDONED = '__ABANDONED__'

let inFlight = 0
let queueHighWaterMark = 0
let rejections = 0
/** S15 §2 — jobs that were never begun because nobody was left waiting for them. This is
 *  the counter that makes cancellation VISIBLE: without it, a build that cancels and a
 *  build that is merely quiet look identical on /stats. */
let abandonedCount = 0

// ── who is still waiting ─────────────────────────────────────────────────────
//
// ⚠ ABANDONMENT IS COUNTED PER CACHE KEY, NOT PER CONNECTION, AND THAT IS LOAD-BEARING.
// Disconnecting is a fact about one socket, but the work is shared: QueryCache coalesces
// every concurrent identical request onto ONE compute(). Cancel on the owning socket's
// disconnect alone and every request coalesced behind it is stranded — a correctness bug
// introduced by a performance fix, which is the worst kind. So each live client registers
// against the key it is waiting on, and work stops only when that count reaches zero.
const liveByKey = new Map<string, number>()
function addLive(key: string) { liveByKey.set(key, (liveByKey.get(key) ?? 0) + 1) }
function dropLive(key: string) {
  const n = (liveByKey.get(key) ?? 1) - 1
  if (n <= 0) liveByKey.delete(key)
  else liveByKey.set(key, n)
}
/** True when every client waiting on this key has gone. */
function nobodyWaiting(key: string): boolean { return !liveByKey.has(key) }

type SlotOutcome =
  | { kind: 'granted'; release: () => void }
  | { kind: 'shed' }
  | { kind: 'abandoned' }

interface Waiter { grant: () => void; isAbandoned: () => boolean; cancel: () => void }
const waiters: Waiter[] = []

/**
 * Hand a freed slot to the first waiter that still has a caller.
 *
 * ⚠ THE `continue` IS THE FIX. Before S15 this was `waiters.shift()` and an unconditional
 * grant, so a queue of sixty abandoned requests was sixty pieces of real ANN work still to
 * be done for nobody — which is exactly why the p95 kept climbing for forty minutes after
 * every client had been killed (S14 §0). A queue is a list of promises to do work; a promise
 * to nobody is not one.
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

/** Drop abandoned waiters from the queue so a dead request cannot occupy a place that a
 *  live one is being refused for. Matters far more now the queue is small (§3). */
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
 * Acquire a slot for the NATIVE (Lance) section of a request. Queues FIFO when all
 * MAX_CONCURRENT slots are taken. Three outcomes, and they are deliberately distinct:
 *   granted   — a release function the caller MUST call exactly once, in a finally block
 *   shed      — the queue was full; the caller must turn this into a 503 (§3)
 *   abandoned — the caller disappeared while queued; no work is owed and none is done (§2)
 */
function acquireSlot(isAbandoned: () => boolean): Promise<SlotOutcome> {
  return new Promise((resolve) => {
    const grant = () => {
      inFlight++
      let released = false
      resolve({
        kind: 'granted',
        release: () => { if (released) return; released = true; inFlight--; pump() },
      })
    }
    if (isAbandoned()) return resolve({ kind: 'abandoned' })
    if (inFlight < MAX_CONCURRENT) return grant()
    pruneWaiters()
    if (waiters.length >= MAX_QUEUE) { rejections++; return resolve({ kind: 'shed' }) }
    waiters.push({ grant, isAbandoned, cancel: () => resolve({ kind: 'abandoned' }) })
    queueHighWaterMark = Math.max(queueHighWaterMark, waiters.length)
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

// ── stage timing (S15 §1.2) ──────────────────────────────────────────────────
//
// ⚠ THE POINT OF THIS IS THAT NOBODY HAS EVER MEASURED IT. Until now the service reported
// one number, `ms`, and one component of it, `embedMs`. Everything else — the queue wait,
// the ANN itself, the snippet scan over corpus_chunks, response assembly — was a single
// undifferentiated lump, so "the service is slow" could not be turned into "WHICH PART is
// slow", and every proposal to fix it (more width, fewer requests, a smaller queue) was a
// guess about a quantity nobody held.
//
// ⚠ `cpuMs` IS HERE FOR THE QUESTION WIDTH DEPENDS ON. The index is not held in this
// process: lance.ts opens the tables straight off R2 over S3, with no local cache directory,
// so every ANN is a series of HTTP range reads. If cpu/wall is near 1 the service is
// CPU-bound and width is bought with cores; if it is near 0 the service is waiting on the
// object store and more cores buy nothing. That single ratio decides the shape of §5, and
// it cannot be inferred from a latency.
const queueWaitMs: number[] = []
const annMs: number[] = []
const snippetMs: number[] = []
const cpuMsArr: number[] = []

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

/**
 * one snippet per section (its first chunk body) for the top hits
 *
 * ⚠⚠ THE `limit` HERE WAS `sectionIds.length * 4` AND IT SILENTLY STARVED HALF THE RESULTS.
 *
 * The row budget is shared across ALL the requested sections, but a section contributes as many
 * rows as it has chunks — up to `MAX_CHUNKS` (8). So a handful of long documents consume the whole
 * allowance and every section after them gets no row at all, and therefore no snippet. It is not a
 * truncation of one snippet; it is the complete absence of some.
 *
 * Diagnosed 2026-08-21 (S12) from a reproduction that scales exactly as the arithmetic predicts,
 * on `tier: caselaw` where documents run to 8 chunks each:
 *
 *     limit=1  → 0 of 1  empty
 *     limit=3  → 1 of 3  empty
 *     limit=10 → 5 of 10 empty
 *
 * ⚠ And the SAME document has a snippet at `limit=3` and none at `limit=10` — which is precisely
 * what `INGEST_CASELAW_TEXT_REPORT.md` recorded as "its snippet hydration is inconsistent" and
 * flagged for the search thread. It is not inconsistency; it is a budget, and this is the mechanism.
 *
 * ⚠ It was nearly misattributed. The empty snippets appeared during S12's case-law re-cut and
 * looked exactly like the re-cut having lost the chunks. Reading `corpus_chunks` directly showed
 * 539,454 chunks present with correct bodies, and the `limit` sweep above showed the rate scaling
 * with the request rather than with the collection — so it is pre-existing and the re-cut is
 * exonerated. **Bytes before hypotheses**, in both directions.
 *
 * The budget is now per section rather than shared, so no section can be crowded out by another.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * S13 §3 — AND THE SNIPPET IS NOW THE CHUNK THAT MATCHED, NOT THE FIRST ONE.
 *
 * `if (!out.has(r.sectionId))` over chunks sorted by chunkId took chunk **0** of every section:
 * the head of the document, whatever the query was. The ANN had already decided which chunk
 * answered the query, and `vectorSearchSections` used to throw that decision away (see
 * `VecSectionHit.chunkId`). It no longer does, so this takes the winning chunk's body and runs
 * `bestPassage` over it to centre the ~600 characters shown on the query's own terms.
 *
 * ⚠ THE ROW BUDGET STAYS PER-SECTION even though only one chunk per section is now used. The
 * `sectionId IN (…)` scan cannot cheaply be narrowed to specific chunkIds without an index on
 * `chunkId`, and shrinking the budget to `sectionIds.length` would re-create the starvation this
 * function was rewritten to remove the moment a section's winning chunk was not the first row
 * returned. A budget that is larger than needed costs a scan; one that is too small loses text.
 */
export interface SnippetOut { text: string; matched: boolean; location: string | null; chunkId: string }

/**
 * The chunk-row SCAN, split out from the passage selection below.
 *
 * ⚠ S15 §4 — THE SPLIT IS WHAT MAKES BATCHING WORTH ANYTHING. This is the expensive half and
 * its cost is dominated by the scan rather than by the number of ids in the predicate, so
 * four stream-scoped requests pay for four scans to answer one user's search. A batch pays
 * for ONE, over the union of their sections, and then selects each stream's passage from the
 * rows in memory — because `bestPassage` is keyed on the STREAM'S OWN query terms and the
 * four streams are handed four different rewritten queries by the router. One scan, four
 * selections; never one selection over a merged query, which would centre every stream's
 * snippet on the wrong words.
 */
async function fetchChunkRows(sectionIds: string[]): Promise<any[]> {
  if (!sectionIds.length) return []
  const inList = sectionIds.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')
  // MAX_CHUNKS (8) is the cap `chunk.ts` enforces, so this is the true worst case, not a guess.
  return await chunksTbl.query().where(`sectionId IN (${inList})`).select(['sectionId', 'chunkId', 'body', 'sectionTitle']).limit(sectionIds.length * SNIPPET_ROWS_PER_SECTION).toArray() as any[]
}

/** Passage selection over rows already fetched. Pure and synchronous — no native call. */
function passagesFrom(allRows: any[], hits: Array<{ sectionId: string; chunkId: string }>, query: string): Map<string, SnippetOut> {
  const out = new Map<string, SnippetOut>()
  if (!hits.length) return out
  const sectionIds = hits.map((h) => h.sectionId)
  const wanted = new Set(sectionIds)
  const wantChunk = new Map(hits.map((h) => [h.sectionId, h.chunkId]))
  // A batch's row set covers every stream's sections; take only this stream's.
  const rows = allRows.filter((r) => wanted.has(r.sectionId))
  rows.sort((a, b) => (a.chunkId < b.chunkId ? -1 : 1))

  const terms = passageTerms(query)
  const byChunk = new Map<string, any>()
  const firstChunk = new Map<string, any>()
  for (const r of rows) {
    byChunk.set(r.chunkId, r)
    if (!firstChunk.has(r.sectionId)) firstChunk.set(r.sectionId, r)
  }
  let fellBackToFirst = 0
  let unmatchedPassage = 0
  for (const sid of sectionIds) {
    const wanted = wantChunk.get(sid)!
    // ⚠ A MISSING WINNING CHUNK FALLS BACK TO THE FIRST AND IS COUNTED. It should not happen —
    // the chunkId came out of corpus_vec and corpus_chunks is its source — but a silent fallback
    // here would look exactly like the defect this change removes, and would be invisible.
    const row = byChunk.get(wanted) ?? firstChunk.get(sid)
    if (!row) continue
    if (!byChunk.has(wanted)) fellBackToFirst++
    const body = (row.body ?? '') as string
    if (!PASSAGE_SNIPPET) {
      out.set(sid, { text: body.slice(0, 300), matched: false, location: null, chunkId: row.chunkId })
      continue
    }
    const p = bestPassage(body, terms, PASSAGE_CHARS)
    if (!p.matched) unmatchedPassage++
    out.set(sid, { text: p.text, matched: p.matched, location: passageLocation(p, body.length), chunkId: row.chunkId })
  }
  // A section that still got no row is a fault, not an empty document — say so rather than
  // returning a blank snippet that reads like "this document has no text".
  const missing = sectionIds.filter((s) => !out.has(s))
  if (missing.length) console.warn(`[vector-query] ${missing.length}/${sectionIds.length} sections got NO snippet row (budget ${sectionIds.length * SNIPPET_ROWS_PER_SECTION}) — e.g. ${missing.slice(0, 2).join(', ')}`)
  if (fellBackToFirst) console.warn(`[vector-query] ${fellBackToFirst}/${sectionIds.length} winning chunkIds were absent from corpus_chunks — fell back to chunk 0`)
  if (unmatchedPassage) console.log(`[vector-query] ${unmatchedPassage}/${sectionIds.length} passages located no query term — head of chunk returned, flagged matched:false`)
  return out
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, vec: VEC_TABLE, build: BUILD })
  if (req.method === 'GET' && req.url === '/stats') {
    return send(res, 200, {
      build: BUILD,
      served, errors,
      cold_ms: cold[0] ?? null,
      // uncached — what the database actually costs
      warm_p50_ms: pct(warm, 50), warm_p95_ms: pct(warm, 95), warm_n: warm.length,
      // every served request, cache hits included — what a caller actually experiences
      all_p50_ms: pct(all, 50), all_p95_ms: pct(all, 95), all_n: all.length,
      embed_p50_ms: pct(embedMs, 50), embed_p95_ms: pct(embedMs, 95),
      // ── S15 §1.2 — THE BREAKDOWN, so "the service is slow" can become "WHICH PART". ──
      // `queue` is time spent waiting for a slot and is the saturation signal; `ann` and
      // `snippet` are the two native stages; `cpu` is process CPU time charged to the
      // request, and `cpu_over_wall` is the one number that says whether width is bought
      // with cores or is waiting on R2. Every series is since-boot, like the rest.
      stages: {
        queue_p50_ms: pct(queueWaitMs, 50), queue_p95_ms: pct(queueWaitMs, 95),
        ann_p50_ms: pct(annMs, 50), ann_p95_ms: pct(annMs, 95),
        snippet_p50_ms: pct(snippetMs, 50), snippet_p95_ms: pct(snippetMs, 95),
        cpu_p50_ms: pct(cpuMsArr, 50), cpu_p95_ms: pct(cpuMsArr, 95),
        cpu_over_wall: warm.length && cpuMsArr.length
          ? Math.round((cpuMsArr.reduce((a, b) => a + b, 0) / Math.max(1, warm.reduce((a, b) => a + b, 0))) * 100) / 100
          : null,
        n: annMs.length,
      },
      concurrency: {
        max: MAX_CONCURRENT, maxQueue: MAX_QUEUE, inFlight, queued: waiters.length,
        queueHighWaterMark, rejections,
        // S15 §2 — work that was never started because its caller had gone. A build that
        // cancels and a build that is merely quiet are indistinguishable without this.
        abandoned: abandonedCount,
        liveKeys: liveByKey.size,
      },
      // The host, because §5's "vertical first" is a question about cores and this is the
      // only place the answer can be read from the running service rather than assumed.
      host: { cpus: os.cpus().length, loadavg: os.loadavg().map((n) => Math.round(n * 100) / 100) },
      cache: cache.stats(),
      memory: memoryReport(),
      // The retrieval parameters IN FORCE in this process. Without these, an nprobes A/B could only
      // be verified by inferring it from latency — and "the setting probably took effect" is not a
      // measurement. Reading 24 here before the change is what makes reading 64 afterwards mean
      // something (BRIEF_SEARCH_S2C5 §1: verify engagement positively, never by absence of errors).
      config: retrievalConfig(),
      uptime_s: Math.round(process.uptime()),
      started_at: STARTED_AT,
    })
  }
  if (req.method === 'POST' && req.url === '/vector-search-batch') return handleBatch(req, res)
  if (req.method === 'POST' && req.url === '/vector-search') {
    // ── S15 §2 — IS ANYBODY STILL THERE? ──────────────────────────────────────
    // `close` on the RESPONSE fires when the underlying connection goes away. If it fires
    // before we finished writing, the client left. (`req.aborted` is deprecated and
    // `req.destroyed` is true on a clean finish too, so neither says what this says.)
    let clientGone = false
    let liveKey: string | null = null
    res.on('close', () => {
      if (!res.writableFinished) clientGone = true
      if (liveKey) { dropLive(liveKey); liveKey = null }
    })

    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      // Declared out here so the finally can release a slot the compute() closure took.
      let release: (() => void) | null = null
      let shed = false
      let abandoned = false
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
        const cpu0 = process.cpuUsage()
        let thisEmbedMs: number | null = null
        let thisWaitMs = 0
        let thisAnnMs = 0
        let thisSnippetMs = 0

        // ⚠ THE CANCELLATION PREDICATE IS PER KEY, NOT PER SOCKET. See `liveByKey`: this
        // request's own socket closing is not sufficient, because another client may have
        // coalesced onto the same computation and still be waiting for it.
        const isAbandoned = () => (liveKey ? nobodyWaiting(liveKey) : clientGone)

        // The work, run only on a miss. Everything expensive lives inside here — the Gemini
        // embed included — so a hit or a coalesced wait costs neither a Gemini call nor a
        // semaphore slot.
        const compute = async (): Promise<CachedHit[]> => {
          // CHECK 1 — before the embed. A request whose caller has already gone should not
          // even spend the Gemini call, which is the one part of this that costs money.
          if (isAbandoned()) { abandoned = true; abandonedCount++; throw new Error(ABANDONED) }

          const tEmbedStart = Date.now()
          // Embed FIRST, outside the semaphore — see the header note. This is a Gemini
          // HTTPS call, not a Lance call, so it is not the thing the guard protects.
          const qv = await embedQuery(query)
          thisEmbedMs = Date.now() - tEmbedStart
          embedMs.push(thisEmbedMs)

          const tWait = Date.now()
          const slot = await acquireSlot(isAbandoned)
          thisWaitMs = Date.now() - tWait
          queueWaitMs.push(thisWaitMs)
          if (slot.kind === 'shed') { shed = true; throw new Error(SHED) }
          // CHECK 2 — THE ONE THAT MAKES THE QUEUE DRAIN. This request may have sat behind
          // others for a long time; the caller can easily have given up in the interval.
          // Nothing native has been touched yet, and nothing native will be.
          if (slot.kind === 'abandoned') { abandoned = true; throw new Error(ABANDONED) }
          release = slot.release

          const tAnn = Date.now()
          const hits = await vectorSearchSections(vecTbl, qv, lim, tier, { corpora, excludeCorpora })
          thisAnnMs = Date.now() - tAnn
          annMs.push(thisAnnMs)

          // CHECK 3 — BETWEEN THE STAGES. The ANN has run and cannot be recalled, but the
          // snippet scan is a second, larger piece of native work (§1.2: it dominates), and
          // there is no reason to spend it on a caller who left while the ANN was running.
          if (isAbandoned()) { abandoned = true; abandonedCount++; throw new Error(ABANDONED) }

          const tSnip = Date.now()
          const snip = passagesFrom(
            await fetchChunkRows(hits.map((h) => h.sectionId)),
            hits.map((h) => ({ sectionId: h.sectionId, chunkId: h.chunkId })),
            query,
          )
          thisSnippetMs = Date.now() - tSnip
          snippetMs.push(thisSnippetMs)
          const c = process.cpuUsage(cpu0)
          cpuMsArr.push(Math.round((c.user + c.system) / 1000))

          return hits.map((h) => {
            const s = snip.get(h.sectionId)
            return {
              id: h.sectionId, corpus: h.corpus, tier: h.tier, score: h.score,
              snippet: s?.text ?? '',
              // S13 §3 — the provenance of the text above, on the wire. `snippetMatched: false`
              // means "we could not locate a query term in it", which is a different statement
              // from "here is the passage that matched" and must not read the same downstream.
              snippetMatched: s?.matched ?? false,
              snippetLocation: s?.location ?? null,
              chunkId: s?.chunkId ?? h.chunkId,
            }
          })
        }

        let outcome: 'hit' | 'coalesced' | 'miss' = 'miss'
        // ⚠ A `noCache` request gets a key OF ITS OWN. It shares no computation with anybody,
        // so registering it under the shared key would let one harness request's disconnect
        // be masked by an unrelated live client — or worse, mask a real one.
        const key = noCache === true
          ? `nocache:${++noCacheSeq}`
          : QueryCache.key({ query, tier, limit: lim, corpora, excludeCorpora })
        liveKey = key
        addLive(key)
        // The socket may already have closed while the body was being read; `res.on('close')`
        // above cannot have decremented a key it did not yet know about, so square it here.
        if (clientGone) { dropLive(key); liveKey = null }

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
          // S15 §1.2 — the same breakdown /stats aggregates, per response, so a harness can
          // attribute a slow call without having to correlate it against a since-boot counter.
          waitMs: thisWaitMs, annMs: thisAnnMs, snippetMs: thisSnippetMs,
          results,
        })
      } catch (e) {
        // ABANDONED first: there is nobody to tell. Ending the socket is all that is owed,
        // and `send`ing a body to a closed connection would only raise a second error.
        if (abandoned || (e as Error).message === ABANDONED) {
          if (!res.writableEnded) res.end()
          return
        }
        // `shed` covers the request that hit the full queue itself; the message check covers
        // a request that had COALESCED onto it and must not be told "__SHED__" in a 500.
        if (shed || (e as Error).message === SHED) {
          // Queue full. Refuse fast and countably rather than admitting a request whose
          // wait would outlive the caller's own timeout. Not an error — a deliberate shed.
          // ⚠ `reason: 'overloaded'` is machine-readable ON PURPOSE (§3): the platform adapter
          // must be able to tell a saturated service from a broken one, because the first is a
          // stated gap the user should hear about and the second is an error.
          return send(res, 503, { error: 'overloaded', reason: 'overloaded', queued: waiters.length, maxQueue: MAX_QUEUE }, { 'retry-after': '1' })
        }
        errors++; send(res, 500, { error: (e as Error).message })
      }
      finally {
        if (release) (release as () => void)()
        // Belt and braces against a leaked key: `res.on('close')` normally does this, but a
        // counter that only ever goes up would make every later request look abandoned.
        if (liveKey) { dropLive(liveKey); liveKey = null }
      }
    })
    return
  }
  send(res, 404, { error: 'not found' })
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// S15 §4 — ONE REQUEST, EVERY STREAM. "FOUR REQUESTS PER SEARCH IS A CHOICE."
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// `fusedStream` issues one dense request per routed stream, so enabling a fourth stream
// quadrupled the load one search puts on a service four wide in total, for everybody. This
// endpoint takes all of a search's stream-scoped queries together.
//
// ⚠⚠ THE SAVING IS NOT THE HTTP ROUND TRIPS — IT IS THE SNIPPET SCAN, AND THE MEASUREMENT
// IS WHY THIS ENDPOINT IS SHAPED THIS WAY. `corpus_chunks` has 22,670,808 rows and its
// `sectionId IN (…)` lookup costs the same for ONE section as for sixty: measured against
// the live dataset at 130,229 ms for n=1 and 130,131 ms for n=60, against an ANN of 1,301 ms
// on the same host. It is a scan, not a lookup, and it is ~100× the vector search it exists
// to decorate. Four separate requests pay for FOUR scans of the same table to answer one
// user's question. A batch pays for one, and the passages are then selected per stream in
// memory. Measured end to end on that host: 565,670 ms → 135,267 ms, a 76% saving, which is
// the 4→1 scan reduction almost exactly.
//
// ⚠ ONE SLOT FOR THE WHOLE BATCH, and the ANNs run SEQUENTIALLY inside it. The semaphore
// exists to bound concurrent native calls against a shared Lance handle; running four in
// parallel inside one slot would defeat it while appearing to respect it.
//
// ⚠⚠ PER-STREAM FAILURE, NEVER `Promise.all`. The brief is explicit and it is the whole
// point of §3: "one stream erroring must not fail the other three". Each entry carries its
// own `ok`, so a stream that threw is a stated gap in one place rather than a total search
// failure — which is the opposite of what the bounded queue is for.
interface BatchItem { query: string; tier?: string; corpora?: string[]; excludeCorpora?: string[]; limit?: number }

function handleBatch(req: http.IncomingMessage, res: http.ServerResponse) {
  let clientGone = false
  res.on('close', () => { if (!res.writableFinished) clientGone = true })
  const isAbandoned = () => clientGone

  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', async () => {
    let release: (() => void) | null = null
    try {
      const body = JSON.parse(raw || '{}')
      const items = body.queries
      if (!Array.isArray(items) || !items.length) return send(res, 400, { error: 'queries (non-empty array) required' })
      if (items.length > 8) return send(res, 400, { error: 'at most 8 queries per batch' })
      for (const it of items) {
        if (!it || typeof it.query !== 'string' || !it.query) return send(res, 400, { error: 'each query must be {query: string, tier?, corpora?, excludeCorpora?, limit?}' })
        if (it.tier !== undefined && typeof it.tier !== 'string') return send(res, 400, { error: 'tier must be a string when given' })
      }
      const defLimit = Math.min(Math.max(parseInt(body.limit ?? 20, 10) || 20, 1), 100)
      const specs: BatchItem[] = items.map((it: BatchItem) => ({
        query: it.query,
        tier: it.tier,
        corpora: it.corpora,
        excludeCorpora: it.excludeCorpora,
        limit: Math.min(Math.max(parseInt(String(it.limit ?? defLimit), 10) || defLimit, 1), 100),
      }))

      const t0 = Date.now()
      const cpu0 = process.cpuUsage()
      if (isAbandoned()) { abandonedCount++; if (!res.writableEnded) res.end(); return }

      // 1. EMBED EVERY QUERY, IN PARALLEL, OUTSIDE THE SEMAPHORE. Same reasoning as the
      //    single path: these are Gemini HTTPS calls and touch no Lance handle. One
      //    embed that fails fails ONLY its own stream.
      const tEmbed = Date.now()
      // Deliberately NOT a discriminated union: this package's tsconfig does not narrow one
      // reliably here, and a `!` cast to work around that would be a lie about a value that
      // really can be absent. Two nullable fields, checked directly.
      const vectors: Array<{ v: number[] | null; e: string | null }> = await Promise.all(specs.map((s) =>
        embedQuery(s.query).then((v) => ({ v, e: null })).catch((err) => ({ v: null, e: (err as Error).message }))))
      const thisEmbedMs = Date.now() - tEmbed
      embedMs.push(thisEmbedMs)

      // 2. ONE SLOT FOR THE WHOLE BATCH.
      const tWait = Date.now()
      const slot = await acquireSlot(isAbandoned)
      const thisWaitMs = Date.now() - tWait
      queueWaitMs.push(thisWaitMs)
      if (slot.kind === 'shed') {
        rejections // already counted inside acquireSlot
        return send(res, 503, { error: 'overloaded', reason: 'overloaded', queued: waiters.length, maxQueue: MAX_QUEUE }, { 'retry-after': '1' })
      }
      if (slot.kind === 'abandoned') { if (!res.writableEnded) res.end(); return }
      release = slot.release

      // 3. THE ANNs, SEQUENTIALLY, EACH FAILING ONLY ITSELF.
      const tAnn = Date.now()
      interface Leg { hits: Awaited<ReturnType<typeof vectorSearchSections>> | null; error: string | null }
      const legs: Leg[] = []
      for (let i = 0; i < specs.length; i++) {
        const s = specs[i]
        const emb = vectors[i]
        if (!emb.v) { legs.push({ hits: null, error: `embed failed: ${emb.e}` }); continue }
        if (isAbandoned()) { legs.push({ hits: null, error: 'abandoned' }); continue }
        try {
          legs.push({ hits: await vectorSearchSections(vecTbl, emb.v, s.limit ?? 20, s.tier, { corpora: s.corpora, excludeCorpora: s.excludeCorpora }), error: null })
        } catch (e) {
          legs.push({ hits: null, error: (e as Error).message })
        }
      }
      const thisAnnMs = Date.now() - tAnn
      annMs.push(thisAnnMs)

      if (isAbandoned()) { abandonedCount++; if (!res.writableEnded) res.end(); return }

      // 4. ONE SCAN over the union, then per-stream passage selection in memory.
      const tSnip = Date.now()
      const union = Array.from(new Set(legs.flatMap((l) => (l.hits ? l.hits.map((h) => h.sectionId) : []))))
      let rows: any[] = []
      let scanError: string | null = null
      try { rows = await fetchChunkRows(union) } catch (e) { scanError = (e as Error).message }
      const thisSnippetMs = Date.now() - tSnip
      snippetMs.push(thisSnippetMs)
      const c = process.cpuUsage(cpu0)
      cpuMsArr.push(Math.round((c.user + c.system) / 1000))

      const out = specs.map((s, i) => {
        const leg = legs[i]
        const hits = leg.hits
        if (!hits) return { ok: false as const, tier: s.tier ?? null, error: leg.error, count: 0, results: [] as CachedHit[] }
        // ⚠ Each stream's passages are selected on ITS OWN query terms. The router hands the
        // four streams four different rewritten strings, so a single merged term list would
        // centre every snippet on the wrong words — a batching change quietly degrading text.
        const snip = passagesFrom(rows, hits.map((h) => ({ sectionId: h.sectionId, chunkId: h.chunkId })), s.query)
        const results: CachedHit[] = hits.map((h) => {
          const sn = snip.get(h.sectionId)
          return {
            id: h.sectionId, corpus: h.corpus, tier: h.tier, score: h.score,
            snippet: sn?.text ?? '', snippetMatched: sn?.matched ?? false,
            snippetLocation: sn?.location ?? null, chunkId: sn?.chunkId ?? h.chunkId,
          }
        })
        // A failed SCAN is not a failed stream — the ranking is intact and only the text is
        // missing — but it must be said rather than shown as empty snippets.
        return {
          ok: true as const, tier: s.tier ?? null,
          corpora: s.corpora ?? null, excludeCorpora: s.excludeCorpora ?? null,
          snippetError: scanError, count: results.length, results,
        }
      })

      const ms = Date.now() - t0
      ;(served === 0 ? cold : warm).push(ms)
      all.push(ms)
      served++
      send(res, 200, {
        batch: specs.length, ms, embedMs: thisEmbedMs, waitMs: thisWaitMs,
        annMs: thisAnnMs, snippetMs: thisSnippetMs,
        // ⚠ ONE scan for the whole batch — reported, so the saving §4 claims is observed on
        // the wire rather than asserted in a comment.
        chunkScans: 1, sectionsScanned: union.length,
        queries: out,
      })
    } catch (e) {
      errors++
      if (!res.writableEnded) send(res, 500, { error: (e as Error).message })
    } finally { if (release) (release as () => void)() }
  })
}

async function main() {
  console.log(`[vector-query] opening ${VEC_TABLE} + ${CHUNKS_TABLE}…`)
  const conn = await connectLance()
  vecTbl = await conn.openTable(VEC_TABLE)
  chunksTbl = await conn.openTable(CHUNKS_TABLE)
  console.log(`[vector-query] open. vec rows=${await vecTbl.countRows()}. max_concurrent=${MAX_CONCURRENT} max_queue=${MAX_QUEUE}`)
  // Printed at boot as well as served on /stats, so a deploy log alone answers "what is it set to?"
  const rc = retrievalConfig()
  console.log(`[vector-query] retrieval config: nprobes=${rc.nprobes} overscan=x${rc.chunkOverscan} refine=x${rc.refineFactor} ${rc.distance} ${rc.model}@${rc.dims}d`)
  try {
    const t0 = Date.now()
    const qv = await embedQuery('legislation')
    await vectorSearchSections(vecTbl, qv, 1)
    console.log(`[vector-query] warm-up ok in ${Date.now() - t0}ms`)
  } catch (e) { console.warn(`[vector-query] warm-up failed (non-fatal): ${(e as Error).message}`) }
  http.createServer(handle).listen(PORT, () => console.log(`[vector-query] listening on :${PORT}`))
}

main().catch((e) => { console.error('[vector-query] FATAL', e); process.exit(1) })
