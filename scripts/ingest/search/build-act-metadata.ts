/**
 * build-act-metadata.ts — populate `corpus_acts` (SPRINT §1).
 *
 * DDL: scrutinise-web/prisma/act_metadata.sql (apply that first — this script does
 * not create the table, so a missing table is a loud error rather than a silent
 * half-build).
 *
 * The whole build is ONE `INSERT … SELECT` inside a transaction, entirely
 * server-side. corpus_sections has 1.28M legislation rows and LegislationItem
 * 135,531; pulling either into Node to join them in JS would cost minutes and a lot
 * of memory to do worse what Postgres does in one pass. Rerunnable: it rebuilds the
 * table from scratch each time (TRUNCATE + INSERT in the same transaction, so
 * readers never see an empty table), which is the right shape for a derived table
 * whose sources drift as ingest runs.
 *
 * Usage:
 *   tsx search/build-act-metadata.ts             # rebuild + verify
 *   tsx search/build-act-metadata.ts --verify-only
 * Env: NEON_DATABASE_URL.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

/** The corpora whose ids carry a legislation gid. Kept in step with corpus-map.ts's
 *  `legislation` tier, minus explanatory-notes/-memoranda, which are commentary
 *  ABOUT an instrument rather than the instrument itself and would otherwise
 *  inflate section_count with text that is not the law.
 *
 *  `regional` is NOT optional and must not be dropped as "not really legislation":
 *  it is where ALL the devolved primary and secondary legislation lives —
 *  asp/ssi (Scotland), wsi/anaw/asc/mwa (Wales), nia/nisi/nisr (Northern Ireland),
 *  331,124 sections across 26,172 instruments. Omitting it makes this table report
 *  0 searchable instruments for Scotland, Wales and Northern Ireland, which reads
 *  as a corpus coverage gap when it is really a bug in this list. */
const LEG_CORPORA = [
  'primary-acts-2000plus',
  'primary-acts-pre-2000',
  'si-2010plus',
  'si-pre-2010',
  'regional',
  'retained-eu',
  'eur-lex',
]

const VERIFY_ONLY = process.argv.includes('--verify-only')

/**
 * gid type prefix → jurisdiction.
 *
 * corpus_sections.jurisdiction is the literal 'uk' on every legislation row, so it
 * cannot tell an Act of the Scottish Parliament from a UK public general Act. The
 * gid's own type prefix can, and it is part of the citation rather than a guess.
 */
const JURISDICTION_SQL = `
  CASE
    WHEN t IN ('asp', 'ssi')                        THEN 'Scotland'
    WHEN t IN ('anaw', 'asc', 'wsi', 'mwa')         THEN 'Wales'
    WHEN t IN ('nia', 'nisi', 'nisr', 'apni', 'aip') THEN 'Northern Ireland'
    WHEN t IN ('eur', 'eudn', 'eudr', 'eurlex', 'celex') THEN 'EU (retained)'
    ELSE 'UK'
  END`

async function report(pool: Pool) {
  const q = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows

  const [totals] = await q(`
    SELECT count(*)::text AS rows,
           count(*) FILTER (WHERE in_corpus)::text AS in_corpus,
           count(*) FILTER (WHERE in_legislation_item)::text AS in_leg_item,
           count(*) FILTER (WHERE in_corpus AND in_legislation_item)::text AS both,
           count(*) FILTER (WHERE title IS NOT NULL)::text AS titled,
           count(*) FILTER (WHERE year IS NULL)::text AS no_year,
           COALESCE(sum(section_count), 0)::text AS sections
    FROM corpus_acts`)
  console.log('[act-metadata] rows                 :', Number(totals.rows).toLocaleString())
  console.log('[act-metadata]   in corpus          :', Number(totals.in_corpus).toLocaleString())
  console.log('[act-metadata]   in LegislationItem :', Number(totals.in_leg_item).toLocaleString())
  console.log('[act-metadata]   in both            :', Number(totals.both).toLocaleString())
  console.log('[act-metadata]   titled             :', Number(totals.titled).toLocaleString(),
    `(${((Number(totals.titled) / Number(totals.rows)) * 100).toFixed(1)}%)`)
  console.log('[act-metadata]   no year (regnal)   :', Number(totals.no_year).toLocaleString())
  console.log('[act-metadata]   sections covered   :', Number(totals.sections).toLocaleString())

  // RECONCILIATION — the guard that makes a wrong build visible rather than plausible.
  // Every compiled legislation section must be attributed to exactly one act row; if
  // section_count doesn't sum to the source count, the gid derivation dropped rows.
  const [src] = await q(
    `SELECT count(*)::text AS n FROM corpus_sections
     WHERE status='compiled' AND corpus = ANY($1::text[])`, [LEG_CORPORA])
  const delta = Number(src.n) - Number(totals.sections)
  console.log(`[act-metadata] source sections      : ${Number(src.n).toLocaleString()}`)
  if (delta === 0) {
    console.log('[act-metadata] RECONCILES: every compiled legislation section is attributed to an act.')
  } else {
    console.log(`[act-metadata] ** ${delta.toLocaleString()} SECTIONS UNATTRIBUTED ** — gid derivation dropped rows.`)
  }

  console.log('\n[act-metadata] by jurisdiction:')
  for (const r of await q(
    `SELECT jurisdiction, count(*)::text AS n, count(*) FILTER (WHERE in_corpus)::text AS c
     FROM corpus_acts GROUP BY 1 ORDER BY count(*) DESC`)) {
    console.log(`  ${String(r.jurisdiction).padEnd(18)} ${String(r.n).padStart(7)}  (in corpus: ${r.c})`)
  }
  console.log('\n[act-metadata] top 8 types:')
  for (const r of await q(
    `SELECT leg_type, count(*)::text AS n, COALESCE(sum(section_count),0)::text AS s
     FROM corpus_acts GROUP BY 1 ORDER BY count(*) DESC LIMIT 8`)) {
    console.log(`  ${String(r.leg_type).padEnd(10)} acts=${String(r.n).padStart(7)} sections=${String(r.s).padStart(8)}`)
  }
  console.log('\n[act-metadata] sample (largest by section_count):')
  for (const r of await q(
    `SELECT gid, COALESCE(title,'(untitled)') AS title, year, jurisdiction, section_count
     FROM corpus_acts WHERE in_corpus ORDER BY section_count DESC LIMIT 5`)) {
    console.log(`  ${String(r.gid).padEnd(22)} ${String(r.year ?? '----')}  ${String(r.jurisdiction).padEnd(16)} ${String(r.section_count).padStart(6)}  ${String(r.title).slice(0, 60)}`)
  }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    statement_timeout: 900_000,
    query_timeout: 900_000,
  })

  const { rows: exists } = await pool.query(`SELECT to_regclass('public.corpus_acts') AS t`)
  if (!exists[0].t) {
    throw new Error('corpus_acts does not exist — apply scrutinise-web/prisma/act_metadata.sql first')
  }

  if (VERIFY_ONLY) {
    await report(pool)
    await pool.end()
    return
  }

  const t0 = Date.now()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('TRUNCATE corpus_acts')
    await client.query(
      `
      INSERT INTO corpus_acts (
        gid, title, title_source, leg_type, year, number, jurisdiction,
        legislation_item_id, legislation_type, item_section_count, item_compiled_count,
        corpus, section_count, word_count, in_corpus, in_legislation_item,
        first_date, last_date, refreshed_at
      )
      WITH sec AS (
        -- One row per gid over the legislation corpora. The gid is id segment 2 for
        -- legislation.gov.uk ids and the whole CELEX token for eur-lex.
        SELECT split_part(id, ':', 2)      AS gid,
               min(corpus)                 AS corpus,
               count(*)::int               AS section_count,
               sum("wordCount")::bigint    AS word_count,
               min("itemDate")             AS first_date,
               max("itemDate")             AS last_date
        FROM corpus_sections
        WHERE status = 'compiled' AND corpus = ANY($1::text[])
        GROUP BY 1
      ),
      li AS (
        -- gid is unique in LegislationItem today (135,531 rows / 135,531 distinct
        -- gids), but grouping keeps this build total if that ever stops being true
        -- rather than failing on a duplicate-key insert.
        SELECT "legislationGovUkId" AS gid,
               max(title)            AS title,
               max(year)             AS year,
               max(jurisdiction)     AS jurisdiction,
               max(id)               AS item_id,
               max("legislationType"::text) AS item_type,
               max("sectionCount")   AS item_section_count,
               max("compiledSectionCount") AS item_compiled_count
        FROM "LegislationItem"
        WHERE "legislationGovUkId" IS NOT NULL
        GROUP BY 1
      ),
      parsed AS (
        -- NB: membership is tested on the JOIN KEY (sec.gid / li.gid), never on a
        -- whole-row composite. "(row) IS NOT NULL" in Postgres is true only when
        -- EVERY field is non-null, so a composite test would have reported
        -- in_corpus=false for every eur-lex instrument purely because its itemDate
        -- is null — silently excluding 90,260 rows from "searchable".
        SELECT
          COALESCE(sec.gid, li.gid) AS gid,
          li.title                  AS li_title,
          li.year                   AS li_year,
          li.jurisdiction           AS li_jurisdiction,
          li.item_id                AS li_item_id,
          li.item_type              AS li_item_type,
          li.item_section_count     AS li_section_count,
          li.item_compiled_count    AS li_compiled_count,
          sec.corpus                AS corpus,
          sec.section_count         AS section_count,
          sec.word_count            AS word_count,
          sec.first_date            AS first_date,
          sec.last_date             AS last_date,
          (sec.gid IS NOT NULL)     AS in_corpus,
          (li.gid  IS NOT NULL)     AS in_legislation_item,
          -- CELEX ids carry no '/'; everything else is {type}/{year|regnal}/{number}.
          CASE WHEN position('/' in COALESCE(sec.gid, li.gid)) = 0 THEN 'celex'
               ELSE split_part(COALESCE(sec.gid, li.gid), '/', 1) END AS t,
          split_part(COALESCE(sec.gid, li.gid), '/', 2) AS seg2,
          split_part(COALESCE(sec.gid, li.gid), '/', 3) AS seg3
        FROM sec FULL OUTER JOIN li ON li.gid = sec.gid
      )
      SELECT
        gid,
        li_title,
        CASE WHEN li_title IS NOT NULL THEN 'legislation-item' END,
        t,
        -- Year: the gid's own year segment when it is a 4-digit number; for CELEX,
        -- digits 2-5 (sector digit + 4-digit year). Falls back to LegislationItem's
        -- year. NULL for regnal-year gids — no year exists in the identifier.
        COALESCE(
          CASE
            WHEN t = 'celex' AND gid ~ '^[0-9]{5}' THEN substring(gid from 2 for 4)::int
            WHEN seg2 ~ '^[0-9]{4}$'               THEN seg2::int
          END,
          li_year
        ),
        -- Number: the number segment normally; for regnal gids keep the whole
        -- remainder ('Edw7/1/5' -> '1/5' is meaningless alone, so keep 'Edw7/1/5').
        CASE
          WHEN t = 'celex'         THEN gid
          WHEN seg2 ~ '^[0-9]{4}$' THEN NULLIF(seg3, '')
          ELSE NULLIF(substring(gid from position('/' in gid) + 1), '')
        END,
        COALESCE(li_jurisdiction, ${JURISDICTION_SQL}),
        li_item_id,
        COALESCE(li_item_type, upper(t)),
        li_section_count,
        li_compiled_count,
        corpus,
        COALESCE(section_count, 0),
        word_count,
        in_corpus,
        in_legislation_item,
        first_date,
        last_date,
        now()
      FROM parsed
      `,
      [LEG_CORPORA],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  console.log(`[act-metadata] rebuilt in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)
  await report(pool)
  await pool.end()
}

main().catch((e) => {
  console.error('[act-metadata] FAILED:', e)
  process.exit(1)
})
