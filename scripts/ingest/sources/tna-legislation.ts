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
  if (!xml) {
    console.log(`[tna] enumerateSections: no feed for ${actId}`)
    return []
  }

  const sections: TnaSection[] = []
  // TNA section links: href="http://www.legislation.gov.uk/{actId}/section/{N}/data.xml"
  // Also handle schedule, crossheading, etc. — match any /data.xml link containing the actId
  const linkRx = new RegExp(
    `href="(https?://www\\.legislation\\.gov\\.uk/${actId}/[^"]+/data\\.xml)"`,
    'g'
  )
  let m: RegExpExecArray | null
  while ((m = linkRx.exec(xml)) !== null) {
    const href = m[1]
    // Extract the section ref: everything between actId/ and /data.xml
    const refMatch = new RegExp(`/${actId}/(.+)/data\\.xml$`).exec(href)
    if (!refMatch) continue
    const sectionRef = refMatch[1]
    // Skip top-level document links (no sub-path component)
    if (!sectionRef.includes('/')) continue
    sections.push({ sectionRef, url: href })
  }

  if (sections.length === 0) {
    console.log(`[tna] enumerateSections: 0 sections found for ${actId} — feed may use different link format`)
  }
  return sections
}

export async function fetchSectionXml(url: string): Promise<string | null> {
  return fetchText(url)
}

// ── Act list builders ─────────────────────────────────────────────────────────

export async function listActIds(type: string, yearMin: number, yearMax: number): Promise<string[]> {
  const ids: string[] = []
  let yearsWithResults = 0

  for (let year = yearMin; year <= yearMax; year++) {
    const listUrl = `${TNA_BASE}/${type}/${year}/data.feed`
    const xml = await fetchText(listUrl)
    if (!xml) continue

    // TNA Atom feed <id> format: http://www.legislation.gov.uk/id/{type}/{year}/{number}
    // Handle both http:// and https://, and optional /id/ prefix
    const idRx = new RegExp(
      `https?://www\\.legislation\\.gov\\.uk/(?:id/)?(${type}/${year}/\\d+)`,
      'g'
    )
    let m: RegExpExecArray | null
    let countBefore = ids.length
    while ((m = idRx.exec(xml)) !== null) {
      if (!ids.includes(m[1])) ids.push(m[1])
    }
    if (ids.length > countBefore) yearsWithResults++
  }

  console.log(`[tna] listActIds type=${type} years=${yearMin}-${yearMax}: ${ids.length} acts across ${yearsWithResults} years`)
  if (ids.length > 0) console.log(`[tna] first act: ${ids[0]}, last: ${ids[ids.length - 1]}`)
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
