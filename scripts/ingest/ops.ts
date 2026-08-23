/**
 * ops.ts — V17 merged scheduler + monitor. One always-on (but tiny) service,
 * one process, two cadences:
 *
 *   Hourly (:01)    — stale-claim reaper, census, corpus snapshot, cleanup.
 *   Daily (08:00 Europe/London) — progress email (existing format + ingest
 *                     state, sections vs rows divergence, persistent breaker
 *                     ISSUES), reporting the trailing 24h. Piggybacks on the
 *                     hourly tick whose local wall-clock hour is 8; a
 *                     dedicated lock (progress-reporter.ts acquireDailyEmailLock)
 *                     stops a mid-hour redeploy from re-sending it.
 *   Every 15 min    — circuit-breaker evaluation, ingest liveness check,
 *                     pwdata daily-file reseed, transient-failure retry reset,
 *                     vector-embed heartbeat/stall watcher (search/embed-observer.ts;
 *                     R2-only, edge-triggered emails, no-op when no embed is running).
 *
 * ops connects to NEON ONLY. The V16-era queryFormatBreakdown() /
 * queryUnrecognisedFormats() Railway-DB calls — the documented cause of
 * scheduler hangs when Railway DB was down — are gone, as is every other
 * Prisma/DATABASE_URL path.
 *
 * ── Circuit breakers (the core of the V17 renewal) ──────────────────────────
 * Per sourceType, deterministic:
 *   - failure breaker:      last 5 completed attempts all 'failed' → trip.
 *   - zero-output breaker:  ≥25 rows marked done while corpus_sections grew
 *                           by 0 for that source (cumulative streak) → trip.
 *     WHY 25: catches a silently-broken client within minutes while tolerating
 *     legitimately empty items. The committees incident wrote 2,896 empty
 *     "done" rows with no alarm — this breaker makes that class impossible.
 *   - on trip: park the source's pending rows as status='blocked', record the
 *     reason, add a persistent ISSUES line to the hourly email.
 *     NO AUTOMATIC RETRY, EVER (playbook rule: deterministic failures must
 *     not be retried). Clearing is manual — SQL documented in INGEST_PLAYBOOK.
 *
 * Breaker state lives in a dedicated `source_status` table rather than columns
 * on source_rate_limits. WHY: rate limits are human-edited configuration;
 * breaker state is a runtime state machine with counters that ops rewrites
 * every 15 min. Mixing them risks a manual rate edit clobbering breaker state
 * (and vice versa), and a separate table makes manual clearing one obvious row.
 *
 * ── Ingest liveness ─────────────────────────────────────────────────────────
 * If pending > 0 (status='pending' only — blocked rows excluded) and the
 * ingest heartbeat (ingest_service_state.last_beat, written every 30s by
 * ingest-pool) is stale, start `Ingest` via serviceInstanceRedeploy.
 * NEVER deploymentRedeploy — it can resurrect a stale build (see CLAUDE.md;
 * this exact mistake caused the 9 Jun Railway DB incident).
 * If pending = 0, do nothing: ingest stops itself (exit-on-empty).
 *
 * Env needed: NEON_DATABASE_URL, RESEND_API_KEY, RAILWAY_API_TOKEN.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import {
  sendProgressEmail,
  saveProgressSnapshot,
  acquireSchedulerLock,
  acquireBreakerLock,
  acquireDailyEmailLock,
  queryDbSize,
  runHourlyCleanup,
  queryStalledSources,
  reclaimStaleRows,
  writeCorpusSnapshot,
  getSnapshotDelta,
  queryRowsCompletedSince,
  type CorpusSnapshotEntry,
  type IngestServiceState,
} from './shared/progress-reporter'
import { checkEmbedProgress } from './search/embed-observer'
import { checkServeHealth } from './search/serve-observer'
import { runCensus, saveToR2 as saveCensusToR2 } from './census/live-census'
import { clearExpiredSuspensions } from './shared/queue-client'
import { getNeonPool } from './shared/neon-pool'
import { listPwdataFiles, PWDATA_CORPUS_CONFIG } from './sources/twfy-pwdata'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const INGEST_SERVICE_ID = process.env.INGEST_SERVICE_ID ?? 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'
const RAILWAY_ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'

const FAILURE_BREAKER_THRESHOLD = 5    // consecutive failures, no intervening success
const ZERO_OUTPUT_THRESHOLD     = 25   // done rows with zero section growth
const HEARTBEAT_STALE_MINUTES   = 10   // ingest considered stopped if no beat for this long
const START_COOLDOWN_MINUTES    = 15   // don't re-trigger a deploy while one may still be building
const DAILY_EMAIL_LOCAL_HOUR    = 8    // Europe/London wall-clock hour the progress email fires

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export async function ensureTables(): Promise<void> {
  const pool = getNeonPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS source_status (
      source_key TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'ok',
      trip_reason TEXT,
      tripped_at TIMESTAMPTZ,
      done_count BIGINT NOT NULL DEFAULT 0,
      section_count BIGINT NOT NULL DEFAULT 0,
      zero_output_streak INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingest_service_state (
      id int PRIMARY KEY,
      last_beat timestamptz,
      last_start_trigger timestamptz,
      starts_on date,
      starts_count int NOT NULL DEFAULT 0
    )
  `)
  // V24: per-row zero-output verdict written by the worker (see markDone).
  await pool.query(`ALTER TABLE ingest_queue ADD COLUMN IF NOT EXISTS produced_output boolean`)
}

// ── Railway API (start action only — liveness detection is heartbeat-based) ──

async function railwayGql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RAILWAY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(JSON.stringify(data.errors))
  return data.data as T
}

async function startIngestService(): Promise<void> {
  await railwayGql(
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    { serviceId: INGEST_SERVICE_ID, environmentId: RAILWAY_ENV_ID },
  )
}

// ── Ingest service state ──────────────────────────────────────────────────────

async function getIngestState(): Promise<IngestServiceState> {
  const pool = getNeonPool()
  const res = await pool.query<{ last_beat: Date | null; starts_on: Date | null; starts_count: number }>(
    'SELECT last_beat, starts_on, starts_count FROM ingest_service_state WHERE id = 1'
  )
  const row = res.rows[0]
  const lastBeat = row?.last_beat ? new Date(row.last_beat) : null
  const running = lastBeat != null && (Date.now() - lastBeat.getTime()) < HEARTBEAT_STALE_MINUTES * 60_000
  const today = new Date().toISOString().slice(0, 10)
  const startsToday = row?.starts_on && new Date(row.starts_on).toISOString().slice(0, 10) === today
    ? row.starts_count : 0
  return { running, lastBeat, startsToday }
}

async function checkIngestLiveness(): Promise<void> {
  const pool = getNeonPool()

  const pendingRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM ingest_queue WHERE status = 'pending'`
  )
  const pending = pendingRes.rows[0]?.n ?? 0
  if (pending === 0) return  // nothing to do — ingest stops itself

  const state = await getIngestState()
  if (state.running) return

  // Cooldown: a serviceInstanceRedeploy takes 1–2 min to build; don't stack them.
  const trigRes = await pool.query<{ last_start_trigger: Date | null }>(
    'SELECT last_start_trigger FROM ingest_service_state WHERE id = 1'
  )
  const lastTrig = trigRes.rows[0]?.last_start_trigger
  if (lastTrig && (Date.now() - new Date(lastTrig).getTime()) < START_COOLDOWN_MINUTES * 60_000) {
    console.log('[ops] ingest start already triggered recently — waiting')
    return
  }

  console.log(`[ops] ${pending} pending rows and ingest heartbeat stale — starting Ingest service`)
  try {
    await startIngestService()
    await pool.query(`
      INSERT INTO ingest_service_state (id, last_start_trigger, starts_on, starts_count)
      VALUES (1, NOW(), CURRENT_DATE, 1)
      ON CONFLICT (id) DO UPDATE SET
        last_start_trigger = NOW(),
        starts_count = CASE WHEN ingest_service_state.starts_on = CURRENT_DATE
                            THEN ingest_service_state.starts_count + 1 ELSE 1 END,
        starts_on = CURRENT_DATE
    `)
    console.log('[ops] serviceInstanceRedeploy triggered for Ingest')
  } catch (err) {
    console.error('[ops] failed to start Ingest service:', err)
  }
}

// ── Circuit breakers ──────────────────────────────────────────────────────────

interface SourceCounts { done: number; sections: number | null }

// Current done-row count per sourceType, and section count per sourceType via
// the queue's corpus→sourceType mapping (corpus_sections has corpus only).
//
// V27 §1 fix: the per-corpus section count is read from corpus_snapshots (the
// hourly census already computes it; PK-indexed, tiny) rather than a live
// `GROUP BY corpus` over corpus_sections. At 17M+ rows that full scan exceeded
// the pool's 60s client query_timeout on the production Neon link and threw
// "Query read timeout" EVERY 15-min tick — aborting evaluateBreakers before it
// could refresh source_status or trip/clear any breaker (the safety mechanism
// was silently dead since ~14 Jun). section_count is an informational column
// (written here, read nowhere — the email uses the census directly), so it must
// never be on the breaker-critical path. The snapshot read is wrapped: on any
// failure section counts come back null and the caller keeps the prior value,
// but the breaker evaluation still completes.
async function querySourceCounts(): Promise<Map<string, SourceCounts>> {
  const pool = getNeonPool()
  const [doneRes, mapRes] = await Promise.all([
    pool.query<{ sourceType: string; n: string }>(`
      SELECT "sourceType", COUNT(*)::text AS n FROM ingest_queue
      WHERE status = 'done' GROUP BY "sourceType"
    `),
    pool.query<{ sourceType: string; corpus: string }>(`
      SELECT DISTINCT "sourceType", corpus FROM ingest_queue
    `),
  ])

  // Per-corpus section counts from the latest census snapshot (not a 17M-row
  // live scan). null map ⇒ snapshots unavailable ⇒ leave section_count untouched.
  let sectionsByCorpus: Map<string, number> | null = null
  try {
    const secRes = await pool.query<{ corpus_key: string; n: string }>(`
      SELECT corpus_key, section_count::text AS n FROM corpus_snapshots
      WHERE hour = (SELECT MAX(hour) FROM corpus_snapshots)
    `)
    if (secRes.rows.length > 0) {
      sectionsByCorpus = new Map(secRes.rows.map(r => [r.corpus_key, parseInt(r.n, 10)]))
    }
  } catch (err) {
    console.warn('[ops] section-count snapshot read failed (non-fatal):', err instanceof Error ? err.message : err)
  }

  const out = new Map<string, SourceCounts>()
  for (const r of doneRes.rows) {
    out.set(r.sourceType, { done: parseInt(r.n, 10), sections: sectionsByCorpus ? 0 : null })
  }
  for (const r of mapRes.rows) {
    if (!out.has(r.sourceType)) out.set(r.sourceType, { done: 0, sections: sectionsByCorpus ? 0 : null })
    if (sectionsByCorpus) out.get(r.sourceType)!.sections! += sectionsByCorpus.get(r.corpus) ?? 0
  }
  return out
}

async function tripBreaker(sourceKey: string, reason: string): Promise<void> {
  const pool = getNeonPool()
  const parked = await pool.query(`
    UPDATE ingest_queue
    SET status = 'blocked', "lastError" = $2
    WHERE "sourceType" = $1 AND status = 'pending'
  `, [sourceKey, `breaker: ${reason}`])
  await pool.query(`
    INSERT INTO source_status (source_key, state, trip_reason, tripped_at, updated_at)
    VALUES ($1, 'tripped', $2, NOW(), NOW())
    ON CONFLICT (source_key) DO UPDATE SET
      state = 'tripped', trip_reason = $2, tripped_at = NOW(), updated_at = NOW()
  `, [sourceKey, reason])
  console.warn(`[ops] 🔴 BREAKER TRIPPED: ${sourceKey} — ${reason} (${parked.rowCount ?? 0} pending rows parked as blocked)`)
}

export async function evaluateBreakers(): Promise<void> {
  const pool = getNeonPool()

  const trippedRes = await pool.query<{ source_key: string }>(
    `SELECT source_key FROM source_status WHERE state = 'tripped'`
  )
  const tripped = new Set(trippedRes.rows.map(r => r.source_key))

  // 1. Failure breaker: last N completed attempts (done/failed/skipped, by
  //    claim time) all failed → deterministic failure, trip.
  const failRes = await pool.query<{ sourceType: string; n: string; all_failed: boolean; last_error: string | null }>(`
    SELECT "sourceType",
           COUNT(*)::text AS n,
           bool_and(status = 'failed') AS all_failed,
           (array_agg("lastError") FILTER (WHERE "lastError" IS NOT NULL))[1] AS last_error
    FROM (
      SELECT "sourceType", status, "lastError",
             ROW_NUMBER() OVER (PARTITION BY "sourceType" ORDER BY "claimedAt" DESC) AS rn
      FROM ingest_queue
      WHERE status IN ('done', 'failed', 'skipped') AND "claimedAt" IS NOT NULL
    ) t
    WHERE rn <= ${FAILURE_BREAKER_THRESHOLD}
    GROUP BY "sourceType"
    HAVING COUNT(*) >= ${FAILURE_BREAKER_THRESHOLD} AND bool_and(status = 'failed')
  `)
  for (const r of failRes.rows) {
    if (tripped.has(r.sourceType)) continue
    const snippet = (r.last_error ?? 'unknown').slice(0, 120).replace(/\n/g, ' ')
    await tripBreaker(r.sourceType, `${FAILURE_BREAKER_THRESHOLD} consecutive failures — last: ${snippet}`)
    tripped.add(r.sourceType)
  }

  // 2. Zero-output breaker (V24): the worker records ingest_queue.produced_output
  //    per done row — false only when the row wrote no compiled section, confirmed
  //    no existing R2 file, and wrote no marker (process-row.ts markDone). We trip
  //    when the TRAILING run of most-recent done rows for a sourceType is all-empty
  //    and reaches the threshold. This replaces the V23 logic, which inferred
  //    emptiness from corpus-level section_count deltas and so false-tripped on
  //    idempotent reseeds (already-complete rows re-run write 0 NEW sections →
  //    0 delta ≠ 0 output) — it parked 108,349 legitimate rows. Counting the
  //    r2Exists confirmation at the worker removes that false signal.
  //
  //    Window: rows completed in the last 24h with a non-null verdict. A genuinely
  //    broken source racks up empties fast; bounding the scan keeps the sweep cheap
  //    and prevents an old, since-fixed empty tail from lingering as a trip.
  const streakRes = await pool.query<{ sourceType: string; trailing_empty: string }>(`
    WITH ranked AS (
      SELECT "sourceType", produced_output,
             ROW_NUMBER() OVER (PARTITION BY "sourceType" ORDER BY "completedAt" DESC, id DESC) AS rn
      FROM ingest_queue
      WHERE status = 'done' AND produced_output IS NOT NULL
        AND "completedAt" > NOW() - INTERVAL '24 hours'
    ),
    agg AS (
      SELECT "sourceType",
             MIN(rn) FILTER (WHERE produced_output = true) AS first_true,
             COUNT(*) AS considered
      FROM ranked GROUP BY "sourceType"
    )
    SELECT "sourceType", COALESCE(first_true - 1, considered)::text AS trailing_empty FROM agg
  `)
  const streakBySource = new Map<string, number>(
    streakRes.rows.map(r => [r.sourceType, parseInt(r.trailing_empty, 10)])
  )

  // Keep done_count/section_count fresh for the progress email, and surface the
  // measured trailing-empty run in zero_output_streak (informational only now —
  // the trip decision is the produced_output query above, not a cross-sweep delta).
  const counts = await querySourceCounts()
  const prevRes = await pool.query<{ source_key: string; state: string }>(
    `SELECT source_key, state FROM source_status`
  )
  const prevState = new Map<string, string>(prevRes.rows.map(r => [r.source_key, r.state]))

  for (const [sourceKey, cur] of counts) {
    const streak = streakBySource.get(sourceKey) ?? 0
    await pool.query(`
      INSERT INTO source_status (source_key, done_count, section_count, zero_output_streak, updated_at)
      VALUES ($1, $2, COALESCE($3, 0), $4, NOW())
      ON CONFLICT (source_key) DO UPDATE SET
        done_count = $2,
        section_count = COALESCE($3, source_status.section_count),
        zero_output_streak = $4, updated_at = NOW()
    `, [sourceKey, cur.done, cur.sections, streak])

    if (streak >= ZERO_OUTPUT_THRESHOLD && !tripped.has(sourceKey) && prevState.get(sourceKey) !== 'tripped') {
      await tripBreaker(sourceKey, `${streak} consecutive done rows produced zero output (no section written, no existing-content confirmed, no marker)`)
      tripped.add(sourceKey)
    }
  }
}

export async function queryBreakerIssues(): Promise<string[]> {
  try {
    const res = await getNeonPool().query<{ source_key: string; trip_reason: string | null; tripped_at: Date | null; blocked: string }>(`
      SELECT s.source_key, s.trip_reason, s.tripped_at,
             COALESCE((SELECT COUNT(*)::text FROM ingest_queue q
                       WHERE q."sourceType" = s.source_key AND q.status = 'blocked'), '0') AS blocked
      FROM source_status s WHERE s.state = 'tripped' ORDER BY s.tripped_at
    `)
    return res.rows.map(r => {
      const when = r.tripped_at ? new Date(r.tripped_at).toISOString().slice(0, 16).replace('T', ' ') : '?'
      return `BREAKER ${r.source_key} (tripped ${when}, ${r.blocked} rows parked): ${r.trip_reason ?? 'unknown'} — manual clear required, see INGEST_PLAYBOOK §breakers`
    })
  } catch { return [] }
}

// ── pwdata daily-file reseed (moved from monitor.ts, dedup fixed in V17) ──────
// TWFY publishes new parliamentary XML daily. When a pwdata corpus has no
// pending/claimed rows, look for new files; inserted rows make pending > 0 and
// the liveness check starts ingest. This is the system's only automatic feed.
//
// WHY dedupe against corpus_sections, not the queue: hourly cleanup deletes
// done queue rows after 7 days, so "not in ingest_queue" matches the entire
// historical archive (~20k files for debates). The monitor-era version had
// this bug — it perpetually re-seeded already-ingested files, which under V17
// would keep ingest alive forever and feed the zero-output breaker. The
// permanent record of what is ingested is corpus_sections (id = corpus:docId:1).

export async function reseedExhaustedPwdata(): Promise<void> {
  const pool = getNeonPool()
  // Corpora with work still in the queue are skipped; everything else in
  // PWDATA_CORPUS_CONFIG is checked. WHY not "corpora with done rows in the
  // queue" (the monitor-era condition): hourly cleanup eventually deletes all
  // of a corpus's done rows during a recess, after which that condition would
  // never check the corpus again.
  const busyRes = await pool.query<{ corpus: string }>(`
    SELECT DISTINCT corpus FROM ingest_queue
    WHERE corpus LIKE 'pwdata-%' AND status IN ('pending', 'claimed')
  `)
  const busy = new Set(busyRes.rows.map(r => r.corpus))

  for (const corpus of Object.keys(PWDATA_CORPUS_CONFIG)) {
    if (busy.has(corpus)) continue
    try {
      const files = await listPwdataFiles(corpus)
      if (files.length === 0) continue

      // V28 §2: dedup via an index-friendly PK existence check, NOT a full id
      // pull. The previous `SELECT id FROM corpus_sections WHERE corpus=$1`
      // returned up to ~8.8M rows for pwdata-debates — a huge client-side
      // transfer that reliably exceeded the pool's 60s query_timeout, so pwdata
      // auto-reseed of new TWFY files was silently failing (V27 §1 flagged it).
      // Every processed file writes at least id "{corpus}:{docId}:1" (seq is
      // 1-based; empty/superseded files write a marker at :1 — see
      // process-row.ts processPwdataFile), so a PK lookup on those exact ids
      // tells us which files are already ingested. id = ANY(...) uses the
      // corpus_sections PK btree; chunked to keep each array param bounded.
      const firstIds = files.map(f => `${corpus}:${f.docId}:1`)
      const ingested = new Set<string>()
      const CHUNK = 10_000
      for (let i = 0; i < firstIds.length; i += CHUNK) {
        const slice = firstIds.slice(i, i + CHUNK)
        const r = await pool.query<{ docid: string }>(
          `SELECT split_part(id, ':', 2) AS docid FROM corpus_sections WHERE id = ANY($1::text[])`,
          [slice]
        )
        for (const row of r.rows) ingested.add(row.docid)
      }

      const priority = corpus === 'pwdata-westminster' ? 3 : 2
      let inserted = 0
      for (const f of files) {
        if (ingested.has(f.docId)) continue
        const { rowCount } = await pool.query(
          `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
           VALUES ($1, $2, $3, 'twfy-pwdata', $4, 'pending')
           ON CONFLICT (id) DO NOTHING`,
          [`${corpus}:${f.docId}`, corpus, f.docId, priority]
        )
        inserted += rowCount ?? 0
      }
      if (inserted > 0) console.log(`[ops] auto-reseeded ${corpus}: ${inserted} new files`)
    } catch (err) {
      console.error(`[ops] pwdata reseed error for ${corpus}:`, err)
    }
  }
}

// ── Transient-failure retry reset (moved from monitor.ts) ─────────────────────
// HTTP 502/524 are transient gateway errors — retryable per playbook policy.
// Tripped-breaker sources are excluded: deterministic failures are never
// auto-retried. 'specialist-queue:' rows are archived, never reset.

async function resetRetryableFailures(): Promise<void> {
  const { rowCount } = await getNeonPool().query(`
    UPDATE ingest_queue
    SET status      = 'pending',
        "lastError" = NULL,
        "claimedBy" = NULL,
        "claimedAt" = NULL
    WHERE status = 'failed'
      AND ("lastError" LIKE '%HTTP 502%' OR "lastError" LIKE '%HTTP 524%')
      AND "lastError" NOT LIKE 'specialist-queue:%'
      AND "sourceType" NOT IN (SELECT source_key FROM source_status WHERE state = 'tripped')
  `)
  if ((rowCount ?? 0) > 0) {
    console.log(`[ops] reset ${rowCount} retryable failed rows (502/524)`)
  }
}

// ── Hourly cycle ──────────────────────────────────────────────────────────────

async function runHourly(): Promise<void> {
  const hasLock = await acquireSchedulerLock()
  if (!hasLock) {
    console.log('[ops] another instance holds the hourly lock — skipping')
    return
  }

  const reclaimedCount = await reclaimStaleRows()

  // Daily-feed reseed belongs at hourly cadence (TWFY publishes daily).
  await reseedExhaustedPwdata().catch(err => console.error('[ops] pwdata reseed failed:', err))

  const capturedAt = new Date()
  console.log('[ops] running census (Neon corpus_sections + queue state)')
  const [census, dbSize] = await Promise.all([
    runCensus(),
    queryDbSize().catch(err => { console.warn('[ops] DB size query failed:', err); return undefined }),
  ])

  const corpusCounts: Record<string, { compiled: number; failed: number }> = {}
  for (const c of census.corpusSections) {
    corpusCounts[c.corpus] = { compiled: c.compiled, failed: c.failed }
  }
  const neonCount = census.legacyLegislationSections

  if (dbSize) {
    console.log(`[ops] Neon DB size: ${dbSize.sizePretty} = $${dbSize.costPerMonth.toFixed(2)}/month storage`)
  }

  try { await saveCensusToR2(census) } catch (err) { console.warn('[ops] census R2 save failed:', err) }

  try {
    const snapshotEntries: CorpusSnapshotEntry[] = census.corpusSections.map(c => ({
      corpus: c.corpus,
      count: c.total,
      compiled: c.compiled,
    }))
    await writeCorpusSnapshot(snapshotEntries, neonCount)
  } catch (err) { console.warn('[ops] corpus snapshot write failed:', err) }

  try {
    const cleaned = await runHourlyCleanup()
    if (cleaned.snapshots > 0 || cleaned.doneRows > 0) {
      console.log(`[ops] cleanup: deleted ${cleaned.snapshots} snapshots, ${cleaned.doneRows} done queue rows`)
    }
  } catch (err) { console.warn('[ops] cleanup failed:', err) }

  try { await clearExpiredSuspensions() } catch (err) { console.warn('[ops] suspension clear failed:', err) }

  try { await saveProgressSnapshot(corpusCounts, capturedAt) } catch (err) {
    console.warn('[ops] snapshot save failed:', err)
  }

  let stalledSources: string[] = []
  try { stalledSources = await queryStalledSources() } catch (err) { console.warn('[ops] stalled check failed:', err) }

  // ── Daily progress email ────────────────────────────────────────────────
  // Piggybacks on this hourly tick, gated to the one tick per day whose local
  // wall-clock hour is DAILY_EMAIL_LOCAL_HOUR. acquireDailyEmailLock guards
  // against a redeploy re-entering that same hour and sending it twice.
  const localHour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', hour12: false,
  }).format(capturedAt))

  if (localHour === DAILY_EMAIL_LOCAL_HOUR) {
    const hasEmailLock = await acquireDailyEmailLock()
    if (!hasEmailLock) {
      console.log('[ops] daily email already sent today — skipping')
    } else {
      let periodDelta = new Map<string, number>()
      try {
        const currentHour = new Date(capturedAt)
        currentHour.setMinutes(0, 0, 0)
        currentHour.setMilliseconds(0)
        const currentCounts = new Map<string, number>()
        for (const c of census.corpusSections) currentCounts.set(c.corpus, c.compiled)
        currentCounts.set('legacy-legislation-section', neonCount)
        periodDelta = await getSnapshotDelta(currentCounts, currentHour, 24)
      } catch (err) { console.warn('[ops] daily delta failed:', err) }

      const [completedToday, ingestService, breakerIssues] = await Promise.all([
        queryRowsCompletedSince(24),
        getIngestState().catch(() => undefined),
        queryBreakerIssues(),
      ])

      console.log('[ops] sending daily email')
      await sendProgressEmail({
        timestamp: capturedAt,
        corpusCounts,
        neonCount,
        dbSize,
        stalledSources,
        periodDelta,
        periodHours: 24,
        reclaimedCount,
        rowsCompletedInPeriod: completedToday.total,
        emptyRowsInPeriod: completedToday.empty,
        ingestService,
        breakerIssues,
      })
    }
  }
}

// ── 15-min cycle ──────────────────────────────────────────────────────────────

async function runQuarterHour(): Promise<void> {
  const hasLock = await acquireBreakerLock()
  if (!hasLock) {
    console.log('[ops] another instance holds the breaker lock — skipping')
    return
  }
  await evaluateBreakers().catch(err => console.error('[ops] breaker evaluation failed:', err))
  await resetRetryableFailures().catch(err => console.error('[ops] retry reset failed:', err))
  await checkIngestLiveness().catch(err => console.error('[ops] liveness check failed:', err))
  // Vector-embed heartbeat/stall watcher (R2-only; edge-triggered emails). No-op when
  // no embed is in progress. Isolated so it can never break the ingest-critical checks.
  await checkEmbedProgress().catch(err => console.error('[ops] embed observer failed:', err))
  // Serving health for fts-serve + vector-serve: memory vs the 8GB cap, concurrency,
  // latency, crashes/restarts, Neon storage, cost. Immediate email on breach, daily
  // digest otherwise. No-op when neither service URL is configured. Isolated for the
  // same reason as the embed observer — a monitoring failure must not take down the
  // ingest-critical checks above it.
  await checkServeHealth().catch(err => console.error('[ops] serve observer failed:', err))
}

// ── Scheduler loop ────────────────────────────────────────────────────────────
// Single setInterval-style loop ticking at 15-min clock marks (:00:30 offset
// avoids on-the-minute contention); the :00 tick also runs the hourly cycle.

const RUN_TIMEOUT_MS = 5 * 60 * 1000  // if a cycle hangs, abort it and continue

function msUntilNextQuarter(): number {
  const now = new Date()
  const mins = now.getMinutes()
  const nextMark = Math.ceil((mins + 1) / 15) * 15
  const target = new Date(now)
  if (nextMark >= 60) {
    target.setHours(target.getHours() + 1)
    target.setMinutes(nextMark - 60, 30, 0)
  } else {
    target.setMinutes(nextMark, 30, 0)
  }
  target.setMilliseconds(0)
  return Math.max(target.getTime() - now.getTime(), 60_000)
}

async function withTimeout(p: Promise<void>, label: string): Promise<void> {
  let handle: NodeJS.Timeout | undefined
  const timeoutP = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error(`${label} timed out after ${RUN_TIMEOUT_MS / 60_000} min`)), RUN_TIMEOUT_MS)
  })
  await Promise.race([p, timeoutP])
    .catch(err => console.error(`[ops] ${label} failed:`, err))
    .finally(() => clearTimeout(handle))
}

async function loop(): Promise<never> {
  // First cycle immediately on deploy: both cadences.
  await withTimeout(runQuarterHour(), 'quarter-hour cycle')
  await withTimeout(runHourly(), 'hourly cycle')

  while (true) {
    const delay = msUntilNextQuarter()
    console.log(`[ops] next tick in ${Math.round(delay / 60_000)}min`)
    await new Promise(r => setTimeout(r, delay))

    await withTimeout(runQuarterHour(), 'quarter-hour cycle')
    // Hourly cycle on the :00 tick
    if (new Date().getMinutes() < 8) {
      await withTimeout(runHourly(), 'hourly cycle')
    }
  }
}

async function main(): Promise<never> {
  console.log('[ops] starting — merged scheduler + monitor (V17, Neon only)')
  await ensureTables()
  return loop()
}

// Only start the service loop when run as the entrypoint — the exported cycle
// functions are imported by diagnostics without side effects.
if (require.main === module) {
  main().catch(err => {
    console.error('[ops] fatal:', err)
    process.exit(1)
  })
}
