/**
 * ofgem.ts — Office of Gas and Electricity Markets publications (V29 §6).
 *
 * Exempt org (own domain, NOT in the gov.uk content API). Drupal "Simple XML
 * Sitemap": index → /sitemap.xml?page=1..10 (5,000 urls/page). The corpus is the
 * English /publications/{slug} leaves (12,899 measured 20 Jun 2026; the /cy/
 * Welsh duplicates are excluded). Each publication page is a thin HTML stub plus
 * the document as a linked PDF on /sites/default/files/… — so, like ICO, prefer
 * the PDF(s), fall back to the page's <main> text.
 *
 * Licence: OGL v3.0 — VERIFIED at ofgem.gov.uk/copyright (20 Jun 2026): Ofgem is
 * a non-ministerial department; its Crown-copyright material (excluding logos)
 * is re-usable "under the terms of the Open Government Licence".
 */
import { rawToText } from '../shared/compile'

const BASE = 'https://www.ofgem.gov.uk'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'
const PUB_RX = /^https:\/\/www\.ofgem\.gov\.uk\/publications\/[a-z0-9-]+$/

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

export function urlToPath(url: string): string {
  return url.replace(/^https?:\/\/www\.ofgem\.gov\.uk\//, '').replace(/\/+$/, '')
}

export async function enumerateOfgemPublications(): Promise<Array<{ url: string; path: string }>> {
  const idx = await getText(`${BASE}/sitemap.xml`)
  if (!idx) throw new Error('ofgem sitemap index fetch failed')
  const subs = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
  const out: Array<{ url: string; path: string }> = []
  const seen = new Set<string>()
  for (const sub of subs) {
    const xml = await getText(sub)
    if (!xml) continue
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = m[1].trim()
      if (!PUB_RX.test(url)) continue
      const path = urlToPath(url)
      if (seen.has(path)) continue
      seen.add(path)
      out.push({ url, path })
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return out
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

export interface OfgemPage { mainText: string; pdfUrls: string[]; title: string; itemDate?: string }

export async function fetchOfgemPage(path: string): Promise<OfgemPage | null> {
  const html = await getText(`${BASE}/${path}`)
  if (!html) return null
  const mainM = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)
  const mainHtml = mainM ? mainM[1] : html
  const mainText = rawToText(mainHtml)

  const pdfUrls = new Set<string>()
  for (const m of mainHtml.matchAll(/href="([^"]+\.pdf)"/gi)) {
    const href = m[1]
    pdfUrls.add(href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`)
  }

  const titleM = /<title>([^<]*)<\/title>/i.exec(html)
  const title = titleM ? titleM[1].replace(/\s*\|\s*Ofgem\s*$/i, '').trim() : path

  let itemDate: string | undefined
  const dm = /(?:Published|Updated|Publication date)[:\s]+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(mainText)
  if (dm && MONTHS[dm[2].toLowerCase()]) itemDate = `${dm[3]}-${MONTHS[dm[2].toLowerCase()]}-${dm[1].padStart(2, '0')}`

  return { mainText, pdfUrls: [...pdfUrls], title, itemDate }
}

export async function fetchOfgemPdf(url: string): Promise<Buffer | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': BASE + '/', 'Accept': 'application/pdf' } })
      if (res.status === 404 || res.status === 410) return null
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length < 5 || buf.toString('latin1', 0, 4) !== '%PDF') return null
        return buf
      }
    } catch { /* transient */ }
    if (i < 2) await new Promise(r => setTimeout(r, 1500 * (i + 1)))
  }
  return null
}
