import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const TNA_CASELAW_BASE = 'https://caselaw.nationalarchives.gov.uk'
const throttle = new AdaptiveThrottle({ floor: 200 })

export interface CaseLawJudgment {
  uri: string          // e.g. "/ewca/civ/2023/100"
  neutralCitation: string
  name: string
  date: string
  xmlUrl: string
}

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (Open Justice)' } })
  if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

// Probe the first search page and return the total judgment count.
export async function getTotalJudgments(): Promise<number> {
  const url = `${TNA_CASELAW_BASE}/search/results.json?query=*&page=1&per_page=1&order=date`
  const data = await fetchJson(url) as SearchResult | null
  return data?.total ?? 0
}

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (Open Justice)' } })
  if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

interface SearchResult {
  results?: Array<{
    uri: string
    neutral_citation?: string
    name?: string
    date?: string
  }>
  total?: number
}

export async function* listJudgments(pageSize = 50): AsyncGenerator<CaseLawJudgment> {
  let page = 1
  let exhausted = false

  while (!exhausted) {
    const url = `${TNA_CASELAW_BASE}/search/results.json?query=*&page=${page}&per_page=${pageSize}&order=date`
    const data = await fetchJson(url) as SearchResult | null
    if (!data || !Array.isArray(data.results) || data.results.length === 0) break

    for (const item of data.results) {
      yield {
        uri: item.uri,
        neutralCitation: item.neutral_citation ?? '',
        name: item.name ?? '',
        date: item.date ?? '',
        xmlUrl: `${TNA_CASELAW_BASE}${item.uri}/data.xml`,
      }
    }

    if (data.results.length < pageSize) exhausted = true
    page++
  }
}

export async function fetchJudgmentXml(xmlUrl: string): Promise<string | null> {
  return fetchText(xmlUrl)
}

