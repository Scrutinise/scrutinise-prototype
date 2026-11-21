// ─────────────────────────────────────────────────────────────────────────────
// 26-AA item 9(c) — A STATISTICS CELL IS A VALUE OR A STATE, NEVER A ZERO. PURE; CLIENT-SAFE.
//
// Ingest (CBA-1 EXECUTE §3, decision 329) keeps a publisher's suppressed cell — "[c] confidential …", "[n] not applicable …" — in its own
// table, stat_suppressed_cell, with the publisher's own definition (markerText), because every older reader does Number(value) and would
// turn a NULL into 0. This module is the one shape a CBA reader hands on: a held value with its release and price basis, or the marker
// with the publisher's words. `cellWords` is the only way either reaches a screen or a document, so a suppressed cell cannot print as 0
// or as nothing.
// ─────────────────────────────────────────────────────────────────────────────

export interface CellCommon {
  seriesId: string
  periodLabel: string
  /** The publisher's release date (YYYY-MM-DD), read as text so no time zone can move it a day. */
  releaseDate: string | null
  /** What the figure is: "cash (£), gross median annual salary …", "index, 2025-26 = 100". */
  priceBasis: string | null
}
export type StatCell =
  | (CellCommon & { kind: 'value'; value: number; unit: string })
  | (CellCommon & { kind: 'suppressed'; marker: 'c' | 'n'; markerText: string })
  | { kind: 'absent'; seriesId: string | null; why: string }

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

/** The words a cell is shown or printed with. A suppressed cell is its marker and the publisher's definition; an absent one says so. */
export function cellWords(c: StatCell): string {
  if (c.kind === 'value') return c.unit === 'GBP' ? gbp(c.value) : c.value.toLocaleString('en-GB')
  if (c.kind === 'suppressed') return `[${c.marker}] ${c.markerText.replace(/^\[[cn]\]\s*=?\s*/i, '').replace(/\.$/, '')}`
  return `not held (${c.why})`
}

/** A suppressed or absent cell is never a number: callers that need one get null and must say why. */
export const cellValue = (c: StatCell): number | null => (c.kind === 'value' ? c.value : null)

/** The release, in words: "released 30 Jun 2026". */
export function releaseWords(isoDate: string | null): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 'release date not recorded'
  const [y, m, d] = isoDate.split('-').map(Number)
  return `released ${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`
}

// ── Civil Service Statistics 2026 (css-2026): median salary by responsibility level ──
/** The responsibility levels Table 7 (all departments) and Table 25 (by body) publish. */
export const CSS_LEVELS = ['AA_AO', 'EO', 'HEO_SEO', 'G6_G7', 'SCS', 'ALL'] as const
export type CssLevel = (typeof CSS_LEVELS)[number]
/** Table 7's own level names (all departments). */
export const CSS_TABLE7_LEVEL: Record<CssLevel, string> = {
  AA_AO: 'Administrative Officers and Assistants', EO: 'Executive Officers', HEO_SEO: 'Senior and Higher Executive Officers',
  G6_G7: 'Grades 6 and 7', SCS: 'Senior Civil Service level', ALL: 'All responsibility levels',
}
/** Table 25's own measure names (one body). */
export const CSS_TABLE25_MEASURE: Record<CssLevel, string> = {
  AA_AO: 'Median salary of all civil servants working at Administrative Assistant or Administrative Officer level',
  EO: 'Median salary of all civil servants working at Executive Officer level',
  HEO_SEO: 'Median salary of all civil servants working at Senior or Higher Executive Officer level',
  G6_G7: 'Median salary of all civil servants working at Grade 6 or Grade 7 level',
  SCS: 'Median salary of all civil servants working at Senior Civil Service level',
  ALL: 'Median salary of all civil servants',
}
export const css7Key = (level: CssLevel) => `table_7|${CSS_TABLE7_LEVEL[level]}|Median salary of all civil servants`
export const css25Key = (level: CssLevel, body: string) => `table_25|${body}|${CSS_TABLE25_MEASURE[level]}`

/** A staffing salary as decision 340 shows it: the figure, or the suppressed cell AND the named fallback (the grade across all departments). */
export interface SalaryFloor { cell: StatCell; fallback: { cell: StatCell; words: string } | null; level: CssLevel; body: string | null }

export function salaryFloorWords(f: SalaryFloor): string {
  const lvl = CSS_TABLE7_LEVEL[f.level]
  const where = f.body ? `${f.body}, ${lvl}` : `${lvl}, all departments`
  const head = `Civil Service Statistics 2026, gross median salary, ${where}: ${cellWords(f.cell)}`
  return f.fallback ? `${head}; so ${f.fallback.words}: ${cellWords(f.fallback.cell)}` : head
}
