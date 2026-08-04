// The write path for each seeded StatDataset — fetch (via the source modules
// proven in measure-pilot.ts) + upsert series/observations. One handler per
// dataset id in seed-catalogue.ts. refresh-scheduler.ts dispatches to these.
//
// SHAPE OF EVERY HANDLER: build the full `IngestRow[]` the source produced, then hand it to
// `ingestRows()` once. Handlers used to await one round trip per series and one per
// observation, which measured ~10 series/minute against pooled Neon — 3.5 hours for OBR's
// historical forecasts alone, and it would have made IMF's 65,985 rows an overnight job.
// `ingestRows` issues one statement per ~500 rows against the same conflict targets, so it is
// exactly as idempotent and roughly two orders of magnitude faster. Keep new handlers on it.
import { ingestRows, ensureCofogFunction, type IngestRow } from './lib/upsert'
import { CDID_SERIES, fetchCdidSeries } from './sources/ons-cdid'
import { getLatestVersionMeta, parseOnsBetaCsv, parseOnsBetaTimeLabel } from './sources/ons-beta'
import { fetchObrWorkbook, parsePsfSince1900, parsePsfAggregatesGbp, parseHistoricalForecastSheet, resolveHistoricalForecastUnit } from './sources/obr'
import { fetchPesaWorkbook, parseFunctionTimeSeries, parseDeptByFunctionSnapshot } from './sources/pesa'
import { fetchHmrcWorkbook, parseReceiptsAnnually, parseTaxGapTable11 } from './sources/hmrc'
import { WB_INDICATORS, fetchIndicator } from './sources/world-bank'
import { fetchOecdCofog, OECD_UNIT_MAP } from './sources/oecd'
import { fetchImfGfsCofog, IMF_UNIT_MAP, IMF_COMMERCIAL_USE_EXCLUDED } from './sources/imf'
import { geographyLabel } from './lib/iso'

export interface RefreshResult {
  series: number
  observations: number
}

/**
 * A stable per-series id for sources that issue none of their own.
 *
 * `sourceSeriesId` was NULL on 2,925 of 3,404 series, which is what made the natural key
 * non-unique and forced `seriesLabel` into the identity hash. Where the source publishes a
 * code (ONS CDID, OBR's "ONS code" column, a PESA department name) that code is used
 * unchanged; where it publishes none, this derives one from the parts of the source's own
 * structure that identify the line — sheet name, forecast round, COFOG code, tax name.
 *
 * The `derived:` prefix is not decoration. It keeps a slug we invented visibly distinct from
 * a code the publisher issued, so nobody later cites one back to the source as if it were
 * theirs. Derived ids are built only from values that are already part of the series
 * identity, so they are stable across re-ingests by construction.
 */
function derivedSourceId(...parts: Array<string | null | undefined>): string {
  return 'derived:' + parts.map((p) => (p ?? '').trim() || '-').join('|')
}

const PESA_CH5_URL = 'https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx'
const HMRC_RECEIPTS_URL = 'https://assets.publishing.service.gov.uk/media/6a571e539e63154454413697/NS_Table.ods'
const HMRC_TAXGAP_URL = 'https://assets.publishing.service.gov.uk/media/6a314f53141f0690ad5fa41e/Measuring_tax_gap_online_tables_2026.xlsx'

async function refreshOnsCdidHeadline(): Promise<RefreshResult> {
  const rows: IngestRow[] = []
  for (const cfg of CDID_SERIES) {
    const s = await fetchCdidSeries(cfg)
    const series = {
      datasetId: 'ons-cdid-headline',
      sourceSeriesId: s.cdid,
      geography: 'GB',
      measure: cfg.measure,
      unit: cfg.unit,
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel: s.title,
    }
    for (const obs of s.observations) {
      rows.push({
        series,
        obs: { periodType: obs.periodType, periodStart: obs.periodStart, periodLabel: obs.periodLabel, value: obs.value, status: null },
      })
    }
  }
  return ingestRows(rows)
}

async function refreshOnsBetaWellbeing(): Promise<RefreshResult> {
  const meta = await getLatestVersionMeta('wellbeing-quarterly')
  const res = await fetch(meta.csvDownloadUrl)
  const text = await res.text()
  const parsed = parseOnsBetaCsv(text, meta.dimensionNames)
  const rows: IngestRow[] = []
  for (const row of parsed) {
    const time = row.dims.time
    const geo = row.dims.geography
    if (!time || !geo) continue
    const period = parseOnsBetaTimeLabel(time.label) ?? parseOnsBetaTimeLabel(time.code)
    if (!period) continue
    const nonTimeDims = Object.entries(row.dims).filter(([k]) => k !== 'time')
    const sourceSeriesId = nonTimeDims.map(([, v]) => v.code).join('|')
    const seriesLabel = nonTimeDims.map(([, v]) => v.label).join(' / ')
    const geography = geo.code === 'K02000001' ? 'GB' : geo.code
    // Not every row on this dataset is a 0–10 score: the `estimate` dimension carries
    // both the mean rating (average-mean, a 0–10 score) and the share of respondents in
    // each band (very-good/good/fair/poor — percentages, e.g. 16.30). Labelling those
    // SCORE_0_10 would be wrong data, so the unit is derived per row.
    const unit = row.dims.estimate?.code === 'average-mean' ? 'SCORE_0_10' : 'PERCENT'
    rows.push({
      series: {
        datasetId: 'ons-beta-wellbeing-quarterly',
        sourceSeriesId,
        geography,
        measure: 'wellbeing_estimate',
        unit,
        cofogFunctionCode: null,
        forecastVintage: null,
        seriesLabel,
      },
      obs: {
        periodType: period.periodType as never,
        periodStart: period.periodStart,
        periodLabel: period.periodLabel,
        value: row.value,
        status: null,
      },
    })
  }
  return ingestRows(rows)
}

async function refreshObrPsfDatabank(): Promise<RefreshResult> {
  const { workbook } = await fetchObrWorkbook('public-finances-databank')
  // The two sheets are tagged so a derived id can name which one a series came from — the
  // "since 1900" sheet publishes no ONS code, the "Aggregates (£bn)" sheet does.
  const tagged = [
    ...parsePsfSince1900(workbook).map((r) => ({ row: r, sheet: 'since-1900' as const })),
    ...parsePsfAggregatesGbp(workbook).map((r) => ({ row: r, sheet: 'aggregates-gbp' as const })),
  ]
  const rows: IngestRow[] = tagged.map(({ row, sheet }) => {
    const onsCode = 'onsCode' in row ? (row as { onsCode: string | null }).onsCode : null
    return {
      series: {
        datasetId: 'obr-psf-databank',
        sourceSeriesId: onsCode ?? derivedSourceId(sheet, row.measure),
        geography: 'GB',
        measure: row.measure,
        unit: row.unit,
        cofogFunctionCode: null,
        forecastVintage: null,
        seriesLabel: row.measure,
      },
      obs: {
        periodType: row.periodType,
        periodStart: row.periodStart,
        periodLabel: row.periodLabel,
        value: row.value,
        status: row.status,
      },
    }
  })
  return ingestRows(rows)
}

async function refreshObrHistoricalForecasts(): Promise<RefreshResult> {
  const { workbook } = await fetchObrWorkbook('historical-official-forecasts-database')
  const rows: IngestRow[] = []
  for (const sheetName of workbook.SheetNames) {
    const measure = sheetName.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
    // The unit is stated by the sheet itself (A2, or a parenthesised title) — read it rather
    // than hardcoding 'UNKNOWN', which had made all 2,807 of these series unquotable and so
    // invisible to catalogue search. See resolveHistoricalForecastUnit for what stays UNKNOWN.
    const unit = resolveHistoricalForecastUnit(workbook, sheetName)
    let parsed
    try {
      parsed = parseHistoricalForecastSheet(workbook, sheetName, measure, unit)
    } catch {
      continue
    }
    for (const row of parsed) {
      rows.push({
        series: {
          datasetId: 'obr-historical-forecasts',
          // OBR publishes no per-vintage code; sheet + forecast round identifies the line.
          sourceSeriesId: derivedSourceId(sheetName, row.forecastVintage ?? 'outturn'),
          geography: 'GB',
          measure: row.measure,
          unit: row.unit,
          cofogFunctionCode: null,
          forecastVintage: row.forecastVintage,
          seriesLabel: `${sheetName} (${row.status === 'outturn' ? 'outturn' : row.forecastVintage})`,
        },
        obs: {
          periodType: row.periodType,
          periodStart: row.periodStart,
          periodLabel: row.periodLabel,
          value: row.value,
          status: row.status,
        },
      })
    }
  }
  return ingestRows(rows)
}

async function refreshPesaCh5(): Promise<RefreshResult> {
  const wb = await fetchPesaWorkbook(PESA_CH5_URL)
  const parsed = [...parseFunctionTimeSeries(wb), ...parseDeptByFunctionSnapshot(wb)]
  // stat_series.cofogFunctionCode is a real FK — the sub-function codes PESA reports against
  // are not in seed-catalogue.ts's top-level-only seed, so create them before the series
  // reference them. Done once per distinct code rather than once per row.
  const cofogNames = new Map<string, string | null>()
  for (const row of parsed) if (row.cofogFunctionCode) cofogNames.set(row.cofogFunctionCode, row.cofogFunctionName)
  for (const [code, name] of cofogNames) await ensureCofogFunction(code, name)

  const rows: IngestRow[] = parsed.map((row) => ({
    series: {
      datasetId: 'pesa-ch5-function',
      // Numbered COFOG rows carry no separate row code — the function code is the identity.
      sourceSeriesId: row.sourceSeriesId ?? derivedSourceId(row.measure, row.cofogFunctionCode ?? 'total'),
      geography: 'GB',
      measure: row.measure,
      unit: row.unit,
      cofogFunctionCode: row.cofogFunctionCode,
      forecastVintage: null,
      seriesLabel: row.sourceSeriesId ? `${row.sourceSeriesId} — ${row.cofogFunctionCode ?? 'total'}` : row.measure,
    },
    obs: {
      periodType: 'FINANCIAL_YEAR' as const,
      periodStart: row.periodStart,
      periodLabel: row.periodLabel,
      value: row.value,
      status: 'outturn',
    },
  }))
  return ingestRows(rows)
}

async function refreshHmrcReceipts(): Promise<RefreshResult> {
  const wb = await fetchHmrcWorkbook(HMRC_RECEIPTS_URL)
  const rows: IngestRow[] = parseReceiptsAnnually(wb).map((row) => ({
    series: {
      datasetId: 'hmrc-receipts',
      // HMRC's NS_Table publishes no per-tax code; the tax name (already slugified into
      // `measure`) is what identifies the line.
      sourceSeriesId: derivedSourceId(row.measure),
      geography: 'GB',
      measure: row.measure,
      unit: row.unit,
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel: row.measure,
    },
    obs: {
      periodType: 'FINANCIAL_YEAR' as const,
      periodStart: row.periodStart,
      periodLabel: row.periodLabel,
      value: row.value,
      status: null,
    },
  }))
  return ingestRows(rows)
}

async function refreshHmrcTaxGap(): Promise<RefreshResult> {
  const wb = await fetchHmrcWorkbook(HMRC_TAXGAP_URL)
  const rows: IngestRow[] = parseTaxGapTable11(wb).map((row) => ({
    series: {
      datasetId: 'hmrc-tax-gap',
      sourceSeriesId: row.sourceSeriesId ?? null,
      geography: 'GB',
      measure: row.measure,
      unit: row.unit,
      cofogFunctionCode: null,
      forecastVintage: null,
      seriesLabel: row.seriesLabel ?? row.measure,
    },
    obs: {
      periodType: 'FINANCIAL_YEAR' as const,
      periodStart: row.periodStart,
      periodLabel: row.periodLabel,
      value: row.value,
      status: null,
    },
  }))
  return ingestRows(rows)
}

// ---- Phase B — comparative / international ---------------------------------

async function refreshWorldBankWdi(): Promise<RefreshResult> {
  const rows: IngestRow[] = []
  for (const ind of WB_INDICATORS) {
    for (const row of await fetchIndicator(ind.code)) {
      rows.push({
        series: {
          datasetId: 'wb-wdi-comparative',
          sourceSeriesId: `${ind.code}|${row.geography}`,
          geography: row.geography,
          measure: ind.measure,
          unit: ind.unit,
          cofogFunctionCode: null,
          forecastVintage: null,
          seriesLabel: `${geographyLabel(row.geography)} — ${ind.label}`,
        },
        obs: {
          periodType: 'ANNUAL' as const,
          periodStart: new Date(Date.UTC(row.year, 0, 1)),
          periodLabel: String(row.year),
          value: row.value,
          status: 'outturn',
        },
      })
    }
  }
  return ingestRows(rows)
}

async function refreshOecdCofog(): Promise<RefreshResult> {
  // Government at a Glance COFOG coverage starts ~2007; take the full published window.
  const parsed = await fetchOecdCofog(2007, new Date().getUTCFullYear())
  const rows: IngestRow[] = []
  const cofogNames = new Map<string, string | null>()
  for (const row of parsed) {
    const unit = OECD_UNIT_MAP[row.unit]
    if (!unit) continue // unmapped unit — skipped deliberately, never guessed
    if (!row.cofogCode) continue
    cofogNames.set(row.cofogCode, row.cofogName)
    rows.push({
      series: {
        datasetId: 'oecd-cofog-expenditure',
        sourceSeriesId: `${row.geography}|${row.cofogCode}|${unit}`,
        geography: row.geography,
        measure: 'govt_expenditure_by_function',
        unit,
        cofogFunctionCode: row.cofogCode,
        forecastVintage: null,
        seriesLabel: `${geographyLabel(row.geography)} — ${row.cofogName ?? row.cofogCode} (${unit})`,
      },
      obs: {
        periodType: 'ANNUAL' as const,
        periodStart: new Date(Date.UTC(row.year, 0, 1)),
        periodLabel: String(row.year),
        value: row.value,
        status: 'outturn',
      },
    })
  }
  // Same FK requirement as PESA: sub-function codes must exist before a series references them.
  for (const [code, name] of cofogNames) await ensureCofogFunction(code, name)
  return ingestRows(rows)
}

async function refreshImfGfsCofog(): Promise<RefreshResult> {
  const parsed = await fetchImfGfsCofog()
  const rows: IngestRow[] = []
  const cofogNames = new Map<string, string | null>()
  for (const row of parsed) {
    const unit = IMF_UNIT_MAP[row.typeOfTransformation]
    if (!unit) continue // unmapped transformation — skipped deliberately, never guessed
    if (!row.cofogCode) continue
    cofogNames.set(row.cofogCode, row.cofogName)
    rows.push({
      series: {
        datasetId: 'imf-gfs-cofog',
        // IMF publishes a real series key: the SDMX dimension tuple. Kept verbatim.
        sourceSeriesId: `${row.geography}|${row.sector}|${row.indicator}|${row.typeOfTransformation}`,
        geography: row.geography,
        measure: 'govt_expenditure_by_function',
        unit,
        cofogFunctionCode: row.cofogCode,
        forecastVintage: null,
        seriesLabel: `${geographyLabel(row.geography)} — ${row.cofogName ?? row.cofogCode} (${unit})`,
        // NOT inherited from the dataset by accident — stated per series so it survives any
        // future dataset-level edit. IMF's terms permit publication and redistribution but
        // require written permission for COMMERCIAL reuse (verified at source, 4 Aug 2026).
        commercialUseExcluded: IMF_COMMERCIAL_USE_EXCLUDED,
      },
      obs: {
        periodType: 'ANNUAL' as const,
        periodStart: new Date(Date.UTC(row.year, 0, 1)),
        periodLabel: String(row.year),
        value: row.value,
        status: 'outturn',
      },
    })
  }
  for (const [code, name] of cofogNames) await ensureCofogFunction(code, name)
  return ingestRows(rows)
}

export const INGEST_HANDLERS: Record<string, () => Promise<RefreshResult>> = {
  'ons-cdid-headline': refreshOnsCdidHeadline,
  'ons-beta-wellbeing-quarterly': refreshOnsBetaWellbeing,
  'obr-psf-databank': refreshObrPsfDatabank,
  'obr-historical-forecasts': refreshObrHistoricalForecasts,
  'pesa-ch5-function': refreshPesaCh5,
  'hmrc-receipts': refreshHmrcReceipts,
  'hmrc-tax-gap': refreshHmrcTaxGap,
  // Phase B
  'wb-wdi-comparative': refreshWorldBankWdi,
  'oecd-cofog-expenditure': refreshOecdCofog,
  'imf-gfs-cofog': refreshImfGfsCofog,
}
