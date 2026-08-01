// Thin query layer for Lex/analysis access — analytical (aggregation, time-series,
// COFOG rollup), not full-text search, so this is a deliberately separate surface
// from scrutinise-web/lib/search.ts. Phase A: at least make the data cleanly
// queryable; wiring this into Lex's tool-calling is a follow-on (see
// docs/STATS_PHASE_A_BRIEF.md §7).
import { getStatsPrisma } from '../lib/db'

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
  geography: string
  measure: string
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
      geography: params.geography,
      periodStart: params.periodStart,
      cofogFunctionCode: { not: null },
      series: { measure: params.measure },
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
