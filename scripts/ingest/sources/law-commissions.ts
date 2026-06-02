import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const throttle = new AdaptiveThrottle({ floor: 300, ceiling: 60_000 })
const UA = 'Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)'

export interface LawCommissionReport {
  id: string
  title: string
  pdfUrl: string
  sourceUrl: string
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// ── Scottish Law Commission ───────────────────────────────────────────────────
// Listing: https://www.scotlawcom.gov.uk/publications/ (46 pages, 454 reports)
// Individual pub page → /sites/default/files/YYYY-MM/report.pdf

const SCOTLAWCOM_BASE = 'https://www.scotlawcom.gov.uk'

function extractTitle(html: string): string {
  const m = /<h1[^>]*>([^<]+)<\/h1>/i.exec(html)
  return m ? m[1].trim() : ''
}

function extractPdfLinks(html: string, base: string): string[] {
  const results: string[] = []
  const seen = new Set<string>()
  const rx = /href="(\/sites\/default\/files\/[^"]+\.pdf)"/gi
  let m: RegExpExecArray | null
  while ((m = rx.exec(html)) !== null) {
    const url = `${base}${m[1]}`
    if (!seen.has(url)) { seen.add(url); results.push(url) }
  }
  return results
}

export async function* listScotLawComReports(): AsyncGenerator<LawCommissionReport> {
  let page = 1
  const seen = new Set<string>()

  while (true) {
    const listUrl = page === 1
      ? `${SCOTLAWCOM_BASE}/publications/`
      : `${SCOTLAWCOM_BASE}/publications/?page=${page}`
    const listHtml = await fetchHtml(listUrl)
    if (!listHtml) break

    // Extract links to individual publication pages
    const pubRx = /href="(\/publications\/[a-z0-9][a-z0-9-]+)"/g
    const pubPaths: string[] = []
    let pm: RegExpExecArray | null
    while ((pm = pubRx.exec(listHtml)) !== null) {
      const path = pm[1]
      if (!seen.has(path)) { seen.add(path); pubPaths.push(path) }
    }

    if (pubPaths.length === 0) break

    for (const path of pubPaths) {
      const pubUrl = `${SCOTLAWCOM_BASE}${path}`
      const pubHtml = await fetchHtml(pubUrl)
      if (!pubHtml) continue

      const pdfUrls = extractPdfLinks(pubHtml, SCOTLAWCOM_BASE)
      if (pdfUrls.length === 0) continue

      const title = extractTitle(pubHtml)
      const id = path.replace('/publications/', '').slice(0, 120)

      // Yield only the primary (first) PDF per publication
      yield { id, title, pdfUrl: pdfUrls[0], sourceUrl: pubUrl }
    }

    // Advance to next page only if a next-page link exists
    if (!new RegExp(`page=${page + 1}`).test(listHtml) && !/rel="next"/.test(listHtml)) break
    page++
  }
}

// ── Northern Ireland Law Commission ───────────────────────────────────────────
// Non-operational since April 2015. ~18 historical reports at nilawcommission.gov.uk.
// Simple index-page scrape — the org's homepage lists completed reports with PDF links.

const NILAWCOM_BASE = 'https://www.nilawcommission.gov.uk'

export async function* listNiLawComReports(): AsyncGenerator<LawCommissionReport> {
  const html = await fetchHtml(NILAWCOM_BASE)
  if (!html) return

  const seen = new Set<string>()
  const rx = /href="([^"]+\.pdf)"/gi
  let m: RegExpExecArray | null
  while ((m = rx.exec(html)) !== null) {
    const href = m[1]
    const pdfUrl = href.startsWith('http') ? href : `${NILAWCOM_BASE}/${href.replace(/^\//, '')}`
    if (seen.has(pdfUrl)) continue
    seen.add(pdfUrl)
    const id = pdfUrl.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(-80)
    yield { id, title: id, pdfUrl, sourceUrl: NILAWCOM_BASE }
  }
}
