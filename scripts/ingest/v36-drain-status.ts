/**
 * v36-drain-status.ts — is the V36 recovery actually draining?
 *
 * "Nothing is happening" is usually the design rather than a stall: `Ops` runs its
 * liveness cycle every 15 minutes and only restarts `Ingest` when the heartbeat is
 * more than 10 minutes stale, so the worst case between a seed landing and a worker
 * starting is about 25 minutes. Check the state before reaching for a manual
 * redeploy.
 *
 * ⚠ pg renders timestamps in local time with a `GMT+0100` label, so an 18:45 UTC
 * value prints as "19:45:32 GMT+0100" and differencing the printed strings against a
 * UTC clock reads as an hour in the future — a stalled service that is not stalled.
 * Every staleness figure here is therefore computed IN SQL.
 *
 * Usage: tsx v36-drain-status.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  const { rows: q } = await pool.query(`
    SELECT status, count(*)::int AS n
    FROM ingest_queue WHERE "sourceType" = 'tna-legislation' GROUP BY 1 ORDER BY 2 DESC`)
  console.log('queue (tna-legislation):')
  for (const r of q) console.log(`  ${String(r.status).padEnd(9)} ${r.n.toLocaleString().padStart(8)}`)
  const total = q.reduce((a, r) => a + r.n, 0)
  const done = q.find(r => r.status === 'done')?.n ?? 0
  const failed = q.find(r => r.status === 'failed')?.n ?? 0
  const claimed = q.find(r => r.status === 'claimed')?.n ?? 0
  console.log(`  ${'TOTAL'.padEnd(9)} ${total.toLocaleString().padStart(8)}  — ${((100 * (done + failed)) / Math.max(1, total)).toFixed(2)}% resolved`)

  // Progress in the last 15 minutes is the liveness signal that matters: a claimed
  // count above zero with no completions is a stall wearing the same face as work.
  const { rows: [rate] } = await pool.query(`
    SELECT count(*) FILTER (WHERE "completedAt" > now() - interval '15 minutes')::int AS last15,
           count(*) FILTER (WHERE "completedAt" > now() - interval '60 minutes')::int AS last60,
           max("completedAt") AS newest
    FROM ingest_queue WHERE "sourceType" = 'tna-legislation'`)
  console.log(`\nthroughput: ${rate.last15} in the last 15 min · ${rate.last60} in the last hour`)
  // An ETA off a window the drain has only just entered is arithmetic, not a
  // forecast: the first reading after seeding said "837 h remaining" from 50
  // completions in a minute-old window. Refuse to print one until the hour is
  // actually representative, and say why rather than printing nothing.
  const remaining = total - done - failed
  if (rate.last60 >= 500 && rate.last15 > 0) {
    console.log(`            ~${(remaining / rate.last60).toFixed(1)} h remaining at the last hour's rate`)
  } else {
    console.log(`            ETA withheld — only ${rate.last60} completions in the last hour, which is too short a`)
    console.log(`            window to extrapolate from. It becomes meaningful once the hour holds 500+.`)
  }

  const { rows: [beat] } = await pool.query(`
    SELECT EXTRACT(EPOCH FROM (now() - max(last_beat)))/60 AS beat_age_min
    FROM ingest_service_state`).catch(() => ({ rows: [{ beat_age_min: null }] }))
  console.log(`ingest heartbeat: ${beat.beat_age_min === null ? '(no ingest_service_state)' : `${Number(beat.beat_age_min).toFixed(1)} min old`}`)

  const { rows: sec } = await pool.query(`
    SELECT count(*)::int AS n
    FROM corpus_sections
    WHERE corpus IN ('primary-acts-2000plus','primary-acts-pre-2000','si-2010plus','si-pre-2010','regional','retained-eu')
      AND "createdAt" > now() - interval '2 hours'`)
  console.log(`sections written in the last 2 h: ${sec[0].n.toLocaleString()}`)

  const { rows: top } = await pool.query(`
    SELECT "docId", status, priority, "lastError"
    FROM ingest_queue WHERE "sourceType" = 'tna-legislation'
    ORDER BY priority ASC, id ASC LIMIT 8`)
  console.log('\nhead of the citation-ordered queue:')
  for (const r of top) console.log(`  p${String(r.priority).padStart(3)} ${String(r.docId).padEnd(22)} ${String(r.status).padEnd(9)} ${r.lastError ?? ''}`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
