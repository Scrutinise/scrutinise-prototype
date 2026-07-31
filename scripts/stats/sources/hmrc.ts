// HMRC statistics — gov.uk spreadsheets (.ods for receipts, .xlsx for tax gap),
// direct static asset URLs. Two datasets: headline tax receipts by tax line
// (annual), and the tax gap by tax type (annual, percentage).
import * as XLSX from 'xlsx'
import { politeFetch } from '../lib/fetch-utils'
import { parseFinancialYear } from '../lib/period'

export async function fetchHmrcWorkbook(url: string): Promise<XLSX.WorkBook> {
  const res = await politeFetch(url, { delayMs: 500 })
  if (!res.ok) throw new Error(`HMRC workbook download failed for ${url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

export interface HmrcObservation {
  measure: string
  unit: string
  periodLabel: string
  periodStart: Date
  value: number
}

/** "HMRC tax receipts and National Insurance contributions" workbook, Receipts_Annually sheet. */
export function parseReceiptsAnnually(workbook: XLSX.WorkBook, sheetName = 'Receipts_Annually'): HmrcObservation[] {
  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in HMRC receipts workbook`)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const headerRowIdx = rows.findIndex((r) => typeof r[0] === 'string' && /financial year/i.test(r[0]))
  if (headerRowIdx === -1) throw new Error(`Header row not found in "${sheetName}"`)
  const columns = (rows[headerRowIdx].slice(1) as unknown[]).map((v) => (typeof v === 'string' ? v.trim() : null))
  const out: HmrcObservation[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const fyLabel = row[0]
    if (typeof fyLabel !== 'string') continue
    const period = parseFinancialYear(fyLabel)
    if (!period) continue
    for (let c = 0; c < columns.length; c++) {
      const name = columns[c]
      if (!name) continue
      const raw = row[1 + c]
      if (typeof raw !== 'number') continue
      out.push({
        measure: slugify(name),
        unit: 'GBP_MILLION',
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        value: raw,
      })
    }
  }
  return out
}

/** "Measuring tax gaps" workbook, Table 1.1: percentage tax gap by tax/type/component. */
export function parseTaxGapTable11(workbook: XLSX.WorkBook, sheetName = 'Table 1.1'): HmrcObservation[] {
  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in tax gap workbook`)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const headerRowIdx = rows.findIndex((r) => r[0] === 'Tax' && r[1] === 'Type' && r[2] === 'Component')
  if (headerRowIdx === -1) throw new Error(`Header row not found in "${sheetName}"`)
  const years = (rows[headerRowIdx].slice(3) as unknown[]).map((v) => (typeof v === 'string' ? v : null))
  const out: HmrcObservation[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const tax = row[0]
    const component = row[2]
    if (typeof tax !== 'string' || typeof component !== 'string') continue
    const measure = `tax_gap_pct_${slugify(component)}`
    for (let c = 0; c < years.length; c++) {
      const fyLabel = years[c]
      if (!fyLabel) continue
      const period = parseFinancialYear(fyLabel)
      if (!period) continue
      const raw = row[3 + c]
      if (typeof raw !== 'string' || !raw.endsWith('%')) continue
      const num = parseFloat(raw.slice(0, -1))
      if (Number.isNaN(num)) continue
      out.push({ measure, unit: 'PERCENT', periodLabel: period.periodLabel, periodStart: period.periodStart, value: num })
    }
  }
  return out
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()£%'"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
