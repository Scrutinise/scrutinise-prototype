/**
 * v36-retry-churn-probe.ts — are rows COMPLETING, or cycling through the retryable path?
 *
 * The signature to tell apart, and the reason this exists: `markRetryable()` returns a
 * row to `pending`, records the reason and backs the source off 60s, capped at 5
 * attempts. Under TNA throttling that produces `done` flat, `pending` oscillating,
 * claims churning and a trickle of sections — which from the trailing-window
 * throughput in `v36-drain-status.ts` looks like a slow patch of large instruments.
 *
 * The distinguishing measurement is the ATTEMPTS DISTRIBUTION on pending rows. A
 * healthy tail is attempts=0/1. A throttled run climbs, and every row that reaches 5
 * becomes a real `failed` — which is how 39,964 rows were parked on 12 Aug.
 *
 * Usage: tsx v36-retry-churn-probe.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  const { rows: att } = await pool.query(`
    SELECT status, attempts, count(*)::int AS n
      FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' AND status IN ('pending', 'claimed', 'failed')
     GROUP BY 1, 2 ORDER BY 1, 2`)
  console.log('attempts distribution on unfinished rows:')
  for (const r of att) console.log(`  ${String(r.status).padEnd(9)} attempts=${r.attempts}  ${Number(r.n).toLocaleString()}`)

  const { rows: err } = await pool.query(`
    SELECT left("lastError", 90) AS err, count(*)::int AS n
      FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' AND "lastError" IS NOT NULL AND status <> 'done'
     GROUP BY 1 ORDER BY 2 DESC LIMIT 8`)
  console.log(`\nlastError on unfinished rows (${err.length} distinct):`)
  for (const r of err) console.log(`  ${String(r.n).padStart(6)}  ${r.err}`)

  const { rows: st } = await pool.query(
    `SELECT * FROM source_status WHERE source_key = 'tna-legislation'`)
  console.log('\nsource_status:', JSON.stringify(st[0], null, 1))

  const { rows: held } = await pool.query(`
    SELECT round(extract(epoch FROM now() - "claimedAt"))::int AS held_s, "docId", attempts
      FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' AND status = 'claimed'
     ORDER BY "claimedAt" LIMIT 12`)
  console.log(`\nclaimed now (${held.length}):`)
  for (const h of held) console.log(`  held ${String(h.held_s).padStart(5)}s attempts=${h.attempts}  ${h.docId}`)

  await endNeonPool()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
