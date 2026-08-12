/**
 * v36-classb-timing.ts — is class (b) a property of the documents, or of the minutes
 * in which they happened to be fetched?
 *
 * `enumerateSections` reaches TNA through `fetchText()`, which drops the
 * `retryable` flag that `fetchTextWithStatus()` computes. A 429 or a 5xx therefore
 * arrives at the caller as "no CLML" — identical to a genuine 404 — and after
 * data.htm and data.pdf give the same non-answer the act is stamped
 * `No CLML/HTML/PDF found on TNA`, a permanent claim about the document.
 *
 * If that is what happened, the markers will cluster into bursts: neighbouring
 * instruments failing together within the same minutes, while instruments either
 * side of the burst succeeded. If instead these instruments genuinely have no text,
 * the markers will be spread evenly through the sweep.
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
    await show(c, 'class (b) markers per MINUTE — the top 20 minutes', `
      SELECT date_trunc('minute', "createdAt") AS minute, count(*) AS class_b_rows
      FROM corpus_sections
      WHERE corpus = ANY($1::text[]) AND status='unavailable'
        AND "errorMsg" = 'No CLML/HTML/PDF found on TNA'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, [LEG_CORPORA])

    await show(c, 'concentration: how many distinct minutes hold the 8,583 markers', `
      WITH m AS (
        SELECT date_trunc('minute', "createdAt") AS minute, count(*) AS n
        FROM corpus_sections
        WHERE corpus = ANY($1::text[]) AND status='unavailable'
          AND "errorMsg" = 'No CLML/HTML/PDF found on TNA'
        GROUP BY 1
      )
      SELECT count(*) AS distinct_minutes, sum(n) AS total_rows,
             round(avg(n),1) AS mean_per_minute, max(n) AS max_per_minute,
             count(*) FILTER (WHERE n >= 10) AS minutes_with_10plus,
             sum(n) FILTER (WHERE n >= 10) AS rows_in_those_minutes
      FROM m`, [LEG_CORPORA])

    // The control. If class (b) is a property of the documents, the SAME minutes
    // should also be producing successes at the usual rate. If it is throttling,
    // the bursts will be minutes in which almost nothing succeeded.
    await show(c, 'CONTROL — in the ten worst class-(b) minutes, what else was written', `
      WITH worst AS (
        SELECT date_trunc('minute', "createdAt") AS minute
        FROM corpus_sections
        WHERE corpus = ANY($1::text[]) AND status='unavailable'
          AND "errorMsg" = 'No CLML/HTML/PDF found on TNA'
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 10
      )
      SELECT date_trunc('minute', cs."createdAt") AS minute,
             count(*) FILTER (WHERE cs.status='compiled') AS compiled_same_minute,
             count(*) FILTER (WHERE cs.status='unavailable'
                              AND cs."errorMsg" = 'No CLML/HTML/PDF found on TNA') AS class_b,
             count(*) FILTER (WHERE cs.status='unavailable'
                              AND cs."errorMsg" LIKE 'hasNoProvisions%') AS class_a
      FROM corpus_sections cs
      JOIN worst w ON w.minute = date_trunc('minute', cs."createdAt")
      WHERE cs.corpus = ANY($1::text[])
      GROUP BY 1 ORDER BY 3 DESC`, [LEG_CORPORA])

    await show(c, 'neighbour test — consecutive SI numbers around class-(b) rows', `
      WITH st AS (
        SELECT split_part(id,':',2) AS gid,
               count(*) FILTER (WHERE status='compiled')::int AS compiled,
               count(*) FILTER (WHERE status='unavailable'
                                AND "errorMsg" = 'No CLML/HTML/PDF found on TNA')::int AS classb
        FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1
      ), num AS (
        SELECT gid, compiled, classb,
               split_part(gid,'/',1) AS t,
               NULLIF(split_part(gid,'/',2),'')::text AS y,
               NULLIF(regexp_replace(split_part(gid,'/',3), '[^0-9]', '', 'g'),'')::int AS n
        FROM st WHERE gid LIKE 'uksi/%'
      )
      SELECT y AS year, count(*) FILTER (WHERE classb>0 AND compiled=0) AS lost,
             count(*) AS instruments,
             round(100.0*count(*) FILTER (WHERE classb>0 AND compiled=0)/count(*),2) AS pct_lost
      FROM num GROUP BY 1 HAVING count(*) FILTER (WHERE classb>0 AND compiled=0) > 0
      ORDER BY 2 DESC LIMIT 15`, [LEG_CORPORA])
  } finally {
    c.release(); await pool.end()
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
