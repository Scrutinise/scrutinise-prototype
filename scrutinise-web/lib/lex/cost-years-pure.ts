// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X X3 §6a.5 (decision 314) — THE COSTS, ROLLED UP BY HEADING AND BY YEAR. PURE; CLIENT-SAFE (imports nothing).
//
// CCh-Lex 7 Nov (2), 3 — the rule, and the whole of it:
//   · years 1–5;
//   · a ONE-OFF line falls in year 1;
//   · a PER-YEAR line falls in each year of its duration (`durationMonths`; a part year is that part of the year's figure, e.g. 18 months is
//     year 1 in full and half of year 2); a per-year line with NO duration runs all five years;
//   · a line with NO recurrence ("undated") is shown in its own column and COUNTED — never placed in a year by guesswork.
// A line with no figure at all is counted as "no figure" and adds nothing. Figures are ranges (low–high); a line given as one number is a
// floor and is counted so the total is not read as more certain than it is (as computeCostSummary). Uprating is the caller's (the server
// half applies the same deflator series as the cost summary) and is said in the table's note.
// ─────────────────────────────────────────────────────────────────────────────

export const COST_YEARS = 5

export interface CostLineIn {
  id: string
  headingId: string | null
  low: number | null
  high: number | null
  recurrence: 'ONE_OFF' | 'PER_YEAR' | null
  durationMonths: number | null
}
export interface Money { low: number; high: number }
export interface CostRow {
  headingId: string | null
  /** Year 1..5 totals. */
  years: Money[]
  /** Lines with no recurrence: their sum, and how many. */
  undated: Money
  undatedLines: number
  /** Lines with no figure at all. */
  noFigure: number
  /** Lines given as a single number (a floor). */
  oneSided: number
  lines: number
}
export interface CostTable { rows: CostRow[]; total: CostRow }

const zero = (): Money => ({ low: 0, high: 0 })
const emptyRow = (headingId: string | null): CostRow => ({ headingId, years: Array.from({ length: COST_YEARS }, zero), undated: zero(), undatedLines: 0, noFigure: 0, oneSided: 0, lines: 0 })

/** The fraction of year `k` (1-based) a per-year line covers. No duration → every year. Pure. */
export function yearShare(k: number, durationMonths: number | null): number {
  if (durationMonths == null || !(durationMonths > 0)) return 1
  return Math.max(0, Math.min(1, durationMonths / 12 - (k - 1)))
}

function add(row: CostRow, l: CostLineIn) {
  row.lines++
  if (l.low == null && l.high == null) { row.noFigure++; return }
  const lo = l.low ?? (l.high as number)
  const hi = l.high ?? lo
  if (l.low == null || l.high == null) row.oneSided++
  if (l.recurrence === 'ONE_OFF') { row.years[0].low += lo; row.years[0].high += hi; return }
  if (l.recurrence === 'PER_YEAR') {
    for (let k = 1; k <= COST_YEARS; k++) {
      const s = yearShare(k, l.durationMonths)
      row.years[k - 1].low += lo * s; row.years[k - 1].high += hi * s
    }
    return
  }
  row.undated.low += lo; row.undated.high += hi; row.undatedLines++
}

/** The table: one row per heading in `headingOrder` that has lines (then "not under a heading"), and the total. */
export function costTable(lines: readonly CostLineIn[], headingOrder: ReadonlyArray<string>): CostTable {
  const rows = new Map<string | null, CostRow>()
  const total = emptyRow(null)
  for (const l of lines) {
    const key = l.headingId && headingOrder.includes(l.headingId) ? l.headingId : null
    if (!rows.has(key)) rows.set(key, emptyRow(key))
    add(rows.get(key)!, l)
    add(total, l)
  }
  const ordered = [...headingOrder.filter((h) => rows.has(h)).map((h) => rows.get(h)!), ...(rows.has(null) ? [rows.get(null)!] : [])]
  return { rows: ordered, total }
}

/** "£1,200" / "£1,200–3,400" — rounded to the pound; a zero range prints "—". */
export function moneyWords(m: Money): string {
  const lo = Math.round(m.low), hi = Math.round(m.high)
  if (lo === 0 && hi === 0) return '—'
  return lo === hi ? `£${lo.toLocaleString('en-GB')}` : `£${lo.toLocaleString('en-GB')}–${hi.toLocaleString('en-GB')}`
}
