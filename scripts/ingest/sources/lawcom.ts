/**
 * lawcom.ts — Law Commission of England & Wales (V20 probe 4).
 *
 * lawcom.gov.uk is WordPress with an open REST API (verified 12 Jun 2026):
 *   /wp-json/wp/v2/publication?per_page=100&page=N   (X-WP-Total: 240)
 * Publication pages link PDFs on the MoJ CDN
 * (cdn.websitebuilder.service.justice.gov.uk) in single-quoted hrefs.
 * Licence: site footer states OGL v3.0 (verified).
 *
 * Universe note: the current site holds 240 publications; pre-redesign LC
 * papers (the commission has issued 400+ since 1965) live only in the UK Gov
 * Web Archive — out of universe here, recorded in the V20 scorecard.
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const BASE = 'https://lawcom.gov.uk'
const UA = 'Scrutinise-Ingest/1.0 (legal corpus research)'
const FETCH_TIMEOUT_MS = 60_000

const throttle = new AdaptiveThrottle({
  floor: 500,
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('lawcom', delayMs * 2)
      .catch(err => console.warn('[lawcom] suspend write failed:', err))
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
    console.warn(`[lawcom] fetch error ${url}: ${err}`)
    return null
  }
}

export interface LawcomPublication {
  id: number
  slug: string
  link: string
  title: string
  date: string | null  // YYYY-MM-DD
}

export async function listLawcomPublications(): Promise<LawcomPublication[]> {
  const out: LawcomPublication[] = []
  for (let page = 1; page <= 50; page++) {
    const res = await get(`${BASE}/wp-json/wp/v2/publication?per_page=100&page=${page}`)
    if (!res) break
    const items = await res.json() as Array<{ id: number; slug: string; link: string; date: string; title: { rendered: string } }>
    if (!Array.isArray(items) || items.length === 0) break
    for (const it of items) {
      out.push({
        id: it.id,
        slug: it.slug,
        link: it.link,
        title: it.title?.rendered?.replace(/&#8211;/g, '–').replace(/&amp;/g, '&') ?? it.slug,
        date: it.date ? it.date.slice(0, 10) : null,
      })
    }
    if (items.length < 100) break
  }
  console.log(`[lawcom] enumerated ${out.length} publications`)
  return out
}

// Document links from a publication page: PDFs/docs on the MoJ CDN or under
// lawcom uploads. Hrefs appear in BOTH single and double quotes.
export async function fetchLawcomDocumentUrls(pageUrl: string): Promise<string[] | null> {
  const res = await get(pageUrl)
  if (!res) return null
  const html = await res.text()
  const urls = new Set<string>()
  for (const m of html.matchAll(/href=["']([^"']+\.(?:pdf|docx?)(?:\?[^"']*)?)["']/gi)) {
    urls.add(new URL(m[1], BASE).toString())
  }
  return [...urls]
}

export async function fetchLawcomFile(url: string): Promise<Buffer | null> {
  const res = await get(url)
  if (!res) return null
  return Buffer.from(await res.arrayBuffer())
}
