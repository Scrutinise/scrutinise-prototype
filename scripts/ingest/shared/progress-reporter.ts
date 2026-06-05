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
}

async function queryCorpusTargets(): Promise<CorpusTarget[]> {
  const res = await getNeonPool().query<CorpusTarget>(`
    SELECT corpus_key, display_label, est_sections, est_is_confirmed,
           priority, blocked, blocked_reason
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
      AND "updatedAt" < NOW() - INTERVAL '7 days'
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
    const neonRes = await getNeonPool().query<{ corpus: string }>(
      'SELECT DISTINCT corpus FROM corpus_sections'
    )
    const compiledCorpora = new Set(neonRes.rows.map(r => r.corpus))

    const railwayRes = await getPool().query<{ corpus: string }>(`
      SELECT DISTINCT q.corpus
      FROM ingest_queue q
      WHERE q.status = 'done'
        AND q."completedAt" < NOW() - INTERVAL '24 hours'
      ORDER BY q.corpus
    `)
    return railwayRes.rows.map(r => r.corpus).filter(c => !compiledCorpora.has(c))
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
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.warn('[reporter] RESEND_API_KEY not set — skipping email'); return }

  const bst = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(agg.timestamp))

  // Query which corpora have any queue rows
  let queueCorpora = new Set<string>()
  try { queueCorpora = await queryQueueCorpora() } catch { /* non-fatal */ }

  // Count active workers from recent snapshots
  let activeWorkerCount = 0
  try {
    const wRes = await getPool().query<{ n: number }>(`
      SELECT COUNT(DISTINCT "workerId")::int AS n
      FROM ingest_progress_snapshots
      WHERE "workerId" IS NOT NULL
        AND "capturedAt" > NOW() - INTERVAL '2 hours'
    `)
    activeWorkerCount = wRes.rows[0]?.n ?? 0
  } catch { /* keep 0 */ }

  // Load corpus targets from DB
  let targets: CorpusTarget[] = []
  try { targets = await queryCorpusTargets() } catch { /* non-fatal */ }

  // ── Queue state ────────────────────────────────────────────────────────────
  let queueState = { pending: 0, claimed: 0, done: 0, failed: 0 }
  try {
    const qRes = await getPool().query<{ status: string; n: number }>(`
      SELECT status, COUNT(*)::int AS n FROM ingest_queue GROUP BY status
    `)
    for (const r of qRes.rows) {
      if (r.status === 'pending') queueState.pending = r.n
      else if (r.status === 'claimed') queueState.claimed = r.n
      else if (r.status === 'done') queueState.done = r.n
      else if (r.status === 'failed') queueState.failed = r.n
    }
  } catch { /* non-fatal */ }

  // ── Totals ────────────────────────────────────────────────────────────────
  const newPipelineCompiled = Object.values(corpusCounts).reduce((s, c) => s + c.compiled, 0)
  const overallCompiled = neonCount + newPipelineCompiled

  // Sum only non-blocked, non-null estimated targets for overall %
  const totalEstimated = targets
    .filter(t => !t.blocked && t.est_sections != null)
    .reduce((s, t) => s + (t.est_sections ?? 0), 0)

  const overallPct = totalEstimated > 0
    ? ((newPipelineCompiled / totalEstimated) * 100)
    : 0
  const overallBar = progressBar(overallPct)

  const eta = await queryEtaFromSnapshots(totalEstimated, newPipelineCompiled)

  // ── Per-corpus rows grouped by priority ───────────────────────────────────
  const corpusLines: string[] = []
  let currentPriority = -1

  // Priority groups in order
  const priorityGroups = [1, 2, 3, 4]
  const priorityLabels: Record<number, string> = {
    1: 'PRIORITY 1 — UK Statute',
    2: 'PRIORITY 2 — Major open sources',
    3: 'PRIORITY 3 — Secondary sources',
    4: 'PRIORITY 4 — Lower priority',
  }

  for (const pri of priorityGroups) {
    const group = targets.filter(t => t.priority === pri)
    if (group.length === 0) continue

    corpusLines.push('', `── ${priorityLabels[pri]} ──`)

    for (const target of group) {
      const label = target.display_label.padEnd(40)
      const compiled = corpusCounts[target.corpus_key]?.compiled ?? 0
      const failed = corpusCounts[target.corpus_key]?.failed ?? 0
      const est = target.est_sections
      const isSeeded = queueCorpora.has(target.corpus_key)

      if (target.blocked) {
        corpusLines.push(`  ${label} ⛔ blocked${target.blocked_reason ? ': ' + target.blocked_reason : ''}`)
        continue
      }

      if (compiled === 0 && !isSeeded) {
        const estPart = est != null ? ` / ${(target.est_is_confirmed ? '' : '~') + est.toLocaleString()}` : ''
        corpusLines.push(`  ${label} ${(0).toString().padStart(9)}${estPart}  · not started`)
        continue
      }

      if (compiled === 0 && isSeeded) {
        const estPart = est != null ? ` / ${(target.est_is_confirmed ? '' : '~') + est.toLocaleString()}` : ''
        corpusLines.push(`  ${label} ${(0).toString().padStart(9)}${estPart}  ⚠️  failing`)
        continue
      }

      const pct = pctStr(compiled, est)
      const bar = est != null ? progressBar((compiled / est) * 100, 10) : '░'.repeat(10)
      const estStr = est != null
        ? ` / ${(target.est_is_confirmed ? '' : '~') + est.toLocaleString()}`
        : ' / ?'
      const failStr = failed > 0 ? `  (${failed.toLocaleString()} failed)` : ''
      corpusLines.push(`  ${label} ${compiled.toLocaleString().padStart(9)}${estStr}  ${bar} ${pct}${failStr}`)
    }
  }

  // Any corpus in corpusCounts that has no target row — show as unlabelled
  const knownKeys = new Set(targets.map(t => t.corpus_key))
  const unlabelled = Object.entries(corpusCounts)
    .filter(([k]) => !knownKeys.has(k) && corpusCounts[k].compiled > 0)
  if (unlabelled.length > 0) {
    corpusLines.push('', '── Unlabelled (no corpus_targets row) ──')
    for (const [corpus, counts] of unlabelled) {
      corpusLines.push(`  ${corpus.padEnd(40)} ${counts.compiled.toLocaleString().padStart(9)}`)
    }
  }

  // ── DB size block ─────────────────────────────────────────────────────────
  const dbSizeLines: string[] = []
  if (dbSize) {
    const dbBar = progressBar(dbSize.usedPct, 10)
    const limitGB = (dbSize.limitBytes / 1_073_741_824).toFixed(0)
    const flag = dbSize.usedPct >= 90 ? '  ⚠️  CRITICAL — pause ingest, delete rows immediately'
      : dbSize.usedPct >= 80 ? '  ⚠️  WARNING — run cleanup SQL soon'
      : ''
    dbSizeLines.push(`  Neon DB: ${dbSize.sizePretty.padEnd(10)} ${dbBar}  ${dbSize.usedPct.toFixed(1)}% of ${limitGB}GB${flag}`)
  }

  const parts: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'SCRUTINISE INGEST PROGRESS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `  ${bst} BST`,
    '',
    `  ${overallBar}  ${overallPct.toFixed(1)}%`,
    `  ${newPipelineCompiled.toLocaleString()} / ~${totalEstimated.toLocaleString()} est. new pipeline sections`,
    `  LEGACY (Neon — legislation.gov.uk): ${neonCount.toLocaleString()}  ✅`,
    `  ETA: ${eta}`,
    '',
    ...dbSizeLines,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'CORPUS STATUS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...corpusLines,
  ]

  // ── Queue state ────────────────────────────────────────────────────────────
  parts.push(
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'QUEUE STATE',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `  pending: ${queueState.pending.toLocaleString()}  |  claimed: ${queueState.claimed.toLocaleString()}  |  done: ${queueState.done.toLocaleString()}  |  failed: ${queueState.failed.toLocaleString()}`,
  )

  // ── Worker throughput ─────────────────────────────────────────────────────
  try {
    const workerRows = await queryWorkerThroughput()
    if (workerRows.length > 0) {
      const totalRate = workerRows.reduce((s, w) => s + w.ratePerHour, 0)
      const maxRate = Math.max(...workerRows.map(w => w.ratePerHour), 1)
      parts.push('', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      parts.push(`WORKER ACTIVITY (last 2h)  |  ${activeWorkerCount} active  |  ${totalRate.toLocaleString()} /hr total`)
      parts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      for (const w of workerRows) {
        const workerStr = `Worker ${String(w.workerId).padStart(2)}`
        const sourceStr = (w.sourceKey || '[idle]').slice(0, 26).padEnd(26)
        const rateStr = w.ratePerHour.toLocaleString().padStart(7) + ' /hr'
        const bar = progressBar((w.ratePerHour / maxRate) * 100, 6)
        const effStr = w.ratePerHour > 0 ? `  ${w.efficiencyPct}% eff${w.efficiencyFlag ? ' ' + w.efficiencyFlag : ''}` : ''
        const statusFlag = w.stalled ? '  ⚠️  stalled' : w.idle ? '  ℹ️  idle' : ''
        parts.push(`  ${workerStr}  ${sourceStr}  ${rateStr}  ${bar}${effStr}${statusFlag}`)
      }
      const stalledIds = workerRows.filter(w => w.stalled).map(w => `Worker ${w.workerId}`)
      if (stalledIds.length > 0) parts.push(``, `  Stalled workers: ${stalledIds.join(', ')}`)
      const critical = workerRows.filter(w => w.efficiencyFlag === '🔴critical').map(w => `Worker ${w.workerId}`)
      if (critical.length > 0) parts.push(`  Critical efficiency: ${critical.join(', ')}`)
    }
  } catch (err) {
    parts.push('', `[Worker throughput unavailable: ${err}]`)
  }

  // ── Attention needed: stalled sources ─────────────────────────────────────
  if (stalledSources.length > 0) {
    parts.push('', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    parts.push('⚠️  ATTENTION — done queue rows, 0 corpus_sections after 24h')
    parts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const corpus of stalledSources) {
      parts.push(`  ${corpus}`)
    }
    console.warn('[reporter] stalled sources:', stalledSources.join(', '))
  }

  const body = parts.join('\n')

  const subjectBar = progressBar(overallPct, 10)
  const dbWarn = dbSize && dbSize.usedPct >= 80 ? ` | ⚠️ DB ${dbSize.usedPct.toFixed(0)}%` : ''
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Scrutinise Ingest <ingest@messages.scrutinise.org>',
      to: [TO],
      subject: `Corpus: ${overallPct.toFixed(1)}% [${subjectBar}] ${newPipelineCompiled.toLocaleString()} secs — ${bst}${dbWarn}`,
      text: body,
    }),
  })

  if (!res.ok) {
    console.error(`[reporter] Resend failed: ${res.status} ${await res.text()}`)
  } else {
    console.log(`[reporter] Email sent to ${TO} — ${overallPct.toFixed(1)}% overall`)
  }
}
