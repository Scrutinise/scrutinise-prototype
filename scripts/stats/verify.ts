// Post-ingest verification + scorecard for the stats DB. Read-only.
// Prints per-dataset series/observation counts, date spans, licence-verified-at, the
// latest refresh-log status per dataset, physical DB size, and a live exercise of all
// three query-layer entry points (findSeries / getSeriesTimeSeries / getCofogRollup).
// Usage: npx tsx --tsconfig ../tsconfig.json verify.ts   (from scripts/stats/)
import { getStatsPrisma } from './lib/db'
import { findSeries, getSeriesTimeSeries, getCofogRollup } from './query/stats-query'

const fmt = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '—')

async function main() {
  const prisma = getStatsPrisma()

  const datasets = await prisma.statDataset.findMany({ orderBy: { id: 'asc' } })

  console.log('=== PER-DATASET SCORECARD ===\n')
  let totalSeries = 0
  let totalObs = 0
  for (const ds of datasets) {
    const series = await prisma.statSeries.count({ where: { datasetId: ds.id } })
    const agg = await prisma.statObservation.aggregate({
      where: { series: { datasetId: ds.id } },
      _count: { _all: true },
      _min: { periodStart: true },
      _max: { periodStart: true },
    })
    // Two different questions, two different rows — conflating them hides real information:
    //   lastLog     = the latest COMPLETED attempt: "what is the current health of this feed?"
    //   lastSuccess = the latest SUCCESSFUL attempt: "what did the last good run actually write?"
    // Reconciliation must use lastSuccess. Using the newest row regardless reported
    // "lastRefresh=never" for a dataset that had succeeded (a killed run left a null-status
    // row); then using the newest *completed* row silently dropped the reconciliation line
    // once that killed row was closed out as FAILURE. Both are the same masking bug wearing
    // different hats — 2026-08-03.
    const lastLog = await prisma.statRefreshLog.findFirst({
      where: { datasetId: ds.id, status: { not: null } },
      orderBy: { startedAt: 'desc' },
    })
    const lastSuccess = await prisma.statRefreshLog.findFirst({
      where: { datasetId: ds.id, status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
    })
    // Surface unfinished runs rather than swallowing them — an orphaned RUNNING row means a
    // refresh died mid-flight and nobody was told.
    const orphaned = await prisma.statRefreshLog.count({
      where: { datasetId: ds.id, status: null, startedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
    })
    totalSeries += series
    totalObs += agg._count._all
    console.log(`${ds.id}`)
    console.log(`  source=${ds.source} cadence=${ds.refreshCadence} cofogRelevant=${ds.cofogRelevant}`)
    console.log(`  licence="${ds.licence}" verifiedAt=${fmt(ds.licenceVerifiedAt)}`)
    console.log(`  series=${series}  observations=${agg._count._all}  span=${fmt(agg._min.periodStart)} → ${fmt(agg._max.periodStart)}`)
    console.log(`  lastRefresh=${lastLog?.status ?? 'never'}${lastLog?.errorMessage ? ` (${lastLog.errorMessage.slice(0, 120)})` : ''}`)
    if (orphaned > 0) console.log(`  ** ${orphaned} UNFINISHED RUN(S) ** — refresh log row(s) with no status: a run died mid-flight`)
    // RECONCILIATION: the handler counts what it TRIED to write; this counts what LANDED.
    // A gap means rows collided on the observation unique key and overwrote each other —
    // exactly the failure that hid 533 lost CDID rows and 60 lost tax-gap rows behind a
    // green SUCCESS on the first live ingest (2026-08-01). Never let this be silent again.
    if (lastSuccess && lastSuccess.observationsUpserted > 0) {
      const gap = lastSuccess.observationsUpserted - agg._count._all
      if (gap === 0) {
        console.log(`  reconcile: OK — ${lastSuccess.observationsUpserted} attempted == ${agg._count._all} stored`)
      } else if (gap > 0) {
        // Fewer stored than attempted: rows collided on the observation unique key.
        console.log(`  reconcile: ** ${gap} ROWS LOST ** — ${lastSuccess.observationsUpserted} attempted vs ${agg._count._all} stored (duplicate observation keys overwrote each other)`)
      } else {
        // MORE stored than attempted: the handler didn't write these, so they're left over from
        // an earlier run whose SERIES KEY has since changed — orphaned series the upsert can no
        // longer reach (it upserts by key, so a changed key creates a new row beside the old).
        // This is what the bug-6 tax-gap fix produced: 27 pre-fix series stranded next to 30 correct ones.
        console.log(`  reconcile: ** ${-gap} ORPHANED ROWS ** — only ${lastSuccess.observationsUpserted} attempted but ${agg._count._all} stored (stale series from a run before a series-key change; delete them)`)
      }
    }
    console.log('')
  }
  console.log(`TOTAL: ${datasets.length} datasets, ${totalSeries} series, ${totalObs} observations`)

  const [{ size, pretty }] = await prisma.$queryRaw<{ size: bigint, pretty: string }[]>`
    SELECT pg_database_size(current_database()) AS size, pg_size_pretty(pg_database_size(current_database())) AS pretty
  `
  console.log(`DB SIZE: ${pretty} (${size} bytes)`)

  const outturn = await prisma.statObservation.count({ where: { status: 'outturn' } })
  const forecast = await prisma.statObservation.count({ where: { status: 'forecast' } })
  const vintages = await prisma.statSeries.findMany({
    where: { forecastVintage: { not: null } },
    distinct: ['forecastVintage'],
    select: { forecastVintage: true },
  })
  console.log(`OBS BY STATUS: outturn=${outturn} forecast=${forecast} other/null=${totalObs - outturn - forecast}`)
  console.log(`FORECAST VINTAGES: ${vintages.length} distinct`)

  console.log('\n=== QUERY LAYER (live) ===\n')

  // 1. catalogue lookup
  const cdid = await findSeries({ datasetId: 'ons-cdid-headline' })
  console.log(`findSeries(ons-cdid-headline) -> ${cdid.length} series:`)
  for (const s of cdid) console.log(`  ${s.sourceSeriesId}  ${s.measure}  ${s.unit}  "${s.seriesLabel}"  [${s.dataset.source}]`)

  // 2. time series retrieval
  if (cdid.length > 0) {
    const pts = await getSeriesTimeSeries(cdid[0].id)
    console.log(`\ngetSeriesTimeSeries("${cdid[0].seriesLabel}") -> ${pts.length} points`)
    if (pts.length) {
      console.log(`  first: ${pts[0].periodLabel} = ${pts[0].value}`)
      console.log(`  last:  ${pts[pts.length - 1].periodLabel} = ${pts[pts.length - 1].value}`)
    }
  }

  // 3. COFOG rollup — "what does the UK spend most on"
  const cofogCodes = await prisma.statObservation.groupBy({
    by: ['cofogFunctionCode'],
    where: { cofogFunctionCode: { not: null } },
    _count: { _all: true },
  })
  console.log(`\nCOFOG-coded observations: ${cofogCodes.reduce((a, c) => a + c._count._all, 0)} across ${cofogCodes.length} distinct codes`)
  console.log(`  codes: ${cofogCodes.map((c) => c.cofogFunctionCode).sort().join(', ')}`)

  const latestCofog = await prisma.statObservation.findFirst({
    where: { cofogFunctionCode: { not: null } },
    orderBy: { periodStart: 'desc' },
    select: { periodStart: true, periodLabel: true, series: { select: { measure: true, geography: true } } },
  })
  if (latestCofog) {
    const rollup = await getCofogRollup({
      geography: latestCofog.series.geography,
      measure: latestCofog.series.measure,
      periodStart: latestCofog.periodStart,
    })
    console.log(`\ngetCofogRollup(${latestCofog.series.geography}, ${latestCofog.series.measure}, ${latestCofog.periodLabel}) -> ${rollup.length} rows at source granularity (top 5):`)
    for (const r of rollup.slice(0, 5)) console.log(`  ${r.cofogFunctionCode}  ${r.cofogFunctionName ?? '(sub-function)'}  ${r.totalValue.toLocaleString()}`)

    const top = await getCofogRollup({
      geography: latestCofog.series.geography,
      measure: latestCofog.series.measure,
      periodStart: latestCofog.periodStart,
      rollUpToTopLevel: true,
    })
    const grand = top.reduce((a, r) => a + r.totalValue, 0)
    console.log(`\n"What does the UK spend most on", ${latestCofog.periodLabel} (rollUpToTopLevel) -> ${top.length} functions, £${Math.round(grand).toLocaleString()}m total:`)
    for (const r of top) {
      const pct = ((r.totalValue / grand) * 100).toFixed(1)
      console.log(`  ${r.cofogFunctionCode}  ${(r.cofogFunctionName ?? '?').padEnd(34)} £${Math.round(r.totalValue).toLocaleString().padStart(9)}m  ${pct.padStart(5)}%`)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
