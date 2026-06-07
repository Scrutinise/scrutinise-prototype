/**
 * monitor.ts — autonomous ingest health monitor
 * Runs every 15 minutes on Railway as a separate service.
 * WHY separate from scheduler: scheduler owns reporting (hourly email, census).
 * Monitor owns corrective action (reseeding, rebalancing, stale claim reset).
 * Keeping them separate means a monitor crash doesn't affect email delivery.
 */

import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

const STALE_CLAIM_MINUTES = 90
const PARTIAL_SECTION_THRESHOLD = 3  // sections below this = likely incomplete ingest

async function runMonitor(): Promise<void> {
  const railwayPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
  })

  console.log(`[monitor] ${new Date().toISOString()} — cycle start`)

  await reclaimStale(railwayPool)
  await reseedPartialItems(railwayPool)
  await checkQueueExhaustion(railwayPool)
  await resetRetryableFailures(railwayPool)

  await railwayPool.end()
  console.log(`[monitor] cycle complete`)
}

// ── 1. Stale claim reaper ─────────────────────────────────────────────────────
async function reclaimStale(pool: Pool): Promise<void> {
  const { rowCount } = await pool.query(`
    UPDATE ingest_queue
    SET status      = 'pending',
        "lastError" = 'reclaimed by monitor — worker SIGTERM or crash',
        "claimedBy" = NULL,
        "claimedAt" = NULL
    WHERE status = 'claimed'
      AND "claimedAt" < NOW() - INTERVAL '${STALE_CLAIM_MINUTES} minutes'
  `)
  if ((rowCount ?? 0) > 0) {
    console.log(`[monitor] reclaimed ${rowCount} stale claimed rows`)
  }
}

// ── 2. Partial item reseeder ──────────────────────────────────────────────────
// WHY: a worker can claim a queue row, write 1-2 sections, then crash.
// The row gets marked done but the item is incomplete. Detect by comparing
// section count per govUkId in Neon corpus_sections against PARTIAL_SECTION_THRESHOLD.
// NOTE: corpus_sections has no legislationGovUkId column — we extract it from r2Key.
// r2Key format: {corpus}/{govUkId}/sections/{N}.compiled.txt
async function reseedPartialItems(pool: Pool): Promise<void> {
  // Step 1: query Neon for govUkIds with too few sections (HAVING does the threshold filter).
  // Limit to TNA legislation corpora — the only ones with legislationGovUkId in the queue.
  const { Client } = require('pg')
  const neon = new Client({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  })
  await neon.connect()

  const { rows } = await neon.query(`
    SELECT substring("r2Key" from '^[^/]+/(.+)/sections/') AS gov_uk_id
    FROM corpus_sections
    WHERE "r2Key" LIKE '%/sections/%'
      AND corpus IN (
        'primary-acts-pre-2000','primary-acts-2000plus',
        'si-pre-2010','si-2010plus','regional','retained-eu'
      )
    GROUP BY 1
    HAVING COUNT(*) < $1
  `, [PARTIAL_SECTION_THRESHOLD])
  await neon.end()

  // partialIds = govUkIds that Neon considers partial (< threshold sections)
  const partialIds = (rows as Array<{ gov_uk_id: string | null }>)
    .map(r => r.gov_uk_id)
    .filter((id): id is string => Boolean(id))

  if (partialIds.length === 0) return

  // Step 2: reset matching Railway queue rows to pending (in batches of 500)
  const BATCH = 500
  let totalReset = 0
  for (let i = 0; i < partialIds.length; i += BATCH) {
    const batch = partialIds.slice(i, i + BATCH)
    const { rowCount } = await pool.query(
      `UPDATE ingest_queue
       SET status      = 'pending',
           "lastError" = 'reseeded by monitor — partial section count detected',
           "claimedBy" = NULL,
           "claimedAt" = NULL
       WHERE "legislationGovUkId" = ANY($1::text[])
         AND status = 'done'`,
      [batch]
    )
    totalReset += rowCount ?? 0
  }

  if (totalReset > 0) {
    console.log(`[monitor] reseeded ${totalReset} partially ingested items`)
  }
}

// ── 3. Queue exhaustion detection ─────────────────────────────────────────────
async function checkQueueExhaustion(pool: Pool): Promise<void> {
  const { rows } = await pool.query(`
    SELECT corpus,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE status = 'claimed') AS claimed,
           COUNT(*) FILTER (WHERE status = 'done')    AS done
    FROM ingest_queue
    GROUP BY corpus
    HAVING COUNT(*) FILTER (WHERE status = 'pending') = 0
       AND COUNT(*) FILTER (WHERE status = 'claimed') = 0
       AND COUNT(*) FILTER (WHERE status = 'done') > 0
  `)

  for (const row of rows) {
    // Log exhaustion — reseeding logic per-corpus is in discovery.ts.
    // Future: auto-trigger reseed for corpora that support incremental discovery.
    console.log(`[monitor] ⚠️  corpus exhausted: ${row.corpus} (${row.done} done rows, 0 pending)`)
  }
}

// ── 4. Reset retryable failures ───────────────────────────────────────────────
// WHY: HTTP 502/524 are transient gateway errors — always retryable.
// HTTP 429 (TWFY quota) is not retryable until quota resets — leave as failed.
// HTTP 403, 404 are permanent — leave as failed, surface in email ISSUES.
// WHY 30-minute delay: gives the upstream API time to recover before retry.
async function resetRetryableFailures(pool: Pool): Promise<void> {
  const { rowCount } = await pool.query(`
    UPDATE ingest_queue
    SET status      = 'pending',
        "lastError" = NULL,
        "claimedBy" = NULL,
        "claimedAt" = NULL
    WHERE status = 'failed'
      AND ("lastError" LIKE '%HTTP 502%' OR "lastError" LIKE '%HTTP 524%')
      AND "completedAt" < NOW() - INTERVAL '30 minutes'
  `)
  if ((rowCount ?? 0) > 0) {
    console.log(`[monitor] reset ${rowCount} retryable failed rows (502/524)`)
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await runMonitor()

  // Align to 15-minute clock boundaries (:00, :15, :30, :45)
  // :30s offset avoids exactly-on-the-minute contention with the scheduler
  function msUntilNext15(): number {
    const now = new Date()
    const mins = now.getMinutes()
    const nextMark = Math.ceil((mins + 1) / 15) * 15
    const targetMins = nextMark >= 60 ? nextMark - 60 : nextMark
    const target = new Date(now)
    if (nextMark >= 60) target.setHours(target.getHours() + 1)
    target.setMinutes(targetMins, 30, 0)
    return Math.max(target.getTime() - now.getTime(), 60_000)
  }

  async function loop(): Promise<void> {
    const delay = msUntilNext15()
    console.log(`[monitor] next run in ${Math.round(delay / 60000)}min`)
    setTimeout(async () => {
      try { await runMonitor() } catch (e) { console.error('[monitor] cycle error:', e) }
      loop()
    }, delay)
  }
  loop()
}

main().catch(e => { console.error('[monitor] fatal:', e); process.exit(1) })
