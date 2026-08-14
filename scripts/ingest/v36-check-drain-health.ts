/**
 * v36-check-drain-health.ts — the morning check: breaker, failures, and what the
 * recovery has actually written (which is what sizes the reindex that must follow it).
 *
 * Usage: tsx v36-check-drain-health.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  const { rows: st } = await pool.query(
    `SELECT source_key, state, trip_reason FROM source_status WHERE source_key LIKE '%legislation%'`
  )
  console.log('source_status:')
  for (const r of st) console.log(`  ${r.source_key.padEnd(24)} ${r.state}  ${r.trip_reason ?? ''}`)

  const { rows: f } = await pool.query(
    `SELECT "docId", attempts, left("lastError", 120) AS err
       FROM ingest_queue
      WHERE "sourceType" = 'tna-legislation' AND status = 'failed'
      ORDER BY "docId" LIMIT 20`
  )
  console.log(`\nfailed rows (${f.length}):`)
  for (const r of f) console.log(`  ${r.docId}  attempts=${r.attempts}  ${r.err}`)

  // What the run has written. The reindex is sized from this, not from the row count:
  // an instrument is one queue row and anywhere from 1 to 2,000 sections.
  const { rows: w } = await pool.query(`
    SELECT count(*)::int AS sections,
           count(DISTINCT "parentDocId")::int AS docs,
           min("createdAt") AS first_write,
           max("createdAt") AS last_write
      FROM corpus_sections
     WHERE "createdAt" >= '2026-08-12 22:57:00Z'`)
  console.log(
    `\nwritten since seed: ${Number(w[0].sections).toLocaleString()} sections across ` +
      `${Number(w[0].docs).toLocaleString()} documents\n  ${w[0].first_write?.toISOString?.() ?? w[0].first_write} → ${w[0].last_write?.toISOString?.() ?? w[0].last_write}`
  )

  const { rows: rp } = await pool.query(`SELECT count(*)::int AS n FROM section_repeals`)
  console.log(`\nsection_repeals rows: ${Number(rp[0].n).toLocaleString()}`)

  await endNeonPool()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
