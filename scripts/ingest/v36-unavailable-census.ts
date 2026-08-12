/**
 * v36-unavailable-census.ts — V36 §1.2's follow-on: "if that is what happened here,
 * the same defect may be live elsewhere."
 *
 * enumerateSections has two different ways of producing an `unavailable` row:
 *
 *   (a) `hasNoProvisions — classified as {commencement|revoked|pdf-only|…}`
 *       The CLML WAS fetched, and it declares NumberOfProvisions="0". A real state.
 *
 *   (b) `No CLML/HTML/PDF found on TNA`
 *       Nothing came back from any of the three formats. That is a FETCH OUTCOME,
 *       not a property of the instrument — and it is written with
 *       availability_status = 'no-provisions' (the `?? 'no-provisions'` default),
 *       so it is indistinguishable in the table from (a).
 *
 * Probing (b) against the live source finds megabytes of CLML. This counts how many
 * rows are in each state across every legislation corpus, so the size of the false
 * bucket is measured rather than extrapolated from the six ids that were probed.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool, PoolClient } from 'pg'

const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex',
]

async function show(c: PoolClient, label: string, sql: string, params: unknown[] = []) {
  const t = Date.now()
  const { rows } = await c.query(sql, params)
  console.log(`\n=== ${label} ===  (${((Date.now() - t) / 1000).toFixed(1)}s, ${rows.length} rows)`)
  if (rows.length) console.table(rows); else console.log('  (no rows)')
  return rows
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
  const c = await pool.connect()
  try {
    await show(c, 'ALL unavailable rows in the legislation corpora, by errorMsg', `
      SELECT corpus,
             CASE WHEN "errorMsg" LIKE 'hasNoProvisions%' THEN 'a: CLML fetched, declares 0 provisions'
                  WHEN "errorMsg" = 'No CLML/HTML/PDF found on TNA' THEN 'b: nothing came back (FETCH OUTCOME)'
                  ELSE COALESCE("errorMsg",'(null)') END AS reason,
             availability_status,
             count(*) AS rows
      FROM corpus_sections
      WHERE corpus = ANY($1::text[]) AND status = 'unavailable'
      GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 40`, [LEG_CORPORA])

    await show(c, 'totals: class (a) genuine vs class (b) fetch-outcome', `
      SELECT CASE WHEN "errorMsg" LIKE 'hasNoProvisions%' THEN 'a: genuine no-provisions'
                  WHEN "errorMsg" = 'No CLML/HTML/PDF found on TNA' THEN 'b: fetch returned nothing'
                  ELSE 'other' END AS class,
             count(*) AS rows,
             count(DISTINCT split_part(id, ':', 2)) AS instruments
      FROM corpus_sections
      WHERE corpus = ANY($1::text[]) AND status = 'unavailable'
      GROUP BY 1 ORDER BY 2 DESC`, [LEG_CORPORA])

    await show(c, 'class (b) instruments that have NO compiled section anywhere', `
      WITH st AS (
        SELECT split_part(id, ':', 2) AS gid,
               count(*) FILTER (WHERE status='compiled')::int AS compiled,
               count(*) FILTER (WHERE status='unavailable' AND "errorMsg" = 'No CLML/HTML/PDF found on TNA')::int AS classb
        FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1
      )
      SELECT split_part(gid,'/',1) AS leg_type,
             count(*) AS instruments_lost
      FROM st WHERE classb > 0 AND compiled = 0
      GROUP BY 1 ORDER BY 2 DESC`, [LEG_CORPORA])

    await show(c, 'when were the class (b) markers written', `
      SELECT date_trunc('month', "createdAt")::date AS month, count(*) AS rows
      FROM corpus_sections
      WHERE corpus = ANY($1::text[]) AND status = 'unavailable'
        AND "errorMsg" = 'No CLML/HTML/PDF found on TNA'
      GROUP BY 1 ORDER BY 1`, [LEG_CORPORA])

    await show(c, 'sample class (b) rows, largest legacy instruments first', `
      WITH st AS (
        SELECT split_part(id, ':', 2) AS gid,
               count(*) FILTER (WHERE status='compiled')::int AS compiled,
               count(*) FILTER (WHERE status='unavailable' AND "errorMsg" = 'No CLML/HTML/PDF found on TNA')::int AS classb,
               min("createdAt") AS created
        FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1
      )
      SELECT st.gid, COALESCE(ca.title,'(untitled)') AS title, ca.year,
             ca.item_section_count AS legacy_sections, st.created
      FROM st LEFT JOIN corpus_acts ca ON ca.gid = st.gid
      WHERE st.classb > 0 AND st.compiled = 0
      ORDER BY ca.item_section_count DESC NULLS LAST LIMIT 15`, [LEG_CORPORA])
  } finally {
    c.release(); await pool.end()
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
