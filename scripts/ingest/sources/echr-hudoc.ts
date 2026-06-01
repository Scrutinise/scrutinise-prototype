import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const HUDOC_BASE = 'https://hudoc.echr.coe.int'
const throttle = new AdaptiveThrottle({ floor: 500 })

export interface EchrCase {
  itemId: string
  docName: string
  date: string
  importance: string
  url: string
}

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

const UK_QUERY = 'country:GBR AND (doctype:JUDGMENTS OR doctype:DECISIONS)'

// Get total number of UK judgments/decisions from HUDOC before iterating.
export async function countUkCases(): Promise<number> {
  const url = `${HUDOC_BASE}/app/query/results` +
    `?select=itemid&query=${encodeURIComponent(UK_QUERY)}&start=0&length=1`
  const data = await fetchJson(url) as {
    results?: { resultcount?: number }
  } | null
  return data?.results?.resultcount ?? 0
}

export async function* listUkCases(pageSize = 50): AsyncGenerator<EchrCase> {
  let start = 0
  while (true) {
    const url = `${HUDOC_BASE}/app/query/results` +
      `?select=itemid,docname,kpdate,importance` +
      `&query=${encodeURIComponent(UK_QUERY)}` +
      `&start=${start}&length=${pageSize}`

    const data = await fetchJson(url) as {
      results?: {
        Result?: Array<{ itemid?: string; docname?: string; kpdate?: string; importance?: string }>
        resultcount?: number
      }
    } | null

    const items = data?.results?.Result ?? []
    if (items.length === 0) break

    for (const item of items) {
      if (!item.itemid) continue
      yield {
        itemId: item.itemid,
        docName: item.docname ?? '',
        date: item.kpdate ?? '',
        importance: item.importance ?? '',
        url: `${HUDOC_BASE}/#{"itemid":["${item.itemid}"]}`,
      }
    }

    if (items.length < pageSize) break
    start += pageSize
  }
}

export async function fetchCaseText(itemId: string, docName: string): Promise<string | null> {
  // Fetch HTML version of judgment — more reliable than PDF for text extraction
  const htmlUrl = `${HUDOC_BASE}/app/conversion/html/?library=ECHR&id=${itemId}`
  const html = await fetchText(htmlUrl)
  if (!html) return null

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
