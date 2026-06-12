/**
 * progress-reporter.ts — Neon queries + hourly progress email for `ops` (V17).
 *
 * Fleet relics removed in V17: per-worker R2 checkpoints (buildAggregate),
 * R2 progress JSON/CSV writes, per-worker throughput snapshots and the email
 * sections built on them. Throughput now comes from corpus_snapshots deltas.
 * Everything here runs on the single shared Neon pool.
 */
import { getNeonPool } from './neon-pool'

const RESEND_API = 'https://api.resend.com/emails'
const TO = 'cl@scrutinise.org'

// ── Locks — prevent duplicate runs when two ops instances overlap ─────────────
// Random per-startup ID (not process.pid) because Railway containers all start
// as PID 1. scheduler_lock ids: 1 = hourly run, 2 = (legacy discovery, unused),
// 4 = 15-min breaker/liveness run.

const OPS_INSTANCE_ID = Math.random().toString(36).slice(2)

async function acquireLock(lockId: number, windowMinutes: number): Promise<boolean> {
  const pool = getNeonPool()
  try {
    await pool.query(`
      INSERT INTO scheduler_lock (id, locked_at, process_id)
      VALUES ($2, NOW(), $1)
      ON CONFLICT (id) DO UPDATE
        SET locked_at = NOW(), process_id = $1
        WHERE scheduler_lock.locked_at < NOW() - ($3 || ' minutes')::interval
    `, [OPS_INSTANCE_ID, lockId, String(windowMinutes)])
    const res = await pool.query<{ process_id: string }>(
      'SELECT process_id FROM scheduler_lock WHERE id = $1', [lockId]
    )
    return res.rows[0]?.process_id === OPS_INSTANCE_ID
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('does not exist')) {
      console.warn('[ops] scheduler_lock table not yet created — running without lock')
      return true
    }
    console.warn('[ops] lock acquisition failed:', msg)
    return false
  }
}

export async function acquireSchedulerLock(): Promise<boolean> {
  return acquireLock(1, 50)
}

export async function acquireBreakerLock(): Promise<boolean> {
  return acquireLock(4, 12)
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

// ── IngestProgressSnapshot write ─────────────────────────────────────────────

export async function saveProgressSnapshot(
  corpusCounts: Record<string, { compiled: number; failed: number }>,
  capturedAt: Date,
): Promise<void> {
  const pool = getNeonPool()
  for (const [corpus, counts] of Object.entries(corpusCounts)) {
    await pool.query(`
      INSERT INTO ingest_progress_snapshots
        ("capturedAt", "workerLabel", "sourceKey", "sectionsCompiled", "sectionsEstimated", phase)
      VALUES ($1, $2, $3, $4, 0, $5)
    `, [capturedAt, corpus, corpus, counts.compiled, 'queue'])
  }
}

// ── DB size check (Neon) ──────────────────────────────────────────────────────

export interface DbSizeResult {
  sizeBytes: number
  sizePretty: string
  limitBytes: number
  usedPct: number
}

const DB_LIMIT_GB = 20  // V18: storage headroom raised to 20GB (display only — Neon bills per-GB; any hard limit is console-side)

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

// ── Source rate limits + queue state per source ───────────────────────────────

interface SourceStatusRow {
  sourceKey: string
  pending: number
  active: number
  cap: number
  suspended: boolean
  isComplete: boolean
}

async function querySourceStatus(): Promise<SourceStatusRow[]> {
  const pool = getNeonPool()
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

// ── Claim reaper — reclaims rows left claimed by a SIGTERM'd/crashed process ──

// WHY: a process killed mid-claim leaves rows permanently claimed. No heartbeat
// exists per row — the only safety net is this reaper running each hourly cycle.
// 90-minute threshold: covers worst-case LDA fetch with large margin.
export async function reclaimStaleRows(): Promise<number> {
  const { rowCount } = await getNeonPool().query(`
    UPDATE ingest_queue
    SET status      = 'pending',
        "lastError" = 'reclaimed by ops — process SIGTERM or crash',
        "claimedBy" = NULL,
        "claimedAt" = NULL
    WHERE status = 'claimed'
      AND "claimedAt" < NOW() - INTERVAL '90 minutes'
  `)
  const count = rowCount ?? 0
  if (count > 0) {
    console.log(`[ops] reclaimed ${count} stale claimed rows`)
  }
  return count
}

// ── Hourly cleanup ────────────────────────────────────────────────────────────

export async function runHourlyCleanup(): Promise<{ snapshots: number; doneRows: number }> {
  const pool = getNeonPool()
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

// ── Rows completed in the last hour (divergence check input) ──────────────────

export async function queryRowsCompletedLastHour(): Promise<number> {
  try {
    const res = await getNeonPool().query<{ n: number }>(`
      SELECT COUNT(*)::int AS n FROM ingest_queue
      WHERE status = 'done' AND "completedAt" > NOW() - INTERVAL '1 hour'
    `)
    return res.rows[0]?.n ?? 0
  } catch { return 0 }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function progressBar(pct: number, width = 20): string {
  const clampedPct = Math.min(100, Math.max(0, pct))
  const filled = Math.min(width, Math.max(0, Math.round((clampedPct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
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

    const doneRes = await neonPool.query<{ corpus: string }>(`
      SELECT DISTINCT q.corpus
      FROM ingest_queue q
      WHERE q.status = 'done'
        AND q."completedAt" < NOW() - INTERVAL '24 hours'
      ORDER BY q.corpus
    `)
    return doneRes.rows
      .map(r => r.corpus)
      .filter(c => !compiledCorpora.has(c) && !blockedSet.has(c))
  } catch { return [] }
}

// ── Unified progress email ────────────────────────────────────────────────────

export interface IngestServiceState {
  running: boolean
  lastBeat: Date | null
  startsToday: number
}

export interface ProgressEmailInput {
  timestamp: Date
  corpusCounts: Record<string, { compiled: number; failed: number }>
  neonCount: number
  dbSize?: DbSizeResult
  stalledSources?: string[]
  hourlyDelta?: Map<string, number>
  reclaimedCount?: number
  rowsCompletedThisHour?: number
  ingestService?: IngestServiceState
  breakerIssues?: string[]
}

export async function sendProgressEmail(input: ProgressEmailInput): Promise<void> {
  const {
    timestamp, corpusCounts, neonCount, dbSize,
    stalledSources = [], hourlyDelta = new Map(), reclaimedCount = 0,
    rowsCompletedThisHour = 0, ingestService, breakerIssues = [],
  } = input

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.warn('[reporter] RESEND_API_KEY not set — skipping email'); return }

  const now = timestamp
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

  // Per-corpus queue breakdown
  interface QueueCorpusRow { corpus: string; status: string; n: number }
  let queueByCorpus: QueueCorpusRow[] = []
  const queueState = { pending: 0, claimed: 0, done: 0, failed: 0, blocked: 0 }
  try {
    const qRes = await getNeonPool().query<{ corpus: string; status: string; n: number }>(`
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
      else if (r.status === 'blocked') queueState.blocked += r.n
    }
  } catch { /* non-fatal */ }

  // Last error per corpus (for ISSUES section)
  interface FailedRow { corpus: string; n: number; last_error: string | null }
  let failedByCorpus: FailedRow[] = []
  try {
    const fRes = await getNeonPool().query<FailedRow>(`
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
  // V21 honest denominator: BLOCKED sources count (they exist — being unable
  // to fetch them does not shrink the universe); RETIRED sources do not (their
  // content is covered by a successor corpus — counting both is double-counting;
  // the retired LDA written-questions rows were silently inflating the
  // denominator by 722k next to their pwdata replacements).
  const newPipelineEstimated = targets
    .filter(t => !t.retired && t.est_sections != null)
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

  // Corpora that grew this hour count as "active"
  const activeCorpusKeys = new Set(
    [...hourlyDelta.entries()].filter(([, v]) => v > 0).map(([k]) => k)
  )

  // ── Subject ───────────────────────────────────────────────────────────────
  const deltaStr = totalDelta != null ? `+${totalDelta.toLocaleString()}` : '--'
  const dbWarn = dbSize && dbSize.usedPct >= 80 ? ` | ⚠️ DB ${dbSize.usedPct.toFixed(0)}%` : ''
  const breakerWarn = breakerIssues.length > 0 ? ` | 🔴 ${breakerIssues.length} breaker` : ''
  const subject = `Ingest ${bstTime} | ${deltaStr} this hour | ${grandTotalCompiled.toLocaleString()} total | ${overallPct.toFixed(1)}%${dbWarn}${breakerWarn}`

  const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const parts: string[] = [SEP, `SCRUTINISE INGEST — ${bst} BST`, SEP]

  // ── INGEST SERVICE ────────────────────────────────────────────────────────
  if (ingestService) {
    const stateStr = ingestService.running ? '🟢 running' : '⚪ stopped (exit-on-empty)'
    const beatStr = ingestService.lastBeat
      ? ` — last heartbeat ${timeFmt.format(ingestService.lastBeat)}`
      : ''
    parts.push('', `INGEST SERVICE: ${stateStr}${beatStr}  |  starts today: ${ingestService.startsToday}`)
  }

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
  // Divergence: rows completing without producing sections is the silent
  // failure mode that hid the committees incident for days.
  parts.push(`  Rows completed: ${rowsCompletedThisHour.toLocaleString()}`)
  if (rowsCompletedThisHour > 0 && (totalDelta ?? 0) === 0) {
    parts.push(`  ⚠️  DIVERGENCE: ${rowsCompletedThisHour} rows done but 0 sections written — investigate before this trips the zero-output breaker`)
  }

  // ── TOTAL CORPUS ──────────────────────────────────────────────────────────
  parts.push('', SEP, 'TOTAL CORPUS', SEP)
  parts.push(`  ${overallBar}  ${overallPct.toFixed(1)}%`)
  parts.push(`  ${grandTotalCompiled.toLocaleString()} sections ingested`)
  // V18: show the breakdown — this total is legacy LegislationSection + compiled-only
  // corpus_sections, so it will never match a raw count(*) of corpus_sections
  // (which also holds unavailable/failed classification rows).
  parts.push(`  = ${neonCount.toLocaleString()} legacy (LegislationSection) + ${newPipelineCompiled.toLocaleString()} new pipeline (corpus_sections, compiled only)`)
  parts.push(`  Est. total: ~${grandTotalEstimated.toLocaleString()}`)
  parts.push(`  (denominators marked ~ are estimates; ✓ = confirmed from source)`)
  // V20/V21 email honesty: the percentage is of the KNOWN universe — never let
  // the number quietly flatter us. V21: every known-but-unenumerated source now
  // carries a ~ placeholder row in corpus_targets (a known source missing from
  // the denominator is a lie of omission), so the denominator includes blocked
  // and not-yet-built sources. Update the residual list below as sizings land.
  parts.push(`  ⚠ % is of the KNOWN universe incl. ~ placeholders for unenumerated sources (V21 honest-denominator rule).`)
  parts.push(`    Still UNSIZED (no denominator): financial-corpus · quango external-site content (exempt orgs)`)
  parts.push(`    · pre-redesign Law Commission papers · Lords Hansard 1919-1999 (bulk archive holds it; pwdata-lords starts 1999)`)
  if (dbSize) {
    const limitGB = (dbSize.limitBytes / 1_073_741_824).toFixed(0)
    const dbFlag = dbSize.usedPct >= 90 ? '  ⚠️  CRITICAL'
      : dbSize.usedPct >= 80 ? '  ⚠️  WARNING' : ''
    parts.push(`  DB: Neon ${dbSize.sizePretty}  (${dbSize.usedPct.toFixed(1)}% of ${limitGB}GB)${dbFlag}`)
  }

  // ── QUEUE ─────────────────────────────────────────────────────────────────
  parts.push('', SEP, 'QUEUE', SEP)
  const blockedStr = queueState.blocked > 0 ? `  |  🔴 blocked: ${queueState.blocked.toLocaleString()}` : ''
  parts.push(`  pending: ${queueState.pending.toLocaleString()}  |  claimed: ${queueState.claimed.toLocaleString()}  |  done: ${queueState.done.toLocaleString()}  |  failed: ${queueState.failed.toLocaleString()}${blockedStr}`)

  // Per-corpus breakdown: show corpora that have pending, failed or blocked rows
  const corpusQueueMap = new Map<string, { pending: number; failed: number; blocked: number }>()
  for (const r of queueByCorpus) {
    if (!corpusQueueMap.has(r.corpus)) corpusQueueMap.set(r.corpus, { pending: 0, failed: 0, blocked: 0 })
    if (r.status === 'pending') corpusQueueMap.get(r.corpus)!.pending = r.n
    if (r.status === 'failed') corpusQueueMap.get(r.corpus)!.failed = r.n
    if (r.status === 'blocked') corpusQueueMap.get(r.corpus)!.blocked = r.n
  }
  const noteworthyCorpora = [...corpusQueueMap.entries()]
    .filter(([, v]) => v.pending > 0 || v.failed > 0 || v.blocked > 0)
    .sort(([a], [b]) => a.localeCompare(b))
  if (noteworthyCorpora.length > 0) {
    parts.push('  By corpus:')
    for (const [corpus, v] of noteworthyCorpora) {
      const pend = v.pending > 0 ? `${v.pending.toLocaleString()} pending` : ''
      const fail = v.failed > 0 ? `${v.failed.toLocaleString()} failed` : ''
      const block = v.blocked > 0 ? `${v.blocked.toLocaleString()} blocked` : ''
      parts.push(`    ${corpus}: ${[pend, fail, block].filter(Boolean).join('  ')}`)
    }
  }

  // ── SOURCES ───────────────────────────────────────────────────────────────
  let sourceRows: SourceStatusRow[] = []
  try { sourceRows = await querySourceStatus() } catch { /* non-fatal */ }

  const noteworthySources = sourceRows.filter(
    s => s.pending > 0 || s.active > 0 || s.suspended
  )

  if (noteworthySources.length > 0) {
    parts.push('', SEP, 'SOURCES', SEP)
    for (const s of noteworthySources) {
      const pendingStr = `pending:${s.pending.toLocaleString()}`
      const activeStr = `in-flight:${s.active}/${s.cap}`
      const statusStr = s.suspended ? '⛔suspended'
        : s.isComplete ? '✅complete'
        : ''
      const line = `  ${s.sourceKey.padEnd(32)} ${pendingStr.padEnd(18)} ${activeStr.padEnd(16)} ${statusStr}`
      parts.push(line.trimEnd())
    }
  }

  // ── ISSUES ────────────────────────────────────────────────────────────────
  // Breaker lines persist every hour until the breaker is manually cleared.
  const issueLines: string[] = []

  for (const line of breakerIssues) {
    issueLines.push(`  🔴 ${line}`)
  }

  if (reclaimedCount > 0) {
    issueLines.push(`  ⚠️  Reclaimed ${reclaimedCount} stale claimed rows (process died mid-claim — now pending)`)
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
