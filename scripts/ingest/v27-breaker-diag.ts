/**
 * v27-breaker-diag.ts — V27 §1. Read-only diagnosis of why the Ops 15-min
 * breaker-evaluation loop stopped updating source_status (last seen 14 Jun).
 *
 * Ops liveness clearly still runs (it restarts the worker), and liveness lives
 * in the same runQuarterHour() block AFTER evaluateBreakers(), under the same
 * breaker lock — so the lock IS being acquired and evaluateBreakers() IS being
 * called. That means evaluateBreakers() is either (a) throwing before its
 * source_status update loop (caught by the .catch in runQuarterHour), or (b)
 * reaching an empty counts map so the update loop never executes.
 *
 * This script reproduces evaluateBreakers()'s queries in isolation, times each,
 * and finally calls evaluateBreakers() itself — no writes beyond what that
 * function already does in production (it runs every 15 min anyway).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { evaluateBreakers } from './ops'

const FAILURE_BREAKER_THRESHOLD = 5

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  const t0 = Date.now()
  try {
    const r = await fn()
    console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] OK  ${label}`)
    return r
  } catch (e) {
    console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] ERR ${label}: ${e instanceof Error ? e.message : e}`)
    return undefined
  }
}

async function main() {
  const pool = getNeonPool()

  console.log('=== CONNECTIVITY ===')
  const now = await pool.query('select now() as ts, current_database() as db')
  console.log('Neon OK:', now.rows[0].ts, '/', now.rows[0].db)

  console.log('\n=== source_status freshness (the symptom) ===')
  const ss = await pool.query(
    `select count(*)::int n, max(updated_at) as latest, min(updated_at) as earliest from source_status`
  )
  console.log(ss.rows[0])
  const ssTop = await pool.query(
    `select source_key, state, done_count, section_count, zero_output_streak, updated_at
       from source_status order by updated_at desc limit 8`
  )
  console.table(ssTop.rows)

  console.log('\n=== scheduler_lock state (id 4 = breaker/liveness lock) ===')
  const locks = await pool.query(
    `select id, process_id, locked_at, now() - locked_at as age from scheduler_lock order by id`
  )
  console.table(locks.rows)

  console.log('\n=== ingest_queue by status + total completed (drives the heavy window query) ===')
  const byStatus = await pool.query(`select status, count(*)::int n from ingest_queue group by status order by n desc`)
  console.table(byStatus.rows)
  const completed = await pool.query(
    `select count(*)::bigint n from ingest_queue where status in ('done','failed','skipped') and "claimedAt" is not null`
  )
  console.log('completed rows feeding the failure-breaker window sort:', completed.rows[0].n)

  console.log('\n=== Timing each evaluateBreakers() sub-query in isolation ===')
  await timed('SELECT tripped from source_status', () =>
    pool.query(`SELECT source_key FROM source_status WHERE state = 'tripped'`))

  await timed('FAILURE breaker window query (ROW_NUMBER over ALL completed rows)', () =>
    pool.query(`
      SELECT "sourceType", COUNT(*)::text AS n, bool_and(status = 'failed') AS all_failed,
             (array_agg("lastError") FILTER (WHERE "lastError" IS NOT NULL))[1] AS last_error
      FROM ( SELECT "sourceType", status, "lastError",
               ROW_NUMBER() OVER (PARTITION BY "sourceType" ORDER BY "claimedAt" DESC) AS rn
             FROM ingest_queue
             WHERE status IN ('done', 'failed', 'skipped') AND "claimedAt" IS NOT NULL ) t
      WHERE rn <= ${FAILURE_BREAKER_THRESHOLD}
      GROUP BY "sourceType"
      HAVING COUNT(*) >= ${FAILURE_BREAKER_THRESHOLD} AND bool_and(status = 'failed')`))

  await timed('ZERO-OUTPUT streak window query (24h bounded)', () =>
    pool.query(`
      WITH ranked AS (
        SELECT "sourceType", produced_output,
               ROW_NUMBER() OVER (PARTITION BY "sourceType" ORDER BY "completedAt" DESC, id DESC) AS rn
        FROM ingest_queue
        WHERE status = 'done' AND produced_output IS NOT NULL
          AND "completedAt" > NOW() - INTERVAL '24 hours' )
      , agg AS ( SELECT "sourceType", MIN(rn) FILTER (WHERE produced_output = true) AS first_true,
                        COUNT(*) AS considered FROM ranked GROUP BY "sourceType" )
      SELECT "sourceType", COALESCE(first_true - 1, considered)::text AS trailing_empty FROM agg`))

  await timed('querySourceCounts: done counts', () =>
    pool.query(`SELECT "sourceType", COUNT(*)::text AS n FROM ingest_queue WHERE status = 'done' GROUP BY "sourceType"`))
  await timed('querySourceCounts: DISTINCT sourceType,corpus map', () =>
    pool.query(`SELECT DISTINCT "sourceType", corpus FROM ingest_queue`))
  await timed('querySourceCounts: corpus_sections GROUP BY (16M+ rows)', () =>
    pool.query(`SELECT corpus, COUNT(*)::text AS n FROM corpus_sections GROUP BY corpus`))

  console.log('\n=== Running the REAL evaluateBreakers() end-to-end ===')
  const t0 = Date.now()
  try {
    await evaluateBreakers()
    console.log(`evaluateBreakers() completed OK in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) {
    console.log(`evaluateBreakers() THREW after ${((Date.now() - t0) / 1000).toFixed(1)}s:`)
    console.log(e)
  }

  console.log('\n=== source_status freshness AFTER the run ===')
  const ss2 = await pool.query(`select count(*)::int n, max(updated_at) as latest from source_status`)
  console.log(ss2.rows[0])

  await endNeonPool()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
