/**
 * v36-attempted-analysis.ts — V36 §1.2: the 2,935 instruments that WERE attempted
 * and produced no compiled section.
 *
 * The question that matters: TNA classified them 'no-provisions' / 'metadata-only' /
 * 'pdf-only'. The legacy LegislationSection table holds real text for some of them.
 * Both cannot be right, and which one is wrong decides whether these are a recovery
 * job or a correctly-recorded known unknown.
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
    await c.query(`
      CREATE TEMP TABLE v36_gid_state AS
      SELECT split_part(id, ':', 2) AS gid,
             count(*) FILTER (WHERE status = 'compiled')::int    AS compiled,
             count(*) FILTER (WHERE status = 'unavailable')::int AS unavailable,
             min(availability_status)                            AS avail,
             min("errorMsg")                                     AS err,
             min("sourceUrl")                                    AS src
      FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1`, [LEG_CORPORA])
    await c.query(`CREATE INDEX ON v36_gid_state (gid)`)
    await c.query(`ANALYZE v36_gid_state`)

    await show(c, 'attempted-empty × legacy text held', `
      WITH gap AS (
        SELECT ca.gid, ca.leg_type, ca.legislation_item_id, ca.item_section_count
        FROM corpus_acts ca WHERE ca.in_corpus = false AND ca.in_legislation_item = true
      )
      SELECT s.avail AS tna_says,
             count(*) AS instruments,
             count(*) FILTER (WHERE gap.item_section_count > 0) AS legacy_has_text,
             sum(gap.item_section_count) AS legacy_sections
      FROM gap JOIN v36_gid_state s ON s.gid = gap.gid
      GROUP BY 1 ORDER BY 2 DESC`)

    await show(c, 'attempted-empty × leg_type × tna classification', `
      WITH gap AS (
        SELECT ca.gid, ca.leg_type, ca.item_section_count
        FROM corpus_acts ca WHERE ca.in_corpus = false AND ca.in_legislation_item = true
      )
      SELECT gap.leg_type, s.avail AS tna_says, count(*) AS n,
             sum(gap.item_section_count) AS legacy_sections
      FROM gap JOIN v36_gid_state s ON s.gid = gap.gid
      GROUP BY 1,2 ORDER BY 3 DESC LIMIT 30`)

    await show(c, 'the contradiction: TNA no-provisions BUT legacy holds many sections', `
      WITH gap AS (
        SELECT ca.gid, ca.title, ca.year, ca.item_section_count
        FROM corpus_acts ca WHERE ca.in_corpus = false AND ca.in_legislation_item = true
      )
      SELECT gap.gid, COALESCE(gap.title,'(untitled)') AS title, gap.year,
             gap.item_section_count AS legacy_sections, s.avail AS tna_says, s.err
      FROM gap JOIN v36_gid_state s ON s.gid = gap.gid
      WHERE gap.item_section_count >= 20
      ORDER BY gap.item_section_count DESC LIMIT 20`)

    await show(c, 'never-attempted set: legacy text held or not', `
      WITH gap AS (
        SELECT ca.gid, ca.leg_type, ca.item_section_count
        FROM corpus_acts ca WHERE ca.in_corpus = false AND ca.in_legislation_item = true
      )
      SELECT gap.leg_type,
             count(*) AS never_attempted,
             count(*) FILTER (WHERE gap.item_section_count > 0) AS with_legacy_text,
             count(*) FILTER (WHERE COALESCE(gap.item_section_count,0) = 0) AS no_legacy_text,
             sum(gap.item_section_count) AS legacy_sections
      FROM gap LEFT JOIN v36_gid_state s ON s.gid = gap.gid
      WHERE s.gid IS NULL
      GROUP BY 1 ORDER BY 2 DESC`)

    await show(c, 'never-attempted ukpga: pre-1963 vs post', `
      WITH gap AS (
        SELECT ca.gid, ca.year, ca.item_section_count
        FROM corpus_acts ca WHERE ca.in_corpus = false AND ca.in_legislation_item = true
          AND ca.leg_type = 'ukpga'
      )
      SELECT CASE WHEN gap.year < 1963 THEN 'pre-1963 (regnal era)' ELSE '1963+' END AS era,
             count(*) AS instruments,
             count(*) FILTER (WHERE gap.item_section_count > 0) AS with_legacy_text,
             sum(gap.item_section_count) AS legacy_sections
      FROM gap LEFT JOIN v36_gid_state s ON s.gid = gap.gid
      WHERE s.gid IS NULL
      GROUP BY 1 ORDER BY 2 DESC`)

    await show(c, 'the 1963+ never-attempted ukpga — a real gap, listed', `
      SELECT ca.gid, COALESCE(ca.title,'(untitled)') AS title, ca.year, ca.item_section_count
      FROM corpus_acts ca
      LEFT JOIN v36_gid_state s ON s.gid = ca.gid
      WHERE ca.in_corpus = false AND ca.in_legislation_item = true
        AND ca.leg_type = 'ukpga' AND ca.year >= 1963 AND s.gid IS NULL
      ORDER BY ca.item_section_count DESC NULLS LAST LIMIT 20`)
  } finally {
    c.release(); await pool.end()
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
