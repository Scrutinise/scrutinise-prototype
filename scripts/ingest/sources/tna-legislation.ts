import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const TNA_BASE = 'https://www.legislation.gov.uk'
const throttle = new AdaptiveThrottle({ floor: 200 })

// Section = one <P1> element extracted from the full act CLML XML.
// No separate per-section URL fetch needed — all sections come from one data.xml download.
export interface TnaSection {
  sectionRef: string  // e.g. "section-1", "schedule-1-paragraph-2"
  xml: string         // full <P1>...</P1> CLML fragment
}

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' } })
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return res.text()
  } catch (err) {
    console.warn(`[tna] fetch error ${url}: ${err}`)
    return null
  }
}

// ── Act enumeration ────────────────────────────────────────────────────────────
// TNA year-level Atom feed: https://www.legislation.gov.uk/{type}/{year}/data.feed
// Each <id> element: http://www.legislation.gov.uk/id/{type}/{year}/{number}

export async function listActIds(type: string, yearMin: number, yearMax: number): Promise<string[]> {
  const ids: string[] = []
  let yearsWithResults = 0

  for (let year = yearMin; year <= yearMax; year++) {
    const listUrl = `${TNA_BASE}/${type}/${year}/data.feed`
    const xml = await fetchText(listUrl)
    if (!xml) continue

    // TNA <id> format: http://www.legislation.gov.uk/id/{type}/{year}/{number}
    // Handle both http:// and https://, and optional /id/ prefix
    const idRx = new RegExp(
      `https?://www\\.legislation\\.gov\\.uk/(?:id/)?(${type}/${year}/\\d+)`,
      'g'
    )
    let m: RegExpExecArray | null
    const before = ids.length
    const seen = new Set(ids)
    while ((m = idRx.exec(xml)) !== null) {
      if (!seen.has(m[1])) { ids.push(m[1]); seen.add(m[1]) }
    }
    if (ids.length > before) yearsWithResults++
  }

  console.log(`[tna] listActIds type=${type} years=${yearMin}-${yearMax}: ${ids.length} acts across ${yearsWithResults} years`)
  if (ids.length > 0) console.log(`[tna]   first=${ids[0]}  last=${ids[ids.length - 1]}`)
  return ids
}

// ── Section extraction ─────────────────────────────────────────────────────────
// Download the full act CLML via data.xml, then extract <P1> elements.
// Each <P1 id="section-N"> is one section. This costs 1 HTTP request per act,
// not 1 per section — far more efficient and avoids the data.feed format confusion.

export async function enumerateSections(actId: string): Promise<TnaSection[]> {
  const xmlUrl = `${TNA_BASE}/${actId}/data.xml`
  const fullXml = await fetchText(xmlUrl)
  if (!fullXml) {
    console.log(`[tna] no XML returned for ${actId} (${xmlUrl})`)
    return []
  }

  const sections: TnaSection[] = []
  // <P1 ...id="section-1"...> ... </P1>  — sections in body and schedules
  // Non-greedy so we get individual P1s, not one giant match.
  // P1 elements don't nest inside other P1 elements in CLML.
  const p1Rx = /<P1\s[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/P1>/g
  let m: RegExpExecArray | null
  while ((m = p1Rx.exec(fullXml)) !== null) {
    sections.push({ sectionRef: m[1], xml: m[0] })
  }

  if (sections.length === 0) {
    console.log(`[tna] 0 <P1> sections in ${actId} (XML length=${fullXml.length} — may be empty/repealed act)`)
  }
  return sections
}

// ── Worker corpus config ───────────────────────────────────────────────────────

export const WORKER_CORPORA: Record<number, { types: string[]; yearMin: number; yearMax: number }> = {
  1: { types: ['ukpga'],                       yearMin: 1267, yearMax: 1999 },
  2: { types: ['ukpga'],                       yearMin: 2000, yearMax: 2030 },
  3: { types: ['uksi'],                        yearMin: 1948, yearMax: 2009 },
  4: { types: ['uksi'],                        yearMin: 2010, yearMax: 2030 },
  5: { types: ['asp', 'anaw', 'nia', 'nisi', 'nisr'], yearMin: 1900, yearMax: 2030 },
  6: { types: ['eudn', 'eur', 'eudr'],         yearMin: 1900, yearMax: 2030 },
}
