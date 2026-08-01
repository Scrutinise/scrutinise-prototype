// HM Treasury PESA (Public Expenditure Statistical Analyses) — gov.uk spreadsheets,
// direct static asset URLs (no token/cookie dance, unlike OBR). Chapter 5 is the
// COFOG-relevant chapter: Table 5.2 gives the national function/sub-function time
// series (no departmental split); Table 5.1 gives the departmental-group x
// top-level-function cross-tab for the latest single year. Together they cover
// both axes the brief asks for, though not as one combined department x function
// x year cube — PESA itself doesn't publish that as a single table (see
// docs/STATS_PHASE_A_BRIEF.md scorecard note).
import * as XLSX from 'xlsx'
import { politeFetch } from '../lib/fetch-utils'
import { parseFinancialYear } from '../lib/period'
import { parseCofogRowLabel } from '../lib/cofog'

export async function fetchPesaWorkbook(url: string): Promise<XLSX.WorkBook> {
  const res = await politeFetch(url, { delayMs: 500 })
  if (!res.ok) throw new Error(`PESA workbook download failed for ${url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

export interface PesaObservation {
  measure: string
  unit: string
  cofogFunctionCode: string | null
  cofogFunctionName: string | null // the source's own row label for that code — seeds stat_cofog_function
  sourceSeriesId: string | null // department name, or the named service line, where applicable
  periodLabel: string
  periodStart: Date
  value: number
}

/** Rows that carry numbers but are aggregates or partial breakdowns of a line we already take. */
function isAggregateOrOfWhichRow(label: string): boolean {
  return /^\s*(total\b|of which\b)/i.test(label) || /^\s*of which:/i.test(label)
}

/** Table 5.2 — public sector expenditure by (sub-)function, national total, multi-year. */
export function parseFunctionTimeSeries(workbook: XLSX.WorkBook, sheetName = '5_2'): PesaObservation[] {
  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in PESA workbook`)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const yearRowIdx = rows.findIndex((r) => typeof r[1] === 'string' && parseFinancialYear(String(r[1])))
  if (yearRowIdx === -1) throw new Error(`Year header row not found in "${sheetName}"`)
  const years = (rows[yearRowIdx].slice(1) as unknown[]).map((v) => (typeof v === 'string' ? v : null))
  const out: PesaObservation[] = []
  // Health is the one function PESA does NOT number: "7. Health (6)" is a bare section
  // header with no data, and its three data rows ("Medical services", "Medical research",
  // "Central and other health services") carry no COFOG sub-number at all, unlike every
  // other function's "N.M <name>" rows. Tracking the current section lets those rows be
  // attributed to top-level 07 instead of being dropped — which is what happened before
  // 1 Aug 2026, silently losing ALL UK health spending from this measure.
  let currentTopLevel: { code: string; name: string } | null = null

  for (let i = yearRowIdx + 2; i < rows.length; i++) {
    // yearRowIdx+1 is the outturn/plans status row — skip
    const row = rows[i]
    const label = row[0]
    if (typeof label !== 'string' || !label.trim()) continue

    const cofog = parseCofogRowLabel(label)
    if (cofog?.isTopLevel) currentTopLevel = { code: cofog.code, name: cofog.name }

    // A section ENDS at its own "Total <function>" row. Without this, the sheet's
    // trailing grand-total and accounting-adjustment rows (which sit after "Total social
    // protection" and are also unnumbered) get swept into the last open section — that
    // inflated COFOG 10 from £299bn to £1,424bn when this rule was first written.
    if (/^\s*total\b/i.test(label)) currentTopLevel = null

    // Which code does this row's data belong to, and is it its own series?
    let code: string | null = null
    let codeName: string | null = null
    let seriesKey: string | null = null
    if (cofog) {
      code = cofog.code
      codeName = cofog.name
    } else if (currentTopLevel && !isAggregateOrOfWhichRow(label)) {
      // An unnumbered, non-aggregate data row inside a numbered section (health's three).
      code = currentTopLevel.code
      codeName = currentTopLevel.name
      seriesKey = label.trim()
    } else {
      continue // "Total <function>" / "of which:" / footnote rows
    }

    for (let c = 0; c < years.length; c++) {
      const fyLabel = years[c]
      if (!fyLabel) continue
      const period = parseFinancialYear(fyLabel)
      if (!period) continue
      const raw = row[1 + c]
      if (typeof raw !== 'number') continue
      out.push({
        measure: 'public_expenditure_by_function',
        unit: 'GBP_MILLION',
        cofogFunctionCode: code,
        cofogFunctionName: codeName,
        sourceSeriesId: seriesKey,
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        value: raw,
      })
    }
  }
  return out
}

/** Table 5.1 — departmental group x top-level function, single latest year. */
export function parseDeptByFunctionSnapshot(workbook: XLSX.WorkBook, sheetName = '5_1'): PesaObservation[] {
  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in PESA workbook`)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const titleMatch = String(rows[0]?.[0] ?? '').match(/(\d{4}-\d{2})\s*$/)
  const period = titleMatch ? parseFinancialYear(titleMatch[1]) : null
  if (!period) throw new Error(`Could not read the reporting year from Table 5.1's title: "${rows[0]?.[0]}"`)
  const headerRowIdx = rows.findIndex((r) => typeof r[1] === 'string' && /^\d+\.\s/.test(String(r[1])))
  if (headerRowIdx === -1) throw new Error(`Function header row not found in "${sheetName}"`)
  const header = rows[headerRowIdx] as unknown[]
  // Only top-level numbered COFOG columns — skip " of which:" sub-columns and "EU transactions".
  const cofogCols: Array<{ idx: number; code: string }> = []
  for (let c = 1; c < header.length; c++) {
    const h = header[c]
    if (typeof h !== 'string') continue
    const cofog = parseCofogRowLabel(h)
    if (cofog && cofog.isTopLevel) cofogCols.push({ idx: c, code: cofog.code })
  }
  const totalColIdx = header.findIndex((h) => typeof h === 'string' && /for each department/i.test(h))

  const out: PesaObservation[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const dept = row[0]
    if (typeof dept !== 'string' || !dept.trim()) continue
    if (/for each function/i.test(dept)) continue // the column-total footer row, not a department
    for (const { idx, code } of cofogCols) {
      const raw = row[idx]
      if (typeof raw !== 'number') continue
      out.push({
        measure: 'dept_expenditure_by_function',
        unit: 'GBP_MILLION',
        cofogFunctionCode: code,
        cofogFunctionName: null, // top-level codes are seeded; no name needed
        sourceSeriesId: dept.trim(),
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        value: raw,
      })
    }
    if (totalColIdx !== -1 && typeof row[totalColIdx] === 'number') {
      out.push({
        measure: 'dept_total_expenditure',
        unit: 'GBP_MILLION',
        cofogFunctionCode: null,
        cofogFunctionName: null,
        sourceSeriesId: dept.trim(),
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        value: row[totalColIdx] as number,
      })
    }
  }
  return out
}
