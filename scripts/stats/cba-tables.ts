// cba-tables.ts — BRIEF_INGEST_CBA_1_EXECUTE §3 (decision 329): the Civil Service Statistics and GDP
// deflator-release tables in the STATISTICS store (not corpus_sections: these numbers are called, not
// searched). PESA Chapter 5 is the third table and already lives here as `pesa-ch5-function`; its
// release date and price basis are written by its own handler (ingest-handlers.ts refreshPesaCh5).
//
// Per row, without exception: the publisher's RELEASE DATE, the PRICE BASIS, and suppression as a STATE
// ([c] / [n] go to stat_suppressed_cell with the table's own definition, never to a value).
//
// ⚠ Civil Service Statistics is GROSS MEDIAN SALARY ONLY (no employer NI, pension or paybill). It is
// stored as exactly that. No total employment cost is computed here: an inference must not travel as a
// measurement. Lex applies any on-cost uplift as a stated assumption.
// ⚠ Deflator forecast years publish only the % change (index "-", the sheet's footnote 1). The index is
// stored for OUTTURN years only; no index is derived from the forecast percentages.
//
//   npx tsx --tsconfig ../tsconfig.json cba-tables.ts            dry run: parse, count, print samples
//   npx tsx --tsconfig ../tsconfig.json cba-tables.ts --apply    write datasets, series, cells
//   npx tsx --tsconfig ../tsconfig.json cba-tables.ts --readback re-read from the DB and reconcile
import * as XLSX from 'xlsx'
import { fetchCached, govukRecord, SOURCES } from './cba-probe'
import { getStatsPrisma } from './lib/db'
import { ingestRows, startRefreshLog, finishRefreshLog, upsertSeriesBatch, type IngestRow, type SeriesKey } from './lib/upsert'
import { computeSeriesKey } from './lib/series-key'

const OGL = 'Open Government Licence v3.0'
const OGL_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'

// ── Civil Service Statistics 2026 ─────────────────────────────────────────────────────────────────────
export const CSS_DATASET = 'css-2026'
const CSS_TABLES = ['table_7', 'table_20', 'table_21', 'table_25'] as const
// gov.uk first_published_at 2026-07-29 09:30 BST. The file read is V2 (28 Oct 2026), whose ONLY revisions
// (its Full_revisions_list sheet) are seven cells of table_E12; the four tables above are as released on 29 Jul.
const CSS_RELEASE = new Date('2026-07-29T00:00:00Z')
const CSS_EDITION = 'Civil Service Statistics 2026, statistical tables V2 (28 Oct 2026; tables 7/20/21/25 unrevised since 29 Jul 2026)'
const CSS_PERIOD = { periodType: 'ANNUAL' as const, periodStart: new Date('2026-03-31T00:00:00Z'), periodLabel: 'as at 31 March 2026' }

// ── GDP deflator releases ─────────────────────────────────────────────────────────────────────────────
export const DEFL_DATASET = 'hmt-gdp-deflators'
const DEFL_RELEASES = [
  // June 2026 QNA: the release DeflatorSeries (main DB) was loaded from on 4 Jul 2026 by m3-deflators.ts.
  { vintage: 'June 2026 (Quarterly National Accounts)', src: SOURCES.deflJun },
  { vintage: 'October 2026 (Budget)', src: SOURCES.deflOct },
] as const

type Cell = { kind: 'value'; value: number } | { kind: 'suppressed'; marker: 'c' | 'n'; markerText: string }
type Parsed = { series: SeriesKey; period: typeof CSS_PERIOD; status: string; releaseDate: Date; priceBasis: string; cell: Cell }

function rowsOf(wb: XLSX.WorkBook, name: string): unknown[][] {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`sheet ${name} missing`)
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false })
}
const str = (v: unknown) => (v == null ? '' : String(v).trim())

function cssUnit(header: string): { unit: string; measure: string; basis: string } {
  const at = 'as at 31 March 2026'
  if (/^(Overall )?Median salary/i.test(header))
    return { unit: 'GBP', measure: 'median_salary', basis: `cash (£), gross median annual salary ${at}; salary only, no employer National Insurance, pension or other on-costs` }
  if (/^(Total )?Headcount/i.test(header)) return { unit: 'HEADCOUNT', measure: 'headcount', basis: `not monetary: headcount ${at}` }
  if (/^(Total )?Full-time equivalent/i.test(header)) return { unit: 'FTE', measure: 'fte', basis: `not monetary: full-time equivalent ${at}` }
  // Table 7's last three columns. Stored as the publisher's fraction (0.022 = 2.2%), not rescaled.
  if (/^Percentage difference in median salaries of male and female/i.test(header))
    return { unit: 'RATIO', measure: 'median_salary_sex_difference', basis: `not monetary: fraction (0.022 = 2.2%), difference between male and female median salaries ${at}` }
  throw new Error(`unclassified Civil Service Statistics column: "${header}"`)
}

export async function parseCss(): Promise<Parsed[]> {
  const wb = XLSX.read(await fetchCached(SOURCES.css.url, SOURCES.css.file), { type: 'buffer' })
  const out: Parsed[] = []
  for (const t of CSS_TABLES) {
    const rows = rowsOf(wb, t)
    const title = str(rows.find((r) => /^Table \d+:/.test(str(r?.[0])))?.[0])
    const markers = new Map<string, string>()
    for (const r of rows) {
      const m = str(r?.[0]).match(/Shorthand is used in this table, \[(c|n)\] = (.*)$/)
      if (m) markers.set(m[1], `[${m[1]}] = ${m[2]}`)
    }
    const h = rows.findIndex((r) => /^(Responsibility Level|Civil Service parent department)$/i.test(str(r?.[0])))
    if (h < 0) throw new Error(`${t}: header row not found`)
    const header = rows[h].map(str)
    const labelCols = /parent department/i.test(header[0]) ? 2 : 1
    const seen = new Set<string>()
    for (const r of rows.slice(h + 1)) {
      const labels = header.slice(0, labelCols).map((_, i) => str(r?.[i]))
      if (!labels[0]) continue
      for (let c = labelCols; c < header.length; c++) {
        if (!header[c]) continue
        const raw = r?.[c]
        if (raw == null || str(raw) === '') throw new Error(`${t} ${labels.join(' / ')} col ${c}: empty cell (neither a value nor a marker)`)
        let cell: Cell
        if (typeof raw === 'number' && isFinite(raw)) cell = { kind: 'value', value: raw }
        else {
          const m = str(raw).match(/^\[(c|n)\]$/)
          if (!m) throw new Error(`${t} ${labels.join(' / ')} col ${c}: unparsed cell "${str(raw)}"`)
          const text = markers.get(m[1])
          if (!text) throw new Error(`${t}: marker [${m[1]}] used but the sheet does not define it`)
          cell = { kind: 'suppressed', marker: m[1] as 'c' | 'n', markerText: text }
        }
        const u = cssUnit(header[c])
        const rowLabel = labels.filter(Boolean).join(' › ')
        const id = `${t}|${rowLabel}|${header[c]}`
        if (seen.has(id)) throw new Error(`duplicate cell identity ${id}`)
        seen.add(id)
        out.push({
          series: {
            datasetId: CSS_DATASET, sourceSeriesId: id, geography: 'GB', measure: u.measure, unit: u.unit,
            cofogFunctionCode: null, forecastVintage: null, seriesLabel: `${title.replace(/ \[note.*$/, '')} — ${rowLabel} — ${header[c]}`,
          },
          period: CSS_PERIOD, status: 'outturn', releaseDate: CSS_RELEASE, priceBasis: u.basis, cell,
        })
      }
    }
  }
  return out
}

export async function parseDeflators(): Promise<Parsed[]> {
  const out: Parsed[] = []
  for (const rel of DEFL_RELEASES) {
    const rec = await govukRecord(rel.src.page)
    if (!rec.attachments?.some((a: any) => a.url === rel.src.url)) throw new Error(`${rel.vintage}: gov.uk page does not own ${rel.src.url}`)
    const releaseDate = new Date(String(rec.first_public_at).slice(0, 10) + 'T00:00:00Z')
    const wb = XLSX.read(await fetchCached(rel.src.url, rel.src.file), { type: 'buffer' })
    const rows = rowsOf(wb, wb.SheetNames[0])
    const hdr = rows.find((r) => str(r?.[1]) === 'Financial year' && /= 100$/.test(str(r?.[2])))
    if (!hdr) throw new Error(`${rel.vintage}: base-year header not found`)
    const fyBase = str(hdr[2]), cyBase = str(hdr[8])
    if (!/= 100$/.test(cyBase)) throw new Error(`${rel.vintage}: calendar base not found (got "${cyBase}")`)
    const add = (fy: boolean, label: string, idx: unknown, pct: unknown) => {
      const m = label.match(fy ? /^(\d{4})-(\d{2})( \(1\).*)?$/ : /^(\d{4})( \(1\).*)?$/)
      if (!m) return
      const forecast = Boolean(fy ? m[3] : m[2])
      const y = +m[1]
      const period = fy
        ? { periodType: 'FINANCIAL_YEAR' as const, periodStart: new Date(Date.UTC(y, 3, 1)), periodLabel: `${m[1]}-${m[2]}` }
        : { periodType: 'ANNUAL' as const, periodStart: new Date(Date.UTC(y, 0, 1)), periodLabel: m[1] }
      const status = forecast ? 'forecast' : 'outturn'
      const base = fy ? fyBase : cyBase
      const series = (measure: string, unit: string, lab: string): SeriesKey => ({
        datasetId: DEFL_DATASET, sourceSeriesId: `${measure}:${fy ? 'FY' : 'CY'}`, geography: 'GB', measure, unit,
        cofogFunctionCode: null, forecastVintage: rel.vintage, seriesLabel: `GDP deflator at market prices — ${lab} — ${fy ? 'financial' : 'calendar'} year — ${rel.vintage}`,
      })
      if (typeof idx === 'number') {
        if (forecast) throw new Error(`${rel.vintage} ${label}: an index in a forecast row; the presentation changed`)
        out.push({ series: series('gdp_deflator_index', 'INDEX', base), period: period as any, status, releaseDate, priceBasis: `index, ${base}`, cell: { kind: 'value', value: idx } })
      } else if (!forecast || str(idx) !== '-') throw new Error(`${rel.vintage} ${label}: index cell "${str(idx)}" unexpected`)
      if (typeof pct === 'number') out.push({ series: series('gdp_deflator_pct_change', 'PERCENT', 'per cent change on previous year'), period: period as any, status, releaseDate, priceBasis: 'not monetary: per cent change on previous year', cell: { kind: 'value', value: pct } })
      else if (str(pct) !== '') throw new Error(`${rel.vintage} ${label}: pct cell "${str(pct)}" unexpected`)
    }
    for (const r of rows) {
      add(true, str(r?.[1]), r?.[2], r?.[3])
      add(false, str(r?.[7]), r?.[8], r?.[9])
    }
  }
  return out
}

const DATASETS = [
  {
    id: CSS_DATASET, source: 'CABINET_OFFICE' as const, title: 'Civil Service Statistics 2026 — median salary, headcount and FTE by responsibility level',
    description: 'Tables 7 (median salary by responsibility level and sex), 20 (headcount) and 21 (FTE) by department, 25 (median salary by responsibility level and department), as at 31 March 2026. Gross median salary only: no employer NI, pension or paybill.',
    cofogRelevant: false, licence: OGL, licenceUrl: OGL_URL, refreshCadence: 'STATIC' as const,
    sourceUrl: 'https://www.gov.uk/government/statistics/civil-service-statistics-2026', sourceEditionOrVersion: CSS_EDITION,
  },
  {
    id: DEFL_DATASET, source: 'HMT' as const, title: 'HM Treasury GDP deflators at market prices — per release',
    description: 'Each HMT release is its own vintage (forecastVintage). Index for outturn years; per cent change for outturn and OBR forecast years, as published. Release date per row.',
    cofogRelevant: false, licence: OGL, licenceUrl: OGL_URL, refreshCadence: 'STATIC' as const,
    sourceUrl: 'https://www.gov.uk/government/collections/gdp-deflators-at-market-prices-and-money-gdp', sourceEditionOrVersion: DEFL_RELEASES.map((r) => r.vintage).join('; '),
  },
]

async function apply(datasetId: string, parsed: Parsed[]) {
  const prisma = getStatsPrisma()
  const d = DATASETS.find((x) => x.id === datasetId)!
  await prisma.statDataset.upsert({ where: { id: d.id }, create: { ...d, licenceVerifiedAt: new Date() }, update: { ...d, licenceVerifiedAt: new Date() } })
  const log = await startRefreshLog(datasetId)
  try {
    const values = parsed.filter((p) => p.cell.kind === 'value')
    const sup = parsed.filter((p) => p.cell.kind === 'suppressed')
    const rows: IngestRow[] = values.map((p) => ({
      series: p.series,
      obs: { ...p.period, value: (p.cell as any).value, status: p.status, releaseDate: p.releaseDate, priceBasis: p.priceBasis },
    }))
    const r = await ingestRows(rows)
    const ids = await upsertSeriesBatch(sup.map((p) => p.series))
    for (const p of sup) {
      const c = p.cell as Extract<Cell, { kind: 'suppressed' }>
      const seriesId = ids.get(computeSeriesKey(p.series))!
      await prisma.statSuppressedCell.upsert({
        where: { seriesId_periodType_periodStart: { seriesId, periodType: p.period.periodType, periodStart: p.period.periodStart } },
        create: { seriesId, ...p.period, marker: c.marker, markerText: c.markerText, releaseDate: p.releaseDate, priceBasis: p.priceBasis },
        update: { marker: c.marker, markerText: c.markerText, releaseDate: p.releaseDate, priceBasis: p.priceBasis, periodLabel: p.period.periodLabel },
      })
    }
    await finishRefreshLog(log, datasetId, 'SUCCESS', { seriesUpserted: r.series + ids.size, observationsUpserted: r.observations + sup.length })
    console.log(`  applied ${datasetId}: ${values.length} observations, ${sup.length} suppressed cells`)
  } catch (e: any) {
    await finishRefreshLog(log, datasetId, 'FAILURE', { seriesUpserted: 0, observationsUpserted: 0 }, String(e?.message ?? e))
    throw e
  }
}

function summary(name: string, parsed: Parsed[]) {
  const v = parsed.filter((p) => p.cell.kind === 'value').length
  const byMarker: Record<string, number> = {}
  for (const p of parsed) if (p.cell.kind === 'suppressed') byMarker[p.cell.marker] = (byMarker[p.cell.marker] ?? 0) + 1
  const series = new Set(parsed.map((p) => computeSeriesKey(p.series))).size
  const basis = [...new Set(parsed.map((p) => p.priceBasis))]
  const rel = [...new Set(parsed.map((p) => p.releaseDate.toISOString().slice(0, 10)))]
  console.log(`\n== ${name}: ${parsed.length} cells → ${v} values, suppressed ${JSON.stringify(byMarker)}, ${series} series`)
  console.log(`   release dates: ${rel.join(', ')}`)
  for (const b of basis) console.log(`   basis: ${b}`)
  return { cells: parsed.length, values: v, suppressed: byMarker, series }
}

async function readback(datasetId: string, expected: ReturnType<typeof summary>) {
  const prisma = getStatsPrisma()
  const [o] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int n, count(*) FILTER (WHERE o."releaseDate" IS NULL OR o."priceBasis" IS NULL)::int missing,
            count(DISTINCT o."seriesId")::int s
       FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId" WHERE s."datasetId" = $1`, datasetId)
  const sup = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.marker, count(*)::int n FROM stat_suppressed_cell c JOIN stat_series s ON s.id = c."seriesId" WHERE s."datasetId" = $1 GROUP BY 1 ORDER BY 1`, datasetId)
  const [overlap] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int n FROM stat_suppressed_cell c JOIN stat_observation o
        ON o."seriesId" = c."seriesId" AND o."periodType" = c."periodType" AND o."periodStart" = c."periodStart"
       JOIN stat_series s ON s.id = c."seriesId" WHERE s."datasetId" = $1`, datasetId)
  const [series] = await prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int n FROM stat_series WHERE "datasetId" = $1`, datasetId)
  const supObj = Object.fromEntries(sup.map((r) => [r.marker, r.n]))
  const ok = o.n === expected.values && o.missing === 0 && overlap.n === 0 && series.n === expected.series && JSON.stringify(supObj) === JSON.stringify(expected.suppressed)
  console.log(`  READ BACK ${datasetId}: observations ${o.n} (parsed ${expected.values}); missing release/basis ${o.missing}; suppressed ${JSON.stringify(supObj)} (parsed ${JSON.stringify(expected.suppressed)}); value∩suppressed ${overlap.n}; series ${series.n} (parsed ${expected.series}) → ${ok ? 'AGREE' : 'DISAGREE'}`)
  return ok
}

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--readback') ? 'readback' : 'dry'
  const css = await parseCss()
  const defl = await parseDeflators()
  const sc = summary(CSS_DATASET, css)
  const sd = summary(DEFL_DATASET, defl)
  const sample = (p: Parsed) => `${p.series.seriesLabel} @ ${p.period.periodLabel} [${p.status}] = ${p.cell.kind === 'value' ? p.cell.value : '[' + p.cell.marker + ']'}`
  console.log('\n   CSS samples:'); for (const i of [0, 9, css.length - 1]) console.log('    ' + sample(css[i]))
  const firstSup = css.find((p) => p.cell.kind === 'suppressed'); if (firstSup) console.log('    ' + sample(firstSup) + ' — ' + (firstSup.cell as any).markerText)
  console.log('   deflator samples:'); for (const p of defl.filter((p) => /2025-26|2026-27|^2031/.test(p.period.periodLabel))) console.log('    ' + sample(p))
  if (mode === 'apply') { await apply(CSS_DATASET, css); await apply(DEFL_DATASET, defl) }
  if (mode !== 'dry') {
    const a = await readback(CSS_DATASET, sc), b = await readback(DEFL_DATASET, sd)
    if (!(a && b)) process.exitCode = 1
  }
  await getStatsPrisma().$disconnect()
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
