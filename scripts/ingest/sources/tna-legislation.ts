import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const TNA_BASE = 'https://www.legislation.gov.uk'
const throttle = new AdaptiveThrottle({ floor: 200 })

export interface TnaSection {
  sectionRef: string
  url: string
}

export interface TnaAct {
  legislationGovUkId: string  // e.g. "ukpga/1998/42"
  feedUrl: string
  year: number
  type: string
}

// ── Feed enumeration ──────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

export async function enumerateSections(actId: string): Promise<TnaSection[]> {
  const feedUrl = `${TNA_BASE}/${actId}/data.feed`
  const xml = await fetchText(feedUrl)
  if (!xml) return []

  const sections: TnaSection[] = []
  // TNA feed returns Atom-style entries with links — extract section hrefs
  const entryRx = /<entry[\s\S]*?<\/entry>/g
  let match: RegExpExecArray | null
  while ((match = entryRx.exec(xml)) !== null) {
    const entry = match[0]
    // Find data.xml links (section content)
    const linkRx = /href="([^"]+\/section\/[^"]+\/data\.xml)"/
    const linkMatch = linkRx.exec(entry)
    if (!linkMatch) continue
    const href = linkMatch[1]
    // Extract section ref from URL path
    const sectionMatch = /\/section\/([^/]+)\/data\.xml$/.exec(href)
    if (!sectionMatch) continue
    sections.push({ sectionRef: sectionMatch[1], url: href.startsWith('http') ? href : `${TNA_BASE}${href}` })
  }
  return sections
}

export async function fetchSectionXml(url: string): Promise<string | null> {
  return fetchText(url)
}

// ── Act list builders ─────────────────────────────────────────────────────────

export async function listActIds(type: string, yearMin: number, yearMax: number): Promise<string[]> {
  const ids: string[] = []
  for (let year = yearMin; year <= yearMax; year++) {
    const listUrl = `${TNA_BASE}/${type}/${year}/data.feed`
    const xml = await fetchText(listUrl)
    if (!xml) continue

    const idRx = new RegExp(`<id>${TNA_BASE}/(${type}/${year}/\\d+)</id>`, 'g')
    let m: RegExpExecArray | null
    while ((m = idRx.exec(xml)) !== null) {
      ids.push(m[1])
    }
  }
  return ids
}

// Convenience builders for each worker partition
export const WORKER_CORPORA: Record<number, { types: string[]; yearMin: number; yearMax: number }> = {
  1: { types: ['ukpga'],         yearMin: 1267, yearMax: 1999 },
  2: { types: ['ukpga'],         yearMin: 2000, yearMax: 2030 },
  3: { types: ['uksi'],          yearMin: 1948, yearMax: 2009 },
  4: { types: ['uksi'],          yearMin: 2010, yearMax: 2030 },
  5: { types: ['asp', 'anaw', 'nia', 'nisi', 'nisr'], yearMin: 1900, yearMax: 2030 },
  6: { types: ['eudn', 'eur', 'eudr'], yearMin: 1900, yearMax: 2030 },
}
