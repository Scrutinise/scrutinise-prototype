/**
 * queue-client.ts — raw-pg interface to ingest_queue.
 *
 * Uses FOR UPDATE SKIP LOCKED for atomic single-row claims — safe for parallel
 * claim loops on the same database without application-level locking.
 *
 * V17: rate-limit enforcement moved out of the claim SQL into the in-process
 * token bucket (shared/rate-limiter.ts). source_rate_limits is configuration
 * only — read at startup via loadRateLimitConfigs(), never written per-claim.
 */
import { getNeonPool, endNeonPool } from './neon-pool'
import { rateLimiter, SourceRateConfig } from './rate-limiter'
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

function getPool() {
  return getNeonPool()
}

export async function disconnectQueue(): Promise<void> {
  await endNeonPool()
}

// ── Rate-limit configuration (read-only since V17) ───────────────────────────

// Loads source_rate_limits into the in-process token bucket. Called once at
// pool-worker startup. To apply a rate change: edit the table, restart ingest.
export async function loadRateLimitConfigs(): Promise<SourceRateConfig[]> {
  const res = await getPool().query<{
    sourceKey: string
    intervalMs: number
    maxConcurrentWorkers: number | null
    suspended: boolean
    suspendedUntil: Date | null
  }>(`
    SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "suspendedUntil"
    FROM source_rate_limits
  `)
  // intervalMs is BIGINT — pg returns it as a STRING. Without Number() the
  // token bucket computes Date.now() + "200" = string concat = a timestamp
  // millennia away, permanently disabling the source after its first claim
  // (the V17 shakedown freeze).
  return res.rows.map(r => ({
    sourceKey: r.sourceKey,
    intervalMs: Number(r.intervalMs),
    maxConcurrent: Number(r.maxConcurrentWorkers ?? 20),
    suspendedUntil: r.suspended && r.suspendedUntil ? new Date(r.suspendedUntil).getTime() : null,
  }))
}

// Distinct sourceTypes that currently have pending rows — the candidate set
// for the in-memory limiter. Refreshed by the pool worker every sweep.
export async function listPendingSourceTypes(): Promise<string[]> {
  const res = await getPool().query<{ sourceType: string }>(`
    SELECT DISTINCT "sourceType" FROM ingest_queue WHERE status = 'pending'
  `)
  return res.rows.map(r => r.sourceType)
}

// Single-statement atomic claim across the given (limiter-eligible) sources.
// Highest priority first. No source_rate_limits writes — token issuance is
// recorded in-process by the caller via rateLimiter.recordClaim().
export async function claimNextFromSources(workerId: number, sourceTypes: string[]): Promise<QueueRow | null> {
  if (sourceTypes.length === 0) return null
  const res = await getPool().query<QueueRow>(`
    UPDATE ingest_queue
    SET status      = 'claimed',
        "claimedBy" = $1,
        "claimedAt" = NOW(),
        attempts    = attempts + 1
    WHERE id = (
      SELECT id FROM ingest_queue
      WHERE status = 'pending'
        AND "sourceType" = ANY($2::text[])
      ORDER BY priority ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `, [workerId, sourceTypes])
  return res.rows[0] ?? null
}

// Suspend a source after receiving a 429. Duration defaults to 60s if no
// Retry-After header was provided. The DB write keeps the suspension visible
// to ops/diagnostics; the in-memory bucket enforces it immediately in-process.
export async function suspendSource(sourceKey: string, durationMs: number): Promise<void> {
  rateLimiter.suspend(sourceKey, durationMs)
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

// producedOutput (V24): the worker's per-row verdict for the zero-output breaker
// — true if the row wrote a compiled section, confirmed an existing R2 file
// (idempotent reseed), wrote a no-content marker, or is a structural seeder;
// false if it genuinely produced nothing; null when the caller doesn't track it
// (legacy/maintenance callers — excluded from the breaker window).
export async function markDone(id: string, formatFound?: string, producedOutput?: boolean | null): Promise<void> {
  await getPool().query(`
    UPDATE ingest_queue
    SET status = 'done', "completedAt" = NOW(), "formatFound" = $2, produced_output = $3
    WHERE id = $1
  `, [id, formatFound ?? null, producedOutput ?? null])
}

export async function markFailed(id: string, error: string): Promise<void> {
  await getPool().query(`
    UPDATE ingest_queue
    SET status = 'failed', "lastError" = $2
    WHERE id = $1
  `, [id, error])
}

/**
 * Return a row to `pending` because the SOURCE was temporarily unable to answer —
 * a 429, a 503, a 5xx, a network drop. Not a failure of the row.
 *
 * ⚠ THIS EXISTS BECAUSE THE FIX FOR ONE DEFECT CAUSED ANOTHER. V36 made
 * `enumerateSections` throw `RetryableSourceError` rather than write a transient
 * fetch failure down as a permanent "this instrument has no text" marker. The worker
 * caught it and called `markFailed` — and ops' failure breaker trips on five
 * consecutive failures, so a short burst of TNA throttling parked all 39,964 pending
 * rows of the recovery as `blocked` within minutes of the run starting. The breaker
 * was right: it is built for DETERMINISTIC failures, which must never be retried. A
 * retryable failure is the opposite kind and must not be counted as one.
 *
 * Capped by `attempts` so a row that always fails this way cannot spin forever: past
 * the cap it becomes a real `failed`, visible with its reason, and the breaker may
 * legitimately count it.
 */
export async function markRetryable(id: string, error: string, maxAttempts = 5): Promise<'pending' | 'failed'> {
  const { rows } = await getPool().query<{ status: string }>(`
    UPDATE ingest_queue
    SET status      = CASE WHEN attempts >= $3 THEN 'failed' ELSE 'pending' END,
        "lastError" = $2,
        "claimedBy" = NULL,
        "claimedAt" = NULL
    WHERE id = $1
    RETURNING status
  `, [id, error, maxAttempts])
  return (rows[0]?.status as 'pending' | 'failed') ?? 'failed'
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

// Batched queue insert (V18 seeders). With resetExisting, rows whose id already
// exists in a terminal state (done/skipped/failed) are reset to pending — used
// by the pwdata granularity migration, which deliberately re-processes the
// whole archive. Without it, existing ids are left untouched.
export async function bulkInsertQueueRows(
  rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }>,
  opts: { resetExisting?: boolean } = {},
  chunkSize = 500,
): Promise<{ affected: number }> {
  let affected = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values: string[] = []
    const params: unknown[] = []
    chunk.forEach((r, j) => {
      const b = j * 5
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},'pending')`)
      params.push(r.id, r.corpus, r.docId, r.sourceType, r.priority)
    })
    const conflict = opts.resetExisting
      ? `ON CONFLICT (id) DO UPDATE SET
           status = 'pending', priority = EXCLUDED.priority,
           "lastError" = NULL, "claimedBy" = NULL, "claimedAt" = NULL
         WHERE ingest_queue.status IN ('done', 'skipped', 'failed')`
      : 'ON CONFLICT (id) DO NOTHING'
    const res = await getPool().query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
       VALUES ${values.join(',')} ${conflict}`,
      params
    )
    affected += res.rowCount ?? 0
  }
  return { affected }
}

// Returns count of all pending rows — used to distinguish empty queue from rate-limited.
export async function countPendingRows(): Promise<number> {
  const res = await getPool().query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM ingest_queue WHERE status = \'pending\''
  )
  return res.rows[0]?.count ?? 0
}

// Returns the lexicographically highest docId for a corpus — used as discovery cursor.
export async function getMaxDocIdForCorpus(corpus: string): Promise<string | null> {
  const res = await getPool().query<{ docId: string }>(
    'SELECT "docId" FROM ingest_queue WHERE corpus = $1 ORDER BY "docId" DESC LIMIT 1',
    [corpus]
  )
  return res.rows[0]?.docId ?? null
}

// Returns all docIds for a corpus — used by FCA discovery to find missing sourcebooks.
export async function getAllDocIdsForCorpus(corpus: string): Promise<Set<string>> {
  const res = await getPool().query<{ docId: string }>(
    'SELECT "docId" FROM ingest_queue WHERE corpus = $1',
    [corpus]
  )
  return new Set(res.rows.map(r => r.docId))
}

// Mark a sourceType as exhausted — workers skip it in their priority selection.
// Reset by scheduler weekly or via seed-rate-limits.ts re-run.
export async function markSourceTypeComplete(sourceType: string): Promise<void> {
  await getPool().query(
    'UPDATE source_rate_limits SET "isComplete" = true, "updatedAt" = NOW() WHERE "sourceKey" = $1',
    [sourceType]
  )
  console.log(`[queue] marked ${sourceType} as complete`)
}

// Returns the highest-priority sourceType that still has work to do:
// either pending rows OR not yet marked isComplete.
// Used by the worker to decide which source to self-discover next.
export async function getNextDiscoveryTarget(): Promise<string | null> {
  // Priority order mirrors CORPUS_MANIFEST: lower number = higher priority.
  // We pick the first sourceType that is NOT isComplete and has the lowest
  // priority value in the queue (or a known rate-limit entry not yet complete).
  const res = await getPool().query<{ sourceType: string; minPriority: number }>(`
    SELECT q."sourceType", MIN(q.priority) AS "minPriority"
    FROM ingest_queue q
    LEFT JOIN source_rate_limits r ON r."sourceKey" = q."sourceType"
    WHERE q.status IN ('done', 'pending', 'claimed')
      AND (r."isComplete" IS NULL OR r."isComplete" = false)
      AND NOT EXISTS (
        SELECT 1 FROM ingest_queue q2
        WHERE q2."sourceType" = q."sourceType" AND q2.status = 'pending'
      )
    GROUP BY q."sourceType"
    ORDER BY "minPriority" ASC, q."sourceType" ASC
    LIMIT 1
  `)
  return res.rows[0]?.sourceType ?? null
}

// ── Discovery lock ────────────────────────────────────────────────────────────
// Only one worker runs discovery at a time to prevent thundering-herd on TNA.
// Uses scheduler_lock id=2 (id=1 is the scheduler mutex).
// 10-minute timeout ensures lock auto-expires if a worker crashes mid-discovery.

export async function acquireDiscoveryLock(workerId: string): Promise<boolean> {
  try {
    await getPool().query(`
      INSERT INTO scheduler_lock (id, locked_at, process_id)
      VALUES (2, NOW(), $1)
      ON CONFLICT (id) DO UPDATE
        SET locked_at = NOW(), process_id = $1
        WHERE scheduler_lock.locked_at < NOW() - INTERVAL '10 minutes'
    `, [workerId])
    const res = await getPool().query<{ process_id: string }>(
      'SELECT process_id FROM scheduler_lock WHERE id = 2'
    )
    return res.rows[0]?.process_id === workerId
  } catch { return false }
}

export async function releaseDiscoveryLock(workerId: string): Promise<void> {
  await getPool().query(
    'DELETE FROM scheduler_lock WHERE id = 2 AND process_id = $1',
    [workerId]
  ).catch(() => {})
}

// Bulk upsert — much faster than individual upserts for large populations
export async function insertSpecialistQueueRow(row: {
  id: string
  corpus: string
  docId: string
  sourceType: string
  specialistType: 'commencement' | 'revoked' | 'pdf-only' | 'metadata-only'
  title?: string
  legislationYear?: number
  legislationType?: string
  notes?: string
}): Promise<void> {
  await getPool().query(`
    INSERT INTO specialist_queue
      (id, corpus, "docId", "sourceType", specialist_type, title, "legislationYear", "legislationType", notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO NOTHING
  `, [
    row.id,
    row.corpus,
    row.docId,
    row.sourceType,
    row.specialistType,
    row.title ?? null,
    row.legislationYear ?? null,
    row.legislationType ?? null,
    row.notes ?? null,
  ])
}

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
