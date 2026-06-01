import { AdaptiveThrottle } from '../shared/adaptive-throttle'

// OECD iLibrary free tier — only open-access content.
// The iLibrary does not have a simple public JSON search API.
// We use two approaches:
//   1. OECD's open data portal (stats.oecd.org) for structured datasets
//   2. gov.uk search for OECD-referenced policy guidance (free HTML)
const OECD_STATS = 'https://stats.oecd.org/SDMX-JSON/data'
const GOV_SEARCH = 'https://www.gov.uk/api/search.json'
const throttle = new AdaptiveThrottle({ floor: 500, ceiling: 60_000 })
const UA = 'Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)'

export interface OecdDoc {
  id: string
  title: string
  url: string
  type: string
}

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// Enumerate OECD-related open-access documents via gov.uk content API.
// These are UK government documents that reference or implement OECD frameworks
// (OECD BEPS, OECD development finance, OECD anti-corruption conventions, etc.)
export async function* listOecdOpenDocs(maxItems = 500): AsyncGenerator<OecdDoc> {
  const queries = ['OECD framework', 'OECD convention', 'OECD guidelines', 'OECD model tax']
  let yielded = 0
  const seenUrls = new Set<string>()

  for (const q of queries) {
    if (yielded >= maxItems) break
    let start = 0
    const pageSize = 50

    while (yielded < maxItems) {
      const url = `${GOV_SEARCH}?q=${encodeURIComponent(q)}&count=${pageSize}&start=${start}`
      const data = await fetchJson(url) as {
        results?: Array<{ title?: string; link?: string; _id?: string }>
      } | null
      const results = data?.results ?? []
      if (results.length === 0) break

      for (const r of results) {
        if (!r.link || seenUrls.has(r.link)) continue
        seenUrls.add(r.link)
        const fullUrl = r.link.startsWith('http') ? r.link : `https://www.gov.uk${r.link}`
        yield {
          id: (r._id ?? r.link).replace(/[^a-z0-9-]/gi, '-').slice(0, 120),
          title: r.title ?? '',
          url: fullUrl,
          type: 'policy-guidance',
        }
        yielded++
        if (yielded >= maxItems) break
      }

      if (results.length < pageSize) break
      start += pageSize
    }
  }
}

export async function fetchDocText(url: string): Promise<string | null> {
  const html = await fetchText(url)
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
