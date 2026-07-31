// The write path for each seeded StatDataset — fetch (via the source modules
// proven in measure-pilot.ts) + upsert series/observations. One handler per
// dataset id in seed-catalogue.ts. refresh-scheduler.ts dispatches to these.
import { upsertSeries, upsertObservation } from './lib/upsert'
import { CDID_SERIES, fetchCdidSeries } from './sources/ons-cdid'
import { getLatestVersionMeta, parseOnsBetaCsv } from './sources/ons-beta'
import { fetchObrWorkbook, parsePsfSince1900, parsePsfAggregatesGbp, parseHistoricalForecastSheet } from './sources/obr'
import { fetchPesaWorkbook, parseFunctionTimeSeries, parseDeptByFunctionSnapshot } from './sources/pesa'
import { fetchHmrcWorkbook, parseReceiptsAnnually, parseTaxGapTable11 } from './sources/hmrc'

export interface RefreshResult {
  series: number
  observations: number
}

const PESA_CH5_URL = 'https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx'
const HMRC_RECEIPTS_URL = 'https://assets.publishing.service.gov.uk/media/6a571e539e63154454413697/NS_Table.ods'
const HMRC_TAXGAP_URL = 'https://assets.publishing.service.gov.uk/media/6a314f53141f0690ad5fa41e/Measuring_tax_gap_online_tables_2026.xlsx'

async function refreshOnsCdidHeadline(): Promise<RefreshResult> {
  const seriesSeen = new Set<string>()
  let observations = 0
  for (const cfg of CDID_SERIES) {
    const s = await fetchCdidSeries(cfg)
    const seriesId = await upsertSeries({
      datasetId: 'ons-cdid-headline',
      sourceSeriesId: s.cdid,
      geography: 'GB',
      measure: cfg.measure,
      unit: cfg.unit,
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel: s.title,
    })
    seriesSeen.add(seriesId)
    for (const obs of s.observations) {
      await upsertObservation(seriesId, 'GB', cfg.unit, null, {
        periodType: obs.periodType,
        periodStart: obs.periodStart,
        periodLabel: obs.periodLabel,
        value: obs.value,
        status: null,
      })
      observations++
    }
  }
  return { series: seriesSeen.size, observations }
}

async function refreshOnsBetaWellbeing(): Promise<RefreshResult> {
  const meta = await getLatestVersionMeta('wellbeing-quarterly')
  const res = await fetch(meta.csvDownloadUrl)
  const text = await res.text()
  const rows = parseOnsBetaCsv(text, meta.dimensionNames)
  const seriesSeen = new Set<string>()
  let observations = 0
  for (const row of rows) {
    const time = row.dims.time
    const geo = row.dims.geography
    if (!time || !geo) continue
    const { parseOnsBetaTimeLabel } = await import('./sources/ons-beta')
    const period = parseOnsBetaTimeLabel(time.label) ?? parseOnsBetaTimeLabel(time.code)
    if (!period) continue
    const nonTimeDims = Object.entries(row.dims).filter(([k]) => k !== 'time')
    const sourceSeriesId = nonTimeDims.map(([, v]) => v.code).join('|')
    const seriesLabel = nonTimeDims.map(([, v]) => v.label).join(' / ')
    const geography = geo.code === 'K02000001' ? 'GB' : geo.code
    const seriesId = await upsertSeries({
      datasetId: 'ons-beta-wellbeing-quarterly',
      sourceSeriesId,
      geography,
      measure: 'wellbeing_estimate',
      unit: 'SCORE_0_10',
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel,
    })
    seriesSeen.add(seriesId)
    await upsertObservation(seriesId, geography, 'SCORE_0_10', null, {
      periodType: period.periodType as never,
      periodStart: period.periodStart,
      periodLabel: period.periodLabel,
      value: row.value,
      status: null,
    })
    observations++
  }
  return { series: seriesSeen.size, observations }
}

async function refreshObrPsfDatabank(): Promise<RefreshResult> {
  const { workbook } = await fetchObrWorkbook('public-finances-databank')
  const seriesSeen = new Set<string>()
  let observations = 0
  for (const row of [...parsePsfSince1900(workbook), ...parsePsfAggregatesGbp(workbook)]) {
    const onsCode = 'onsCode' in row ? (row as { onsCode: string | null }).onsCode : null
    const seriesId = await upsertSeries({
      datasetId: 'obr-psf-databank',
      sourceSeriesId: onsCode,
      geography: 'GB',
      measure: row.measure,
      unit: row.unit,
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel: row.measure,
    })
    seriesSeen.add(seriesId)
    await upsertObservation(seriesId, 'GB', row.unit, null, {
      periodType: row.periodType,
      periodStart: row.periodStart,
      periodLabel: row.periodLabel,
      value: row.value,
      status: row.status,
    })
    observations++
  }
  return { series: seriesSeen.size, observations }
}

async function refreshObrHistoricalForecasts(): Promise<RefreshResult> {
  const { workbook } = await fetchObrWorkbook('historical-official-forecasts-database')
  const seriesSeen = new Set<string>()
  let observations = 0
  for (const sheetName of workbook.SheetNames) {
    const measure = sheetName.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
    let rows
    try {
      rows = parseHistoricalForecastSheet(workbook, sheetName, measure, 'UNKNOWN')
    } catch {
      continue
    }
    for (const row of rows) {
      const seriesId = await upsertSeries({
        datasetId: 'obr-historical-forecasts',
        sourceSeriesId: null,
        geography: 'GB',
        measure: row.measure,
        unit: row.unit,
        cofogFunctionCode: null,
        forecastVintage: row.forecastVintage,
        seriesLabel: `${sheetName} (${row.status === 'outturn' ? 'outturn' : row.forecastVintage})`,
      })
      seriesSeen.add(seriesId)
      await upsertObservation(seriesId, 'GB', row.unit, null, {
        periodType: row.periodType,
        periodStart: row.periodStart,
        periodLabel: row.periodLabel,
        value: row.value,
        status: row.status,
      })
      observations++
    }
  }
  return { series: seriesSeen.size, observations }
}

async function refreshPesaCh5(): Promise<RefreshResult> {
  const wb = await fetchPesaWorkbook(PESA_CH5_URL)
  const seriesSeen = new Set<string>()
  let observations = 0
  for (const row of [...parseFunctionTimeSeries(wb), ...parseDeptByFunctionSnapshot(wb)]) {
    const seriesId = await upsertSeries({
      datasetId: 'pesa-ch5-function',
      sourceSeriesId: row.sourceSeriesId,
      geography: 'GB',
      measure: row.measure,
      unit: row.unit,
      cofogFunctionCode: row.cofogFunctionCode,
      forecastVintage: null,
      seriesLabel: row.sourceSeriesId ? `${row.sourceSeriesId} — ${row.cofogFunctionCode ?? 'total'}` : row.measure,
    })
    seriesSeen.add(seriesId)
    await upsertObservation(seriesId, 'GB', row.unit, row.cofogFunctionCode, {
      periodType: 'FINANCIAL_YEAR',
      periodStart: row.periodStart,
      periodLabel: row.periodLabel,
      value: row.value,
      status: 'outturn',
    })
    observations++
  }
  return { series: seriesSeen.size, observations }
}

async function refreshHmrcReceipts(): Promise<RefreshResult> {
  const wb = await fetchHmrcWorkbook(HMRC_RECEIPTS_URL)
  const seriesSeen = new Set<string>()
  let observations = 0
  for (const row of parseReceiptsAnnually(wb)) {
    const seriesId = await upsertSeries({
      datasetId: 'hmrc-receipts',
      sourceSeriesId: null,
      geography: 'GB',
      measure: row.measure,
      unit: row.unit,
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel: row.measure,
    })
    seriesSeen.add(seriesId)
    await upsertObservation(seriesId, 'GB', row.unit, null, {
      periodType: 'FINANCIAL_YEAR',
      periodStart: row.periodStart,
      periodLabel: row.periodLabel,
      value: row.value,
      status: null,
    })
    observations++
  }
  return { series: seriesSeen.size, observations }
}

async function refreshHmrcTaxGap(): Promise<RefreshResult> {
  const wb = await fetchHmrcWorkbook(HMRC_TAXGAP_URL)
  const seriesSeen = new Set<string>()
  let observations = 0
  for (const row of parseTaxGapTable11(wb)) {
    const seriesId = await upsertSeries({
      datasetId: 'hmrc-tax-gap',
      sourceSeriesId: null,
      geography: 'GB',
      measure: row.measure,
      unit: row.unit,
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel: row.measure,
    })
    seriesSeen.add(seriesId)
    await upsertObservation(seriesId, 'GB', row.unit, null, {
      periodType: 'FINANCIAL_YEAR',
      periodStart: row.periodStart,
      periodLabel: row.periodLabel,
      value: row.value,
      status: null,
    })
    observations++
  }
  return { series: seriesSeen.size, observations }
}

export const INGEST_HANDLERS: Record<string, () => Promise<RefreshResult>> = {
  'ons-cdid-headline': refreshOnsCdidHeadline,
  'ons-beta-wellbeing-quarterly': refreshOnsBetaWellbeing,
  'obr-psf-databank': refreshObrPsfDatabank,
  'obr-historical-forecasts': refreshObrHistoricalForecasts,
  'pesa-ch5-function': refreshPesaCh5,
  'hmrc-receipts': refreshHmrcReceipts,
  'hmrc-tax-gap': refreshHmrcTaxGap,
}
