import { AdaptiveThrottle } from '../shared/adaptive-throttle'

// UK Treaties — FCDO publishes the UK Treaties Online register.
// Open-access source: gov.uk Treaties & MoUs collection (no API key required).
// Rate limit: 500ms floor (gov.uk content API is rate-limited at ~2 req/s).
const GOV_SEARCH = 'https://www.gov.uk/api/search.json'
const GOV_CONTENT = 'https://www.gov.uk/api/content'
const throttle = new AdaptiveThrottle({ floor: 500, ceiling: 60_000 })
const UA = 'Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)'

export interface UkTreaty {
  id: string
  title: string
  url: string
  date: string
}

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (res.status === 429) { throttle.backoff(); return null }
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// Enumerate UK treaties from the gov.uk search API.
// Searches for "treaty" documents published by the Foreign Commonwealth Development Office.
// Each result is a treaty page on gov.uk with structured HTML content.
export async function* listUkTreaties(maxItems = 2000): AsyncGenerator<UkTreaty> {
  let start = 0
  const pageSize = 50
  let yielded = 0
  const seenIds = new Set<string>()

  while (yielded < maxItems) {
    // gov.uk search: filter by "treaty" keyword and FCDO/FCO as publishing organisation
    const url =
      `${GOV_SEARCH}?q=treaty&filter_organisations[]=foreign-commonwealth-development-office` +
      `&count=${pageSize}&start=${start}&order=newest`

    const data = await fetchJson(url) as {
      results?: Array<{
        title?: string
        link?: string
        _id?: string
        public_timestamp?: string
      }>
      total?: number
    } | null

    const results = data?.results ?? []
    if (results.length === 0) break

    for (const r of results) {
      if (!r.link || seenIds.has(r.link)) continue
      seenIds.add(r.link)
      const fullUrl = r.link.startsWith('http') ? r.link : `https://www.gov.uk${r.link}`
      yield {
        id: (r._id ?? r.link).replace(/[^a-z0-9\-/]/gi, '-').replace(/-+/g, '-').slice(0, 160),
        title: r.title ?? '',
        url: fullUrl,
        date: (r.public_timestamp ?? '').slice(0, 10),
      }
      yielded++
      if (yielded >= maxItems) break
    }

    if (results.length < pageSize) break
    start += pageSize
  }
}

// Fetch and extract text from a gov.uk treaty page.
// Uses the gov.uk content API for structured JSON where available,
// otherwise falls back to HTML scraping.
export async function fetchTreatyText(url: string): Promise<string | null> {
  // Try JSON content API first (gov.uk provides structured content for most pages)
  const apiPath = url.replace('https://www.gov.uk', '')
  const jsonData = await fetchJson(`${GOV_CONTENT}${apiPath}`) as {
    details?: { body?: string }
    title?: string
    description?: string
  } | null

  if (jsonData?.details?.body) {
    const body = jsonData.details.body
    const title = jsonData.title ?? ''
    const desc = jsonData.description ?? ''

    const text = `${title}\n\n${desc}\n\n${body}`
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text || null
  }

  // HTML fallback
  const html = await fetchHtml(url)
  if (!html) return null

  const mainMatch =
    /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html) ??
    /<div[^>]+class="[^"]*govuk-grid-column[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
  const body = mainMatch ? mainMatch[1] : html

  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
}
