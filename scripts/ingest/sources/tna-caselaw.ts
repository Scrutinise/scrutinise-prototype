import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const TNA_CASELAW_BASE = 'https://caselaw.nationalarchives.gov.uk'
const ATOM_FEED = `${TNA_CASELAW_BASE}/atom.xml`
const ITEMS_PER_PAGE = 50  // TNA atom feed returns 50 entries per page
const throttle = new AdaptiveThrottle({
  floor: 200,
  ceiling: 30_000,
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('tna-caselaw', delayMs * 2)
      .catch(err => console.warn('[tna-caselaw] suspend write failed:', err))
  },
})
const UA = 'Scrutinise-Ingest/1.0 (Open Justice; contact: cl@scrutinise.org)'

export interface CaseLawJudgment {
  uri: string            // e.g. "uksc/2024/1" or "d-f11e093f-..."
  neutralCitation: string // e.g. "[2024] UKSC 1"
  name: string
  date: string           // YYYY-MM-DD
  xmlUrl: string         // https://…/data.xml
}

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// Extract last-page number from the Atom feed's <link rel="last"> element.
// Feed links have the form: href="...?page=7485" rel="last"
function extractLastPage(xml: string): number {
  // href always comes before rel in TNA feed link elements
  const m = /href="[^"]+\?page=([0-9]+)"[^>]*rel="last"/.exec(xml)
    ?? /rel="last"[^>]*href="[^"]+\?page=([0-9]+)"/.exec(xml)
  return m ? parseInt(m[1], 10) : 0
}

// Get total judgment count.  Fetches just the first Atom page, reads the
// last-page link, and multiplies by ITEMS_PER_PAGE.
export async function getTotalJudgments(): Promise<number> {
  const xml = await fetchText(ATOM_FEED)
  if (!xml) return 0
  const lastPage = extractLastPage(xml)
  return lastPage > 0 ? lastPage * ITEMS_PER_PAGE : 0
}

// Parse all CaseLawJudgment entries out of one page of the Atom feed.
function parseEntries(xml: string): CaseLawJudgment[] {
  const results: CaseLawJudgment[] = []
  const entryRx = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null

  while ((m = entryRx.exec(xml)) !== null) {
    const entry = m[1]

    // AKN XML link: type="application/akn+xml"
    const xmlLinkM = /href="(https:\/\/caselaw\.nationalarchives\.gov\.uk\/[^"]+\/data\.xml)"/.exec(entry)
    if (!xmlLinkM) continue
    const xmlUrl = xmlLinkM[1]

    // Derive URI by stripping base URL and /data.xml suffix
    const uri = xmlUrl
      .replace(`${TNA_CASELAW_BASE}/`, '')
      .replace('/data.xml', '')

    // Neutral citation (type="ukncn") — not all documents have one
    const ncnM = /<tna:identifier[^>]+type="ukncn"[^>]*>([^<]+)<\/tna:identifier>/.exec(entry)
      ?? /tna:identifier[^>]+type="ukncn">([^<]+)</.exec(entry)
    const neutralCitation = ncnM ? ncnM[1].trim() : ''

    // Title (second <title> element — first is the feed title)
    const titleM = /<title>([^<]+)<\/title>/.exec(entry)
    const name = titleM ? titleM[1].trim() : ''

    // Published date
    const dateM = /<published>([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(entry)
    const date = dateM ? dateM[1] : ''

    results.push({ uri, neutralCitation, name, date, xmlUrl })
  }

  return results
}

// Paginate through the entire Atom feed, oldest-first (highest page first)
// so checkpoint resume by neutralCitation / URI works correctly.
// Oldest judgments are on the highest page numbers; newest on page 1.
// We iterate page 1 → lastPage so newest are ingested first (higher value).
export async function* listJudgments(): AsyncGenerator<CaseLawJudgment> {
  const firstXml = await fetchText(ATOM_FEED)
  if (!firstXml) return

  const lastPage = extractLastPage(firstXml)
  if (lastPage === 0) {
    // Fallback: just yield entries from the first page we already have
    for (const j of parseEntries(firstXml)) yield j
    return
  }

  // Yield page 1 (already fetched)
  for (const j of parseEntries(firstXml)) yield j

  // Fetch remaining pages
  for (let page = 2; page <= lastPage; page++) {
    const xml = await fetchText(`${ATOM_FEED}?page=${page}`)
    if (!xml) continue
    const entries = parseEntries(xml)
    if (entries.length === 0) break
    for (const j of entries) yield j
  }
}

export async function fetchJudgmentXml(xmlUrl: string): Promise<string | null> {
  return fetchText(xmlUrl)
}
