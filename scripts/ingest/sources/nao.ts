/**
 * nao.ts — National Audit Office reports (V20 probe 7 → routed).
 *
 * nao.org.uk is WordPress with an open REST API (verified 12 Jun 2026):
 *   /wp-json/wp/v2/report?per_page=100&page=N   (X-WP-Total: 2,755)
 * Report pages link PDFs under /wp-content/uploads/. PDFs are extracted from
 * the <main> region only — the site footer carries corporate PDFs (modern
 * slavery statement etc.) on every page.
 *
 * Licence: NAO copyright statement — free re-use for NON-COMMERCIAL purposes
 * with attribution ("Reproduced from '…'. National Audit Office"); commercial
 * use needs express permission. Recorded as 'nao-nc' in the licence map.
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const BASE = 'https://www.nao.org.uk'
const UA = 'Scrutinise-Ingest/1.0 (legal corpus research)'
const FETCH_TIMEOUT_MS = 60_000

const throttle = new AdaptiveThrottle({
  floor: 500,
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('nao', delayMs * 2)
      .catch(err => console.warn('[nao] suspend write failed:', err))
  },
})

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function get(url: string): Promise<Response | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return res
  } catch (err) {
    clear()
    console.warn(`[nao] fetch error ${url}: ${err}`)
    return null
  }
}

export interface NaoReport {
  id: number
  slug: string
  link: string
  title: string
  date: string | null
}

export async function listNaoReports(): Promise<NaoReport[]> {
  const out: NaoReport[] = []
  for (let page = 1; page <= 100; page++) {
    const res = await get(`${BASE}/wp-json/wp/v2/report?per_page=100&page=${page}`)
    if (!res) break
    const items = await res.json() as Array<{ id: number; slug: string; link: string; date: string; title: { rendered: string } }>
    if (!Array.isArray(items) || items.length === 0) break
    for (const it of items) {
      out.push({
        id: it.id, slug: it.slug, link: it.link,
        title: it.title?.rendered?.replace(/&#8211;/g, '–').replace(/&amp;/g, '&') ?? it.slug,
        date: it.date ? it.date.slice(0, 10) : null,
      })
    }
    if (items.length < 100) break
  }
  console.log(`[nao] enumerated ${out.length} reports`)
  return out
}

export async function fetchNaoReportPdfUrls(pageUrl: string): Promise<string[] | null> {
  const res = await get(pageUrl)
  if (!res) return null
  let html = await res.text()
  // Restrict to the main content region — footer carries site-wide PDFs.
  const mainMatch = /<main[\s\S]*?<\/main>/.exec(html)
  if (mainMatch) html = mainMatch[0]
  const urls = new Set<string>()
  for (const m of html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)) {
    urls.add(new URL(m[1], BASE).toString())
  }
  return [...urls]
}

export async function fetchNaoFile(url: string): Promise<Buffer | null> {
  const res = await get(url)
  if (!res) return null
  return Buffer.from(await res.arrayBuffer())
}
