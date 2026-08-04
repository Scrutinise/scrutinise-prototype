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
  /** Licence provenance — carried on EVERY result. A figure whose terms you cannot
   *  state is a figure you cannot safely publish, and a commercial fork of Scrutinise
   *  is a live possibility, so `commercialUseExcluded` travels with the number. */
  licence: string
  licenceUrl: string | null
  commercialUseExcluded: boolean
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
  geography?: string | null,
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
           d.licence           AS licence,
           d."licenceUrl"      AS "licenceUrl",
           d."commercialUseExcluded" AS "commercialUseExcluded",
           count(o.id)::int    AS observations,
           min(o."periodLabel") AS "firstPeriod",
           max(o."periodLabel") AS "lastPeriod"
    FROM stat_series s
    JOIN stat_dataset d ON d.id = s."datasetId"
    LEFT JOIN stat_observation o ON o."seriesId" = s.id
    WHERE (s.measure ILIKE $1 OR s."seriesLabel" ILIKE $2 OR d.title ILIKE $2)
      AND ($4::boolean OR s.unit <> 'UNKNOWN')
      AND ($5::text IS NULL OR s.geography = $5)
    GROUP BY s.id, s."seriesLabel", s.measure, s.unit, s.geography, s."cofogFunctionCode",
             d.id, d.title, d.source, d."sourceUrl", d.licence, d."licenceUrl", d."commercialUseExcluded"
    HAVING count(o.id) > 0
    ORDER BY (s.measure ILIKE $1) DESC, (s.unit <> 'UNKNOWN') DESC, count(o.id) DESC
    LIMIT $3
    `,
    [q, `%${q}%`, limit, includeUnknownUnits, geography ?? null],
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
  licence: string
  licenceUrl: string | null
  commercialUseExcluded: boolean
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
    SELECT d.title AS "datasetTitle", d.source::text AS source, d."sourceUrl" AS "sourceUrl",
           d.licence AS licence, d."licenceUrl" AS "licenceUrl",
           d."commercialUseExcluded" AS "commercialUseExcluded"
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
    licence: String(provenance?.licence ?? 'not recorded'),
    licenceUrl: (provenance?.licenceUrl as string | null) ?? null,
    commercialUseExcluded: provenance?.commercialUseExcluded === true,
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

// ── Comparative geography (§ stats-tool gaps, 4 Aug 2026) ────────────────────

/**
 * The comparison set. Phase B loaded World Bank WDI across these 21 countries plus
 * GB; "OECD" here means "every country we actually hold for the measure", which is a
 * subset of OECD membership. The tool says so rather than implying full coverage —
 * calling a 21-country mean "the OECD average" when the OECD has 38 members would be
 * a quietly wrong number.
 */
export const UK_CODE = 'GB'

export interface ComparativeRow {
  geography: string
  value: number
  periodLabel: string
  status: string | null
}

export interface Comparative {
  measure: string
  unit: string
  periodLabel: string
  rows: ComparativeRow[]
  /** UNWEIGHTED mean across `rows`, COMPUTED HERE — not a published figure. Labelled
   *  as such everywhere it surfaces, because no source published this number. */
  computedMean: number | null
  computedMeanBasis: string
  ukValue: number | null
  datasetTitle: string
  source: string
  sourceUrl: string | null
  licence: string
  licenceUrl: string | null
  commercialUseExcluded: boolean
}

/**
 * One measure across many countries for a single period — the "how does the UK
 * compare" shape. Picks the latest period for which at least `minCountries` have data,
 * so a comparison is never drawn from one straggler country's newest year.
 */
export async function getComparative(params: {
  measure: string
  geographies?: string[] | null
  periodLabel?: string
  minCountries?: number
}): Promise<Comparative | null> {
  const geos = params.geographies?.length ? params.geographies : null
  // The "latest period with enough countries" guard stops a comparison being drawn from
  // one straggler country's newest year. But when the caller NAMES the countries, the
  // floor must not exceed how many they asked for — requiring 5 of a 3-country request
  // matches no period at all and silently returns nothing.
  const minCountries = params.minCountries ?? (geos ? Math.min(geos.length, 5) : 5)

  const period =
    params.periodLabel ??
    (
      await statsQuery<{ periodLabel: string }>(
        `
        SELECT o."periodLabel"
        FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
        WHERE s.measure = $1 AND ($2::text[] IS NULL OR o.geography = ANY($2))
        GROUP BY o."periodLabel", o."periodStart"
        HAVING count(DISTINCT o.geography) >= $3
        ORDER BY o."periodStart" DESC
        LIMIT 1
        `,
        [params.measure, geos, minCountries],
      )
    )[0]?.periodLabel
  if (!period) return null

  const rows = await statsQuery<Record<string, unknown>>(
    `
    SELECT o.geography, o.value::text AS value, o."periodLabel", o.status, o.unit,
           d.title AS "datasetTitle", d.source::text AS source, d."sourceUrl" AS "sourceUrl",
           d.licence AS licence, d."licenceUrl" AS "licenceUrl",
           d."commercialUseExcluded" AS "commercialUseExcluded"
    FROM stat_observation o
    JOIN stat_series s ON s.id = o."seriesId"
    JOIN stat_dataset d ON d.id = s."datasetId"
    WHERE s.measure = $1 AND o."periodLabel" = $2
      AND ($3::text[] IS NULL OR o.geography = ANY($3))
    ORDER BY o.value DESC
    `,
    [params.measure, period, geos],
  )
  if (!rows.length) return null

  const parsed: ComparativeRow[] = rows.map((r) => ({
    geography: String(r.geography),
    value: Number(r.value),
    periodLabel: String(r.periodLabel),
    status: (r.status as string | null) ?? null,
  }))
  const mean = parsed.length ? parsed.reduce((a, r) => a + r.value, 0) / parsed.length : null

  return {
    measure: params.measure,
    unit: String(rows[0].unit),
    periodLabel: period,
    rows: parsed,
    computedMean: mean,
    computedMeanBasis:
      `unweighted mean of the ${parsed.length} countries listed (${parsed.map((r) => r.geography).join(', ')}) ` +
      `for ${period} — computed by Scrutinise, not published by the source`,
    ukValue: parsed.find((r) => r.geography === UK_CODE)?.value ?? null,
    datasetTitle: String(rows[0].datasetTitle),
    source: String(rows[0].source),
    sourceUrl: (rows[0].sourceUrl as string | null) ?? null,
    licence: String(rows[0].licence ?? 'not recorded'),
    licenceUrl: (rows[0].licenceUrl as string | null) ?? null,
    commercialUseExcluded: rows[0].commercialUseExcluded === true,
  }
}

/** Which geographies exist for a measure — so the tool can say what it can compare. */
export async function geographiesFor(measure: string): Promise<string[]> {
  const rows = await statsQuery<{ geography: string }>(
    `SELECT DISTINCT o.geography FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
     WHERE s.measure = $1 ORDER BY 1`,
    [measure],
  )
  return rows.map((r) => r.geography)
}

// ── The retrieval contract with the search thread (4 Aug 2026) ────────────────
//
// Division of labour: the SEARCH side owns discoverability (indexing the catalogue so
// a user's question surfaces a series); THIS side owns retrieval (turning whatever the
// catalogue recorded back into observations). These two functions are that seam.
//
// THE IDENTITY PROBLEM, measured rather than assumed:
//   · `stat_series.id` is a cuid — unique, but NOT stable. A re-ingest under a changed
//     series key mints a NEW row beside the old one (that is exactly how 27 stale
//     tax-gap series came to double-count 540 observations, handoff 2026-08-01).
//   · The natural key is NOT unique: 3,404 series collapse to 3,244 distinct
//     (datasetId, measure, geography, cofogFunctionCode, forecastVintage) tuples,
//     because `sourceSeriesId` is NULL for 2,925 of them and distinguishing detail
//     (e.g. which department) lives only in `seriesLabel`.
//
// So NEITHER handle is sufficient alone. The contract: the catalogue stores the cuid
// as the fast path AND the natural key + label as the repair path; retrieval tries the
// id first and falls back. A stale id returns `null` LOUDLY so the search side can
// re-resolve, rather than silently yielding no data.

/** Fast path: fetch a series by the id the catalogue recorded. Null = stale/unknown. */
export async function getSeriesById(seriesId: string): Promise<SeriesMatch | null> {
  const rows = await statsQuery<SeriesMatch & Record<string, unknown>>(
    `
    SELECT s.id AS "seriesId", s."seriesLabel" AS "seriesLabel", s.measure, s.unit, s.geography,
           s."cofogFunctionCode" AS "cofogFunctionCode",
           d.id AS "datasetId", d.title AS "datasetTitle", d.source::text AS source,
           d."sourceUrl" AS "sourceUrl", d.licence AS licence, d."licenceUrl" AS "licenceUrl",
           d."commercialUseExcluded" AS "commercialUseExcluded",
           count(o.id)::int AS observations,
           min(o."periodLabel") AS "firstPeriod", max(o."periodLabel") AS "lastPeriod"
    FROM stat_series s
    JOIN stat_dataset d ON d.id = s."datasetId"
    LEFT JOIN stat_observation o ON o."seriesId" = s.id
    WHERE s.id = $1
    GROUP BY s.id, s."seriesLabel", s.measure, s.unit, s.geography, s."cofogFunctionCode",
             d.id, d.title, d.source, d."sourceUrl", d.licence, d."licenceUrl", d."commercialUseExcluded"
    `,
    [seriesId],
  )
  return rows[0] ?? null
}

/**
 * Repair path: re-resolve a series from the natural key the catalogue also stored.
 * May return MORE THAN ONE (the key is not unique) — `seriesLabel` disambiguates, so
 * the caller passes it when it has it. Returns every candidate rather than guessing.
 */
export async function resolveSeries(key: {
  datasetId: string
  measure: string
  geography?: string | null
  cofogFunctionCode?: string | null
  forecastVintage?: string | null
  seriesLabel?: string | null
}): Promise<SeriesMatch[]> {
  return statsQuery<SeriesMatch & Record<string, unknown>>(
    `
    SELECT s.id AS "seriesId", s."seriesLabel" AS "seriesLabel", s.measure, s.unit, s.geography,
           s."cofogFunctionCode" AS "cofogFunctionCode",
           d.id AS "datasetId", d.title AS "datasetTitle", d.source::text AS source,
           d."sourceUrl" AS "sourceUrl", d.licence AS licence, d."licenceUrl" AS "licenceUrl",
           d."commercialUseExcluded" AS "commercialUseExcluded",
           count(o.id)::int AS observations,
           min(o."periodLabel") AS "firstPeriod", max(o."periodLabel") AS "lastPeriod"
    FROM stat_series s
    JOIN stat_dataset d ON d.id = s."datasetId"
    LEFT JOIN stat_observation o ON o."seriesId" = s.id
    WHERE s."datasetId" = $1
      AND s.measure = $2
      AND ($3::text IS NULL OR s.geography = $3)
      AND ($4::text IS NULL OR s."cofogFunctionCode" = $4)
      AND ($5::text IS NULL OR s."forecastVintage" = $5)
      AND ($6::text IS NULL OR s."seriesLabel" = $6)
    GROUP BY s.id, s."seriesLabel", s.measure, s.unit, s.geography, s."cofogFunctionCode",
             d.id, d.title, d.source, d."sourceUrl", d.licence, d."licenceUrl", d."commercialUseExcluded"
    ORDER BY count(o.id) DESC
    `,
    [key.datasetId, key.measure, key.geography ?? null, key.cofogFunctionCode ?? null,
     key.forecastVintage ?? null, key.seriesLabel ?? null],
  )
}
