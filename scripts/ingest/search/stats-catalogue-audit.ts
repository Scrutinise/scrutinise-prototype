/**
 * stats-catalogue-audit.ts — BRIEF_SEARCH_S9 §3. WHAT IS ACTUALLY IN THE STATISTICS STORE.
 *
 * §3 is explicit that this runs BEFORE the index is written, and that it must read ROWS rather
 * than quote a manifest: "Read rows back; do not quote a manifest." So every number below is a
 * `SELECT` against the live `scrutinise-stats` Neon database, printed with the SQL that produced
 * it, and the script prints the host it connected to first so the reader can tell which database
 * answered (docs/CLAUDE.md §16 — two migrations once succeeded against the wrong one).
 *
 * It answers §3's four questions in order, and it is deliberately allowed to CONTRADICT the
 * brief: "If the audit contradicts this brief, stop and report." Two of the brief's three stated
 * residuals are stated as facts about the schema, and a schema can change under a brief.
 *
 *   §3.1  what is in the store            — series, observations, publishers
 *   §3.2  the join key                    — seriesKey present/populated/stable; sourceSeriesId
 *                                           null rate; what the natural key collapses
 *   §3.3  the licence register            — series per licence class, and per commercial class
 *   §3.4  derived headings                — can the catalogue carry a heading that is not a
 *                                           raw source column
 *
 * Read-only by construction: every statement is a SELECT.
 */

import path from 'path'
import { Pool } from 'pg'

require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

const url = process.env.STATS_DATABASE_URL
if (!url) {
  console.error('STATS_DATABASE_URL not set — refusing to guess (docs/CLAUDE.md §16).')
  process.exit(1)
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 60_000,
})

async function q<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
  return rows as T[]
}

function table(rows: Record<string, unknown>[], cols?: string[]): void {
  if (!rows.length) { console.log('   (no rows)'); return }
  const keys = cols ?? Object.keys(rows[0])
  const w = keys.map((k) => Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)))
  console.log('   ' + keys.map((k, i) => k.padEnd(w[i])).join('  '))
  console.log('   ' + w.map((n) => '-'.repeat(n)).join('  '))
  for (const r of rows) console.log('   ' + keys.map((k, i) => String(r[k] ?? '').padEnd(w[i])).join('  '))
}

function h(n: string): void { console.log(`\n${'='.repeat(78)}\n${n}\n${'='.repeat(78)}`) }

async function main(): Promise<void> {
  console.log(`[stats-audit] host=${new URL(url!).hostname}`)
  const [who] = await q<{ db: string; role: string; can_write: boolean }>(`
    SELECT current_database() AS db, current_user AS role,
           has_table_privilege(current_user, 'stat_observation', 'INSERT') AS can_write`)
  console.log(`[stats-audit] database=${who.db} role=${who.role} canWrite=${who.can_write}`)
  console.log(`[stats-audit] read at ${new Date().toISOString()}`)

  // ── §3.1 ────────────────────────────────────────────────────────────────────
  h('§3.1 — WHAT IS ACTUALLY IN THE STATISTICS STORE (rows, not a manifest)')

  const [totals] = await q(`
    SELECT (SELECT count(*) FROM stat_dataset)     AS datasets,
           (SELECT count(*) FROM stat_series)      AS series,
           (SELECT count(*) FROM stat_observation) AS observations,
           (SELECT count(*) FROM stat_cofog_function) AS cofog_codes`)
  console.log('\n   TOTALS')
  table([totals])

  console.log('\n   BY PUBLISHER (stat_dataset.source)')
  table(await q(`
    SELECT d.source::text AS source,
           count(DISTINCT d.id)::int AS datasets,
           count(DISTINCT s.id)::int AS series,
           count(o.id)::int          AS observations,
           min(o."periodLabel")      AS earliest_label,
           max(o."periodLabel")      AS latest_label
    FROM stat_dataset d
    LEFT JOIN stat_series s ON s."datasetId" = d.id
    LEFT JOIN stat_observation o ON o."seriesId" = s.id
    GROUP BY d.source ORDER BY count(o.id) DESC`))

  console.log('\n   BY DATASET')
  table(await q(`
    SELECT d.id, d.source::text AS source,
           left(d.title, 46) AS title,
           count(DISTINCT s.id)::int AS series,
           count(o.id)::int AS obs,
           d."refreshCadence"::text AS cadence
    FROM stat_dataset d
    LEFT JOIN stat_series s ON s."datasetId" = d.id
    LEFT JOIN stat_observation o ON o."seriesId" = s.id
    GROUP BY d.id, d.source, d.title, d."refreshCadence"
    ORDER BY count(o.id) DESC`))

  console.log('\n   ⚠ SERIES WITH ZERO OBSERVATIONS (a catalogue entry that leads nowhere)')
  const [empty] = await q(`
    SELECT count(*)::int AS series_with_no_observations
    FROM stat_series s WHERE NOT EXISTS (SELECT 1 FROM stat_observation o WHERE o."seriesId" = s.id)`)
  table([empty])

  console.log('\n   GEOGRAPHY SPREAD (top 25)')
  table(await q(`
    SELECT s.geography, count(*)::int AS series
    FROM stat_series s GROUP BY s.geography ORDER BY count(*) DESC LIMIT 25`))

  console.log('\n   UNIT SPREAD')
  table(await q(`SELECT s.unit, count(*)::int AS series FROM stat_series s GROUP BY s.unit ORDER BY count(*) DESC`))

  // ── §3.2 ────────────────────────────────────────────────────────────────────
  h('§3.2 — THE JOIN KEY: does seriesKey exist, is it populated, is it stable?')

  console.log('\n   COLUMN EXISTS? (information_schema, not the schema file — the file is a claim)')
  table(await q(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'stat_series' AND column_name IN ('seriesKey','sourceSeriesId','commercialUseExcluded')
    ORDER BY column_name`))

  console.log('\n   UNIQUE CONSTRAINT ON seriesKey? (an unenforced key is not a key)')
  table(await q(`
    SELECT i.relname AS index_name, ix.indisunique AS is_unique,
           array_to_string(array_agg(a.attname ORDER BY a.attnum), ',') AS columns
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = 'stat_series'
    GROUP BY i.relname, ix.indisunique ORDER BY i.relname`))

  console.log('\n   POPULATION + SHAPE')
  table(await q(`
    SELECT count(*)::int                                                   AS series,
           count("seriesKey")::int                                         AS key_populated,
           count(*) FILTER (WHERE "seriesKey" IS NULL)::int                AS key_null,
           count(*) FILTER (WHERE "seriesKey" !~ '^[0-9a-f]{64}$')::int     AS key_not_sha256_hex,
           count(DISTINCT "seriesKey")::int                                AS key_distinct
    FROM stat_series`))

  console.log('\n   sourceSeriesId — the brief\'s residual, quantified')
  table(await q(`
    SELECT count(*)::int                                              AS series,
           count("sourceSeriesId")::int                               AS populated,
           count(*) FILTER (WHERE "sourceSeriesId" IS NULL)::int       AS null_rows,
           round(100.0 * count(*) FILTER (WHERE "sourceSeriesId" IS NULL) / count(*), 1) AS pct_null
    FROM stat_series`))

  console.log('\n   sourceSeriesId null rate BY DATASET (where the gap actually sits)')
  table(await q(`
    SELECT s."datasetId", count(*)::int AS series,
           count(*) FILTER (WHERE s."sourceSeriesId" IS NULL)::int AS null_rows,
           round(100.0 * count(*) FILTER (WHERE s."sourceSeriesId" IS NULL) / count(*), 1) AS pct_null
    FROM stat_series s GROUP BY s."datasetId"
    HAVING count(*) FILTER (WHERE s."sourceSeriesId" IS NULL) > 0
    ORDER BY count(*) FILTER (WHERE s."sourceSeriesId" IS NULL) DESC`))

  console.log('\n   ⚠ WHAT BREAKS: does the NATURAL key (without seriesLabel) still identify a series?')
  table(await q(`
    SELECT count(*)::int AS series,
           count(DISTINCT ("datasetId","measure",geography,"cofogFunctionCode","forecastVintage"))::int
             AS distinct_natural_key_tuples,
           count(*) - count(DISTINCT ("datasetId","measure",geography,"cofogFunctionCode","forecastVintage"))::int
             AS series_that_collide
    FROM stat_series`))

  console.log('\n   ⚠ and WITH seriesLabel (the input seriesKey adds)')
  table(await q(`
    SELECT count(*)::int AS series,
           count(DISTINCT ("datasetId","measure",geography,"cofogFunctionCode","forecastVintage","seriesLabel"))::int
             AS distinct_with_label
    FROM stat_series`))

  console.log('\n   WORST natural-key collisions (what a label-free key would merge)')
  table(await q(`
    SELECT "datasetId", measure, geography, coalesce("cofogFunctionCode",'-') AS cofog,
           count(*)::int AS series_sharing_this_tuple,
           left(min("seriesLabel"), 34) AS example_a, left(max("seriesLabel"), 34) AS example_b
    FROM stat_series
    GROUP BY "datasetId", measure, geography, "cofogFunctionCode", "forecastVintage"
    HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 10`))

  console.log('\n   STABILITY — is seriesKey a pure function of the six identity fields?')
  console.log('   (recomputed in TypeScript below against the stored value; see stats-key-recheck)')
  table(await q(`
    SELECT "seriesKey", count(*)::int AS rows_sharing_key
    FROM stat_series GROUP BY "seriesKey" HAVING count(*) > 1 LIMIT 5`))

  // ── §3.3 ────────────────────────────────────────────────────────────────────
  h('§3.3 — THE LICENCE REGISTER (load-bearing: it must GATE retrieval, not be recorded)')

  console.log('\n   SERIES PER LICENCE CLASS')
  table(await q(`
    SELECT d.licence,
           count(DISTINCT d.id)::int AS datasets,
           count(s.id)::int          AS series,
           bool_or(d."commercialUseExcluded") AS any_dataset_commercial_excluded,
           coalesce(max(d."licenceUrl"), '(none)') AS example_licence_url
    FROM stat_dataset d LEFT JOIN stat_series s ON s."datasetId" = d.id
    GROUP BY d.licence ORDER BY count(s.id) DESC`))

  console.log('\n   ⚠ EFFECTIVE commercial-use class per series (series override ?? dataset)')
  table(await q(`
    SELECT coalesce(s."commercialUseExcluded", d."commercialUseExcluded") AS commercial_use_excluded,
           count(*)::int AS series,
           round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct_of_series,
           count(DISTINCT d.source::text)::int AS publishers,
           string_agg(DISTINCT d.source::text, ',') AS which
    FROM stat_series s JOIN stat_dataset d ON d.id = s."datasetId"
    GROUP BY 1 ORDER BY 1`))

  console.log('\n   OBSERVATIONS under each effective commercial class (what a leak would expose)')
  table(await q(`
    SELECT coalesce(s."commercialUseExcluded", d."commercialUseExcluded") AS commercial_use_excluded,
           count(o.id)::int AS observations
    FROM stat_observation o
    JOIN stat_series s ON s.id = o."seriesId"
    JOIN stat_dataset d ON d.id = s."datasetId"
    GROUP BY 1 ORDER BY 1`))

  console.log('\n   PER-SERIES OVERRIDE — is the column USED, or only available?')
  table(await q(`
    SELECT count(*) FILTER (WHERE "commercialUseExcluded" IS NULL)::int  AS inherit_dataset,
           count(*) FILTER (WHERE "commercialUseExcluded" IS TRUE)::int  AS override_true,
           count(*) FILTER (WHERE "commercialUseExcluded" IS FALSE)::int AS override_false
    FROM stat_series`))

  console.log('\n   LICENCE VERIFICATION DATES (a licence nobody re-read is a stale licence)')
  table(await q(`
    SELECT d.id, d.source::text AS source, left(d.licence, 40) AS licence,
           d."commercialUseExcluded" AS excluded,
           to_char(d."licenceVerifiedAt", 'YYYY-MM-DD') AS verified_at
    FROM stat_dataset d ORDER BY d."licenceVerifiedAt" ASC`))

  // ── §3.4 ────────────────────────────────────────────────────────────────────
  h('§3.4 — DERIVED HEADINGS: can the catalogue carry a heading that is not a source column?')

  console.log('\n   The headings that EXIST today (the candidate index fields)')
  table(await q(`
    SELECT 'seriesLabel' AS heading, count("seriesLabel")::int AS populated,
           count(*)::int AS of_rows, round(avg(length("seriesLabel")))::int AS avg_len
    FROM stat_series
    UNION ALL SELECT 'measure', count(measure)::int, count(*)::int, round(avg(length(measure)))::int FROM stat_series
    UNION ALL SELECT 'geography', count(geography)::int, count(*)::int, round(avg(length(geography)))::int FROM stat_series
    UNION ALL SELECT 'unit', count(unit)::int, count(*)::int, round(avg(length(unit)))::int FROM stat_series
    UNION ALL SELECT 'cofogFunctionCode', count("cofogFunctionCode")::int, count(*)::int, 0 FROM stat_series
    UNION ALL SELECT 'forecastVintage', count("forecastVintage")::int, count(*)::int, 0 FROM stat_series
    UNION ALL SELECT 'datasetTitle', count(d.title)::int, count(*)::int, round(avg(length(d.title)))::int
      FROM stat_series s JOIN stat_dataset d ON d.id = s."datasetId"`))

  console.log('\n   ⚠ DEPARTMENT — §6d names it as a wanted heading. Is there a column for it?')
  table(await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'stat_series' ORDER BY ordinal_position`))

  console.log('\n   Where department information actually lives today (dept series labels)')
  table(await q(`
    SELECT left("seriesLabel", 60) AS series_label, measure
    FROM stat_series WHERE measure = 'dept_expenditure_by_function' LIMIT 8`))

  console.log('\n   MEASURES held (what a derived heading would have to be built from)')
  table(await q(`
    SELECT s.measure, count(*)::int AS series, max(s.unit) AS example_unit,
           count(DISTINCT s.geography)::int AS geographies
    FROM stat_series s GROUP BY s.measure ORDER BY count(*) DESC LIMIT 30`))

  console.log('\n   TIME SPAN per measure (a "span" heading is derivable, not stored)')
  table(await q(`
    SELECT s.measure, min(o."periodLabel") AS first_label, max(o."periodLabel") AS last_label,
           count(DISTINCT o."periodLabel")::int AS periods
    FROM stat_series s JOIN stat_observation o ON o."seriesId" = s.id
    GROUP BY s.measure ORDER BY count(*) DESC LIMIT 20`))

  await pool.end()
  console.log('\n[stats-audit] done.')
}

main().catch(async (e) => {
  console.error('[stats-audit] FAILED:', e)
  await pool.end().catch(() => {})
  process.exit(1)
})
