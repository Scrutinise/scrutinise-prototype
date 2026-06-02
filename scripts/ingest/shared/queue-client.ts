/**
 * queue-client.ts — raw-pg interface to ingest_queue.
 *
 * Uses FOR UPDATE SKIP LOCKED for atomic single-row claims — safe for parallel
 * workers on the same database without application-level locking.
 */
import { Pool, PoolClient } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

export interface QueueRow {
  id: string
  corpus: string
  docId: string
  sourceType: string
  priority: number
  status: string
  claimedBy: number | null
  claimedAt: Date | null
  completedAt: Date | null
  attempts: number
  lastError: string | null
  formatsAvailable: string | null
  formatFound: string | null
  createdAt: Date
}

let _pool: Pool | null = null

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    _pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  }
  return _pool
}

export async function disconnectQueue(): Promise<void> {
  await _pool?.end()
  _pool = null
}

// Two-phase atomic claim with rate-limit token check.
//
// Phase 1: find the highest-priority sourceType that has an available token in
//          source_rate_limits (elapsed >= intervalMs, not suspended).
//          Falls back to any pending source with no rate-limit entry.
// Phase 2: claim one row from that source and update lastIssuedAt atomically.
//
// Two workers running Phase 1 simultaneously may both select the same source —
// Phase 2's SKIP LOCKED ensures they claim different rows and both update
// lastIssuedAt. The result is at most 2 requests per interval rather than N.
// This is acceptable and far better than the previous N×(1/200ms) aggregate rate.

export async function claimNextChunk(workerId: number): Promise<QueueRow | null> {
  const client = await getPool().connect()
  const nowMs = Date.now().toString()
  try {
    await client.query('BEGIN')

    // Phase 1a: highest-priority source with available token
    const tokenRes = await client.query<{ sourceType: string }>(`
      SELECT q."sourceType"
      FROM ingest_queue q
      JOIN source_rate_limits r ON r."sourceKey" = q."sourceType"
      WHERE q.status = 'pending'
        AND r.suspended = false
        AND ($1::bigint - r."lastIssuedAt") >= r."intervalMs"
      ORDER BY q.priority ASC, r."lastIssuedAt" ASC
      LIMIT 1
    `, [nowMs])

    let sourceType: string | null = tokenRes.rows[0]?.sourceType ?? null

    // Phase 1b: fallback — pending rows for sources not in source_rate_limits
    if (!sourceType) {
      const unconstrainedRes = await client.query<{ sourceType: string }>(`
        SELECT DISTINCT q."sourceType"
        FROM ingest_queue q
        WHERE q.status = 'pending'
          AND NOT EXISTS (
            SELECT 1 FROM source_rate_limits r WHERE r."sourceKey" = q."sourceType"
          )
        ORDER BY q."sourceType"
        LIMIT 1
      `)
      sourceType = unconstrainedRes.rows[0]?.sourceType ?? null
    }

    if (!sourceType) {
      await client.query('ROLLBACK')
      return null  // no token available or queue truly empty
    }

    // Phase 2: claim one row from the selected source
    const claimRes = await client.query<QueueRow>(`
      UPDATE ingest_queue
      SET status     = 'claimed',
          "claimedBy" = $1,
          "claimedAt" = NOW(),
          attempts    = attempts + 1
      WHERE id = (
        SELECT id FROM ingest_queue
        WHERE status = 'pending'
          AND "sourceType" = $2
        ORDER BY priority ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `, [workerId, sourceType])

    if (claimRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }

    // Update token timestamp atomically with the claim
    await client.query(`
      UPDATE source_rate_limits
      SET "lastIssuedAt" = $1, "updatedAt" = NOW()
      WHERE "sourceKey" = $2
    `, [nowMs, sourceType])

    await client.query('COMMIT')
    return claimRes.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Returns how long the worker should sleep when claimNextChunk() returns null.
// Computes the minimum time until the next token becomes available across all
// pending sources, so workers wake up exactly when work can resume.
export async function getSleepDuration(): Promise<number> {
  const now = BigInt(Date.now())
  const res = await getPool().query<{ intervalMs: number; lastIssuedAt: string }>(`
    SELECT DISTINCT r."intervalMs", r."lastIssuedAt"
    FROM source_rate_limits r
    JOIN ingest_queue q ON q."sourceType" = r."sourceKey"
    WHERE q.status = 'pending' AND r.suspended = false
    LIMIT 20
  `)
  if (res.rows.length === 0) return 60_000  // queue empty — check in 1 min

  const waits = res.rows.map(r => {
    const nextAvailable = BigInt(r.lastIssuedAt) + BigInt(r.intervalMs)
    const wait = nextAvailable - now
    return wait > 0n ? Number(wait) : 0
  })
  return Math.max(10, Math.min(...waits))
}

// Suspend a source after receiving a 429. Duration defaults to 60s if no
// Retry-After header was provided.
export async function suspendSource(sourceKey: string, durationMs: number): Promise<void> {
  const until = new Date(Date.now() + durationMs)
  await getPool().query(`
    UPDATE source_rate_limits
    SET suspended = true, "suspendedUntil" = $1, "updatedAt" = NOW()
    WHERE "sourceKey" = $2
  `, [until.toISOString(), sourceKey])
  console.warn(`[rate-limit] ${sourceKey} suspended until ${until.toISOString()}`)
}

// Unsuspend sources whose suspendedUntil has passed. Called by the scheduler.
export async function clearExpiredSuspensions(): Promise<void> {
  const res = await getPool().query(`
    UPDATE source_rate_limits
    SET suspended = false, "suspendedUntil" = NULL, "updatedAt" = NOW()
    WHERE suspended = true AND "suspendedUntil" < NOW()
    RETURNING "sourceKey"
  `)
  if (res.rows.length > 0) {
    console.log('[rate-limit] unsuspended:', res.rows.map((r: { sourceKey: string }) => r.sourceKey).join(', '))
  }
}

export async function markDone(id: string, formatFound?: string): Promise<void> {
  await getPool().query(`
    UPDATE ingest_queue
    SET status = 'done', "completedAt" = NOW(), "formatFound" = $2
    WHERE id = $1
  `, [id, formatFound ?? null])
}

export async function markFailed(id: string, error: string): Promise<void> {
  await getPool().query(`
    UPDATE ingest_queue
    SET status = 'failed', "lastError" = $2
    WHERE id = $1
  `, [id, error])
}

export async function markSkipped(id: string): Promise<void> {
  await getPool().query(`
    UPDATE ingest_queue SET status = 'skipped', "completedAt" = NOW() WHERE id = $1
  `, [id])
}

export async function resetFailedToPending(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await getPool().query(`
    UPDATE ingest_queue
    SET status = 'pending', "lastError" = NULL, "claimedBy" = NULL, "claimedAt" = NULL
    WHERE id = ANY($1::text[])
  `, [ids])
}

export async function updateFormatsAvailable(id: string, formats: string): Promise<void> {
  await getPool().query(`
    UPDATE ingest_queue SET "formatsAvailable" = $2 WHERE id = $1
  `, [id, formats])
}

// Count rows by status — used by monitor and scheduler
export async function getQueueCounts(): Promise<Record<string, number>> {
  const res = await getPool().query<{ status: string; count: string }>(`
    SELECT status, COUNT(*)::int AS count FROM ingest_queue GROUP BY status
  `)
  const out: Record<string, number> = {}
  for (const row of res.rows) out[row.status] = parseInt(row.count, 10)
  return out
}

// Get failed rows for error analysis
export async function getFailedRows(minAttempts = 2, limit = 200): Promise<QueueRow[]> {
  const res = await getPool().query<QueueRow>(`
    SELECT * FROM ingest_queue
    WHERE status = 'failed' AND attempts >= $1
    ORDER BY "createdAt" ASC
    LIMIT $2
  `, [minAttempts, limit])
  return res.rows
}

// Upsert a queue row (used by populator — idempotent)
export async function upsertQueueRow(row: {
  id: string
  corpus: string
  docId: string
  sourceType: string
  priority: number
}): Promise<void> {
  await getPool().query(`
    INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [row.id, row.corpus, row.docId, row.sourceType, row.priority])
}

// Bulk upsert — much faster than individual upserts for large populations
export async function bulkUpsertQueueRows(rows: Array<{
  id: string
  corpus: string
  docId: string
  sourceType: string
  priority: number
}>): Promise<number> {
  if (rows.length === 0) return 0
  const BATCH = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const placeholders = batch.map((r, j) => {
      const base = j * 5
      values.push(r.id, r.corpus, r.docId, r.sourceType, r.priority)
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    })

    const res = await getPool().query(`
      INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, values)
    inserted += res.rowCount ?? 0
  }

  return inserted
}
