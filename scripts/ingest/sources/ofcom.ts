/**
 * ofcom.ts — Office of Communications regulatory publications (V29 §6).
 *
 * Exempt org (own domain, NOT in the gov.uk content API). Server-rendered
 * EPiServer site with a sitemap index → per-topic sitemaps
 * (en/aboutofcom_sitemap.xml, en/internetbasedservices_sitemap.xml, …). The
 * corpus is the substantive English regulatory pages (statements, consultations,
 * market studies, plans, guidance); pure data-download / interactive-data /
 * coverage-data pages are filtered out (no extractable prose). Each page is
 * server-rendered HTML; some carry document PDFs.
 *
 * Licence: Ofcom own-open re-use terms — VERIFIED at
 * ofcom.org.uk/about-ofcom/website/terms-of-use (20 Jun 2026): Ofcom material
 * "may be reproduced free of charge in any format or medium provided it is
 * reproduced accurately and not used in a misleading context … acknowledged as
 * Ofcom copyright". OGL-equivalent (free + attribution; logos excluded). Code:
 * 'ofcom-open'. Not OGL — recorded as the regulator's own open licence.
 */
import { rawToText } from '../shared/compile'

const BASE = 'https://www.ofcom.org.uk'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

// Exclude non-prose data pages and non-English/utility paths.
const EXCLUDE_RX = /(data-downloads|interactive-data|interactive-report|\/data$|coverage-checker|\/cy\/)/i

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
  return url.replace(/^https?:\/\/www\.ofcom\.org\.uk\//, '').replace(/\/+$/, '')
}

export async function enumerateOfcomPages(): Promise<Array<{ url: string; path: string }>> {
  const idx = await getText(`${BASE}/sitemap.xml`)
  if (!idx) throw new Error('ofcom sitemap index fetch failed')
  const subs = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(u => /\/en\//.test(u))
  const out: Array<{ url: string; path: string }> = []
  const seen = new Set<string>()
  for (const sub of subs) {
    const xml = await getText(sub)
    if (!xml) continue
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = m[1].trim()
      if (!/^https:\/\/www\.ofcom\.org\.uk\//.test(url)) continue
      if (EXCLUDE_RX.test(url)) continue
      const path = urlToPath(url)
      if (!path || path === 'en' || seen.has(path)) continue
      seen.add(path)
      out.push({ url, path })
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return out
}

export interface OfcomPage { mainText: string; pdfUrls: string[]; title: string }

export async function fetchOfcomPage(path: string): Promise<OfcomPage | null> {
  const html = await getText(`${BASE}/${path}`)
  if (!html) return null
  const mainM = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html) ?? /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)
  const mainHtml = mainM ? mainM[1] : html
  const mainText = rawToText(mainHtml)

  const pdfUrls = new Set<string>()
  for (const m of mainHtml.matchAll(/href="([^"]+\.pdf)"/gi)) {
    const href = m[1]
    pdfUrls.add(href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`)
  }

  const titleM = /<title>([^<]*)<\/title>/i.exec(html)
  const title = titleM ? titleM[1].replace(/\s*[-|]\s*Ofcom\s*$/i, '').trim() : path
  return { mainText, pdfUrls: [...pdfUrls], title }
}

export async function fetchOfcomPdf(url: string): Promise<Buffer | null> {
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
