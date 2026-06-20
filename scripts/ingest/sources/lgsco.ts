/**
 * lgsco.ts — Local Government & Social Care Ombudsman decisions (V29 §7).
 *
 * The clean-licence build of the ombudsmen probe wave (the others — FOS,
 * Pensions, PHSO, Housing — assert own copyright / unverified, ranked V30).
 *
 * Licence: own open re-use, OGL-EQUIVALENT — VERIFIED at lgo.org.uk/copyright
 * (20 Jun 2026): "You may re-use the information on this website free of charge
 * in any format. Re-use includes copying, issuing copies to the public,
 * publishing, broadcasting and translating … subject to: acknowledge the source
 * and our copyright; reproduce accurately; not misleading; not for advertising."
 * Code: 'lgsco-open'.
 *
 * Route: lgo.org.uk/decisions/{category} is a paged HTML listing (10 decisions/
 * page via ?page=N) of decision-detail links /decisions/{cat}/{subcat}/{ref};
 * each detail page is server-rendered HTML with the decision in <main>. Walked
 * queue-driven (self-propagating list:{category}:{page} rows) because the DB is
 * large (decisions since 2013).
 */
import { rawToText } from '../shared/compile'

const BASE = 'https://www.lgo.org.uk'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'
export const PAGE_SIZE = 10

export const LGSCO_CATEGORIES = [
  'adult-care-services', 'children-s-care-services', 'benefits-and-tax', 'education',
  'environment-and-regulation', 'housing', 'transport-and-highways', 'planning',
  'other-categories', 'health',
] as const

const DETAIL_RX = /href="(\/decisions\/[a-z0-9-]+\/[a-z0-9-]+\/[0-9]{2}-[0-9]{3}-[0-9]{3,})"/gi

async function getText(url: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } })
      if (res.status === 404 || res.status === 410) return null
      if (res.ok) return await res.text()
    } catch { /* transient */ }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1500 * (i + 1)))
  }
  return null
}

export interface LgscoListPage { paths: string[]; full: boolean }

// One listing page → its decision-detail paths (no leading slash). full = the
// page returned a complete batch (so a next page likely exists).
export async function fetchLgscoListPage(category: string, page: number): Promise<LgscoListPage | null> {
  const html = await getText(`${BASE}/decisions/${category}?page=${page}`)
  if (html == null) return null
  const paths = [...new Set([...html.matchAll(DETAIL_RX)].map(m => m[1].replace(/^\//, '')))]
  return { paths, full: paths.length >= PAGE_SIZE }
}

export interface LgscoDecision { mainText: string; title: string; itemDate?: string }

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

export async function fetchLgscoDecision(path: string): Promise<LgscoDecision | null> {
  const html = await getText(`${BASE}/${path}`)
  if (!html) return null
  const mainM = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html) ?? /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)
  const mainText = rawToText(mainM ? mainM[1] : html)

  const titleM = /<title>([^<]*)<\/title>/i.exec(html)
  const title = titleM ? titleM[1].replace(/\s*[-|]\s*Local Government.*$/i, '').trim() : path.split('/').pop() ?? path

  let itemDate: string | undefined
  const dm = /(?:Decision date|Date)[:\s]+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(mainText)
  if (dm && MONTHS[dm[2].toLowerCase()]) itemDate = `${dm[3]}-${MONTHS[dm[2].toLowerCase()]}-${dm[1].padStart(2, '0')}`
  else { // derive year from the ref prefix (e.g. 25-016-779 → 2025)
    const rm = /\/(\d{2})-\d{3}-\d{3,}$/.exec(path)
    if (rm) itemDate = `20${rm[1]}-01-01`
  }
  return { mainText, title, itemDate }
}
