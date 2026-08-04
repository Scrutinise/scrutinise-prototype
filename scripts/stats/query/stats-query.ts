// Thin query layer for Lex/analysis access — analytical (aggregation, time-series,
// COFOG rollup), not full-text search, so this is a deliberately separate surface
// from scrutinise-web/lib/search.ts. Phase A: at least make the data cleanly
// queryable; wiring this into Lex's tool-calling is a follow-on (see
// docs/STATS_PHASE_A_BRIEF.md §7).
//
// ⚠ INTENTIONALLY DUPLICATED — keep in sync with `scrutinise-web/lib/stats/stats-query.ts`.
// The web app cannot import this file: the generated stats Prisma client is gitignored and
// sits outside the Vercel build root, so the app expresses the same three questions as raw
// SQL. The two are allowed to differ in *expression*; their ANALYTICAL SEMANTICS — which
// measure carries spending, the COFOG roll-up rule, the never-sum rule below — must not.
// Change one, change the other, then run `npm run verify`.
//
import { getStatsPrisma } from '../lib/db'

/**
 * PESA's expenditure-by-COFOG rows. VERIFIED AGAINST THE LIVE DB (2026-08-02, re-confirmed
 * 2026-08-04) — these names come from the data, not from the schema's illustrative comment,
 * which named a measure (`exp_by_subfunction`) that has never existed in this database.
 *
 *   public_expenditure_by_function — 62 series, 60 COFOG codes, 2020-21…2024-25. Spending by
 *     function only, and THE rollup source: leaf sub-function rows, plus health, which PESA
 *     reports only at top level `07`.
 *   dept_expenditure_by_function   — 103 series, top-level codes only, 2024-25 only. The same
 *     £1,157,828m total, cut by DEPARTMENT × function.
 *
 * ⚠ NEVER SUM ACROSS THE TWO. They are alternative cuts of one quantity — adding them doubles
 * the answer to "what does the UK spend most on".
 */
export const SPENDING_MEASURE = 'public_expenditure_by_function'
export const DEPT_SPENDING_MEASURE = 'dept_expenditure_by_function'

export interface TimeSeriesPoint {
  periodLabel: string
  periodStart: Date
  value: number
  status: string | null
}

/** Every observation for one series, oldest first — "how has X changed since Y". */
export async function getSeriesTimeSeries(seriesId: string): Promise<TimeSeriesPoint[]> {
  const prisma = getStatsPrisma()
  const rows = await prisma.statObservation.findMany({
    where: { seriesId },
    orderBy: { periodStart: 'asc' },
  })
  return rows.map((r) => ({
    periodLabel: r.periodLabel,
    periodStart: r.periodStart,
    value: Number(r.value),
    status: r.status,
  }))
}

/** Find series by dataset/measure/geography/cofog — the catalogue lookup before charting one. */
export async function findSeries(filter: {
  datasetId?: string
  measure?: string
  geography?: string
  cofogFunctionCode?: string
}) {
  const prisma = getStatsPrisma()
  return prisma.statSeries.findMany({
    where: {
      datasetId: filter.datasetId,
      measure: filter.measure,
      geography: filter.geography,
      cofogFunctionCode: filter.cofogFunctionCode,
    },
    include: { dataset: { select: { title: true, source: true, sourceUrl: true } } },
  })
}

// ---- Phase B: comparative / international reads -----------------------------

export interface ComparativeRow {
  geography: string
  periodLabel: string
  periodStart: Date
  value: number
}

export interface ComparativePoint {
  periodLabel: string
  /** geography code -> value for that period. Absent key = that country has no value that year. */
  byGeography: Record<string, number>
}

/**
 * "Compare UK vs OECD-average (or any country set) spending on a given COFOG function over time."
 *
 * This is the Phase B payoff query. It works because Phase B normalises country codes to
 * ISO-3166 alpha-2 (see lib/iso.ts), so the UK's own rows sit under the SAME `GB` geography
 * that Phase A wrote — otherwise the UK would never line up with its own comparators.
 *
 * `geographies` accepts country codes and OECD's published aggregates alike ('OECD_REP' is
 * OECD's own "average country" figure — preferred over averaging member rows ourselves, which
 * would silently weight by whichever members happen to report).
 */
export async function compareByCofogFunction(params: {
  cofogFunctionCode: string
  geographies: string[]
  unit?: string
  datasetId?: string
  fromYear?: number
}): Promise<ComparativePoint[]> {
  const prisma = getStatsPrisma()
  const rows = await prisma.statObservation.findMany({
    where: {
      cofogFunctionCode: params.cofogFunctionCode,
      geography: { in: params.geographies },
      ...(params.unit ? { unit: params.unit } : {}),
      ...(params.fromYear ? { periodStart: { gte: new Date(Date.UTC(params.fromYear, 0, 1)) } } : {}),
      ...(params.datasetId ? { series: { datasetId: params.datasetId } } : {}),
    },
    orderBy: { periodStart: 'asc' },
    select: { geography: true, periodLabel: true, periodStart: true, value: true },
  })
  const byPeriod = new Map<string, ComparativePoint>()
  for (const r of rows) {
    const key = r.periodLabel
    let e = byPeriod.get(key)
    if (!e) { e = { periodLabel: key, byGeography: {} }; byPeriod.set(key, e) }
    e.byGeography[r.geography] = Number(r.value)
  }
  return [...byPeriod.values()]
}

/** One indicator (e.g. health spend % GDP) across countries over time — the non-COFOG comparison. */
export async function compareByMeasure(params: {
  measure: string
  geographies: string[]
  fromYear?: number
}): Promise<ComparativePoint[]> {
  const prisma = getStatsPrisma()
  const rows = await prisma.statObservation.findMany({
    where: {
      geography: { in: params.geographies },
      series: { measure: params.measure },
      ...(params.fromYear ? { periodStart: { gte: new Date(Date.UTC(params.fromYear, 0, 1)) } } : {}),
    },
    orderBy: { periodStart: 'asc' },
    select: { geography: true, periodLabel: true, value: true },
  })
  const byPeriod = new Map<string, ComparativePoint>()
  for (const r of rows) {
    let e = byPeriod.get(r.periodLabel)
    if (!e) { e = { periodLabel: r.periodLabel, byGeography: {} }; byPeriod.set(r.periodLabel, e) }
    e.byGeography[r.geography] = Number(r.value)
  }
  return [...byPeriod.values()]
}

/** Which geographies do we actually hold data for? Useful before offering a comparison to Lex. */
export async function availableGeographies(datasetId?: string): Promise<string[]> {
  const prisma = getStatsPrisma()
  const rows = await prisma.statSeries.findMany({
    where: datasetId ? { datasetId } : {},
    distinct: ['geography'],
    select: { geography: true },
    orderBy: { geography: 'asc' },
  })
  return rows.map((r) => r.geography)
}

export interface CofogRollupRow {
  cofogFunctionCode: string
  cofogFunctionName: string | null
  periodLabel: string
  totalValue: number
}

/**
 * "What does the UK spend most on" — sum observations by COFOG function for a
 * given measure/unit at/around a period. Uses the observation-level denormalised
 * geography/cofogFunctionCode columns (see schema doc comment) so this never
 * needs to join through stat_series.
 */
export async function getCofogRollup(params: {
  /**
   * OPTIONAL filter, never a default. UK-wide series are stored under ISO-3166 alpha-2 `GB`
   * (which IS the code for the United Kingdom — see STATS_SCHEMA.md), so passing a literal
   * `'UK'` matches nothing at all. Omit it unless you mean to restrict to one country.
   */
  geography?: string
  /** Defaults to SPENDING_MEASURE. Do not pass both cuts and add them — see the constant. */
  measure?: string
  periodStart: Date
  /**
   * Aggregate sub-functions into their parent (`10.2` → `10`), giving the 10-function answer
   * "what does the UK spend most on" actually wants. Default false returns the source's own
   * granularity.
   *
   * Safe from double-counting for the Phase A data: PESA Table 5.2 reports ONLY leaf codes
   * (59 sub-functions, no top-level rows) except health, which it reports only at top-level
   * `07` — so no observation is ever both a parent and a child of another observation in the
   * same measure. Re-check this if a source is added that publishes both levels.
   */
  rollUpToTopLevel?: boolean
}): Promise<CofogRollupRow[]> {
  const prisma = getStatsPrisma()
  const rows = await prisma.statObservation.findMany({
    where: {
      ...(params.geography ? { geography: params.geography } : {}),
      periodStart: params.periodStart,
      cofogFunctionCode: { not: null },
      series: { measure: params.measure ?? SPENDING_MEASURE },
    },
    select: { cofogFunctionCode: true, periodLabel: true, value: true },
  })
  const byCode = new Map<string, CofogRollupRow>()
  for (const r of rows) {
    if (!r.cofogFunctionCode) continue
    const code = params.rollUpToTopLevel ? r.cofogFunctionCode.split('.')[0] : r.cofogFunctionCode
    const existing = byCode.get(code)
    const value = Number(r.value)
    if (existing) existing.totalValue += value
    else byCode.set(code, { cofogFunctionCode: code, cofogFunctionName: null, periodLabel: r.periodLabel, totalValue: value })
  }
  const names = await prisma.statCofogFunction.findMany({ where: { code: { in: [...byCode.keys()] } } })
  const nameByCode = new Map(names.map((n) => [n.code, n.name]))
  return [...byCode.values()]
    .map((r) => ({ ...r, cofogFunctionName: nameByCode.get(r.cofogFunctionCode) ?? null }))
    .sort((a, b) => b.totalValue - a.totalValue)
}
