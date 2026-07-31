// COFOG — Classification of the Functions of Government. Top-level 10 functions
// plus the sub-functions PESA Table 5.2 actually reports against (extend as new
// sources surface finer breakdowns — this is not the full official COFOG tree,
// just the codes this ingest currently produces).

export interface CofogCode {
  code: string
  parent: string | null
  name: string
}

export const COFOG_TOP_LEVEL: CofogCode[] = [
  { code: '01', parent: null, name: 'General public services' },
  { code: '02', parent: null, name: 'Defence' },
  { code: '03', parent: null, name: 'Public order and safety' },
  { code: '04', parent: null, name: 'Economic affairs' },
  { code: '05', parent: null, name: 'Environmental protection' },
  { code: '06', parent: null, name: 'Housing and community amenities' },
  { code: '07', parent: null, name: 'Health' },
  { code: '08', parent: null, name: 'Recreation, culture and religion' },
  { code: '09', parent: null, name: 'Education' },
  { code: '10', parent: null, name: 'Social protection' },
]

/**
 * PESA Table 5.2 row labels are literally "<n>. <name>" for top-level and
 * "<n>.<m> <name>" for sub-function. Parse a row label into a COFOG code, or
 * null if the row isn't a COFOG-coded line (sub-total/footnote/"of which" rows).
 */
export function parseCofogRowLabel(label: string): { code: string; name: string; isTopLevel: boolean } | null {
  // "1.1 Executive..." (sub-function) or "1. General public services" / "1 General public services" (top-level).
  const m = label.trim().match(/^(\d{1,2})(?:\.(\d{1,2})|\.)?\s+(.+)$/)
  if (!m) return null
  const [, major, minor, rawName] = m
  const code = minor ? `${major.padStart(2, '0')}.${minor}` : major.padStart(2, '0')
  const name = rawName.replace(/\s*\(\d+\)\s*$/, '').trim() // strip footnote markers like "(1)"
  return { code, name, isTopLevel: !minor }
}
