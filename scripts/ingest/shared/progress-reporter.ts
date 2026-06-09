import { Pool } from 'pg'
import { r2Get, r2Put, PROGRESS_KEY, csvKey } from './r2-client'
import { WorkerCheckpoint, readCheckpoint } from './checkpoint'

const RESEND_API = 'https://api.resend.com/emails'
const TO = 'cl@scrutinise.org'

// ── DB pool (Railway — ingest_queue, snapshots, scheduler_lock) ──────────────

let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    })
  }
  return _pool
}

// ── DB pool (Neon — corpus_sections, corpus_targets) ─────────────────────────

let _neonPool: Pool | null = null
function getNeonPool(): Pool {
  if (!_neonPool) {
    const url = process.env.NEON_DATABASE_URL
    if (!url) throw new Error('NEON_DATABASE_URL not set')
    _neonPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    })
  }
  return _neonPool
}

// ── Scheduler lock — prevents duplicate email sends when two instances overlap ─
// Uses a random per-startup ID (not process.pid) because Railway containers all start as PID 1.

const SCHEDULER_INSTANCE_ID = Math.random().toString(36).slice(2)

export async function acquireSchedulerLock(): Promise<boolean> {
  const pool = getPool()
  try {
    await pool.query(`
      INSERT INTO scheduler_lock (id, locked_at, process_id)
      VALUES (1, NOW(), $1)
      ON CONFLICT (id) DO UPDATE
        SET locked_at = NOW(), process_id = $1
        WHERE scheduler_lock.locked_at < NOW() - INTERVAL '50 minutes'
    `, [SCHEDULER_INSTANCE_ID])
    const res = await pool.query<{ process_id: string }>(
      'SELECT process_id FROM scheduler_lock WHERE id = 1'
    )
    return res.rows[0]?.process_id === SCHEDULER_INSTANCE_ID
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('does not exist') || msg.includes('relation "scheduler_lock"')) {
      console.warn('[scheduler] scheduler_lock table not yet created — running without lock')
      return true
    }
    console.warn('[scheduler] lock acquisition failed:', msg)
    return false
  }
}

// ── corpus_targets row ────────────────────────────────────────────────────────

interface CorpusTarget {
  corpus_key: string
  display_label: string
  est_sections: number | null
  est_is_confirmed: boolean
  priority: number
  blocked: boolean
  blocked_reason: string | null
  retired: boolean
}

async function queryCorpusTargets(): Promise<CorpusTarget[]> {
  const res = await getNeonPool().query<CorpusTarget>(`
    SELECT corpus_key, display_label, est_sections, est_is_confirmed,
           priority, blocked, blocked_reason,
           COALESCE(retired, false) AS retired
    FROM corpus_targets
    ORDER BY priority, corpus_key
  `)
  return res.rows
}

// ── Per-corpus compiled section counts (Neon corpus_sections) ────────────────

export async function queryCorpusCounts(): Promise<Record<string, { compiled: number; failed: number }>> {
  const res = await getNeonPool().query<{ corpus: string; status: string; count: number }>(`
    SELECT corpus, status, COUNT(*)::int AS count
    FROM corpus_sections
    WHERE status IN ('compiled', 'failed')
    GROUP BY corpus, status
    ORDER BY corpus
  `)
  const out: Record<string, { compiled: number; failed: number }> = {}
  for (const row of res.rows) {
    if (!out[row.corpus]) out[row.corpus] = { compiled: 0, failed: 0 }
    if (row.status === 'compiled') out[row.corpus].compiled = row.count
    else if (row.status === 'failed') out[row.corpus].failed = row.count
  }
  return out
}

// Returns set of all corpus values that have any row in ingest_queue.
export async function queryQueueCorpora(): Promise<Set<string>> {
  const res = await getPool().query<{ corpus: string }>('SELECT DISTINCT corpus FROM ingest_queue')
  return new Set(res.rows.map(r => r.corpus))
}

// ── Neon LegislationSection count (legacy pipeline) ──────────────────────────

const NEON_FALLBACK = 914_274  // confirmed count from 2 Jun 2026 transfer

export async function queryNeonCount(): Promise<number> {
  const url = process.env.NEON_DATABASE_URL
  if (!url) {
    console.log('[reporter] NEON_DATABASE_URL not set — using confirmed baseline')
    return NEON_FALLBACK
  }
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  })
  try {
    const res = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM "LegislationSection"')
    return res.rows[0]?.count ?? NEON_FALLBACK
  } catch (err) {
    console.warn('[reporter] Neon query failed — using baseline:', err)
    return NEON_FALLBACK
  } finally {
    await pool.end()
  }
}

// ── corpus_snapshots write ────────────────────────────────────────────────────

export interface CorpusSnapshotEntry {
  corpus: string
  count: number
  compiled: number
}

export async function writeCorpusSnapshot(
  censusCounts: CorpusSnapshotEntry[],
  legacyCount: number,
): Promise<void> {
  const neonPool = getNeonPool()
  const hour = new Date()
  hour.setMinutes(0, 0, 0)
  hour.setMilliseconds(0)

  const entries: Array<{ hour: string; corpus_key: string; section_count: number; compiled_count: number; source: string }> = [
    ...censusCounts.map(c => ({
      hour: hour.toISOString(),
      corpus_key: c.corpus,
      section_count: c.count,
      compiled_count: c.compiled,
      source: 'corpus_sections',
    })),
    {
      hour: hour.toISOString(),
      corpus_key: 'legacy-legislation-section',
      section_count: legacyCount,
      compiled_count: legacyCount,
      source: 'legacy',
    },
  ]

  for (const v of entries) {
    await neonPool.query(`
      INSERT INTO corpus_snapshots (hour, corpus_key, section_count, compiled_count, source)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (hour, corpus_key) DO UPDATE
        SET section_count  = EXCLUDED.section_count,
            compiled_count = EXCLUDED.compiled_count,
            captured_at    = now()
    `, [v.hour, v.corpus_key, v.section_count, v.compiled_count, v.source])
  }
  console.log(`[reporter] wrote ${entries.length} snapshot rows for hour ${hour.toISOString()}`)
}

// ── Hourly delta from corpus_snapshots ───────────────────────────────────────

export async function getHourlyDelta(
  currentCounts: Map<string, number>,
  currentHour: Date,
): Promise<Map<string, number>> {
  const neonPool = getNeonPool()
  const prevHour = new Date(currentHour.getTime() - 60 * 60 * 1000)
  try {
    const { rows } = await neonPool.query<{ corpus_key: string; section_count: number }>(`
      SELECT corpus_key, section_count
      FROM corpus_snapshots
      WHERE hour = $1
    `, [prevHour.toISOString()])
    if (rows.length === 0) return new Map()  // no previous snapshot → show "--" not a fabricated total
    const prevCounts = new Map<string, number>(rows.map(r => [r.corpus_key, Number(r.section_count)]))
    const delta = new Map<string, number>()
    for (const [corpus, current] of currentCounts) {
      const prev = prevCounts.get(corpus) ?? 0
      delta.set(corpus, current - prev)
    }
    return delta
  } catch {
    return new Map()
  }
}

// ── Per-worker snapshot write ─────────────────────────────────────────────────

export async function writeWorkerSnapshot(
  workerId: number,
  sourceKey: string,
  sectionsCompiled: number,
): Promise<void> {
  const pool = getPool()
  await pool.query(`
    INSERT INTO ingest_progress_snapshots
      ("capturedAt", "workerId", "workerLabel", "sourceKey", "sectionsCompiled", "sectionsEstimated", phase)
    VALUES (NOW(), $1, $2, $3, $4, 0, 'worker')
  `, [workerId, `Worker ${workerId}`, sourceKey, sectionsCompiled])
}

// ── IngestProgressSnapshot write ─────────────────────────────────────────────

export async function saveProgressSnapshot(
  corpusCounts: Record<string, { compiled: number; failed: number }>,
  capturedAt: Date,
): Promise<void> {
  const pool = getPool()
  for (const [corpus, counts] of Object.entries(corpusCounts)) {
    await pool.query(`
      INSERT INTO ingest_progress_snapshots
        ("capturedAt", "workerLabel", "sourceKey", "sectionsCompiled", "sectionsEstimated", phase)
      VALUES ($1, $2, $3, $4, 0, $5)
    `, [capturedAt, corpus, corpus, counts.compiled, 'queue'])
  }
}

// ── Time-series ETA from snapshots ───────────────────────────────────────────

async function queryEtaFromSnapshots(totalEstimated: number, currentCompiled: number): Promise<string> {
  try {
    const res = await getPool().query<{ capturedAt: Date; total: number }>(`
      SELECT "capturedAt", SUM("sectionsCompiled")::int AS total
      FROM ingest_progress_snapshots
      GROUP BY "capturedAt"
      ORDER BY "capturedAt" DESC
      LIMIT 6
    `)
    const points = res.rows.reverse()  // oldest first
    if (points.length < 2) return 'Insufficient data'

    const newest = points[points.length - 1]
    const oldest = points[0]
    const deltaCompiled = Number(newest.total) - Number(oldest.total)
    const deltaMs = new Date(newest.capturedAt).getTime() - new Date(oldest.capturedAt).getTime()

    if (deltaMs <= 0 || deltaCompiled <= 0) return 'No rate data'

    const sectionsPerHour = deltaCompiled / (deltaMs / 3_600_000)
    const remaining = totalEstimated - currentCompiled
    if (remaining <= 0) return 'Complete'

    const hoursNeeded = remaining / sectionsPerHour
    const eta = new Date(Date.now() + hoursNeeded * 3_600_000)
    const rate = Math.round(sectionsPerHour).toLocaleString()
    const dateStr = eta.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    return `${dateStr}  (${rate} secs/hr)`
  } catch {
    return 'ETA unavailable'
  }
}

// ── Checkpoint aggregate (kept for legacy R2 writes) ─────────────────────────

export interface WorkerSummary {
  workerId: number
  corpus: string
  phase: 1 | 2
  completed: number
  total: number
  pct: string
  failed: number
  phase1Complete: boolean
  lastUpdated: string
}

export interface ProgressAggregate {
  timestamp: string
  workers: WorkerSummary[]
  totalCompleted: number
  totalEstimated: number
  totalPct: string
}

const CHECKPOINT_LABELS: Record<number, string> = {
  1: 'Primary Acts pre-2000',
  2: 'Primary Acts 2000+',
  3: 'SIs pre-2010',
  4: 'SIs 2010+',
  5: 'Regional (Scot/Wales/NI)',
  6: 'Retained EU Law',
  7: 'FCA + Regulators',
  8: 'HMRC + Guidance',
  9: 'TNA Case Law',
  10: 'International',
}

export async function buildAggregate(): Promise<ProgressAggregate> {
  const workers: WorkerSummary[] = []
  let totalCompleted = 0
  let totalEstimated = 0

  for (let id = 1; id <= 20; id++) {
    const cp = await readCheckpoint(id)
    const pct = cp.totalInCorpus > 0
      ? ((cp.completed / cp.totalInCorpus) * 100).toFixed(1) + '%'
      : '—'
    workers.push({
      workerId: id,
      corpus: CHECKPOINT_LABELS[id] ?? `Worker ${id}`,
      phase: cp.phase,
      completed: cp.completed,
      total: cp.totalInCorpus,
      pct,
      failed: cp.failed,
      phase1Complete: cp.phase1Complete,
      lastUpdated: cp.lastUpdated,
    })
    totalCompleted += cp.completed
    totalEstimated += cp.totalInCorpus
  }

  const totalPct = totalEstimated > 0
    ? ((totalCompleted / totalEstimated) * 100).toFixed(1) + '%'
    : '—'

  return { timestamp: new Date().toISOString(), workers, totalCompleted, totalEstimated, totalPct }
}

// ── R2 writes ─────────────────────────────────────────────────────────────────

export async function writeProgressToR2(agg: ProgressAggregate): Promise<void> {
  await r2Put(PROGRESS_KEY, JSON.stringify(agg, null, 2))
}

export async function appendCsvRow(agg: ProgressAggregate): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const key = csvKey(today)
  const existing = await r2Get(key)
  const header = 'timestamp,worker_id,corpus,completed,total,pct_complete,failed\n'
  const rows = agg.workers.map(w =>
    `"${agg.timestamp}",${w.workerId},"${w.corpus}",${w.completed},${w.total},"${w.pct}",${w.failed}`
  ).join('\n') + '\n'
  const content = existing ? existing + rows : header + rows
  await r2Put(key, content, 'text/csv')
}

// ── DB size check (Neon) ──────────────────────────────────────────────────────

export interface DbSizeResult {
  sizeBytes: number
  sizePretty: string
  limitBytes: number
  usedPct: number
}

const DB_LIMIT_GB = 10  // Neon Launch plan — update if on Scale plan (50GB)

export async function queryDbSize(): Promise<DbSizeResult> {
  const pool = getNeonPool()
  const res = await pool.query<{ db_size_bytes: string; db_size: string }>(`
    SELECT pg_database_size(current_database())::text AS db_size_bytes,
           pg_size_pretty(pg_database_size(current_database())) AS db_size
  `)
  const sizeBytes = parseInt(res.rows[0].db_size_bytes, 10)
  const limitBytes = DB_LIMIT_GB * 1_073_741_824
  return {
    sizeBytes,
    sizePretty: res.rows[0].db_size,
    limitBytes,
    usedPct: (sizeBytes / limitBytes) * 100,
  }
}

// ── Source rate limits + active worker query ─────────────────────────────────

interface SourceStatusRow {
  sourceKey: string
  pending: number
  active: number
  cap: number
  suspended: boolean
  isComplete: boolean
}

async function querySourceStatus(): Promise<SourceStatusRow[]> {
  const pool = getPool()
  try {
    const res = await pool.query<{
      sourceKey: string
      pending: string
      active: string
      cap: number
      suspended: boolean
      isComplete: boolean
    }>(`
      SELECT
        r."sourceKey",
        COALESCE(SUM(CASE WHEN q.status = 'pending' THEN 1 ELSE 0 END), 0)::text AS pending,
        COALESCE(SUM(CASE WHEN q.status = 'claimed' THEN 1 ELSE 0 END), 0)::text AS active,
        r."maxConcurrentWorkers" AS cap,
        COALESCE(r.suspended, false) AS suspended,
        COALESCE(r."isComplete", false) AS "isComplete"
      FROM source_rate_limits r
      LEFT JOIN ingest_queue q ON q."sourceType" = r."sourceKey"
      GROUP BY r."sourceKey", r."maxConcurrentWorkers", r.suspended, r."isComplete"
      ORDER BY SUM(CASE WHEN q.status = 'pending' THEN 1 ELSE 0 END) DESC NULLS LAST,
               SUM(CASE WHEN q.status = 'claimed' THEN 1 ELSE 0 END) DESC NULLS LAST,
               r."sourceKey"
    `)
    return res.rows.map(r => ({
      sourceKey: r.sourceKey,
      pending: parseInt(r.pending, 10),
      active: parseInt(r.active, 10),
      cap: r.cap ?? 1,
      suspended: r.suspended,
      isComplete: r.isComplete,
    }))
  } catch {
    return []
  }
}

// ── Claim reaper — reclaims rows left claimed by SIGTERM'd workers ────────────

// WHY: workers SIGTERM'd during Railway deploys leave rows permanently claimed.
// No heartbeat exists — the only safety net is this reaper running each cycle.
// 90-minute threshold: covers worst-case LDA fetch (45s × 3 retries + backoff
// ≈ 90s) with large margin. Any claim older than 90 min is a crashed worker.
export async function reclaimStaleRows(): Promise<number> {
  const { rowCount } = await getPool().query(`
    UPDATE ingest_queue
    SET status      = 'pending',
        "lastError" = 'reclaimed by scheduler — worker SIGTERM or crash',
        "claimedBy" = NULL,
        "claimedAt" = NULL
    WHERE status = 'claimed'
      AND "claimedAt" < NOW() - INTERVAL '90 minutes'
  `)
  const count = rowCount ?? 0
  if (count > 0) {
    console.log(`[scheduler] reclaimed ${count} stale claimed rows`)
  }
  return count
}

// ── Hourly cleanup — keeps Railway volume from filling up ─────────────────────

export async function runHourlyCleanup(): Promise<{ snapshots: number; doneRows: number }> {
  const pool = getPool()
  const [r1, r2] = await Promise.all([
    pool.query(`
      DELETE FROM ingest_progress_snapshots
      WHERE "capturedAt" < NOW() - INTERVAL '24 hours'
    `),
    pool.query(`
      DELETE FROM ingest_queue
      WHERE status = 'done'
      AND "completedAt" < NOW() - INTERVAL '7 days'
    `),
  ])
  return { snapshots: r1.rowCount ?? 0, doneRows: r2.rowCount ?? 0 }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function progressBar(pct: number, width = 20): string {
  const clampedPct = Math.min(100, Math.max(0, pct))
  const filled = Math.min(width, Math.max(0, Math.round((clampedPct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pctStr(compiled: number, estimated: number | null): string {
  if (estimated == null) return '     ?'
  if (estimated === 0) return '  n/a'
  return ((compiled / estimated) * 100).toFixed(1).padStart(5) + '%'
}

function estLabel(est: number | null, confirmed: boolean): string {
  if (est == null) return 'unknown denominator'
  return (confirmed ? '' : '~') + est.toLocaleString() + ' est.'
}

// ── Theoretical throughput ceilings per source ───────────────────────────────
const THEORETICAL_SECTIONS_PER_HOUR: Record<string, number> = {
  'tna-legislation': Math.floor((3_600_000 / 200) * 5),
  'tna-caselaw':     Math.floor((3_600_000 / 200) * 3),
  'hansard':         Math.floor((3_600_000 / 500) * 20),
  'fca':             Math.floor((3_600_000 / 300) * 10),
  'hmrc':            Math.floor((3_600_000 / 300) * 8),
  'echr':            Math.floor((3_600_000 / 500) * 50),
  'eurlex':          Math.floor((3_600_000 / 500) * 10),
  'lda-parliament':  Math.floor((3_600_000 / 200) * 500),
  'twfy-pwdata':     Math.floor((3_600_000 / 500) * 300),
  'default':         1_000,
}

// ── Worker throughput from snapshots ─────────────────────────────────────────

interface WorkerThroughputRow {
  workerId: number
  sourceKey: string
  ratePerHour: number
  stalled: boolean
  idle: boolean
  efficiencyPct: number
  efficiencyFlag: '' | '⚡low' | '🔴critical'
}

async function queryWorkerThroughput(): Promise<WorkerThroughputRow[]> {
  const pool = getPool()
  const res = await pool.query<{
    workerId: number
    sourceKey: string
    compiled_t1: number | null
    at_t1: Date | null
    compiled_t2: number | null
    at_t2: Date | null
    compiled_t3: number | null
  }>(`
    WITH ranked AS (
      SELECT "workerId", "sourceKey", "capturedAt", "sectionsCompiled",
             ROW_NUMBER() OVER (PARTITION BY "workerId" ORDER BY "capturedAt" DESC) AS rn
      FROM ingest_progress_snapshots
      WHERE "workerId" IS NOT NULL
        AND "capturedAt" > NOW() - INTERVAL '2 hours'
    )
    SELECT
      "workerId",
      MAX(CASE WHEN rn = 1 THEN "sourceKey" END) AS "sourceKey",
      MAX(CASE WHEN rn = 1 THEN "sectionsCompiled" END) AS compiled_t1,
      MAX(CASE WHEN rn = 1 THEN "capturedAt" END) AS at_t1,
      MAX(CASE WHEN rn = 2 THEN "sectionsCompiled" END) AS compiled_t2,
      MAX(CASE WHEN rn = 2 THEN "capturedAt" END) AS at_t2,
      MAX(CASE WHEN rn = 3 THEN "sectionsCompiled" END) AS compiled_t3
    FROM ranked
    WHERE rn <= 3
    GROUP BY "workerId"
    ORDER BY "workerId"
  `)

  const rawRows = res.rows.map(row => {
    const c1 = Number(row.compiled_t1 ?? 0)
    const c2 = row.compiled_t2 != null ? Number(row.compiled_t2) : null
    const c3 = row.compiled_t3 != null ? Number(row.compiled_t3) : null
    const t1 = row.at_t1 ? new Date(row.at_t1).getTime() : 0
    const t2 = row.at_t2 ? new Date(row.at_t2).getTime() : 0
    const deltaMs = t1 > 0 && t2 > 0 ? t1 - t2 : 0
    const deltaCompiled = c2 != null ? c1 - c2 : 0
    const ratePerHour = deltaMs > 0 ? Math.max(0, Math.round(deltaCompiled / (deltaMs / 3_600_000))) : 0
    const prevDelta = c3 != null && c2 != null ? c2 - c3 : undefined
    const stalled = ratePerHour === 0 && prevDelta !== undefined && prevDelta === 0
    const idle = ratePerHour === 0 && !stalled
    const sk = row.sourceKey ?? ''
    const sourceType = sk.startsWith('si-') || sk.startsWith('primary-acts') || sk === 'regional' || sk === 'retained-eu'
      ? 'tna-legislation'
      : sk === 'tna-caselaw' ? 'tna-caselaw'
      : sk.startsWith('hansard') || sk.startsWith('committees') || sk.startsWith('written')
        ? 'hansard'
      : sk === 'fca-regulators' ? 'fca'
      : sk === 'fca-handbook' ? 'fca-handbook'
      : sk.startsWith('hmrc') ? 'hmrc'
      : sk === 'echr-hudoc' ? 'echr'
      : sk === 'eur-lex' ? 'eurlex'
      : sk.startsWith('lda-') ? 'lda-parliament'
      : sk.startsWith('pwdata-') ? 'twfy-pwdata'
      : 'default'
    return { workerId: Number(row.workerId), sourceKey: sk, sourceType, ratePerHour, stalled, idle }
  })

  const workersPerSource: Record<string, number> = {}
  for (const r of rawRows) workersPerSource[r.sourceType] = (workersPerSource[r.sourceType] ?? 0) + 1

  return rawRows.map(r => {
    const theoretical = THEORETICAL_SECTIONS_PER_HOUR[r.sourceType] ?? THEORETICAL_SECTIONS_PER_HOUR.default
    const fairShare = theoretical / Math.max(1, workersPerSource[r.sourceType] ?? 1)
    const efficiencyPct = fairShare > 0 ? Math.round((r.ratePerHour / fairShare) * 100) : 0
    const efficiencyFlag: WorkerThroughputRow['efficiencyFlag'] =
      r.ratePerHour > 0 && efficiencyPct < 20 ? '🔴critical'
      : r.ratePerHour > 0 && efficiencyPct < 40 ? '⚡low'
      : ''
    return { ...r, efficiencyPct, efficiencyFlag }
  }).sort((a, b) => a.workerId - b.workerId)
}

// ── Stalled sources ───────────────────────────────────────────────────────────

export async function queryStalledSources(): Promise<string[]> {
  try {
    const neonPool = getNeonPool()
    // WHY: blocked sources are already surfaced in the ⛔ section. Showing them
    // again as ⚠️ stalled creates duplicate noise and obscures real stalls.
    const [sectionsRes, blockedRes] = await Promise.all([
      neonPool.query<{ corpus: string }>('SELECT DISTINCT corpus FROM corpus_sections'),
      neonPool.query<{ corpus_key: string }>('SELECT corpus_key FROM corpus_targets WHERE blocked = true OR retired = true'),
    ])
    const compiledCorpora = new Set(sectionsRes.rows.map(r => r.corpus))
    const blockedSet = new Set(blockedRes.rows.map(r => r.corpus_key))

    const railwayRes = await getPool().query<{ corpus: string }>(`
      SELECT DISTINCT q.corpus
      FROM ingest_queue q
      WHERE q.status = 'done'
        AND q."completedAt" < NOW() - INTERVAL '24 hours'
      ORDER BY q.corpus
    `)
    return railwayRes.rows
      .map(r => r.corpus)
      .filter(c => !compiledCorpora.has(c) && !blockedSet.has(c))
  } catch { return [] }
}

// ── Unified progress email ────────────────────────────────────────────────────

export interface UnrecognisedFormatRow { sourceUrl: string | null; xmlPreview: string | null }
export interface FormatCount { format: string | null; count: number }

export async function sendProgressEmail(
  agg: ProgressAggregate,
  corpusCounts: Record<string, { compiled: number; failed: number }>,
  neonCount: number,
  unrecognised: UnrecognisedFormatRow[] = [],
  formatBreakdown: FormatCount[] = [],
  dbSize?: DbSizeResult,
  stalledSources: string[] = [],
  hourlyDelta: Map<string, number> = new Map(),
  reclaimedCount: number = 0,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.warn('[reporter] RESEND_API_KEY not set — skipping email'); return }

  const now = new Date(agg.timestamp)
  const bstFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })
  const bst = bstFmt.format(now)
  const bstTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  // Previous hour window label (e.g. "08:00–08:59")
  const prevHourStart = new Date(now)
  prevHourStart.setMinutes(0, 0, 0)
  prevHourStart.setTime(prevHourStart.getTime() - 60 * 60 * 1000)
  const prevHourEnd = new Date(prevHourStart.getTime() + 59 * 60 * 1000)
  const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
  const prevWindow = `${timeFmt.format(prevHourStart)}–${timeFmt.format(prevHourEnd)}`

  // ── Load data ──────────────────────────────────────────────────────────────
  let targets: CorpusTarget[] = []
  try { targets = await queryCorpusTargets() } catch { /* non-fatal */ }

  let queueCorpora = new Set<string>()
  try { queueCorpora = await queryQueueCorpora() } catch { /* non-fatal */ }

  let workerRows: WorkerThroughputRow[] = []
  try { workerRows = await queryWorkerThroughput() } catch { /* non-fatal */ }

  // Per-corpus queue breakdown
  interface QueueCorpusRow { corpus: string; status: string; n: number }
  let queueByCorpus: QueueCorpusRow[] = []
  let queueState = { pending: 0, claimed: 0, done: 0, failed: 0 }
  try {
    const qRes = await getPool().query<{ corpus: string; status: string; n: number }>(`
      SELECT corpus, status, COUNT(*)::int AS n
      FROM ingest_queue
      GROUP BY corpus, status
      ORDER BY corpus, status
    `)
    queueByCorpus = qRes.rows
    for (const r of qRes.rows) {
      if (r.status === 'pending') queueState.pending += r.n
      else if (r.status === 'claimed') queueState.claimed += r.n
      else if (r.status === 'done') queueState.done += r.n
      else if (r.status === 'failed') queueState.failed += r.n
    }
  } catch { /* non-fatal */ }

  // Last error per corpus (for ISSUES section)
  interface FailedRow { corpus: string; n: number; last_error: string | null }
  let failedByCorpus: FailedRow[] = []
  try {
    const fRes = await getPool().query<FailedRow>(`
      SELECT corpus, COUNT(*)::int AS n,
             (array_agg("lastError" ORDER BY id DESC))[1] AS last_error
      FROM ingest_queue
      WHERE status = 'failed' AND "lastError" IS NOT NULL
      GROUP BY corpus
      ORDER BY n DESC
    `)
    failedByCorpus = fRes.rows
  } catch { /* non-fatal */ }

  // ── Totals ────────────────────────────────────────────────────────────────
  const newPipelineCompiled = Object.values(corpusCounts).reduce((s, c) => s + c.compiled, 0)
  const newPipelineEstimated = targets
    .filter(t => !t.blocked && t.est_sections != null)
    .reduce((s, t) => s + (t.est_sections ?? 0), 0)
  const grandTotalCompiled = neonCount + newPipelineCompiled
  const grandTotalEstimated = neonCount + newPipelineEstimated
  const overallPct = grandTotalEstimated > 0 ? (grandTotalCompiled / grandTotalEstimated) * 100 : 0
  const overallBar = progressBar(overallPct)

  // ── This-hour delta ───────────────────────────────────────────────────────
  const hasDelta = hourlyDelta.size > 0
  const totalDelta = hasDelta
    ? [...hourlyDelta.values()].reduce((s, v) => s + Math.max(0, v), 0)
    : null

  // ── Active corpora = corpora with worker activity in last 2h ─────────────
  const activeCorpusKeys = new Set(workerRows.map(w => w.sourceKey).filter(Boolean))

  // Group workers by corpus
  const workersByCorpus = new Map<string, WorkerThroughputRow[]>()
  for (const w of workerRows) {
    if (!w.sourceKey) continue
    if (!workersByCorpus.has(w.sourceKey)) workersByCorpus.set(w.sourceKey, [])
    workersByCorpus.get(w.sourceKey)!.push(w)
  }

  // ── Subject ───────────────────────────────────────────────────────────────
  const deltaStr = totalDelta != null ? `+${totalDelta.toLocaleString()}` : '--'
  const dbWarn = dbSize && dbSize.usedPct >= 80 ? ` | ⚠️ DB ${dbSize.usedPct.toFixed(0)}%` : ''
  const subject = `Ingest ${bstTime} | ${deltaStr} this hour | ${grandTotalCompiled.toLocaleString()} total | ${overallPct.toFixed(1)}%${dbWarn}`

  const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const parts: string[] = [SEP, `SCRUTINISE INGEST — ${bst} BST`, SEP]

  // ── THIS HOUR ─────────────────────────────────────────────────────────────
  parts.push('', `THIS HOUR  (${prevWindow})`)
  if (!hasDelta) {
    parts.push('  Total added:  -- sections  (no previous snapshot yet)')
  } else {
    parts.push(`  Total added:  +${totalDelta!.toLocaleString()} sections`)
    const activeDelta = [...hourlyDelta.entries()]
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
    for (const [corpus, delta] of activeDelta) {
      const label = targets.find(t => t.corpus_key === corpus)?.display_label ?? corpus
      parts.push(`  ${label.padEnd(38)} +${delta.toLocaleString()}`)
    }
    if (activeDelta.length === 0) parts.push('  (no corpora added sections this hour)')
  }

  // ── TOTAL CORPUS ──────────────────────────────────────────────────────────
  parts.push('', SEP, 'TOTAL CORPUS', SEP)
  parts.push(`  ${overallBar}  ${overallPct.toFixed(1)}%`)
  parts.push(`  ${grandTotalCompiled.toLocaleString()} sections ingested`)
  parts.push(`  Est. total: ~${grandTotalEstimated.toLocaleString()}`)
  parts.push(`  (denominators marked ~ are estimates; ✓ = confirmed from source)`)
  if (dbSize) {
    const limitGB = (dbSize.limitBytes / 1_073_741_824).toFixed(0)
    const dbFlag = dbSize.usedPct >= 90 ? '  ⚠️  CRITICAL'
      : dbSize.usedPct >= 80 ? '  ⚠️  WARNING' : ''
    parts.push(`  DB: Neon ${dbSize.sizePretty}  (${dbSize.usedPct.toFixed(1)}% of ${limitGB}GB)${dbFlag}`)
  }

  // ── ACTIVE CORPORA ────────────────────────────────────────────────────────
  const activeTargets = targets.filter(t => !t.retired && activeCorpusKeys.has(t.corpus_key))
  if (activeTargets.length > 0) {
    parts.push('', SEP, `ACTIVE CORPORA  (workers assigned this hour)`, SEP)
    for (const target of activeTargets) {
      const compiled = corpusCounts[target.corpus_key]?.compiled ?? 0
      const est = target.est_sections
      const pct = est != null && est > 0 ? ((compiled / est) * 100).toFixed(1) : '?'
      const estStr = est != null ? `  /  ${(target.est_is_confirmed ? '✓' : '~') + est.toLocaleString()} est.  [${pct}%]` : ''
      parts.push(`  ${target.display_label}`)
      parts.push(`    ${compiled.toLocaleString()} sections${estStr}`)

      const workers = workersByCorpus.get(target.corpus_key) ?? []
      const activeW = workers.filter(w => w.ratePerHour > 0)
      const stalledW = workers.filter(w => w.stalled)
      const totalRate = workers.reduce((s, w) => s + w.ratePerHour, 0)

      const activeIds = activeW.map(w => w.workerId).join(',')
      const stalledIds = stalledW.map(w => w.workerId).join(',')
      let workerLine = `    Workers: ${activeW.length} active`
      if (activeIds) workerLine += ` [${activeIds}]`
      if (stalledW.length > 0) workerLine += `  |  ${stalledW.length} stalled [${stalledIds}]`
      parts.push(workerLine)
      if (totalRate > 0) parts.push(`    Rate: ${totalRate.toLocaleString()}/hr`)
    }
  }

  // ── QUEUE ─────────────────────────────────────────────────────────────────
  parts.push('', SEP, 'QUEUE', SEP)
  parts.push(`  pending: ${queueState.pending.toLocaleString()}  |  claimed: ${queueState.claimed.toLocaleString()}  |  done: ${queueState.done.toLocaleString()}  |  failed: ${queueState.failed.toLocaleString()}`)

  // Per-corpus breakdown: show corpora that have pending or failed rows
  const corpusQueueMap = new Map<string, { pending: number; failed: number }>()
  for (const r of queueByCorpus) {
    if (!corpusQueueMap.has(r.corpus)) corpusQueueMap.set(r.corpus, { pending: 0, failed: 0 })
    if (r.status === 'pending') corpusQueueMap.get(r.corpus)!.pending = r.n
    if (r.status === 'failed') corpusQueueMap.get(r.corpus)!.failed = r.n
  }
  const noteworthyCorpora = [...corpusQueueMap.entries()]
    .filter(([, v]) => v.pending > 0 || v.failed > 0)
    .sort(([a], [b]) => a.localeCompare(b))
  if (noteworthyCorpora.length > 0) {
    parts.push('  By corpus:')
    for (const [corpus, v] of noteworthyCorpora) {
      const pend = v.pending > 0 ? `${v.pending.toLocaleString()} pending` : ''
      const fail = v.failed > 0 ? `${v.failed.toLocaleString()} failed` : ''
      parts.push(`    ${corpus}: ${[pend, fail].filter(Boolean).join('  ')}`)
    }
  }

  // Queue exhausted warning
  if (queueState.pending === 0) {
    const highPriTargets = targets.filter(t => (t.priority === 1 || t.priority === 2) && !t.blocked)
    const pri12Keys = new Set(highPriTargets.map(t => t.corpus_key))
    const pri12Pending = [...corpusQueueMap.entries()]
      .filter(([k]) => pri12Keys.has(k))
      .reduce((s, [, v]) => s + v.pending, 0)
    parts.push(`  ⚠️  Queue exhausted — priority 1/2 pending: ${pri12Pending}`)
  }

  // ── SOURCES ───────────────────────────────────────────────────────────────
  // Shows which sources have work remaining and whether worker caps are limiting throughput.
  // Only shows sources with pending > 0 OR active > 0 OR a flag (suspended/issue).
  let sourceRows: SourceStatusRow[] = []
  try { sourceRows = await querySourceStatus() } catch { /* non-fatal */ }

  const noteworthySources = sourceRows.filter(
    s => s.pending > 0 || s.active > 0 || s.suspended
  )

  if (noteworthySources.length > 0) {
    parts.push('', SEP, 'SOURCES', SEP)
    for (const s of noteworthySources) {
      const pendingStr = `pending:${s.pending.toLocaleString()}`
      const workersStr = `workers:${s.active}/${s.cap}`
      const statusStr = s.suspended ? '⛔suspended'
        : s.isComplete ? '✅complete'
        : s.active >= s.cap && s.pending > 0 ? '⚡cap-full'
        : s.pending === 0 && s.active === 0 ? '○idle'
        : ''
      const line = `  ${s.sourceKey.padEnd(32)} ${pendingStr.padEnd(18)} ${workersStr.padEnd(14)} ${statusStr}`
      parts.push(line.trimEnd())
    }
  }

  // ── ISSUES ────────────────────────────────────────────────────────────────
  const issueLines: string[] = []

  if (reclaimedCount > 0) {
    issueLines.push(`  ⚠️  Reclaimed ${reclaimedCount} stale claimed rows (workers SIGTERM'd mid-claim — now pending)`)
  }

  for (const row of failedByCorpus) {
    const snippet = row.last_error ? row.last_error.slice(0, 80).replace(/\n/g, ' ') : 'unknown'
    issueLines.push(`  ${row.corpus}: ${row.n.toLocaleString()} failed rows — ${snippet}`)
  }

  for (const corpus of stalledSources) {
    issueLines.push(`  ${corpus}: stalled — done queue rows, 0 sections after 24h`)
  }

  for (const target of targets.filter(t => t.blocked && !t.retired && t.blocked_reason)) {
    issueLines.push(`  ${target.corpus_key}: blocked — ${target.blocked_reason}`)
  }

  if (issueLines.length > 0) {
    parts.push('', SEP, '⚠️  ISSUES', SEP)
    parts.push(...issueLines)
  }

  // ── ALL CORPORA STATUS ────────────────────────────────────────────────────
  parts.push('', SEP, 'ALL CORPORA STATUS', SEP)
  for (const target of targets.filter(t => !t.retired)) {
    const compiled = corpusCounts[target.corpus_key]?.compiled ?? 0
    const est = target.est_sections
    const isActive = activeCorpusKeys.has(target.corpus_key)

    if (target.blocked) {
      const reason = target.blocked_reason ? `: ${target.blocked_reason}` : ''
      parts.push(`  ⛔ ${target.corpus_key.padEnd(38)} blocked${reason}`)
      continue
    }

    if (est != null && compiled >= est) {
      parts.push(`  ✅ ${target.corpus_key.padEnd(38)} ${compiled.toLocaleString()}  [100% complete]`)
      continue
    }

    if (compiled === 0) {
      const estStr = est != null ? ` / ~${est.toLocaleString()}` : ''
      parts.push(`  ○  ${target.corpus_key.padEnd(38)} 0${estStr}  — not started`)
      continue
    }

    const pct = est != null ? `${((compiled / est) * 100).toFixed(1)}%` : '?%'
    const estStr = est != null ? ` / ${(target.est_is_confirmed ? '✓' : '~') + est.toLocaleString()}` : ''
    const activeFlag = isActive ? '  — active' : ''
    parts.push(`  ▶  ${target.corpus_key.padEnd(38)} ${compiled.toLocaleString().padStart(9)}${estStr}  [${pct}]${activeFlag}`)
  }

  const body = parts.join('\n')

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Scrutinise Ingest <ingest@messages.scrutinise.org>',
      to: [TO],
      subject,
      text: body,
    }),
  })

  if (!res.ok) {
    console.error(`[reporter] Resend failed: ${res.status} ${await res.text()}`)
  } else {
    console.log(`[reporter] Email sent to ${TO} — ${overallPct.toFixed(1)}% overall, delta ${deltaStr}`)
  }
}
