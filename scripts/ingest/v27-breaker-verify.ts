/**
 * v27-breaker-verify.ts — V27 §1 verification. Proves the repaired
 * evaluateBreakers() (a) completes end-to-end against the live 17M-row Neon DB
 * without the "Query read timeout" abort, and (b) still trips + can be cleared.
 *
 * Fully isolated: uses synthetic sourceType/corpus 'v27-breaker-test'. No
 * production row is read into the trip path or parked. Cleans up everything
 * (queue rows + source_status row) at the end, even on failure.
 *
 * Pass --keep to leave the test rows in place for inspection (default cleans up).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { evaluateBreakers } from './ops'

const SRC = 'v27-breaker-test'
const KEEP = process.argv.includes('--keep')

async function cleanup() {
  const pool = getNeonPool()
  await pool.query(`DELETE FROM ingest_queue WHERE "sourceType" = $1`, [SRC])
  await pool.query(`DELETE FROM source_status WHERE source_key = $1`, [SRC])
}

async function statusOf(): Promise<{ state: string | null; blocked: number; pending: number; failed: number }> {
  const pool = getNeonPool()
  const ss = await pool.query<{ state: string }>(`SELECT state FROM source_status WHERE source_key = $1`, [SRC])
  const q = await pool.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text n FROM ingest_queue WHERE "sourceType" = $1 GROUP BY status`, [SRC])
  const by = new Map(q.rows.map(r => [r.status, parseInt(r.n, 10)]))
  return { state: ss.rows[0]?.state ?? null, blocked: by.get('blocked') ?? 0, pending: by.get('pending') ?? 0, failed: by.get('failed') ?? 0 }
}

let pass = true
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? '✓' : '✗ FAIL'}  ${label}`)
  if (!cond) pass = false
}

async function main() {
  const pool = getNeonPool()
  await cleanup()

  // ── A. evaluateBreakers completes (the timeout-abort regression) ────────────
  console.log('\n=== A. evaluateBreakers() completes against live Neon (no Query read timeout) ===')
  const before = (await pool.query(`SELECT MAX(updated_at) m FROM source_status`)).rows[0].m
  const t0 = Date.now()
  await evaluateBreakers()
  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  const after = (await pool.query(`SELECT MAX(updated_at) m FROM source_status`)).rows[0].m
  console.log(`  ran in ${dt}s; source_status MAX(updated_at) ${before} → ${after}`)
  check('evaluateBreakers refreshed source_status (loop reached the update)', new Date(after).getTime() > new Date(before).getTime())

  // ── B. Failure breaker: deliberate trip ─────────────────────────────────────
  console.log('\n=== B. Failure breaker — deliberate trip (5 consecutive failures) ===')
  for (let i = 0; i < 5; i++) {
    await pool.query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status, "claimedAt", "completedAt", "lastError")
       VALUES ($1,$2,$3,$4,2,'failed', NOW() - ($5||' minutes')::interval, NOW(), 'synthetic test failure')`,
      [`${SRC}:fail:${i}`, SRC, `fail:${i}`, SRC, String(10 - i)])
  }
  for (let i = 0; i < 3; i++) {
    await pool.query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
       VALUES ($1,$2,$3,$4,2,'pending')`,
      [`${SRC}:pending:${i}`, SRC, `pending:${i}`, SRC])
  }
  await evaluateBreakers()
  let s = await statusOf()
  console.log('  after trip:', s)
  check('source_status state = tripped', s.state === 'tripped')
  check('3 pending rows parked as blocked', s.blocked === 3 && s.pending === 0)

  // ── C. Recovery: clear the breaker (the documented manual-clear procedure) ──
  console.log('\n=== C. Recovery — clear breaker, reset failures, unpark; must NOT re-trip ===')
  await pool.query(`UPDATE source_status SET state='ok', trip_reason=NULL, tripped_at=NULL WHERE source_key=$1`, [SRC])
  await pool.query(
    `UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL, "completedAt"=NULL
     WHERE "sourceType"=$1 AND status IN ('failed','blocked')`, [SRC])
  await evaluateBreakers()
  s = await statusOf()
  console.log('  after clear + re-eval:', s)
  check('source_status state stays ok (no re-trip — failures were reset)', s.state === 'ok')
  check('all 8 rows pending again, none blocked', s.pending === 8 && s.blocked === 0)

  // ── D. Zero-output breaker: deliberate trip (25 empty done rows) ─────────────
  console.log('\n=== D. Zero-output breaker — 25 done rows with produced_output=false ===')
  await pool.query(`DELETE FROM ingest_queue WHERE "sourceType"=$1`, [SRC])
  await pool.query(`UPDATE source_status SET state='ok', zero_output_streak=0 WHERE source_key=$1`, [SRC])
  for (let i = 0; i < 25; i++) {
    await pool.query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status, "claimedAt", "completedAt", produced_output)
       VALUES ($1,$2,$3,$4,2,'done', NOW(), NOW() - ($5||' seconds')::interval, false)`,
      [`${SRC}:empty:${i}`, SRC, `empty:${i}`, SRC, String(i)])
  }
  await pool.query(
    `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
     VALUES ($1,$2,$3,$4,2,'pending')`, [`${SRC}:zpending`, SRC, 'zpending', SRC])
  await evaluateBreakers()
  s = await statusOf()
  console.log('  after zero-output trip:', s)
  check('zero-output breaker tripped', s.state === 'tripped')
  check('the pending row was parked as blocked', s.blocked === 1)

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  if (!KEEP) { await cleanup(); console.log('\n[cleanup] removed all v27-breaker-test rows + source_status entry') }
  else console.log('\n[--keep] left test rows in place')

  console.log(`\n=== RESULT: ${pass ? 'ALL CHECKS PASSED ✓' : 'SOME CHECKS FAILED ✗'} ===`)
  await endNeonPool()
  if (!pass) process.exit(1)
}

main().catch(async (e) => {
  console.error('FATAL', e)
  try { await cleanup(); await endNeonPool() } catch { /* ignore */ }
  process.exit(1)
})
