/**
 * v36-gap-analysis.ts — V36 §1: establish what happened before deciding how to fix it.
 *
 * Read-only. Uses ONE dedicated client so a TEMP table can carry per-gid state
 * across queries without leaving anything behind on production.
 *
 * The distinction this script exists to draw:
 *   corpus_acts.in_corpus is `has >= 1 corpus_sections row with status='compiled'`.
 *   A gid with rows in status 'unavailable' / 'failed' / 'skipped' WAS attempted and
 *   is a different failure class from a gid with no row at all, which was never seen.
 *   Those two have different fixes and the brief's §1.2 asks for them separately.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool, PoolClient } from 'pg'

const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010',
  'regional', 'retained-eu', 'eur-lex',
]

async function show(c: PoolClient, label: string, sql: string, params: unknown[] = []) {
  const t = Date.now()
  const { rows } = await c.query(sql, params)
  console.log(`\n=== ${label} ===  (${((Date.now() - t) / 1000).toFixed(1)}s, ${rows.length} rows)`)
  if (rows.length) console.table(rows)
  else console.log('  (no rows)')
  return rows
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    statement_timeout: 900_000,
    query_timeout: 900_000,
  })
  const c = await pool.connect()
  try {
    const { rows: who } = await c.query(`SELECT current_database() AS db, inet_server_addr()::text AS addr`)
    console.log(`[v36] db=${who[0].db} host=${(process.env.NEON_DATABASE_URL ?? '').match(/@([^/]*)/)?.[1]}`)

    // ── The per-gid attempt state over the legislation corpora ───────────────
    console.log('\n[v36] building TEMP gid-state table over the legislation corpora…')
    const t0 = Date.now()
    await c.query(`
      CREATE TEMP TABLE v36_gid_state AS
      SELECT split_part(id, ':', 2)                                    AS gid,
             count(*)::int                                             AS rows_total,
             count(*) FILTER (WHERE status = 'compiled')::int          AS compiled,
             count(*) FILTER (WHERE status = 'unavailable')::int       AS unavailable,
             count(*) FILTER (WHERE status = 'failed')::int            AS failed,
             count(*) FILTER (WHERE status = 'skipped')::int           AS skipped,
             count(*) FILTER (WHERE status = 'pending')::int           AS pending,
             (array_agg(DISTINCT availability_status))                 AS avail_statuses
      FROM corpus_sections
      WHERE corpus = ANY($1::text[])
      GROUP BY 1`, [LEG_CORPORA])
    await c.query(`CREATE INDEX ON v36_gid_state (gid)`)
    await c.query(`ANALYZE v36_gid_state`)
    console.log(`[v36] built in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

    await show(c, '§1.0 gid-state totals', `
      SELECT count(*) AS gids,
             count(*) FILTER (WHERE compiled > 0) AS with_compiled,
             count(*) FILTER (WHERE compiled = 0) AS attempted_no_compiled
      FROM v36_gid_state`)

    // ── §1.2 Were they attempted? ────────────────────────────────────────────
    await show(c, '§1.2 THE GAP SET — attempted vs never seen', `
      WITH gap AS (
        SELECT gid, leg_type, year, item_section_count
        FROM corpus_acts WHERE in_corpus = false AND in_legislation_item = true
      )
      SELECT CASE WHEN s.gid IS NULL THEN 'NO corpus_sections row at all (never attempted)'
                  ELSE 'has rows, none compiled (attempted, produced nothing)' END AS class,
             count(*) AS instruments,
             sum(gap.item_section_count) AS legacy_sections
      FROM gap LEFT JOIN v36_gid_state s ON s.gid = gap.gid
      GROUP BY 1 ORDER BY 2 DESC`)

    await show(c, '§1.2b attempted-but-nothing: what state are those rows in', `
      WITH gap AS (
        SELECT gid FROM corpus_acts WHERE in_corpus = false AND in_legislation_item = true
      )
      SELECT s.avail_statuses::text AS availability, s.unavailable, s.failed, s.skipped, s.pending,
             count(*) AS instruments
      FROM gap JOIN v36_gid_state s ON s.gid = gap.gid
      GROUP BY 1,2,3,4,5 ORDER BY 6 DESC LIMIT 25`)

    // ── §1.1 Coherent set or scatter? ────────────────────────────────────────
    await show(c, '§1.1 GAP by leg_type × attempt class', `
      WITH gap AS (
        SELECT gid, leg_type, item_section_count
        FROM corpus_acts WHERE in_corpus = false AND in_legislation_item = true
      )
      SELECT gap.leg_type,
             count(*) FILTER (WHERE s.gid IS NULL) AS never_attempted,
             count(*) FILTER (WHERE s.gid IS NOT NULL) AS attempted_empty,
             count(*) AS total,
             sum(gap.item_section_count) AS legacy_sections
      FROM gap LEFT JOIN v36_gid_state s ON s.gid = gap.gid
      GROUP BY 1 ORDER BY 4 DESC`)

    await show(c, '§1.1b ukpga BY YEAR — present vs missing (the shape test)', `
      SELECT year,
             count(*) FILTER (WHERE in_corpus) AS in_corpus,
             count(*) FILTER (WHERE NOT in_corpus AND in_legislation_item) AS missing,
             count(*) AS known
      FROM corpus_acts
      WHERE leg_type = 'ukpga' AND in_legislation_item AND year IS NOT NULL
      GROUP BY 1 ORDER BY 1`)

    await show(c, '§1.1c uksi BY DECADE — present vs missing', `
      SELECT (year/10)*10 AS decade,
             count(*) FILTER (WHERE in_corpus) AS in_corpus,
             count(*) FILTER (WHERE NOT in_corpus AND in_legislation_item) AS missing
      FROM corpus_acts
      WHERE leg_type = 'uksi' AND in_legislation_item AND year IS NOT NULL
      GROUP BY 1 ORDER BY 1`)

    await show(c, '§1.1d eur/eudn/eudr/ssi/nisr/wsi BY DECADE — missing only', `
      SELECT leg_type, (year/10)*10 AS decade,
             count(*) FILTER (WHERE in_corpus) AS in_corpus,
             count(*) FILTER (WHERE NOT in_corpus AND in_legislation_item) AS missing
      FROM corpus_acts
      WHERE leg_type IN ('eur','eudn','eudr','ssi','nisr','wsi','asp') AND in_legislation_item AND year IS NOT NULL
      GROUP BY 1,2 HAVING count(*) FILTER (WHERE NOT in_corpus AND in_legislation_item) > 0
      ORDER BY 1,2`)

    // ── §1.4 Does the legacy table actually hold usable text for them? ───────
    await show(c, '§1.4 legacy LegislationSection text held for the gap set', `
      WITH gap AS (
        SELECT ca.gid, ca.legislation_item_id
        FROM corpus_acts ca
        WHERE ca.in_corpus = false AND ca.in_legislation_item = true
      )
      SELECT count(DISTINCT gap.gid) AS instruments_with_sections,
             count(ls.id) AS section_rows,
             count(ls.id) FILTER (WHERE ls."originalText" IS NOT NULL AND ls."originalText" <> '') AS with_text,
             sum(length(ls."originalText")) AS total_chars,
             round(avg(length(ls."originalText"))) AS avg_chars
      FROM gap JOIN "LegislationSection" ls ON ls."legislationItemId" = gap.legislation_item_id`)

    await show(c, '§1.4b gap instruments with ZERO legacy section rows', `
      WITH gap AS (
        SELECT ca.gid, ca.legislation_item_id, ca.item_section_count
        FROM corpus_acts ca
        WHERE ca.in_corpus = false AND ca.in_legislation_item = true
      )
      SELECT count(*) AS instruments_no_legacy_text
      FROM gap
      WHERE NOT EXISTS (
        SELECT 1 FROM "LegislationSection" ls WHERE ls."legislationItemId" = gap.legislation_item_id)`)

    await show(c, '§1.4c the biggest missing instruments (by legacy section count)', `
      SELECT gid, COALESCE(title,'(untitled)') AS title, year, item_section_count
      FROM corpus_acts
      WHERE in_corpus = false AND in_legislation_item = true
      ORDER BY item_section_count DESC NULLS LAST LIMIT 25`)

    await show(c, '§1.4d gap instruments with 0 legacy sections, by type', `
      SELECT leg_type, count(*) AS n, sum(item_section_count) AS item_sections
      FROM corpus_acts ca
      WHERE in_corpus = false AND in_legislation_item = true
        AND COALESCE(item_section_count,0) = 0
      GROUP BY 1 ORDER BY 2 DESC`)
  } finally {
    c.release()
    await pool.end()
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
