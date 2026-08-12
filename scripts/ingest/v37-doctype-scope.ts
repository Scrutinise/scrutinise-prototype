/**
 * v37-doctype-scope.ts — which legislation.gov.uk doctypes does the corpus actually
 * hold, and which does it merely get cited at?
 *
 * V37 §1 says a gap must be CLASSIFIED, not suppressed. That cuts both ways: calling
 * a doctype "out of scope" to make a number smaller is the same failure as leaving it
 * unexplained. So the scope list is derived from what the corpus demonstrably holds,
 * and anything with zero held instruments is reported as needing a DECISION rather
 * than assigned one here.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
  const { rows } = await pool.query(`
    SELECT leg_type, count(*)::int AS known,
           count(*) FILTER (WHERE in_corpus)::int AS held,
           sum(section_count)::bigint AS sections
    FROM corpus_acts GROUP BY 1 ORDER BY 3 DESC, 2 DESC`)
  console.log('doctype    known    held    sections   verdict')
  for (const r of rows) {
    const verdict = r.held > 0 ? 'INGESTED' : (r.known > 0 ? 'known, none held' : '—')
    console.log(`${String(r.leg_type).padEnd(9)} ${String(r.known).padStart(7)} ${String(r.held).padStart(7)} ${String(r.sections ?? 0).padStart(10)}   ${verdict}`)
  }
  await pool.end()
}
main().catch(e => { console.error(e); process.exitCode = 1 })
