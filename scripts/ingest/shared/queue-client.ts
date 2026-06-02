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

// Atomic claim: returns the claimed row or null if queue is empty.
// Uses FOR UPDATE SKIP LOCKED so concurrent workers never claim the same row.
export async function claimNextChunk(workerId: number): Promise<QueueRow | null> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const res = await client.query<QueueRow>(`
      UPDATE ingest_queue
      SET status = 'claimed',
          "claimedBy" = $1,
          "claimedAt" = NOW(),
          attempts    = attempts + 1
      WHERE id = (
        SELECT id FROM ingest_queue
        WHERE status = 'pending'
        ORDER BY priority ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `, [workerId])
    await client.query('COMMIT')
    return res.rows[0] ?? null
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
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
