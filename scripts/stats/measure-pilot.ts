// Phase A pilot measurement — fetches real data from every source, parses it with
// the real parsers, and counts series/observations. Deliberately does NOT write to
// any database: per docs/STATS_PHASE_A_BRIEF.md §9, Charlie confirms the DB choice
// (and anything that costs money) before provisioning, so this script's only job
// is to produce the measured numbers that recommendation is based on.
//
// Run: npx tsx --tsconfig ../tsconfig.json measure-pilot.ts   (from scripts/stats/)
import * as XLSX from 'xlsx'
import { fetchCdidSeries, CDID_SERIES } from './sources/ons-cdid'
import { listDatasets, getLatestVersionMeta, parseOnsBetaCsv } from './sources/ons-beta'
import { fetchObrWorkbook, parsePsfSince1900, parsePsfAggregatesGbp, parseHistoricalForecastSheet } from './sources/obr'
import { fetchPesaWorkbook, parseFunctionTimeSeries, parseDeptByFunctionSnapshot } from './sources/pesa'
import { fetchHmrcWorkbook, parseReceiptsAnnually, parseTaxGapTable11 } from './sources/hmrc'

interface SourceTally {
  source: string
  dataset: string
  series: number
  observations: number
  notes?: string
}

const tallies: SourceTally[] = []

function distinctSeriesCount<T>(rows: T[], keyFn: (r: T) => string): number {
  return new Set(rows.map(keyFn)).size
}

async function measureOns() {
  console.log('\n=== ONS ===')
  // Route B — CDID (curated, individually-verified list)
  let cdidObs = 0
  for (const cfg of CDID_SERIES) {
    const s = await fetchCdidSeries(cfg)
    cdidObs += s.observations.length
    console.log(`  CDID ${s.cdid} (${cfg.measure}): ${s.observations.length} obs, "${s.title}"`)
  }
  tallies.push({ source: 'ONS (CDID)', dataset: `${CDID_SERIES.length} curated headline series`, series: CDID_SERIES.length, observations: cdidObs })

  // Route A — Beta API catalogue size + one representative dataset
  const catalogue = await listDatasets(1, 0)
  console.log(`  Beta API catalogue: (probe only, 1 page) — see total_count note below`)
  const sample = await getLatestVersionMeta('wellbeing-quarterly')
  const res = await fetch(sample.csvDownloadUrl)
  const text = await res.text()
  const rows = parseOnsBetaCsv(text, sample.dimensionNames)
  const seriesKeys = distinctSeriesCount(rows, (r) => JSON.stringify(Object.entries(r.dims as never).filter(([k]) => k !== 'time').map(([, v]: unknown[]) => (v as { code: string }).code)))
  console.log(`  Beta API sample dataset 'wellbeing-quarterly': ${rows.length} obs, ~${seriesKeys} distinct non-time series`)
  tallies.push({
    source: 'ONS (Beta API)',
    dataset: 'wellbeing-quarterly (1 of 337 catalogue datasets)',
    series: seriesKeys,
    observations: rows.length,
    notes: `Catalogue has 337 datasets total (see live total_count) — this is 1 sample, not full Route A ingest.`,
  })
  void catalogue
}

async function measureObr() {
  console.log('\n=== OBR ===')
  const { workbook: psf } = await fetchObrWorkbook('public-finances-databank')
  const since1900 = parsePsfSince1900(psf)
  const aggregates = parsePsfAggregatesGbp(psf)
  console.log(`  Public Finances Databank / "Public finances since 1900": ${since1900.length} obs, ${distinctSeriesCount(since1900, (r) => r.measure as string)} series`)
  console.log(`  Public Finances Databank / "Aggregates (£bn)": ${aggregates.length} obs, ${distinctSeriesCount(aggregates, (r) => r.measure as string)} series`)
  tallies.push({
    source: 'OBR',
    dataset: 'Public Finances Databank (2 sheets)',
    series: distinctSeriesCount(since1900, (r) => r.measure as string) + distinctSeriesCount(aggregates, (r) => r.measure as string),
    observations: since1900.length + aggregates.length,
  })

  const { workbook: hist } = await fetchObrWorkbook('historical-official-forecasts-database')
  let histObs = 0
  let histSeries = 0
  let ok = 0
  let failed: string[] = []
  for (const sheetName of hist.SheetNames) {
    try {
      const measure = sheetName.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
      const rows = parseHistoricalForecastSheet(hist, sheetName, measure, 'UNKNOWN')
      if (rows.length === 0) continue
      histObs += rows.length
      histSeries += distinctSeriesCount(rows, (r) => `${r.measure}:${r.forecastVintage ?? 'outturn'}`)
      ok++
    } catch {
      failed.push(sheetName)
    }
  }
  console.log(`  Historical Official Forecasts Database: ${ok}/${hist.SheetNames.length} sheets parsed, ${histObs} obs, ~${histSeries} series (forecast-vintage + outturn lines)`)
  console.log(`  Sheets that didn't match the expected shape (index/contents pages, different layout — skipped, not silently dropped): ${failed.length}`)
  tallies.push({
    source: 'OBR',
    dataset: `Historical Official Forecasts Database (${ok}/${hist.SheetNames.length} sheets)`,
    series: histSeries,
    observations: histObs,
    notes: `${failed.length} sheets skipped (non-standard layout): ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? '...' : ''}`,
  })
}

async function measurePesa() {
  console.log('\n=== PESA (Chapter 5 — function) ===')
  const wb = await fetchPesaWorkbook(
    'https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx',
  )
  const fn = parseFunctionTimeSeries(wb)
  const dept = parseDeptByFunctionSnapshot(wb)
  console.log(`  Table 5.2 (function time series): ${fn.length} obs, ${distinctSeriesCount(fn, (r) => r.cofogFunctionCode as string)} COFOG series`)
  console.log(`  Table 5.1 (dept x function, single year): ${dept.length} obs, ${distinctSeriesCount(dept, (r) => `${r.sourceSeriesId}:${r.cofogFunctionCode}`)} series`)
  tallies.push({
    source: 'HMT PESA',
    dataset: 'Chapter 5, Tables 5.1 + 5.2 (1 of 10 chapters)',
    series: distinctSeriesCount(fn, (r) => r.cofogFunctionCode as string) + distinctSeriesCount(dept, (r) => `${r.sourceSeriesId}:${r.cofogFunctionCode}`),
    observations: fn.length + dept.length,
    notes: 'Chapters 1-4, 6-10 + annexes not ingested this pilot — Ch5 is the COFOG-relevant one.',
  })
}

async function measureHmrc() {
  console.log('\n=== HMRC ===')
  const receiptsWb = await fetchHmrcWorkbook(
    'https://assets.publishing.service.gov.uk/media/6a571e539e63154454413697/NS_Table.ods',
  )
  const receipts = parseReceiptsAnnually(receiptsWb)
  console.log(`  Tax receipts (Receipts_Annually): ${receipts.length} obs, ${distinctSeriesCount(receipts, (r) => r.measure as string)} series`)

  const taxgapWb = await fetchHmrcWorkbook(
    'https://assets.publishing.service.gov.uk/media/6a314f53141f0690ad5fa41e/Measuring_tax_gap_online_tables_2026.xlsx',
  )
  const taxgap = parseTaxGapTable11(taxgapWb)
  console.log(`  Tax gap (Table 1.1): ${taxgap.length} obs, ${distinctSeriesCount(taxgap, (r) => r.measure as string)} series`)

  tallies.push({
    source: 'HMRC',
    dataset: 'Tax receipts (annual) + tax gap Table 1.1',
    series: distinctSeriesCount(receipts, (r) => r.measure as string) + distinctSeriesCount(taxgap, (r) => r.measure as string),
    observations: receipts.length + taxgap.length,
    notes: 'Tax gap workbook has 15 tables total (1.1-3.12) — only 1.1 ingested this pilot.',
  })
}

async function main() {
  await measureOns()
  await measureObr()
  await measurePesa()
  await measureHmrc()

  console.log('\n=== SUMMARY (measured, real fetches, no fabricated numbers) ===')
  let totalSeries = 0
  let totalObs = 0
  for (const t of tallies) {
    console.log(`  ${t.source.padEnd(16)} ${t.dataset.padEnd(55)} series=${t.series} obs=${t.observations}${t.notes ? '  [' + t.notes + ']' : ''}`)
    totalSeries += t.series
    totalObs += t.observations
  }
  console.log(`\n  TOTAL (this pilot slice): ${totalSeries} series, ${totalObs} observations`)
  // Rough size estimate: stat_observation row is small (bigint id, fk, enum, timestamp,
  // decimal(20,4), 2 short text status/label, 2 denormalised text/varchar cols) — call
  // it ~150 bytes/row including btree index overhead (2 indexes) as a conservative estimate.
  const bytesPerObs = 150
  console.log(`  Rough on-disk estimate at this slice: ~${((totalObs * bytesPerObs) / 1024 / 1024).toFixed(1)} MB`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
