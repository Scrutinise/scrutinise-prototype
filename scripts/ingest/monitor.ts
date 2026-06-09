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

import { listPwdataFiles, PWDATA_CORPUS_CONFIG } from './sources/twfy-pwdata'

const RESEND_API = 'https://api.resend.com/emails'
const ALERT_TO = 'cl@scrutinise.org'
const STALE_CLAIM_MINUTES = 90
const ALERT_RATE_LIMIT_HOURS = 4     // max 1 alert per issue per 4 hours

// WHY: threshold must vary by corpus type.
// Ancient legislation (pre-2000 Acts, old SIs) routinely has 1-2 sections legitimately.
// Modern parliamentary records (debates, written answers) always have many sections per file.
// A single global threshold causes false-positive reseeding of complete short Acts.
const CORPUS_THRESHOLDS: Record<string, number> = {
  'primary-acts-pre-2000': 1,
  'primary-acts-2000plus': 2,
  'si-pre-2010':           1,
  'si-2010plus':           2,
  'regional':              1,  // NI Acts / NISR / NISI routinely have 1 section
  'retained-eu':           1,  // EU instruments often very short
  'pwdata-debates':        5,
  'pwdata-lords':          5,
  'pwdata-wrans':          3,
  'lda-commonswrittenquestions': 3,
  'committees-reports':    1,
  'committees-evidence':   1,
  'default':               3,
}

// ── Alert table bootstrap ─────────────────────────────────────────────────────
// Creates monitor_alerts in Neon on first monitor run (idempotent).
async function createMonitorAlertsTable(): Promise<void> {
  const neonPool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    statement_timeout: 30_000,
  })
  const client = await neonPool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitor_alerts (
        id BIGSERIAL PRIMARY KEY,
        alert_type TEXT NOT NULL,
        corpus_key TEXT,
        message TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS monitor_alerts_type_time_idx
      ON monitor_alerts(alert_type, sent_at DESC)
    `)
  } finally {
    client.release()
    await neonPool.end()
  }
}

// ── Alert sender — rate-limited, stored in Neon ───────────────────────────────
// WHY Neon: alert history belongs with corpus data, not with ephemeral queue.
// Rate limit: max 1 alert per (alert_type, corpus_key) per ALERT_RATE_LIMIT_HOURS.
async function sendMonitorAlert(
  alertType: string,
  corpusKey: string | null,
  message: string
): Promise<void> {
  const neonPool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    statement_timeout: 15_000,
  })

  try {
    // Rate-limit check
    const recentRes = await neonPool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM monitor_alerts
      WHERE alert_type = $1
        AND ($2::text IS NULL AND corpus_key IS NULL OR corpus_key = $2)
        AND sent_at > NOW() - INTERVAL '${ALERT_RATE_LIMIT_HOURS} hours'
    `, [alertType, corpusKey])

    const recentCount = parseInt(recentRes.rows[0]?.count ?? '0', 10)
    if (recentCount > 0) {
      console.log(`[monitor] alert suppressed (within ${ALERT_RATE_LIMIT_HOURS}h): ${alertType}${corpusKey ? ` / ${corpusKey}` : ''}`)
      return
    }

    // Record alert regardless of whether email sends (prevents repeat on Resend failure)
    await neonPool.query(
      `INSERT INTO monitor_alerts (alert_type, corpus_key, message) VALUES ($1, $2, $3)`,
      [alertType, corpusKey, message]
    )

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn(`[monitor] RESEND_API_KEY not set — alert logged but not emailed: ${message}`)
      return
    }

    const subject = corpusKey
      ? `⚠️ Ingest alert: ${alertType} — ${corpusKey}`
      : `⚠️ Ingest alert: ${alertType}`

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Scrutinise Ingest <ingest@messages.scrutinise.org>',
        to: [ALERT_TO],
        subject,
        text: `${message}\n\nSent: ${new Date().toISOString()}\nAlert type: ${alertType}${corpusKey ? `\nCorpus: ${corpusKey}` : ''}`,
      }),
    })

    if (res.ok) {
      console.log(`[monitor] ⚠️  alert emailed: ${subject}`)
    } else {
      console.error(`[monitor] Resend failed: ${res.status} — alert was logged to Neon`)
    }
  } catch (err) {
    console.error('[monitor] sendMonitorAlert error:', err)
  } finally {
    await neonPool.end()
  }
}

// ── 5. Critical condition alerts ──────────────────────────────────────────────
// Two conditions monitored:
//   A) All workers idle: pending rows exist but no worker has written a progress
//      snapshot in the last 1 hour — workers may be crashed or stuck at rate-limit.
//   B) Per-sourceType stall: a sourceType has pending rows but no worker claimed
//      anything from it in the last 2 hours.
async function checkCriticalConditions(pool: Pool): Promise<void> {
  // Condition A: workers idle despite pending work
  const [pendingRes, snapshotRes] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ingest_queue WHERE status = 'pending'`
    ),
    pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM ingest_progress_snapshots
      WHERE "capturedAt" > NOW() - INTERVAL '1 hour'
        AND "workerId" IS NOT NULL
    `),
  ])

  const pendingCount = parseInt(pendingRes.rows[0]?.count ?? '0', 10)
  const recentSnapshots = parseInt(snapshotRes.rows[0]?.count ?? '0', 10)

  if (pendingCount > 0 && recentSnapshots === 0) {
    await sendMonitorAlert(
      'all_workers_idle',
      null,
      `All workers idle: ${pendingCount.toLocaleString()} pending rows in queue but no worker progress snapshot in the last hour. Workers may be crashed or stuck. Check Railway dashboard.`
    )
  }

  // Condition B: sourceType stall — pending work exists but nothing claimed in 2h
  const stalledSources = await pool.query<{ sourceType: string; pending: string }>(`
    SELECT q."sourceType", COUNT(*)::text AS pending
    FROM ingest_queue q
    WHERE q.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM ingest_queue q2
        WHERE q2."sourceType" = q."sourceType"
          AND q2.status = 'claimed'
      )
    GROUP BY q."sourceType"
    HAVING COUNT(*) > 100
  `)

  for (const { sourceType, pending } of stalledSources.rows) {
    // Only alert if no snapshot for this sourceType in last 2 hours
    const activeRes = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM ingest_progress_snapshots
      WHERE "sourceKey" = $1 AND "capturedAt" > NOW() - INTERVAL '2 hours'
    `, [sourceType])
    const isActive = parseInt(activeRes.rows[0]?.count ?? '0', 10) > 0
    if (!isActive) {
      await sendMonitorAlert(
        'stalled_source',
        sourceType,
        `Source ${sourceType} has ${pending} pending rows but no worker activity or claimed rows in 2 hours. Workers may not be picking up this sourceType.`
      )
    }
  }
}

async function runMonitor(): Promise<void> {
  const railwayPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
  })

  console.log(`[monitor] ${new Date().toISOString()} — cycle start`)

  await createMonitorAlertsTable()
  await reclaimStale(railwayPool)
  await reseedPartialItems(railwayPool)
  await checkQueueExhaustion(railwayPool)
  await resetRetryableFailures(railwayPool)
  await checkCriticalConditions(railwayPool)

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
// section count per govUkId in Neon corpus_sections against a corpus-specific threshold.
// NOTE: corpus_sections has no legislationGovUkId column — we extract it from r2Key.
// r2Key format: {corpus}/{govUkId}/sections/{N}.compiled.txt
async function reseedPartialItems(pool: Pool): Promise<void> {
  // Step 1: query Neon for (corpus, govUkId) pairs with their section counts.
  // Include corpus in GROUP BY so we can apply per-corpus thresholds in TypeScript.
  const neonPool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
    max: 1,
  })
  const neon = await neonPool.connect()

  // Fetch compiled section counts per govUkId (only rows with r2Key sections pattern)
  const { rows } = await neon.query(`
    SELECT corpus,
           substring("r2Key" from '^[^/]+/(.+)/sections/') AS gov_uk_id,
           COUNT(*) AS section_count
    FROM corpus_sections
    WHERE "r2Key" LIKE '%/sections/%'
      AND status != 'unavailable'
      AND corpus IN (
        'primary-acts-pre-2000','primary-acts-2000plus',
        'si-pre-2010','si-2010plus','regional','retained-eu'
      )
    GROUP BY corpus, 2
  `)

  // Fetch govUkIds already intentionally classified as unavailable (hasNoProvisions items).
  // These items have availability_status != 'full' and no compiled sections — they appear as
  // section_count=0 in the query above, which would wrongly trigger reseeding.
  // Exclude them: the id column format is '{corpus}:{docId}:unavailable'.
  const { rows: classifiedRows } = await neon.query(`
    SELECT DISTINCT
      corpus,
      split_part(id, ':', 2) AS gov_uk_id
    FROM corpus_sections
    WHERE availability_status != 'full'
      AND id LIKE '%:unavailable'
      AND corpus IN (
        'primary-acts-pre-2000','primary-acts-2000plus',
        'si-pre-2010','si-2010plus','regional','retained-eu'
      )
  `)
  const classifiedSet = new Set(
    (classifiedRows as Array<{ corpus: string; gov_uk_id: string }>)
      .map(r => `${r.corpus}:${r.gov_uk_id}`)
  )

  neon.release()
  await neonPool.end()

  // Apply per-corpus threshold: only flag as partial if count < threshold for that corpus.
  // Exclude classified unavailable items — they were intentionally processed as no-text.
  const partialIds = (rows as Array<{ corpus: string; gov_uk_id: string | null; section_count: string }>)
    .filter(r => {
      if (!r.gov_uk_id) return false
      if (classifiedSet.has(`${r.corpus}:${r.gov_uk_id}`)) return false
      const threshold = CORPUS_THRESHOLDS[r.corpus] ?? CORPUS_THRESHOLDS['default']
      return parseInt(r.section_count, 10) < threshold
    })
    .map(r => r.gov_uk_id as string)

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
       WHERE "docId" = ANY($1::text[])
         AND status = 'done'`,
      [batch]
    )
    totalReset += rowCount ?? 0
  }

  if (totalReset > 0) {
    console.log(`[monitor] reseeded ${totalReset} partially ingested items`)
  }
}

// ── 3. Queue exhaustion detection + auto-reseed ───────────────────────────────
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
    console.log(`[monitor] ⚠️  corpus exhausted: ${row.corpus} (${row.done} done rows, 0 pending)`)
  }

  await reseedExhaustedCorpora(pool)
}

// ── 3a. Auto-reseed for exhausted pwdata corpora ──────────────────────────────
// WHY: without auto-reseed, workers idle when pwdata queue exhausts.
// TWFY adds new parliamentary records daily — monitor picks them up every 15 min.
// TNA legislation: no auto-reseed — discovery is expensive.
// LDA: no auto-reseed — rate limits make batch reseeding dangerous.
async function reseedExhaustedCorpora(pool: Pool): Promise<void> {
  const { rows } = await pool.query(`
    SELECT corpus
    FROM ingest_queue
    GROUP BY corpus
    HAVING COUNT(*) FILTER (WHERE status = 'pending') = 0
       AND COUNT(*) FILTER (WHERE status = 'claimed') = 0
       AND COUNT(*) FILTER (WHERE status = 'done') > 0
  `)

  for (const { corpus } of rows as Array<{ corpus: string }>) {
    if (corpus.startsWith('pwdata-') && PWDATA_CORPUS_CONFIG[corpus]) {
      await seedPwdataCorpus(pool, corpus)
    }
  }
}

// Fetch new TWFY files for a single corpus and insert any not yet in the queue.
async function seedPwdataCorpus(pool: Pool, corpus: string): Promise<void> {
  try {
    const files = await listPwdataFiles(corpus)
    if (files.length === 0) return

    // Insert only rows not already in the queue — ON CONFLICT DO NOTHING pattern.
    const priority = corpus === 'pwdata-westminster' ? 3 : 2
    let inserted = 0
    for (const f of files) {
      const id = `${corpus}:${f.docId}`
      const { rowCount } = await pool.query(
        `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
         VALUES ($1, $2, $3, 'twfy-pwdata', $4, 'pending')
         ON CONFLICT (id) DO NOTHING`,
        [id, corpus, f.docId, priority]
      )
      inserted += rowCount ?? 0
    }

    if (inserted > 0) {
      console.log(`[monitor] auto-reseeded ${corpus}: ${inserted} new files inserted`)
    }
  } catch (err) {
    console.error(`[monitor] seedPwdataCorpus error for ${corpus}:`, err)
  }
}

// ── 4. Reset retryable failures ───────────────────────────────────────────────
// WHY: HTTP 502/524 are transient gateway errors — always retryable.
// HTTP 429 (TWFY quota) is not retryable until quota resets — leave as failed.
// HTTP 403, 404 are permanent — leave as failed, surface in email ISSUES.
// WHY 30-minute delay: gives the upstream API time to recover before retry.
// WHY skip 'specialist-queue:' prefix: these rows have been retried MAX_524_RETRIES
// times and consistently fail — archiving them stops the infinite 524 retry loop.
async function resetRetryableFailures(pool: Pool): Promise<void> {
  const { rowCount } = await pool.query(`
    UPDATE ingest_queue
    SET status      = 'pending',
        "lastError" = NULL,
        "claimedBy" = NULL,
        "claimedAt" = NULL
    WHERE status = 'failed'
      AND ("lastError" LIKE '%HTTP 502%' OR "lastError" LIKE '%HTTP 524%')
      AND "lastError" NOT LIKE 'specialist-queue:%'
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
