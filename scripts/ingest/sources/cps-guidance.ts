/**
 * cps-guidance.ts — Crown Prosecution Service legal guidance (V29 §4).
 *
 * The prosecutorial interpretation of criminal law: how charging decisions are
 * made. Two pieces — the Code for Crown Prosecutors + the full prosecution-
 * guidance library (271 guidance documents).
 *
 * Own domain (cps.gov.uk — NOT the gov.uk content API). Drupal site with a
 * paged XML sitemap index:
 *   GET /sitemap.xml                 → <sitemapindex> of /sitemap.xml?page=1..5
 *   GET /sitemap.xml?page=N          → <urlset> of all site URLs
 * The legal-interpretation corpus = the /prosecution-guidance/{slug} leaves
 * (excluding the search index) + the Code for Crown Prosecutors publication.
 * Each is server-rendered HTML with the guidance in <main>.
 *
 * Licence: OGL v3.0 — VERIFIED at cps.gov.uk/crown-copyright-and-disclaimer
 * (20 Jun 2026): CPS material is Crown copyright re-usable under the Open
 * Government Licence (v3 stated). Confirmed at the copyright page, not a footer.
 */
import { rawToText } from '../shared/compile'

const BASE = 'https://www.cps.gov.uk'
const SITEMAP = `${BASE}/sitemap.xml`
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

// /prosecution-guidance/{slug} — the legal guidance library. Exclude the search
// page and the library landing page (non-content).
const GUIDANCE_RX = /^https:\/\/www\.cps\.gov\.uk\/prosecution-guidance\/[a-z0-9-]+\/?$/
const EXCLUDE_SLUGS = new Set(['prosecution-guidance-search'])

// Curated key publications that are legal-interpretation material (the Code +
// the Director's charging guidance), which live under /publication or as
// top-level pages rather than /prosecution-guidance.
const CURATED_PATHS = [
  'publication/code-crown-prosecutors',
]

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

export interface CpsLeaf { url: string; path: string }

export function urlToPath(url: string): string {
  return url.replace(/^https?:\/\/www\.cps\.gov\.uk\//, '').replace(/\/+$/, '')
}

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

export async function enumerateCpsGuidance(): Promise<CpsLeaf[]> {
  const idx = await getText(SITEMAP)
  if (!idx) throw new Error('cps sitemap index fetch failed')
  const subs = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
  const out: CpsLeaf[] = []
  const seen = new Set<string>()
  for (const sub of subs) {
    const xml = await getText(sub)
    if (!xml) continue
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = m[1].trim()
      if (!GUIDANCE_RX.test(url)) continue
      const path = urlToPath(url)
      const slug = path.split('/')[1]
      if (EXCLUDE_SLUGS.has(slug) || seen.has(path)) continue
      seen.add(path)
      out.push({ url: `${BASE}/${path}`, path })
    }
    await new Promise(r => setTimeout(r, 200))
  }
  for (const path of CURATED_PATHS) {
    if (!seen.has(path)) { seen.add(path); out.push({ url: `${BASE}/${path}`, path }) }
  }
  return out
}

export interface CpsPage { mainText: string; title: string; itemDate?: string }

export async function fetchCpsPage(path: string): Promise<CpsPage | null> {
  const html = await getText(`${BASE}/${path}`)
  if (!html) return null
  const mainM = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)
  const mainText = rawToText(mainM ? mainM[1] : html)

  const titleM = /<title>([^<]*)<\/title>/i.exec(html)
  const title = titleM ? titleM[1].replace(/\s*\|\s*The Crown Prosecution Service\s*$/i, '').trim() : path

  // "Rewritten: 15 March 2023" / "Updated: ..." / "Published: ..." inline.
  let itemDate: string | undefined
  const dm = /(?:Rewritten|Updated|Published|Reviewed):\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(mainText)
  if (dm && MONTHS[dm[2].toLowerCase()]) {
    itemDate = `${dm[3]}-${MONTHS[dm[2].toLowerCase()]}-${dm[1].padStart(2, '0')}`
  }
  return { mainText, title, itemDate }
}
