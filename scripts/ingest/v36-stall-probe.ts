/**
 * v36-stall-probe.ts — is the drain actually moving RIGHT NOW?
 *
 * `v36-drain-status.ts` reports throughput over trailing 15-minute and 1-hour
 * windows, which keep reporting healthy numbers for a quarter of an hour after a
 * run has stopped dead. This asks the narrower question the trailing window cannot:
 * how many rows completed in the last 1, 5 and 10 minutes, and what are the workers
 * holding right now.
 *
 * ⚠ Every staleness figure is computed IN SQL — pg renders timestamps in local time
 * with a GMT+0100 label, and differencing the printed strings against a UTC clock
 * reads as an hour in the future.
 *
 * Usage: tsx v36-stall-probe.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  const { rows: c } = await pool.query(`
    SELECT
      count(*) FILTER (WHERE "completedAt" > now() - interval '1 minute')::int  AS m1,
      count(*) FILTER (WHERE "completedAt" > now() - interval '5 minute')::int  AS m5,
      count(*) FILTER (WHERE "completedAt" > now() - interval '10 minute')::int AS m10,
      count(*) FILTER (WHERE "completedAt" > now() - interval '30 minute')::int AS m30,
      max("completedAt")                                                        AS last_done,
      round(extract(epoch FROM now() - max("completedAt")))::int                AS last_done_age_s
    FROM ingest_queue
    WHERE "sourceType" = 'tna-legislation' AND status = 'done'`)
  const r = c[0]
  console.log('completions:')
  console.log(`  last 1 min ${r.m1}   last 5 min ${r.m5}   last 10 min ${r.m10}   last 30 min ${r.m30}`)
  console.log(`  most recent completion was ${r.last_done_age_s}s ago`)

  const { rows: held } = await pool.query(`
    SELECT "docId", "claimedBy",
           round(extract(epoch FROM now() - "claimedAt"))::int AS held_s, attempts
      FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' AND status = 'claimed'
     ORDER BY "claimedAt" LIMIT 20`)
  console.log(`\nclaimed right now (${held.length}):`)
  for (const h of held) console.log(`  held ${String(h.held_s).padStart(5)}s  attempts=${h.attempts}  ${h.docId}  by ${h.claimedBy}`)

  // Sections are the real output. A run can hold claims and write nothing.
  const { rows: s } = await pool.query(`
    SELECT count(*) FILTER (WHERE "createdAt" > now() - interval '5 minute')::int  AS m5,
           count(*) FILTER (WHERE "createdAt" > now() - interval '30 minute')::int AS m30,
           round(extract(epoch FROM now() - max("createdAt")))::int                AS last_write_age_s
      FROM corpus_sections
     WHERE "createdAt" > now() - interval '2 hour'`)
  console.log(`\nsections written: last 5 min ${s[0].m5} · last 30 min ${s[0].m30} · most recent ${s[0].last_write_age_s}s ago`)

  await endNeonPool()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
