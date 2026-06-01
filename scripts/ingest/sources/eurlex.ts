import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const EUR_LEX_BASE = 'https://eur-lex.europa.eu'
const throttle = new AdaptiveThrottle({ floor: 500 })

export interface EurLexDoc {
  celexId: string
  title: string
  date: string
  url: string
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Scrutinise-Ingest/1.0', 'Accept-Language': 'en' },
  })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

interface SearchPage {
  results?: Array<{ celex?: string; title?: string; date?: string }>
}

async function fetchSearchPage(page: number, pageSize: number): Promise<SearchPage | null> {
  await throttle.wait()
  const url = `${EUR_LEX_BASE}/search.html` +
    `?scope=EURLEX&type=quick&lang=en` +
    `&andText0=united+kingdom&celex=3*` +
    `&page=${page}&pageSize=${pageSize}&format=json`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Scrutinise-Ingest/1.0' },
  })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() as SearchPage } catch { return null }
}

// Paginate through EUR-Lex CELEX series 3 (secondary legislation) filtered to
// UK-relevant instruments — the ~4 000 items that became UK retained EU law.
export async function* listRetainedEuInstruments(maxItems = 5000): AsyncGenerator<EurLexDoc> {
  let page = 1
  const pageSize = 100
  let fetched = 0

  while (fetched < maxItems) {
    const data = await fetchSearchPage(page, pageSize)
    if (!data) continue  // rate-limited — throttle already backed off, retry same page

    const items = data.results ?? []
    if (items.length === 0) break

    for (const item of items) {
      if (!item.celex) continue
      yield {
        celexId: item.celex,
        title: item.title ?? '',
        date: item.date ?? '',
        url: `${EUR_LEX_BASE}/legal-content/EN/TXT/HTML/?uri=CELEX:${item.celex}`,
      }
      if (++fetched >= maxItems) return
    }

    if (items.length < pageSize) break
    page++
  }
}

export async function fetchDocumentText(celexId: string): Promise<string | null> {
  const url = `${EUR_LEX_BASE}/legal-content/EN/TXT/HTML/?uri=CELEX:${celexId}`
  const html = await fetchHtml(url)
  if (!html) return null

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
