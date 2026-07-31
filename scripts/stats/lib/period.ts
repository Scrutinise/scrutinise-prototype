// Period normalisation: every source expresses time differently (plain calendar
// year, UK financial year "2024-25", "2025 Q1", monthly "2025 JUL") — normalise
// all of it to { periodType, periodStart, periodLabel } so stat_observation can
// sort and filter on a single DATE column regardless of source.

export type PeriodType = 'ANNUAL' | 'FINANCIAL_YEAR' | 'QUARTERLY' | 'MONTHLY'

export interface NormalisedPeriod {
  periodType: PeriodType
  periodStart: Date
  periodLabel: string
}

/** "2024-25", "2024/25", or "2024 to 2025" (HMRC's format) -> FY starting 6 April 2024. */
export function parseFinancialYear(label: string): NormalisedPeriod | null {
  const t = label.trim()
  const m = t.match(/^(\d{4})[-/](\d{2,4})$/) ?? t.match(/^(\d{4}) to (\d{4})$/)
  if (!m) return null
  const startYear = parseInt(m[1], 10)
  return {
    periodType: 'FINANCIAL_YEAR',
    periodStart: new Date(Date.UTC(startYear, 3, 6)), // 6 April
    periodLabel: t,
  }
}

/** Bare 4-digit calendar year, e.g. OBR's "1900-01" pre-war rows or a plain "1998". */
export function parseAnnualOrFinancialYear(label: string): NormalisedPeriod | null {
  const fy = parseFinancialYear(label)
  if (fy) return fy
  const m = label.trim().match(/^(\d{4})$/)
  if (!m) return null
  const year = parseInt(m[1], 10)
  return {
    periodType: 'ANNUAL',
    periodStart: new Date(Date.UTC(year, 0, 1)),
    periodLabel: label.trim(),
  }
}

/** ONS CDID annual rows are bare years ("1948"); quarterly rows look like "2025 Q1". */
export function parseCdidPeriod(label: string): NormalisedPeriod | null {
  const t = label.trim()
  let m = t.match(/^(\d{4})$/)
  if (m) {
    const year = parseInt(m[1], 10)
    return { periodType: 'ANNUAL', periodStart: new Date(Date.UTC(year, 0, 1)), periodLabel: t }
  }
  m = t.match(/^(\d{4}) Q([1-4])$/)
  if (m) {
    const year = parseInt(m[1], 10)
    const q = parseInt(m[2], 10)
    return { periodType: 'QUARTERLY', periodStart: new Date(Date.UTC(year, (q - 1) * 3, 1)), periodLabel: t }
  }
  // Monthly rows look like "2025 JUL"
  m = t.match(/^(\d{4}) ([A-Z]{3})$/)
  if (m) {
    const year = parseInt(m[1], 10)
    const monthIdx = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(m[2])
    if (monthIdx === -1) return null
    return { periodType: 'MONTHLY', periodStart: new Date(Date.UTC(year, monthIdx, 1)), periodLabel: t }
  }
  return null
}
