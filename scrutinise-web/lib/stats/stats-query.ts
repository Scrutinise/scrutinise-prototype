// ─────────────────────────────────────────────────────────────────────────────
// Web-side stats read layer — the app's mirror of
// `scripts/stats/query/stats-query.ts` (the ingest thread's Prisma version).
//
// KEEP IN SYNC. Same three questions, same semantics, expressed as SQL because the
// script side's generated Prisma client is gitignored and outside the Vercel build
// root (see stats-db.ts). If the analytical semantics change on either side —
// especially the COFOG roll-up rule below — change both.
//
// Everything returned carries its own provenance (unit, period, source, sourceUrl).
// That is the point: Lex must be able to cite where a number came from, and must
// never present a figure this layer did not return.
// ─────────────────────────────────────────────────────────────────────────────

import { statsQuery } from './stats-db'

// The measure that carries PESA's expenditure-by-COFOG-function rows.
//
// VERIFIED AGAINST THE LIVE DB (2026-08-02), not taken from the script-side layer:
// `scripts/stats/query/stats-query.ts` still names `exp_by_subfunction`, which does
// not exist — it was written offline before the ingest fixes settled the measure
// names, and its getCofogRollup returns nothing against the live data. The real
// measures are below. Flagged to the stats thread; not changed from here.
//
//   public_expenditure_by_function — 62 series, 60 COFOG codes, 2020-21…2024-25.
//     Spending by function only. 15 top-level rows (health, which PESA reports only
//     at `07`) + 295 sub-function rows. THIS is the rollup source.
//   dept_expenditure_by_function   — 103 series, top-level codes only, 2024-25 only.
//     The same £1,157,828m total cut by DEPARTMENT × function.
//
// Both sum to the identical total, so they are alternative cuts of one quantity:
// never sum across them, or the answer doubles.
export const SPENDING_MEASURE = 'public_expenditure_by_function'
export const DEPT_SPENDING_MEASURE = 'dept_expenditure_by_function'

export interface SeriesMatch {
  seriesId: string
  seriesLabel: string
  measure: string
  unit: string
  geography: string
  cofogFunctionCode: string | null
  datasetId: string
  datasetTitle: string
  source: string
  sourceUrl: string | null
  observations: number
  firstPeriod: string | null
  lastPeriod: string | null
}

/** Catalogue lookup: match free text against series label / measure / dataset title.
 *  Ranked so an exact measure match beats a fuzzy label match.
 *
 *  Series whose unit is 'UNKNOWN' are EXCLUDED by default. Those are the OBR
 *  historical-forecast vintages (labels like "PSNB (April 1970)") — real data, but a
 *  figure with no unit cannot be quoted responsibly, which is the exact failure this
 *  tool exists to prevent. `includeUnknownUnits` opts back in. */
export async function findSeries(
  text: string,
  limit = 8,
  includeUnknownUnits = false,
): Promise<SeriesMatch[]> {
  const q = text.trim()
  if (!q) return []
  return statsQuery<SeriesMatch & Record<string, unknown>>(
    `
    SELECT s.id                AS "seriesId",
           s."seriesLabel"     AS "seriesLabel",
           s.measure, s.unit, s.geography,
           s."cofogFunctionCode" AS "cofogFunctionCode",
           d.id                AS "datasetId",
           d.title             AS "datasetTitle",
           d.source::text      AS source,
           d."sourceUrl"       AS "sourceUrl",
           count(o.id)::int    AS observations,
           min(o."periodLabel") AS "firstPeriod",
           max(o."periodLabel") AS "lastPeriod"
    FROM stat_series s
    JOIN stat_dataset d ON d.id = s."datasetId"
    LEFT JOIN stat_observation o ON o."seriesId" = s.id
    WHERE (s.measure ILIKE $1 OR s."seriesLabel" ILIKE $2 OR d.title ILIKE $2)
      AND ($4::boolean OR s.unit <> 'UNKNOWN')
    GROUP BY s.id, s."seriesLabel", s.measure, s.unit, s.geography, s."cofogFunctionCode",
             d.id, d.title, d.source, d."sourceUrl"
    HAVING count(o.id) > 0
    ORDER BY (s.measure ILIKE $1) DESC, (s.unit <> 'UNKNOWN') DESC, count(o.id) DESC
    LIMIT $3
    `,
    [q, `%${q}%`, limit, includeUnknownUnits],
  )
}

export interface Observation {
  periodLabel: string
  periodStart: string
  value: number
  unit: string
  status: string | null
}

/** Every observation for one series in a window, oldest first. */
export async function getSeriesObservations(
  seriesId: string,
  opts: { dateFrom?: string; dateTo?: string; limit?: number } = {},
): Promise<Observation[]> {
  const rows = await statsQuery<Record<string, unknown>>(
    `
    SELECT o."periodLabel", o."periodStart", o.value::text AS value, o.unit, o.status
    FROM stat_observation o
    WHERE o."seriesId" = $1
      AND ($2::date IS NULL OR o."periodStart" >= $2::date)
      AND ($3::date IS NULL OR o."periodStart" <= $3::date)
    ORDER BY o."periodStart" ASC
    LIMIT $4
    `,
    [seriesId, opts.dateFrom ?? null, opts.dateTo ?? null, opts.limit ?? 200],
  )
  return rows.map((r) => ({
    periodLabel: String(r.periodLabel),
    periodStart: new Date(r.periodStart as string).toISOString().slice(0, 10),
    value: Number(r.value),
    unit: String(r.unit),
    status: (r.status as string | null) ?? null,
  }))
}

export interface CofogRollupRow {
  cofogFunctionCode: string
  cofogFunctionName: string | null
  totalValue: number
  shareOfTotal: number
  unit: string
}

export interface CofogRollup {
  periodLabel: string
  geography: string
  unit: string
  total: number
  /** 'outturn' | 'forecast' | 'provisional' | 'mixed' | null — whether these are actual
   *  spend or projections. Carried so Lex never has to characterise a figure itself
   *  (it called PESA outturn "projected" when this was missing). */
  status: string | null
  rows: CofogRollupRow[]
  source: string
  sourceUrl: string | null
  datasetTitle: string
}

/**
 * "What does the UK spend most on" — sum observations by COFOG function for one period.
 *
 * Sub-functions are rolled up into their parent (`10.2` → `10`) by default, giving the
 * 10-function answer the question actually wants.
 *
 * DOUBLE-COUNTING CAVEAT (mirrored verbatim from the script-side layer): safe for the
 * Phase A data because PESA Table 5.2 reports ONLY leaf codes except health, which it
 * reports only at top level `07` — so no observation is both a parent and a child of
 * another in the same measure. Re-check if a source is added that publishes both levels.
 */
export async function getCofogRollup(params: {
  geography?: string
  periodLabel?: string
  rollUpToTopLevel?: boolean
}): Promise<CofogRollup | null> {
  const rollUp = params.rollUpToTopLevel !== false
  // Geography is an OPTIONAL filter, never a default. Every Phase A observation is
  // currently labelled 'GB' (even though PESA's figures are UK public expenditure —
  // a labelling quirk flagged to the stats thread), so defaulting to 'UK' silently
  // returns nothing. Filter only when the caller asks for one.
  const geography = params.geography ?? null

  // Default to the most recent period that actually has function-level data.
  const period =
    params.periodLabel ??
    (
      await statsQuery<{ periodLabel: string }>(
        `
        SELECT o."periodLabel"
        FROM stat_observation o
        JOIN stat_series s ON s.id = o."seriesId"
        WHERE s.measure = $1 AND o."cofogFunctionCode" IS NOT NULL
          AND ($2::text IS NULL OR o.geography = $2)
        ORDER BY o."periodStart" DESC
        LIMIT 1
        `,
        [SPENDING_MEASURE, geography],
      )
    )[0]?.periodLabel

  if (!period) return null

  const codeExpr = rollUp ? `split_part(o."cofogFunctionCode", '.', 1)` : `o."cofogFunctionCode"`

  const rows = await statsQuery<Record<string, unknown>>(
    `
    SELECT ${codeExpr}            AS code,
           f.name                 AS name,
           sum(o.value)::text     AS total,
           max(o.unit)            AS unit,
           max(o.geography)       AS geography,
           string_agg(DISTINCT coalesce(o.status, 'unstated'), '/') AS status
    FROM stat_observation o
    JOIN stat_series s ON s.id = o."seriesId"
    LEFT JOIN stat_cofog_function f ON f.code = ${codeExpr}
    WHERE s.measure = $1
      AND ($2::text IS NULL OR o.geography = $2)
      AND o."periodLabel" = $3
      AND o."cofogFunctionCode" IS NOT NULL
    GROUP BY 1, 2
    ORDER BY sum(o.value) DESC
    `,
    [SPENDING_MEASURE, geography, period],
  )
  if (!rows.length) return null

  const [provenance] = await statsQuery<Record<string, unknown>>(
    `
    SELECT d.title AS "datasetTitle", d.source::text AS source, d."sourceUrl" AS "sourceUrl"
    FROM stat_series s JOIN stat_dataset d ON d.id = s."datasetId"
    WHERE s.measure = $1 LIMIT 1
    `,
    [SPENDING_MEASURE],
  )

  const unit = String(rows[0].unit)
  const total = rows.reduce((acc, r) => acc + Number(r.total), 0)
  const statuses = new Set(rows.flatMap((r) => String(r.status ?? 'unstated').split('/')))
  return {
    periodLabel: period,
    geography: geography ?? String(rows[0].geography ?? 'GB'),
    unit,
    total,
    status: statuses.size === 1 ? [...statuses][0] : 'mixed',
    source: String(provenance?.source ?? 'HMT_PESA'),
    sourceUrl: (provenance?.sourceUrl as string | null) ?? null,
    datasetTitle: String(provenance?.datasetTitle ?? 'PESA'),
    rows: rows.map((r) => ({
      cofogFunctionCode: String(r.code),
      cofogFunctionName: (r.name as string | null) ?? null,
      totalValue: Number(r.total),
      shareOfTotal: total ? Number(r.total) / total : 0,
      unit: String(r.unit),
    })),
  }
}

/** The catalogue as Lex should see it: what can actually be asked about. */
export async function listCatalogue(): Promise<
  { measure: string; unit: string; geography: string; seriesCount: number; example: string; source: string }[]
> {
  return statsQuery(
    `
    SELECT s.measure, s.unit, s.geography,
           count(DISTINCT s.id)::int AS "seriesCount",
           min(s."seriesLabel")      AS example,
           max(d.source::text)       AS source
    FROM stat_series s
    JOIN stat_dataset d ON d.id = s."datasetId"
    JOIN stat_observation o ON o."seriesId" = s.id
    GROUP BY s.measure, s.unit, s.geography
    ORDER BY count(DISTINCT s.id) DESC
    `,
  )
}
