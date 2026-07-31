// OBR — obr.uk/data/ gates its spreadsheet downloads behind a WordPress
// Download-Monitor nonce (`?tmstv=...`) that is only valid when followed with the
// cookies + Referer from the SAME fresh load of /data/ (confirmed live, 30 Jul
// 2026: a bare/no-cookie request 302s to /no-access/, a stale/no-referer token
// 403s). The final Location header lands on a static, ungated
// obr.uk/docs/dlm_uploads/*.xlsx URL that can be cached/re-fetched freely.
import * as XLSX from 'xlsx'
import { politeFetch, sleep } from '../lib/fetch-utils'
import { parseFinancialYear } from '../lib/period'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Scrutinise/1.0'
const DATA_PAGE = 'https://obr.uk/data/'

interface CookieJar {
  header: string
}

function parseSetCookies(res: Response): string[] {
  // undici/fetch exposes multiple Set-Cookie headers via getSetCookie() when available.
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] }
  if (typeof anyHeaders.getSetCookie === 'function') return anyHeaders.getSetCookie()
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

/** Fetch /data/, return its HTML plus a cookie header string for the follow-up request. */
async function loadDataPage(): Promise<{ html: string; jar: CookieJar }> {
  const res = await fetch(DATA_PAGE, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`OBR /data/ fetch failed: HTTP ${res.status}`)
  const cookies = parseSetCookies(res)
  const jar: CookieJar = { header: cookies.map((c) => c.split(';')[0]).join('; ') }
  const html = await res.text()
  return { html, jar }
}

/**
 * Resolve a download-page slug (the obr.uk/download/<slug>/ link text on /data/) to
 * the final static .xlsx/.zip URL. `slugPrefix` matches the start of the slug so
 * callers don't have to know the exact dated suffix (e.g. "public-finances-databank").
 */
export async function resolveObrDownloadUrl(slugPrefix: string): Promise<string> {
  const { html, jar } = await loadDataPage()
  const re = new RegExp(`href="(https://obr\\.uk/download/${slugPrefix}[^"]*)"`)
  const m = html.match(re)
  if (!m) throw new Error(`OBR /data/ page has no download link matching "${slugPrefix}"`)
  const tokenUrl = m[1]
  const res = await fetch(tokenUrl, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, Referer: DATA_PAGE, Cookie: jar.header },
  })
  if (!res.ok) throw new Error(`OBR download resolve failed for ${slugPrefix}: HTTP ${res.status} (final URL ${res.url})`)
  if (!/\.(xlsx|xls|zip)$/i.test(res.url)) {
    throw new Error(`OBR download for ${slugPrefix} did not land on a spreadsheet — got ${res.url} (likely /no-access/)`)
  }
  return res.url
}

export async function fetchObrWorkbook(slugPrefix: string): Promise<{ url: string; workbook: XLSX.WorkBook }> {
  const url = await resolveObrDownloadUrl(slugPrefix)
  await sleep(500)
  const res = await politeFetch(url, { delayMs: 500 })
  if (!res.ok) throw new Error(`OBR workbook download failed for ${url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  const workbook = XLSX.read(buf, { type: 'array' })
  return { url, workbook }
}

// ---- Parsers ---------------------------------------------------------------

export interface ObrObservation {
  measure: string
  unit: string
  periodLabel: string
  periodStart: Date
  periodType: 'ANNUAL' | 'FINANCIAL_YEAR'
  value: number
  status: 'outturn' | 'forecast'
  forecastVintage: string | null
}

/**
 * Public Finances Databank, sheet "Public finances since 1900": header at row 4
 * (col0 null, "Years", then 4 named series), data rows are financial years back
 * to 1900-01, values already % of GDP, no vintage (this sheet is the single
 * current-view time series, not a vintage-by-vintage forecast round table).
 */
export function parsePsfSince1900(workbook: XLSX.WorkBook): ObrObservation[] {
  const ws = workbook.Sheets['Public finances since 1900']
  if (!ws) throw new Error('Sheet "Public finances since 1900" not found in PSF databank workbook')
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const headerRow = rows.findIndex((r) => typeof r[1] === 'string' && /years/i.test(String(r[1])))
  if (headerRow === -1) throw new Error('Header row not found in "Public finances since 1900"')
  const measureNames = (rows[headerRow].slice(2) as string[]).map((s) => s.replace(/\r?\n/g, ' ').trim())
  const out: ObrObservation[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    const fyLabel = row[1]
    if (typeof fyLabel !== 'string') continue
    const period = parseFinancialYear(fyLabel)
    if (!period) continue
    for (let c = 0; c < measureNames.length; c++) {
      const raw = row[2 + c]
      if (typeof raw !== 'number') continue
      out.push({
        measure: slugifyMeasure(measureNames[c]),
        unit: 'PERCENT_GDP',
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        periodType: 'FINANCIAL_YEAR',
        value: raw,
        status: 'outturn',
        forecastVintage: null,
      })
    }
  }
  return out
}

/**
 * Public Finances Databank, sheet "Aggregates (£bn)": 3-row merged header block
 * (group / series name / ONS CDID code), data rows are financial years from
 * 1946-47. Returns per-column series with their ONS code for provenance.
 */
export function parsePsfAggregatesGbp(workbook: XLSX.WorkBook): Array<ObrObservation & { onsCode: string | null }> {
  const ws = workbook.Sheets['Aggregates (£bn)']
  if (!ws) throw new Error('Sheet "Aggregates (£bn)" not found in PSF databank workbook')
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const nameRow = rows.findIndex((r) => typeof r[2] === 'string' && !/ons code/i.test(String(r[1] ?? '')))
  const seriesNameRowIdx = 2
  const onsCodeRowIdx = 3
  const seriesNames = rows[seriesNameRowIdx] as unknown[]
  const onsCodes = rows[onsCodeRowIdx] as unknown[]
  const dataStart = rows.findIndex((r, i) => i > onsCodeRowIdx && typeof r[1] === 'string' && parseFinancialYear(String(r[1])))
  const out: Array<ObrObservation & { onsCode: string | null }> = []
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i]
    const fyLabel = row[1]
    if (typeof fyLabel !== 'string') continue
    const period = parseFinancialYear(fyLabel)
    if (!period) continue
    for (let c = 2; c < seriesNames.length; c++) {
      const name = seriesNames[c]
      if (typeof name !== 'string' || !name.trim()) continue
      const raw = row[c]
      if (typeof raw !== 'number') continue
      out.push({
        measure: slugifyMeasure(name),
        unit: 'GBP_BILLION',
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        periodType: 'FINANCIAL_YEAR',
        value: raw,
        status: 'outturn',
        forecastVintage: null,
        onsCode: typeof onsCodes[c] === 'string' ? (onsCodes[c] as string) : null,
      })
    }
  }
  void nameRow
  return out
}

/**
 * Historical Official Forecasts Database: one sheet per aggregate (e.g. "TME",
 * "PSNB", "PSCR"), shape is header rows (title/unit/contents) then one row per
 * forecast round ("June 2010", "March 2011", ...) with target-year columns.
 * Each row is a distinct forecast vintage — the schema models vintage as a
 * series-level dimension, so each row becomes its own series via forecastVintage.
 */
export function parseHistoricalForecastSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  measure: string,
  unit: string,
): ObrObservation[] {
  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in Historical Official Forecasts Database`)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const headerRowIdx = rows.findIndex((r) => typeof r[0] === 'string' && /back to contents/i.test(r[0]))
  if (headerRowIdx === -1) throw new Error(`Year-header row not found in sheet "${sheetName}"`)
  const yearCols = (rows[headerRowIdx].slice(1) as unknown[]).map((v) => (typeof v === 'string' ? v.trim() : null))
  const out: ObrObservation[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const vintageLabel = row[0]
    if (typeof vintageLabel !== 'string' || !vintageLabel.trim()) continue
    const isOutturn = /outturn/i.test(vintageLabel)
    for (let c = 0; c < yearCols.length; c++) {
      const fyLabel = yearCols[c]
      if (!fyLabel) continue
      const period = parseFinancialYear(fyLabel)
      if (!period) continue
      const raw = row[1 + c]
      if (typeof raw !== 'number') continue
      out.push({
        measure,
        unit,
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        periodType: 'FINANCIAL_YEAR',
        value: raw,
        status: isOutturn ? 'outturn' : 'forecast',
        forecastVintage: isOutturn ? null : vintageLabel.trim(),
      })
    }
  }
  return out
}

function slugifyMeasure(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()£%]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
