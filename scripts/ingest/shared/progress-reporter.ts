/**
 * progress-reporter.ts — Neon queries + daily progress email for `ops` (V17).
 *
 * Maintenance (reaper, census, corpus snapshot, cleanup) runs hourly; the
 * progress email itself is a once-daily digest (08:00 Europe/London — see
 * ops.ts) reporting the trailing 24h, not the trailing hour.
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
// as PID 1. scheduler_lock ids: 1 = hourly maintenance run, 2 = (legacy
// discovery, unused), 4 = 15-min breaker/liveness run, 5 = daily email dedupe
// (23h window — survives a mid-hour redeploy re-entering the 08:00 tick
// without double-sending).

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

export async function acquireDailyEmailLock(): Promise<boolean> {
  return acquireLock(5, 23 * 60)
}

// ═════════════════════════════════════════════════════════════════════════════
// TWO NUMBERS, BOTH LABELLED (INGEST-LABELS §1)
// ═════════════════════════════════════════════════════════════════════════════
//
// On 21 August this email said `primary-acts-pre-2000` was **100% complete** while the search
// contract said we held **21.4%** of pre-2000 primary Acts. Both were correct and neither was
// about the other: this email counts SECTIONS (chunks of text), the coverage walk counts
// INSTRUMENTS (whole Acts and SIs). One Act can be five hundred sections. Nothing was wrong except
// that two incomparable numbers were published side by side with nothing saying so.
//
// ⚠⚠ AND THE SECTION DENOMINATOR WAS OFTEN THE NUMERATOR. `corpus_targets.est_sections` was set,
// for most collections, by copying the compiled count once the queue drained and flagging it
// `est_is_confirmed = true` (v19-rebaseline-final.ts, v19-rebaseline-pwdata.ts,
// v20-rebaseline-drains.ts, v19-align-p1.ts, v19-fix-si-residue.ts all do a variant of
// `UPDATE corpus_targets SET est_sections=<compiledCount>, est_is_confirmed=true`). Measured
// 2026-08-22: 62 of 77 live collections printed `[100% complete]`, and **46 of those had
// est_sections EXACTLY equal to the compiled count.** "We have ingested everything we ingested",
// with a tick.
//
// So `est_is_confirmed` is NOT evidence and this file no longer renders it as though it were.
// Provenance is COMPUTED here, at report time, from the numbers themselves.

export type DenominatorProvenance = 'estimate' | 'self-referential' | 'none'

/**
 * What kind of denominator is this, really?
 *
 * `self-referential` is the load-bearing case: a target at or below the count it is measuring
 * cannot demonstrate completeness, whatever flag is set on it. It is reported as UNMEASURED rather
 * than as 100%, which is the honest reading and the one `corpus-completeness.ts` already uses.
 *
 * ⚠ IT DELIBERATELY DOES NOT TAKE THE SOURCE WALK INTO ACCOUNT, and the first draft of this
 * function did. That draft printed `166,290 / ✓165,438 sections [100.5% of a source-walked
 * denominator]` for `primary-acts-pre-2000` — putting the walk's authority on the SECTION line,
 * when the walk counted INSTRUMENTS. It is the identical category error this whole section exists
 * to remove, rebuilt one layer up. The walk belongs to the instrument line and to nothing else;
 * the section target for these six collections was copied from the compiled count like all the
 * others, so it is self-referential like all the others, and now says so.
 */
export function denominatorProvenance(
  est: number | null, compiled: number,
): DenominatorProvenance {
  if (est == null) return 'none'
  // At or below the numerator: either it was copied from the count, or the count has since passed
  // it. Neither is a measurement of what the publisher publishes.
  if (est <= compiled) return 'self-referential'
  return 'estimate'
}

/** One-glyph strength marker, so an unconfirmed denominator is visibly weaker at a glance. */
export function provenanceMark(p: DenominatorProvenance): string {
  return p === 'estimate' ? '~' : p === 'self-referential' ? '⚠' : '?'
}

/**
 * Instrument-level coverage from the publisher's own enumeration, where one exists.
 *
 * ⚠ SIX COLLECTIONS, ALL LEGISLATION. Nothing else has a publisher walk behind it, and this
 * deliberately returns nothing rather than a plausible figure for the other 71 — an honest
 * "not walked" is worth more than a number that will be quoted as fact within a week.
 *
 * Figures from `docs/v36_reconciliation.json`, produced by `v36-source-census.ts --enumerate`
 * (a full entry walk of legislation.gov.uk's year feeds) followed by `v36-reconcile.ts`.
 * ⚠ A WALK IS A FACT ABOUT A DAY — the date travels with the numbers and is printed in the email.
 */
export const SOURCE_WALK_DATE = '2026-08-12'
export const SOURCE_WALK: Record<string, { published: number; present: number; noProvisions: number }> = {
  'primary-acts-pre-2000': { published: 16622, present: 3560, noProvisions: 7279 },
  'primary-acts-2000plus': { published: 938, present: 933, noProvisions: 0 },
  'si-pre-2010': { published: 80801, present: 54069, noProvisions: 32 },
  'si-2010plus': { published: 28389, present: 19489, noProvisions: 8187 },
  'regional': { published: 38099, present: 26150, noProvisions: 10319 },
  'retained-eu': { published: 159773, present: 39068, noProvisions: 113623 },
}

/** "3,560 of 16,622 = 21.4% (38.1% excl. no-provisions)" — or null where nobody has walked it. */
export function instrumentLine(corpusKey: string): string | null {
  const w = SOURCE_WALK[corpusKey]
  if (!w) return null
  const raw = (100 * w.present) / w.published
  const denomExcl = w.published - w.noProvisions
  const excl = denomExcl > 0 ? (100 * w.present) / denomExcl : null
  return `${w.present.toLocaleString()} of ${w.published.toLocaleString()} published = ${raw.toFixed(1)}%` +
    (excl != null && w.noProvisions > 0 ? ` (${excl.toFixed(1)}% excl. ${w.noProvisions.toLocaleString()} the source declares have no provisions)` : '')
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

// ── Snapshot delta from corpus_snapshots (variable lookback) ────────────────

export async function getSnapshotDelta(
  currentCounts: Map<string, number>,
  currentHour: Date,
  lookbackHours: number,
): Promise<Map<string, number>> {
  const neonPool = getNeonPool()
  const prevHour = new Date(currentHour.getTime() - lookbackHours * 60 * 60 * 1000)
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
  /** $/month at the plan's storage rate. There is no size limit to be a percentage of. */
  costPerMonth: number
  /** Fraction of the spending notification the storage line accounts for. */
  pctOfNotification: number
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE COST, NOT A STORAGE CEILING (INGEST-LABELS §1).
//
// ⚠ THE 20 GB LIMIT DID NOT EXIST. This file printed `DB: Neon 18 GB (88.5% of 20GB) ⚠️ WARNING`
// against a number invented downstream — the THIRD fictional storage ceiling this project has
// carried (17.5 GB in serve-observer.ts, 20 GB here, and a "wall" derived from the first in
// schema-2d2.sql), and one of the earlier two nearly caused real data to be deleted. Neon's
// actual enforced ceiling was read from the compute's own GUC in V38: `neon.max_cluster_size =
// 16,384 GiB`. We are three orders of magnitude below it. What storage actually is, is a bill.
//
// ⚠ A PLAN PRICE IS A FACT ABOUT A DAY, so it is recorded with its source and the date it was
// checked, and anything reading it can see how stale it is. Do not update the rate without also
// updating the date and where it was read.
const STORAGE_RATE_USD_PER_GB_MONTH = 0.35
const STORAGE_RATE_SOURCE = 'Neon Launch plan pricing page'
const STORAGE_RATE_CHECKED = '2026-08-16'   // V38_STORAGE_REPORT.md §1.1
// The $50 spending notification configured in Neon — the only threshold that exists and the only
// one worth showing a percentage of. It is a NOTIFICATION, not a cap: crossing it emails, it does
// not fail writes.
const SPEND_NOTIFICATION_USD = 50

export async function queryDbSize(): Promise<DbSizeResult> {
  const pool = getNeonPool()
  const res = await pool.query<{ db_size_bytes: string; db_size: string }>(`
    SELECT pg_database_size(current_database())::text AS db_size_bytes,
           pg_size_pretty(pg_database_size(current_database())) AS db_size
  `)
  const sizeBytes = parseInt(res.rows[0].db_size_bytes, 10)
  const gb = sizeBytes / 1_073_741_824
  const costPerMonth = gb * STORAGE_RATE_USD_PER_GB_MONTH
  return {
    sizeBytes,
    sizePretty: res.rows[0].db_size,
    costPerMonth,
    pctOfNotification: (costPerMonth / SPEND_NOTIFICATION_USD) * 100,
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

// ── Rows completed in a lookback window (divergence check input) ──────────────

// Returns both the total done-in-window and the genuinely-EMPTY subset
// (produced_output=false: wrote no section, confirmed no existing R2 file, wrote
// no marker, not a structural seeder — V24). The divergence warning fires on the
// empty count, NOT on compiled-section delta: a marker-heavy or idempotent-reseed
// window completes rows without growing the compiled count, which is legitimate
// and must not raise a false alarm. produced_output=NULL (pre-V24 rows) is excluded.
export async function queryRowsCompletedSince(hoursBack: number): Promise<{ total: number; empty: number }> {
  try {
    const res = await getNeonPool().query<{ total: number; empty: number }>(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE produced_output = false)::int AS empty
      FROM ingest_queue
      WHERE status = 'done' AND "completedAt" > NOW() - ($1 || ' hours')::interval
    `, [hoursBack])
    return { total: res.rows[0]?.total ?? 0, empty: res.rows[0]?.empty ?? 0 }
  } catch { return { total: 0, empty: 0 } }
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
  periodDelta?: Map<string, number>
  periodHours?: number
  reclaimedCount?: number
  rowsCompletedInPeriod?: number
  emptyRowsInPeriod?: number
  ingestService?: IngestServiceState
  breakerIssues?: string[]
}

/**
 * Build the email. Split out from `sendProgressEmail` (INGEST-LABELS §1) so the body can be
 * RENDERED WITHOUT SENDING — `labels/preview-email.ts` prints it, and a check can assert its
 * shape. Previously the only way to see this email was to receive it, which is why a denominator
 * copied from its own numerator sat in it, under a tick, for two months.
 */
export async function buildProgressEmail(input: ProgressEmailInput): Promise<{ subject: string; body: string; summary: string }> {
  const {
    timestamp, corpusCounts, neonCount, dbSize,
    stalledSources = [], periodDelta = new Map(), periodHours = 24, reclaimedCount = 0,
    rowsCompletedInPeriod = 0, emptyRowsInPeriod = 0, ingestService, breakerIssues = [],
  } = input

  const now = timestamp
  const bstFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })
  const bst = bstFmt.format(now)
  const bstTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  // Report-period window label (e.g. "since 08:00 yesterday" for the daily digest)
  const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
  const periodStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000)
  const periodLabel = periodHours >= 24 ? 'TODAY' : `LAST ${periodHours}H`
  const prevWindow = periodHours >= 24
    ? `since ${timeFmt.format(periodStart)} yesterday`
    : `${timeFmt.format(periodStart)}–${timeFmt.format(now)}`

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

  // Total corpus words (V22 — Charlie-requested). wordCount is exact and
  // populated at ingest for every compiled section (verified 13 Jun 2026:
  // the only NULLs are unavailable markers, which have no text); one SUM is
  // the whole calculation.
  let totalWords: number | null = null
  try {
    const wRes = await getNeonPool().query<{ words: string }>(
      `SELECT COALESCE(SUM("wordCount"), 0)::text AS words FROM corpus_sections`)
    totalWords = Number(wRes.rows[0].words)
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
  // V24 (Charlie-directed): NO headline percentage. Exact numerators against
  // still-estimated denominators pushed the old overall % past 100. The honest
  // headline is the two exact hard numbers (sections + words); the eventual total
  // is shown as a labelled projection, never as a ratio that can exceed 100%.
  // Completion is reported as a count of corpora in each state.
  const liveTargets = targets.filter(t => !t.retired)
  let selfRefCount = 0, inProgressCount = 0, notStartedCount = 0, blockedCount = 0, unsizedCount = 0
  for (const t of liveTargets) {
    const compiled = corpusCounts[t.corpus_key]?.compiled ?? 0
    if (t.est_sections == null) unsizedCount++
    if (t.blocked) { blockedCount++; continue }
    // ⚠ The old branch here was `compiled >= est → complete++`, and it is what printed
    // "100% complete" for 62 of 77 collections. A target at or below its own numerator is not
    // a measurement; it is counted separately and reported as unmeasured.
    if (denominatorProvenance(t.est_sections, compiled) === 'self-referential') { selfRefCount++; continue }
    if (compiled === 0) { notStartedCount++; continue }
    inProgressCount++
  }
  const totalWordsB = totalWords != null ? (totalWords / 1e9).toFixed(2) : null

  // ── Report-period delta ─────────────────────────────────────────────────────
  const hasDelta = periodDelta.size > 0
  const totalDelta = hasDelta
    ? [...periodDelta.values()].reduce((s, v) => s + Math.max(0, v), 0)
    : null

  // Corpora that grew this period count as "active"
  const activeCorpusKeys = new Set(
    [...periodDelta.entries()].filter(([, v]) => v > 0).map(([k]) => k)
  )

  // ── Subject ───────────────────────────────────────────────────────────────
  const deltaStr = totalDelta != null ? `+${totalDelta.toLocaleString()}` : '--'
  // Subject line carries cost, not a percentage of a limit that does not exist.
  const dbWarn = dbSize && dbSize.pctOfNotification >= 100 ? ` | ⚠️ DB $${dbSize.costPerMonth.toFixed(0)}/mo` : ''
  const breakerWarn = breakerIssues.length > 0 ? ` | 🔴 ${breakerIssues.length} breaker` : ''
  const wordsSubj = totalWordsB != null ? ` | ${totalWordsB}B words` : ''
  const periodSubjLabel = periodHours >= 24 ? 'today' : `last ${periodHours}h`
  const subject = `Ingest ${bstTime} | ${deltaStr} ${periodSubjLabel} | ${grandTotalCompiled.toLocaleString()} sections${wordsSubj}${dbWarn}${breakerWarn}`

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

  // ── TODAY (report period) ────────────────────────────────────────────────
  parts.push('', `${periodLabel}  (${prevWindow})`)
  if (!hasDelta) {
    parts.push('  Total added:  -- sections  (no previous snapshot yet)')
  } else {
    parts.push(`  Total added:  +${totalDelta!.toLocaleString()} sections`)
    const activeDelta = [...periodDelta.entries()]
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
    for (const [corpus, delta] of activeDelta) {
      const label = targets.find(t => t.corpus_key === corpus)?.display_label ?? corpus
      parts.push(`  ${label.padEnd(38)} +${delta.toLocaleString()}`)
    }
    if (activeDelta.length === 0) parts.push('  (no corpora added sections this period)')
  }
  // Divergence (V24): the silent-failure signal is the per-row produced_output
  // verdict, NOT compiled-section delta. A marker-heavy period (e.g. committees
  // metadata-only publications) or an idempotent reseed completes rows without
  // growing the compiled count — both are legitimate output and must not warn.
  // We warn only on rows that genuinely produced nothing (the breaker's input).
  parts.push(`  Rows completed: ${rowsCompletedInPeriod.toLocaleString()}${emptyRowsInPeriod > 0 ? ` (${emptyRowsInPeriod.toLocaleString()} produced zero output)` : ''}`)
  if (emptyRowsInPeriod > 0) {
    parts.push(`  ⚠️  DIVERGENCE: ${emptyRowsInPeriod.toLocaleString()} rows done with ZERO output (no section, no existing-content confirm, no marker) — the genuine zero-output signal; investigate before the breaker trips`)
  }

  // ── TOTAL CORPUS ──────────────────────────────────────────────────────────
  // V24: two exact hard numbers up top (sections + words). No headline % — see
  // the comment at the completion-count computation above for why.
  parts.push('', SEP, 'TOTAL CORPUS', SEP)
  parts.push(`  ${grandTotalCompiled.toLocaleString()} sections ingested   (exact)`)
  if (totalWords != null) parts.push(`  ${totalWordsB}B words   (${totalWords.toLocaleString()}, exact at ingest)`)
  // V18: show the breakdown — this total is legacy LegislationSection + compiled-only
  // corpus_sections, so it will never match a raw count(*) of corpus_sections
  // (which also holds unavailable/failed classification rows).
  parts.push(`  = ${neonCount.toLocaleString()} legacy (LegislationSection) + ${newPipelineCompiled.toLocaleString()} new pipeline (corpus_sections, compiled only)`)
  parts.push('')
  parts.push(`  COMPLETION  (${liveTargets.length} corpora, excl. retired):`)
  parts.push(`    ▶ in progress: ${inProgressCount}   ○ not started: ${notStartedCount}   ⛔ blocked: ${blockedCount}   unsized: ${unsizedCount}`)
  parts.push('')
  parts.push(`  ⚠ THERE IS NO "COMPLETE" COUNT ANY MORE, AND THAT IS THE POINT.`)
  parts.push(`    ${selfRefCount} of ${liveTargets.length} corpora have a section target that is at or below their own compiled count —`)
  parts.push(`    it was set FROM that count when the queue drained, so it can only ever agree with it. Those`)
  parts.push(`    used to print "100% complete". They now print UNMEASURED, because that is what they are.`)
  parts.push(`    Only ${Object.keys(SOURCE_WALK).length} collections have been walked against their publisher's own list (walk date ${SOURCE_WALK_DATE}):`)
  for (const k of Object.keys(SOURCE_WALK)) parts.push(`      ✓ ${k.padEnd(24)} ${instrumentLine(k)}`)
  parts.push(`    Every other collection's instrument coverage is UNKNOWN — not 100%, not "probably fine".`)
  // Labelled PROJECTION, never a percentage that can exceed 100 (Charlie-directed V24).
  parts.push(`  Eventual total ≈ ${grandTotalEstimated.toLocaleString()} est. when the open corpora land — a projection, NOT a % (numerators exact, denominators still estimates).`)
  parts.push(`  (per-corpus detail below. On the SECTIONS line: ~ = our estimate ·`)
  parts.push(`   ⚠ = the target was set from our own count and measures nothing · ? = no denominator at all)`)
  // V21 honest-denominator rule retained: every known-but-unenumerated source
  // carries a ~ placeholder in corpus_targets so the projection isn't a lie of
  // omission. These sources have no denominator at all yet:
  parts.push(`  Still UNSIZED (no denominator): financial-corpus · quango external-site content (exempt orgs)`)
  parts.push(`    · pre-redesign Law Commission papers`)
  if (dbSize) {
    // Cost, not a ceiling. The only threshold that exists is the $50 spending NOTIFICATION.
    const flag = dbSize.pctOfNotification >= 100 ? '  ⚠️  storage alone now exceeds the $50 notification' : ''
    parts.push(
      `  DB: Neon ${dbSize.sizePretty} = $${dbSize.costPerMonth.toFixed(2)}/month storage ` +
      `(${dbSize.pctOfNotification.toFixed(0)}% of the $${SPEND_NOTIFICATION_USD} spending notification)${flag}`)
    parts.push(
      `      rate $${STORAGE_RATE_USD_PER_GB_MONTH}/GB-month — ${STORAGE_RATE_SOURCE}, checked ${STORAGE_RATE_CHECKED}. ` +
      `There is NO storage cap on this plan; Neon's enforced ceiling is 16,384 GiB.`)
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

    // ── TWO NUMBERS, BOTH LABELLED. Sections first (what we fetched), instruments second (what
    //    the publisher publishes) — and never one without saying which it is.
    const prov = denominatorProvenance(est, compiled)
    const instruments = instrumentLine(target.corpus_key)
    const activeFlag = isActive ? '  — active' : ''

    let sectionsPart: string
    if (prov === 'self-referential') {
      // ⚠ NOT "100% complete". The target was set from this count, so it can only ever agree
      // with it. Coverage here is UNMEASURED, which is a different statement from complete.
      sectionsPart = `${compiled.toLocaleString().padStart(9)} sections   [⚠ UNMEASURED — the target was set from this count, not from the source]`
    } else if (prov === 'none') {
      sectionsPart = `${compiled.toLocaleString().padStart(9)} sections   [? no denominator]`
    } else if (compiled === 0) {
      sectionsPart = `        0 / ${provenanceMark(prov)}${(est ?? 0).toLocaleString()} sections   — not started`
    } else {
      const pct = est != null ? `${((compiled / est) * 100).toFixed(1)}%` : '?%'
      sectionsPart = `${compiled.toLocaleString().padStart(9)} / ${provenanceMark(prov)}${(est ?? 0).toLocaleString()} sections   [${pct} of a ${prov} denominator]`
    }
    parts.push(`  ${compiled === 0 ? '○ ' : '▶ '} ${target.corpus_key.padEnd(38)} ${sectionsPart}${activeFlag}`)
    parts.push(`     ${' '.repeat(38)} instruments: ${instruments ?? 'NOT WALKED — no publisher enumeration exists for this source, so coverage is unknown'}`)
  }

  const body = parts.join('\n')
  return { subject, body, summary: `${grandTotalCompiled.toLocaleString()} sections, delta ${deltaStr}` }
}

export async function sendProgressEmail(input: ProgressEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.warn('[reporter] RESEND_API_KEY not set — skipping email'); return }
  const { subject, body, summary } = await buildProgressEmail(input)

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
    console.log(`[reporter] Email sent to ${TO} — ${summary}`)
  }
}
