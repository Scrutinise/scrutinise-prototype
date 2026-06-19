/**
 * ico.ts — Information Commissioner's Office decisions & enforcement (V27 §4).
 *
 * Exempt org (own domain, NOT in the gov.uk content API). Cleanest of the V27
 * exempt-org probes: clear licence + clean enumerable route.
 *
 * Licence: OGL v3.0 — ico.org.uk/global/privacy-cookies-and-legal/legal/ states
 * "All text content is available under the Open Government Licence v3.0, except
 * where otherwise stated" (verified 19 Jun 2026).
 *
 * Route (bulk → HTML → API priority; here a flat sitemap + per-page HTML+PDF):
 *  - Enumerate: https://ico.org.uk/sitemap.xml (flat urlset, ~30k URLs). The
 *    legal corpus is the /action-weve-taken/{category}/{yyyy}/{mm}/{slug}/ leaf
 *    pages — measured 26,576 (25,982 decision-notices · 211 enforcement · 331
 *    foi-regulatory-action · 62 audits · misc).
 *  - Fetch: each leaf is server-rendered HTML with the summary in
 *    <main id="main-content"> AND a link to the full decision/penalty PDF
 *    (/media2/…pdf). Prefer the PDF (full text); fall back to the main HTML.
 */
import { rawToText } from '../shared/compile'

const BASE = 'https://ico.org.uk'
const SITEMAP = 'https://ico.org.uk/sitemap.xml'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

// Leaf legal pages: /action-weve-taken/{category}/{yyyy}/{mm}/{slug}/
const LEAF_RX = /^https:\/\/ico\.org\.uk\/action-weve-taken\/[a-z0-9-]+\/\d{4}\/\d{1,2}\/[a-z0-9-]+\/?$/

export interface IcoLeaf { url: string; path: string; category: string }

// path = url minus host, no leading/trailing slash. e.g.
// "action-weve-taken/decision-notices/2026/06/ic-406308-d2s8"
export function urlToPath(url: string): string {
  return url.replace(/^https?:\/\/ico\.org\.uk\//, '').replace(/\/+$/, '')
}

export async function enumerateIcoLeaves(): Promise<IcoLeaf[]> {
  const res = await fetch(SITEMAP, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } })
  if (!res.ok) throw new Error(`ico sitemap HTTP ${res.status}`)
  const xml = await res.text()
  const out: IcoLeaf[] = []
  const seen = new Set<string>()
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = m[1].trim()
    if (!LEAF_RX.test(url)) continue
    const path = urlToPath(url)
    if (seen.has(path)) continue
    seen.add(path)
    out.push({ url: `${BASE}/${path}/`, path, category: path.split('/')[1] })
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

export interface IcoPage { mainText: string; pdfUrls: string[]; title: string; itemDate?: string }

export async function fetchIcoPage(path: string): Promise<IcoPage | null> {
  let res: Response
  try { res = await fetch(`${BASE}/${path}/`, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } }) }
  catch { return null }
  if (!res.ok) return null
  const html = await res.text()

  const mainM = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)
  const mainHtml = mainM ? mainM[1] : html
  const mainText = rawToText(mainHtml)

  const pdfUrls = new Set<string>()
  for (const m of mainHtml.matchAll(/href="([^"]+\.pdf)"/gi)) {
    const href = m[1]
    pdfUrls.add(href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`)
  }

  const titleM = /<title>([^<]*)<\/title>/i.exec(html)
  const title = titleM ? decodeEntities(titleM[1].replace(/\s*\|\s*ICO\s*$/i, '').trim()) : path

  // Prefer the inline "Date <d Month yyyy>"; fall back to the yyyy/mm in the path.
  let itemDate: string | undefined
  const dm = /Date\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(mainText)
  if (dm && MONTHS[dm[2].toLowerCase()]) {
    itemDate = `${dm[3]}-${MONTHS[dm[2].toLowerCase()]}-${dm[1].padStart(2, '0')}`
  } else {
    const pm = /\/(\d{4})\/(\d{1,2})\//.exec(`/${path}/`)
    if (pm) itemDate = `${pm[1]}-${pm[2].padStart(2, '0')}-01`
  }

  return { mainText, pdfUrls: [...pdfUrls], title, itemDate }
}

export async function fetchIcoPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://ico.org.uk/', 'Accept': 'application/pdf' } })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 5 || buf.toString('latin1', 0, 4) !== '%PDF') return null
    return buf
  } catch { return null }
}
