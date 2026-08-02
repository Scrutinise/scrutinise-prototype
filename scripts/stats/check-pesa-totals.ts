/**
 * check-pesa-totals.ts — regression check for the PESA function parser.
 *
 * Verifies parseFunctionTimeSeries against PESA's own "Total <function>" rows: for each
 * top-level function and each year, the sum of the rows we emit must equal the sheet's own
 * total row. Catches both under-capture (dropped rows) and double-counting — it is the check
 * that caught COFOG-07 (Health) being inflated £299bn -> £1,424bn before that fix shipped.
 * PESA re-publishes annually and can change layout, so run this after any PESA source bump.
 *
 * Exits non-zero if any section-year total fails to reconcile (tolerance ±1 £m for rounding).
 * Run:  cd scripts/stats && ./node_modules/.bin/tsx check-pesa-totals.ts
 */
import * as XLSX from 'xlsx'
import { fetchPesaWorkbook, parseFunctionTimeSeries } from './sources/pesa'
import { parseCofogRowLabel } from './lib/cofog'
import { parseFinancialYear } from './lib/period'

const URL = 'https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx'

async function main() {
  const wb = await fetchPesaWorkbook(URL)
  const emitted = parseFunctionTimeSeries(wb)
  console.log(`parseFunctionTimeSeries -> ${emitted.length} observations`)
  const health = emitted.filter((r) => r.cofogFunctionCode === '07')
  console.log(`  of which COFOG 07 (Health): ${health.length}`)
  console.log(`  health series lines: ${[...new Set(health.map((r) => r.sourceSeriesId))].join(' | ')}`)

  // Read the sheet's own "Total <function>" rows for comparison.
  const ws = wb.Sheets['5_2']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const yearRowIdx = rows.findIndex((r) => typeof r[1] === 'string' && parseFinancialYear(String(r[1])))
  const years = (rows[yearRowIdx].slice(1) as unknown[]).map((v) => (typeof v === 'string' ? v : null))

  let section: string | null = null
  const totals: { code: string; year: string; value: number }[] = []
  for (let i = yearRowIdx + 2; i < rows.length; i++) {
    const label = rows[i][0]
    if (typeof label !== 'string' || !label.trim()) continue
    const c = parseCofogRowLabel(label)
    if (c?.isTopLevel) section = c.code
    if (/^\s*total\b/i.test(label) && section) {
      for (let k = 0; k < years.length; k++) {
        const fy = years[k]
        const raw = rows[i][1 + k]
        if (!fy || typeof raw !== 'number') continue
        const p = parseFinancialYear(fy)
        if (p) totals.push({ code: section, year: p.periodLabel, value: raw })
      }
      section = null // a section ends at its Total row — mirror the parser's rule
    }
  }

  console.log('\ncode  year      our sum        sheet total    diff')
  let bad = 0
  for (const t of totals) {
    const ours = emitted
      .filter((r) => r.periodLabel === t.year && (r.cofogFunctionCode === t.code || r.cofogFunctionCode?.startsWith(t.code + '.')))
      .reduce((a, r) => a + r.value, 0)
    const diff = Math.round((ours - t.value) * 10) / 10
    if (Math.abs(diff) > 1) bad++
    console.log(`${t.code}    ${t.year}   ${ours.toFixed(1).padStart(12)}   ${t.value.toFixed(1).padStart(12)}   ${diff !== 0 ? String(diff) : 'ok'}`)
  }
  console.log(`\n${totals.length - bad}/${totals.length} section-year totals reconcile (tolerance ±1 £m for sheet rounding)`)
  if (bad > 0) {
    console.error(`FAIL: ${bad} section-year total(s) do not reconcile — the PESA parser has drifted.`)
    process.exit(1)
  }
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
