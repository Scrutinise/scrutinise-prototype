/**
 * migrate-queue-to-neon.ts
 * Copies ingest_queue, source_rate_limits, specialist_queue, scheduler_lock,
 * and ingest_progress_snapshots from Railway → Neon in batches of 500.
 * Creates tables on Neon if they don't exist.
 * Uses ON CONFLICT DO NOTHING — safe to re-run for keyed tables.
 * Checkpoint/resume — safe to interrupt and restart.
 *
 * Run ONCE before redeploying workers to the Neon-queue code.
 * After this runs, update queue-client.ts / monitor.ts / progress-reporter.ts to
 * point to NEON_DATABASE_URL and redeploy all workers.
 *
 * Usage:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/migrate-queue-to-neon.ts
 */
import { Pool } from 'pg'
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const BATCH = 500
const CHECKPOINT_FILE = path.join(__dirname, 'migrate-queue-checkpoint.json')

const railway = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 20_000,
  statement_timeout: 120_000,
})
const neon = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 20_000,
  statement_timeout: 120_000,
})

interface Checkpoint { [table: string]: string | number }

function loadCheckpoint(): Checkpoint {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) } catch { return {} }
}
function saveCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

async function ensureNeonTables(): Promise<void> {
  await neon.query(`
    CREATE TABLE IF NOT EXISTS ingest_queue (
      id TEXT PRIMARY KEY,
      corpus TEXT NOT NULL,
      "docId" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      priority INT NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'pending',
      "claimedBy" INT,
      "claimedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      attempts INT NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "formatsAvailable" TEXT,
      "formatFound" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await neon.query(`CREATE INDEX IF NOT EXISTS iq_status_source ON ingest_queue (status, "sourceType", priority)`)
  await neon.query(`CREATE INDEX IF NOT EXISTS iq_corpus_status ON ingest_queue (corpus, status)`)
  await neon.query(`CREATE INDEX IF NOT EXISTS iq_claimed_at ON ingest_queue ("claimedAt") WHERE status = 'claimed'`)

  await neon.query(`
    CREATE TABLE IF NOT EXISTS source_rate_limits (
      "sourceKey" TEXT PRIMARY KEY,
      "intervalMs" BIGINT NOT NULL DEFAULT 500,
      "lastIssuedAt" BIGINT NOT NULL DEFAULT 0,
      suspended BOOLEAN NOT NULL DEFAULT false,
      "suspendedUntil" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "isComplete" BOOLEAN NOT NULL DEFAULT false,
      "maxConcurrentWorkers" INT NOT NULL DEFAULT 20
    )
  `)

  await neon.query(`
    CREATE TABLE IF NOT EXISTS scheduler_lock (
      id INT PRIMARY KEY,
      locked_at TIMESTAMPTZ NOT NULL,
      process_id TEXT NOT NULL
    )
  `)

  await neon.query(`
    CREATE TABLE IF NOT EXISTS ingest_progress_snapshots (
      id BIGSERIAL PRIMARY KEY,
      "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "workerId" INT,
      "workerLabel" TEXT,
      "sourceKey" TEXT,
      "sectionsCompiled" INT NOT NULL DEFAULT 0,
      "sectionsEstimated" INT NOT NULL DEFAULT 0,
      phase TEXT NOT NULL DEFAULT 'worker'
    )
  `)
  await neon.query(`CREATE INDEX IF NOT EXISTS ips_worker_time ON ingest_progress_snapshots ("workerId", "capturedAt" DESC) WHERE "workerId" IS NOT NULL`)
  await neon.query(`CREATE INDEX IF NOT EXISTS ips_source_time ON ingest_progress_snapshots ("sourceKey", "capturedAt" DESC)`)

  await neon.query(`
    CREATE TABLE IF NOT EXISTS specialist_queue (
      id TEXT PRIMARY KEY,
      corpus TEXT NOT NULL,
      "docId" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      specialist_type TEXT NOT NULL,
      title TEXT,
      "legislationYear" INT,
      "legislationType" TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await neon.query(`CREATE INDEX IF NOT EXISTS sq_type_status ON specialist_queue (specialist_type, status)`)
  await neon.query(`CREATE INDEX IF NOT EXISTS sq_corpus_status ON specialist_queue (corpus, status)`)

  console.log('[migrate] Neon tables confirmed (created or already exist)')
}

async function migrateIngestQueue(cp: Checkpoint): Promise<{ before: number; after: number }> {
  const beforeRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM ingest_queue')
  const before = parseInt(beforeRes.rows[0].n, 10)
  const totalRes = await railway.query<{ n: string }>('SELECT COUNT(*) as n FROM ingest_queue')
  const total = parseInt(totalRes.rows[0].n, 10)
  console.log(`[migrate] ingest_queue: Railway ${total.toLocaleString()} rows | Neon ${before.toLocaleString()} rows`)

  let cursor = (cp['ingest_queue'] as string) ?? ''
  let inserted = 0

  while (true) {
    const res = await railway.query<{
      id: string; corpus: string; docId: string; sourceType: string; priority: number
      status: string; claimedBy: number | null; claimedAt: Date | null; completedAt: Date | null
      attempts: number; lastError: string | null; formatsAvailable: string | null
      formatFound: string | null; createdAt: Date
    }>(`
      SELECT id, corpus, "docId", "sourceType", priority, status, "claimedBy", "claimedAt",
             "completedAt", attempts, "lastError", "formatsAvailable", "formatFound", "createdAt"
      FROM ingest_queue WHERE id > $1 ORDER BY id ASC LIMIT $2
    `, [cursor, BATCH])

    if (res.rows.length === 0) break

    const values: unknown[] = []
    const placeholders = res.rows.map((r, i) => {
      const b = i * 14
      values.push(r.id, r.corpus, r.docId, r.sourceType, r.priority, r.status,
        r.claimedBy, r.claimedAt, r.completedAt, r.attempts, r.lastError,
        r.formatsAvailable, r.formatFound, r.createdAt)
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14})`
    })
    const ins = await neon.query(`
      INSERT INTO ingest_queue
        (id, corpus, "docId", "sourceType", priority, status, "claimedBy", "claimedAt",
         "completedAt", attempts, "lastError", "formatsAvailable", "formatFound", "createdAt")
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO NOTHING
    `, values)

    cursor = res.rows[res.rows.length - 1].id
    inserted += ins.rowCount ?? 0
    cp['ingest_queue'] = cursor
    saveCheckpoint(cp)
    if (inserted % 5000 < BATCH) console.log(`  ingest_queue: ${inserted.toLocaleString()} rows inserted…`)
  }

  const afterRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM ingest_queue')
  const after = parseInt(afterRes.rows[0].n, 10)
  console.log(`[migrate] ingest_queue complete — ${inserted.toLocaleString()} new rows. Neon total: ${after.toLocaleString()}`)
  return { before, after }
}

async function migrateRateLimits(cp: Checkpoint): Promise<{ before: number; after: number }> {
  const beforeRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM source_rate_limits')
  const before = parseInt(beforeRes.rows[0].n, 10)
  if (cp['source_rate_limits'] === 'done') {
    console.log(`[migrate] source_rate_limits: already done (${before} rows on Neon)`)
    return { before, after: before }
  }
  const res = await railway.query<{
    sourceKey: string; intervalMs: string; lastIssuedAt: string; suspended: boolean
    suspendedUntil: Date | null; updatedAt: Date; isComplete: boolean; maxConcurrentWorkers: number
  }>('SELECT "sourceKey","intervalMs","lastIssuedAt",suspended,"suspendedUntil","updatedAt","isComplete","maxConcurrentWorkers" FROM source_rate_limits')
  for (const r of res.rows) {
    await neon.query(`
      INSERT INTO source_rate_limits
        ("sourceKey","intervalMs","lastIssuedAt",suspended,"suspendedUntil","updatedAt","isComplete","maxConcurrentWorkers")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT ("sourceKey") DO NOTHING
    `, [r.sourceKey, r.intervalMs, r.lastIssuedAt, r.suspended, r.suspendedUntil, r.updatedAt, r.isComplete, r.maxConcurrentWorkers])
  }
  cp['source_rate_limits'] = 'done'
  saveCheckpoint(cp)
  const afterRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM source_rate_limits')
  const after = parseInt(afterRes.rows[0].n, 10)
  console.log(`[migrate] source_rate_limits complete — ${res.rows.length} entries. Neon total: ${after}`)
  return { before, after }
}

async function migrateSchedulerLock(cp: Checkpoint): Promise<{ before: number; after: number }> {
  const beforeRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM scheduler_lock')
  const before = parseInt(beforeRes.rows[0].n, 10)
  if (cp['scheduler_lock'] === 'done') return { before, after: before }
  try {
    const res = await railway.query<{ id: number; locked_at: Date; process_id: string }>('SELECT * FROM scheduler_lock')
    for (const r of res.rows) {
      await neon.query(
        'INSERT INTO scheduler_lock (id,locked_at,process_id) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
        [r.id, r.locked_at, r.process_id]
      )
    }
    console.log(`[migrate] scheduler_lock complete — ${res.rows.length} rows copied`)
  } catch {
    console.log('[migrate] scheduler_lock: table missing or empty on Railway — creating empty table on Neon only')
  }
  cp['scheduler_lock'] = 'done'
  saveCheckpoint(cp)
  const afterRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM scheduler_lock')
  const after = parseInt(afterRes.rows[0].n, 10)
  return { before, after }
}

async function migrateProgressSnapshots(cp: Checkpoint): Promise<{ before: number; after: number }> {
  const beforeRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM ingest_progress_snapshots')
  const before = parseInt(beforeRes.rows[0].n, 10)
  if (before > 0) {
    console.log(`[migrate] ingest_progress_snapshots: Neon already has ${before.toLocaleString()} rows — skipping`)
    return { before, after: before }
  }
  const totalRes = await railway.query<{ n: string }>(
    `SELECT COUNT(*) as n FROM ingest_progress_snapshots WHERE "capturedAt" > NOW() - INTERVAL '24 hours'`
  )
  const total = parseInt(totalRes.rows[0].n, 10)
  console.log(`[migrate] ingest_progress_snapshots: copying last 24h (${total.toLocaleString()} rows)`)

  // Migrate in one shot (snapshots are small per-row, last 24h is typically < 5k rows)
  const res = await railway.query<{
    capturedAt: Date; workerId: number | null; workerLabel: string | null
    sourceKey: string | null; sectionsCompiled: number; sectionsEstimated: number; phase: string
  }>(`
    SELECT "capturedAt","workerId","workerLabel","sourceKey","sectionsCompiled","sectionsEstimated",phase
    FROM ingest_progress_snapshots
    WHERE "capturedAt" > NOW() - INTERVAL '24 hours'
    ORDER BY "capturedAt" ASC
  `)
  if (res.rows.length === 0) {
    console.log('[migrate] ingest_progress_snapshots: no recent rows on Railway')
    return { before, after: 0 }
  }
  for (let i = 0; i < res.rows.length; i += BATCH) {
    const batch = res.rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const placeholders = batch.map((r, j) => {
      const b = j * 7
      values.push(r.capturedAt, r.workerId, r.workerLabel, r.sourceKey, r.sectionsCompiled, r.sectionsEstimated, r.phase)
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7})`
    })
    await neon.query(`
      INSERT INTO ingest_progress_snapshots
        ("capturedAt","workerId","workerLabel","sourceKey","sectionsCompiled","sectionsEstimated",phase)
      VALUES ${placeholders.join(',')}
    `, values)
  }
  const afterRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM ingest_progress_snapshots')
  const after = parseInt(afterRes.rows[0].n, 10)
  console.log(`[migrate] ingest_progress_snapshots complete — ${res.rows.length.toLocaleString()} rows. Neon total: ${after.toLocaleString()}`)
  return { before, after }
}

async function migrateSpecialistQueue(cp: Checkpoint): Promise<{ before: number; after: number }> {
  const beforeRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM specialist_queue')
  const before = parseInt(beforeRes.rows[0].n, 10)
  try {
    const totalRes = await railway.query<{ n: string }>('SELECT COUNT(*) as n FROM specialist_queue')
    const total = parseInt(totalRes.rows[0].n, 10)
    console.log(`[migrate] specialist_queue: Railway ${total.toLocaleString()} rows | Neon ${before.toLocaleString()} rows`)

    let cursor = (cp['specialist_queue'] as string) ?? ''
    let inserted = 0
    while (true) {
      const res = await railway.query<{
        id: string; corpus: string; docId: string; sourceType: string; specialist_type: string
        title: string | null; legislationYear: number | null; legislationType: string | null
        notes: string | null; createdAt: Date
      }>(`
        SELECT id, corpus, "docId", "sourceType", specialist_type, title, "legislationYear",
               "legislationType", notes, "createdAt"
        FROM specialist_queue WHERE id > $1 ORDER BY id ASC LIMIT $2
      `, [cursor, BATCH])
      if (res.rows.length === 0) break
      const values: unknown[] = []
      const placeholders = res.rows.map((r, i) => {
        const b = i * 10
        values.push(r.id, r.corpus, r.docId, r.sourceType, r.specialist_type, r.title,
          r.legislationYear, r.legislationType, r.notes, r.createdAt)
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`
      })
      const ins = await neon.query(`
        INSERT INTO specialist_queue
          (id, corpus, "docId", "sourceType", specialist_type, title, "legislationYear",
           "legislationType", notes, "createdAt")
        VALUES ${placeholders.join(',')}
        ON CONFLICT (id) DO NOTHING
      `, values)
      cursor = res.rows[res.rows.length - 1].id
      inserted += ins.rowCount ?? 0
      cp['specialist_queue'] = cursor
      saveCheckpoint(cp)
    }
    const afterRes = await neon.query<{ n: string }>('SELECT COUNT(*) as n FROM specialist_queue')
    const after = parseInt(afterRes.rows[0].n, 10)
    console.log(`[migrate] specialist_queue complete — ${inserted.toLocaleString()} rows. Neon total: ${after.toLocaleString()}`)
    return { before, after }
  } catch {
    console.log('[migrate] specialist_queue: table not found on Railway — creating empty table on Neon only')
    return { before, after: 0 }
  }
}

// WHY: workers must be stopped before migration. If workers are claiming rows from Railway
// while Neon has incomplete data, the two DBs diverge and pending rows can be lost.
// Stop all 20 workers via Railway API (deploymentRedeploy → CRASHED intentionally, or
// serviceInstanceUpdate restartPolicyType=NEVER) before running this script.
// Redeploy with NEON_DATABASE_URL code after migration completes.
async function assertNoActiveWorkers(): Promise<void> {
  const res = await railway.query<{ n: string }>(
    `SELECT COUNT(*) as n FROM ingest_queue WHERE status = 'claimed' AND "claimedAt" > NOW() - INTERVAL '5 minutes'`
  )
  const active = parseInt(res.rows[0].n, 10)
  if (active > 0) {
    console.error(`\n[migrate] ABORT — ${active} rows claimed in last 5 minutes.`)
    console.error('[migrate] Stop all Railway ingest workers before running this migration.')
    console.error('[migrate] Workers must not be writing to Railway queue during migration.')
    process.exit(1)
  }
  console.log('[migrate] Preflight OK — no active worker claims in last 5 minutes')
}

async function main() {
  console.log('[migrate] V16: queue migration Railway → Neon')
  if (!process.env.DATABASE_URL) { console.error('[migrate] DATABASE_URL not set'); process.exit(1) }
  if (!process.env.NEON_DATABASE_URL) { console.error('[migrate] NEON_DATABASE_URL not set'); process.exit(1) }

  await assertNoActiveWorkers()

  const cp = loadCheckpoint()

  await ensureNeonTables()

  const results: Record<string, { before: number; after: number }> = {}
  results['ingest_queue']               = await migrateIngestQueue(cp)
  results['source_rate_limits']         = await migrateRateLimits(cp)
  results['scheduler_lock']             = await migrateSchedulerLock(cp)
  results['ingest_progress_snapshots']  = await migrateProgressSnapshots(cp)
  results['specialist_queue']           = await migrateSpecialistQueue(cp)

  console.log('\n[migrate] === ROW COUNT SUMMARY ===')
  for (const [table, { before, after }] of Object.entries(results)) {
    const added = after - before
    console.log(`  ${table.padEnd(36)} before: ${String(before).padStart(7)}  after: ${String(after).padStart(7)}  (+${added})`)
  }

  await railway.end()
  await neon.end()
  try { fs.unlinkSync(CHECKPOINT_FILE) } catch { /* ok */ }
  console.log('[migrate] done')
}

main().catch((e: unknown) => { console.error('[migrate] fatal:', e); process.exit(1) })
