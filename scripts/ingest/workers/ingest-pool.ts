/**
 * ingest-pool.ts — V17 single-process pool worker.
 *
 * Replaces the 20-container fleet with WORKER_CONCURRENCY concurrent claim
 * loops in one Node process. The work is I/O-bound: the event loop overlaps
 * the network waits of all loops, so 20 containers were paying 20× runtime
 * overhead for parallelism one runtime provides free.
 *
 * Each loop runs today's worker cycle unchanged (claim → fetch → parse →
 * R2 put → Neon insert → mark done) via process-row.ts. Loop identity
 * pool-1…pool-N is the claim workerId and log prefix, so the queue model
 * and the ops reaper logic are untouched.
 *
 * Cost rules (the point of V17):
 *  - exit-on-empty: 3 consecutive empty sweeps 30s apart → summary, exit(0).
 *    Railway restartPolicy ON_FAILURE leaves exit-0 stopped → bills nothing.
 *    `ops` restarts the service when pending rows appear.
 *  - one shared pg.Pool (max 10) — loops hold a connection only during the
 *    short claim/insert moments, never across fetches.
 *  - in-memory token-bucket rate limiting (shared/rate-limiter.ts); the
 *    source_rate_limits table is read once at startup as configuration.
 *  - no startup jitter (it existed to stagger 20 containers), no discovery
 *    (idle discovery conflicts with exit-on-empty; daily pwdata reseed now
 *    lives in ops), no R2 checkpoints, no per-worker snapshots.
 *
 * Memory guard: concurrency itself bounds in-flight buffers — each loop holds
 * at most one document at a time, and the large-document sources (TNA CLML)
 * stream section-by-section. At 20 loops the steady footprint stays well
 * under the 600MB target; lower WORKER_CONCURRENCY if a future source breaks
 * that assumption.
 *
 * Env needed: NEON_DATABASE_URL, CLOUDFLARE_R2_*, WORKER_CONCURRENCY.
 * DATABASE_URL (Railway Postgres) is deliberately absent from every import
 * in this entrypoint's graph.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import {
  claimNextFromSources, loadRateLimitConfigs, listPendingSourceTypes,
  countPendingRows, disconnectQueue, markFailed,
} from '../shared/queue-client'
import { getNeonPool } from '../shared/neon-pool'
import { rateLimiter } from '../shared/rate-limiter'
import { processRow, getSectionsWritten } from './process-row'

const CONCURRENCY = (() => {
  const n = parseInt(process.env.WORKER_CONCURRENCY ?? '20', 10)
  return isNaN(n) || n < 1 ? 20 : n
})()

const ROW_TIMEOUT_MS       = 5 * 60_000  // hard ceiling per row — protects against any source hanging
const EMPTY_SWEEP_GAP_MS   = 30_000      // gap between exit-on-empty sweeps
const EMPTY_SWEEPS_TO_EXIT = 3           // consecutive empty sweeps before exit(0)
const SOURCE_REFRESH_MS    = 15_000      // how often the shared pending-source list refreshes
const CLAIM_MISS_SLEEP_MS  = 1_000       // loop sleep when eligible sources exist but claim returned no row
const FATAL_DB_ERRORS      = 5           // consecutive claim-query failures before exit(1)

// ── Shared run state ──────────────────────────────────────────────────────────

const stats = { done: 0, failed: 0, started: Date.now() }
let inFlight = 0
let shuttingDown = false

// Pending sourceTypes are shared by all loops and refreshed by whichever loop
// notices the cache is stale — 20 loops issuing their own DISTINCT query per
// claim would be pointless queue load.
let pendingSources: string[] = []
let sourcesFetchedAt = 0
let sourceRefreshPromise: Promise<void> | null = null

async function refreshPendingSources(): Promise<void> {
  if (Date.now() - sourcesFetchedAt < SOURCE_REFRESH_MS) return
  if (!sourceRefreshPromise) {
    sourceRefreshPromise = listPendingSourceTypes()
      .then(s => {
        if (s.join(',') !== pendingSources.join(',')) {
          console.log(`[pool] pending sources now: [${s.join(', ') || 'none'}]`)
        }
        pendingSources = s
        sourcesFetchedAt = Date.now()
      })
      .catch(err => { console.warn('[pool] source refresh failed:', String(err).slice(0, 120)); throw err })
      .finally(() => { sourceRefreshPromise = null })
  }
  await sourceRefreshPromise
}

// Per-loop phase tracking — dumped by the sweeper so a wedged loop is
// diagnosable from logs alone (the first shakedown froze with zero output).
const loopPhase = new Map<number, string>()
function phase(loopId: number, p: string): void {
  loopPhase.set(loopId, `${p} @${new Date().toISOString().slice(11, 19)}`)
}

function exitSummary(code: 0 | 1, reason: string): never {
  const mins = ((Date.now() - stats.started) / 60_000).toFixed(1)
  console.log(`[pool] ${reason} — rows done: ${stats.done}, failed: ${stats.failed}, sections written: ${getSectionsWritten()}, duration: ${mins}min`)
  process.exit(code)
}

// ── Liveness heartbeat ────────────────────────────────────────────────────────
// ops decides "is ingest running?" from this row, not from Railway deployment
// status — after an exit(0) the deployment status semantics are ambiguous,
// while a 30s-fresh heartbeat is ground truth.

async function beat(): Promise<void> {
  await getNeonPool().query(`
    INSERT INTO ingest_service_state (id, last_beat) VALUES (1, NOW())
    ON CONFLICT (id) DO UPDATE SET last_beat = NOW()
  `).catch(err => console.warn('[pool] heartbeat failed:', String(err).slice(0, 120)))
}

async function ensureStateTable(): Promise<void> {
  await getNeonPool().query(`
    CREATE TABLE IF NOT EXISTS ingest_service_state (
      id int PRIMARY KEY,
      last_beat timestamptz,
      last_start_trigger timestamptz,
      starts_on date,
      starts_count int NOT NULL DEFAULT 0
    )
  `)
}

// ── Exit-on-empty coordinator ─────────────────────────────────────────────────
// One sweeper for the whole process (not per loop): when the queue has no
// pending rows for EMPTY_SWEEPS_TO_EXIT consecutive sweeps and nothing is in
// flight, the process exits 0 and the service stays stopped (bills nothing).
// The sweeper doubles as the heartbeat writer (every 30s).

async function emptySweeper(): Promise<void> {
  let emptySweeps = 0
  while (true) {
    await new Promise(r => setTimeout(r, EMPTY_SWEEP_GAP_MS))
    await beat()
    const pending = await countPendingRows().catch(() => -1)
    const phases = [...loopPhase.entries()].map(([id, p]) => `${id}:${p}`).join(' | ')
    console.log(`[pool] sweep: pending=${pending} inFlight=${inFlight} sources=[${pendingSources.join(',')}] loops: ${phases}`)
    if (pending === 0 && inFlight === 0) {
      emptySweeps++
      console.log(`[pool] empty sweep ${emptySweeps}/${EMPTY_SWEEPS_TO_EXIT}`)
      if (emptySweeps >= EMPTY_SWEEPS_TO_EXIT) {
        shuttingDown = true
        await disconnectQueue().catch(() => {})
        exitSummary(0, 'queue empty — exiting')
      }
    } else {
      emptySweeps = 0
    }
  }
}

// ── Claim loop ────────────────────────────────────────────────────────────────

async function runLoop(loopId: number): Promise<void> {
  const tag = `[pool-${loopId}]`
  let dbErrors = 0

  while (!shuttingDown) {
    phase(loopId, 'refresh')
    await refreshPendingSources().catch(() => { /* stale list is fine for one cycle */ })

    if (pendingSources.length === 0) {
      // Nothing pending at all — idle quietly; the emptySweeper owns exit.
      phase(loopId, 'idle-no-sources')
      await new Promise(r => setTimeout(r, EMPTY_SWEEP_GAP_MS))
      continue
    }

    const eligible = rateLimiter.eligible(pendingSources)
    if (eligible.length === 0) {
      // All pending sources are token- or concurrency-limited right now.
      phase(loopId, `rate-limited(${pendingSources.join(',')})`)
      const wait = rateLimiter.msUntilNextToken(pendingSources)
      await new Promise(r => setTimeout(r, Math.min(wait ?? CLAIM_MISS_SLEEP_MS, 5_000)))
      continue
    }

    // V19: reserve the token BEFORE the async claim. The old order —
    // eligible() → (await claim, 100–300ms) → recordClaim() — left a window in
    // which every idle loop saw the same free token. Invisible when rows take
    // seconds; catastrophic when rows fail instantly (HTTP 429 storm): all 20
    // loops go idle, race every token, and the "rate-limited" source runs at
    // 20×+ its configured rate, keeping the upstream penalty box alive
    // (observed live 11 Jun 2026: govuk-content configured 300ms/5 ≈ 3.3 rows/s,
    // measured 24 fails/s). Reserving up front means a token is occasionally
    // burned on an empty claim — which only slows us down, the correct direction.
    const source = eligible[Math.floor(Math.random() * eligible.length)]
    rateLimiter.recordClaim(source)

    let row
    try {
      phase(loopId, `claiming(${source})`)
      row = await claimNextFromSources(loopId, [source])
      dbErrors = 0
    } catch (err) {
      rateLimiter.release(source)
      dbErrors++
      console.error(`${tag} claim query failed (${dbErrors}/${FATAL_DB_ERRORS}):`, err)
      if (dbErrors >= FATAL_DB_ERRORS) exitSummary(1, 'Neon unreachable — fatal')
      await new Promise(r => setTimeout(r, 2_000 * dbErrors))
      continue
    }

    if (!row) {
      // Token reserved but the source just drained (or another loop won the
      // last row). Release the concurrency slot; the burned token delays this
      // source by one interval, which is harmless. Force a source refresh soon.
      rateLimiter.release(source)
      phase(loopId, 'claim-miss')
      sourcesFetchedAt = 0
      await new Promise(r => setTimeout(r, CLAIM_MISS_SLEEP_MS))
      continue
    }

    inFlight++
    console.log(`${tag} claimed ${row.id} (${row.sourceType} p${row.priority})`)
    phase(loopId, `processing(${row.id})`)

    let timeoutHandle: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        processRow(row),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`row timeout after ${ROW_TIMEOUT_MS / 1000}s`)), ROW_TIMEOUT_MS)
        }),
      ])
      stats.done++
    } catch (err: unknown) {
      console.error(`${tag} error processing ${row.id}:`, err)
      const errStr = String(err)
      // V19 politeness budget: a 429/503 is a rate signal. Suspend the source
      // in-process for 5 min so a storm stops immediately rather than burning
      // the queue at the configured rate until the 15-min breaker sweep.
      if (/HTTP (429|503)/.test(errStr)) {
        rateLimiter.suspend(row.sourceType, 5 * 60_000)
        console.warn(`${tag} ${row.sourceType}: upstream ${/429/.test(errStr) ? '429' : '503'} — source suspended 5 min`)
      }
      await markFailed(row.id, errStr).catch(e => console.warn(`${tag} markFailed error: ${e}`))
      stats.failed++
    } finally {
      // Without this the loser timer rejects 5 min later with no listener —
      // an unhandled rejection after every successful row.
      clearTimeout(timeoutHandle)
      rateLimiter.release(row.sourceType)
      inFlight--
    }

    if ((stats.done + stats.failed) % 50 === 0) {
      console.log(`[pool] progress: ${stats.done} done, ${stats.failed} failed, ${getSectionsWritten()} sections`)
    }
  }
}

// ── Entry ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[pool] starting — concurrency ${CONCURRENCY}`)

  // A swallowed async failure must never be silent — the first shakedown
  // froze with zero log output.
  process.on('unhandledRejection', (reason) => {
    console.error('[pool] UNHANDLED REJECTION:', reason)
  })
  process.on('uncaughtException', (err) => {
    console.error('[pool] UNCAUGHT EXCEPTION:', err)
    exitSummary(1, 'uncaught exception')
  })

  await ensureStateTable()
  await beat()

  const configs = await loadRateLimitConfigs()
  rateLimiter.configure(configs)
  console.log(`[pool] rate limits loaded for ${configs.length} sources (edit source_rate_limits + restart to change)`)

  process.on('SIGTERM', () => {
    // Railway stop/redeploy: claimed rows are reaped by ops after 90 min.
    console.log('[pool] SIGTERM — stopping')
    exitSummary(0, 'SIGTERM')
  })

  const loops = Array.from({ length: CONCURRENCY }, (_, i) => runLoop(i + 1))
  void emptySweeper()
  await Promise.all(loops)
}

main().catch(err => {
  console.error('[pool] fatal:', err)
  exitSummary(1, 'fatal error')
})
