/**
 * v36-regnal-300-scope.ts — how much of the V36 queue is exposed to the HTTP 300 class?
 *
 * `ukpga/Geo5Sess2/13/3` failed five times as a RETRYABLE source error. It is not
 * retryable: legislation.gov.uk answers `data.xml` for that id with **300 Multiple
 * Choices** and a two-item disambiguation list, because the regnal id is ambiguous
 * between `Geo5/13/3` (Appropriation Act 1922) and `Geo5Sess2/13/3` (Appropriation
 * (Session 2) Act 1922). No number of retries resolves an ambiguity.
 *
 * `fetchTextWithStatus` classifies with `if (!res.ok) retryable = true`, and 300 is
 * not `ok`, so a deterministic answer was retried to the 5-attempt cap and then
 * recorded as a failure that reads like a rate limit. Same family as §18: a failure
 * wearing another failure's face.
 *
 * This measures the blast radius before anything is changed — how many queue rows
 * carry a regnal (non-numeric) year segment, and how those rows actually resolved.
 *
 * Usage: tsx v36-regnal-300-scope.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

// A regnal id has a non-numeric year segment: ukpga/Geo5Sess2/13/3, ukpga/Vict/45/1.
const REGNAL = `split_part("docId", '/', 2) !~ '^[0-9]+$'`

async function main() {
  const pool = getNeonPool()

  const { rows: split } = await pool.query(`
    SELECT ${REGNAL} AS regnal, status, count(*)::int AS n
      FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation'
     GROUP BY 1, 2
     ORDER BY 1 DESC, 3 DESC`)

  console.log('queue by id style and status:')
  for (const r of split) {
    console.log(`  ${r.regnal ? 'regnal ' : 'numeric'}  ${String(r.status).padEnd(9)} ${Number(r.n).toLocaleString()}`)
  }

  const { rows: pend } = await pool.query(`
    SELECT count(*)::int AS n FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' AND status = 'pending' AND ${REGNAL}`)
  console.log(`\nregnal rows still pending: ${Number(pend[0].n).toLocaleString()}`)

  // The population that matters most: regnal ids sharing a (chapter, number) with a
  // sibling that differs only by a session suffix — the exact shape that 300s.
  const { rows: amb } = await pool.query(`
    WITH r AS (
      SELECT "docId", status,
             split_part("docId", '/', 1) AS kind,
             split_part("docId", '/', 2) AS yr,
             split_part("docId", '/', 3) AS chap,
             split_part("docId", '/', 4) AS num
        FROM ingest_queue
       WHERE "sourceType" = 'tna-legislation' AND ${REGNAL}
    )
    SELECT count(*)::int AS n
      FROM r
     WHERE r.yr ~ 'Sess'`)
  console.log(`regnal rows with a 'Sess' suffix (the ambiguous shape): ${Number(amb[0].n).toLocaleString()}`)

  const { rows: sessRows } = await pool.query(`
    SELECT "docId", status, attempts
      FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' AND split_part("docId", '/', 2) ~ 'Sess'
     ORDER BY status, "docId" LIMIT 40`)
  console.log(`\nthe 'Sess' rows (${sessRows.length} shown):`)
  for (const r of sessRows) console.log(`  ${String(r.status).padEnd(9)} attempts=${r.attempts}  ${r.docId}`)

  await endNeonPool()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
