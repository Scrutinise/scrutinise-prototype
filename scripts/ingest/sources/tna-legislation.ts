import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const TNA_BASE = 'https://www.legislation.gov.uk'
const throttle = new AdaptiveThrottle({ floor: 200 })

export type SectionFormat = 'clml' | 'clml-unparsed' | 'html' | 'pdf' | 'unavailable'

// One logical section from a TNA act.
// clml:          a single known CLML element (P1/Article/Regulation/Rule/Paragraph/Section)
// clml-unparsed: CLML returned but no known elements found — full XML stored as one blob
// html:          CLML returned nothing, HTML fallback succeeded — raw HTML stored in rawHtml
// pdf:           HTML also failed, PDF fallback succeeded — binary in pdfBuffer
// unavailable:   all three formats returned nothing
export interface TnaSection {
  sectionRef: string
  format: SectionFormat
  xml?: string          // clml / clml-unparsed
  rawHtml?: string      // html
  pdfBuffer?: Buffer    // pdf
  xmlPreview?: string   // clml-unparsed: first 200 chars of raw XML for diagnostic email
  errorMsg?: string     // unavailable
  isEnactedOnly?: boolean // true when TNA only has enacted text (no consolidated version)
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    if (res.status === 404 || res.status === 410) return null
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return res.text()
  } catch (err) {
    console.warn(`[tna] fetch error ${url}: ${err}`)
    return null
  }
}

async function fetchBinary(url: string): Promise<Buffer | null> {
  await throttle.wait()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    if (res.status === 404 || res.status === 410) return null
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.warn(`[tna] fetch error ${url}: ${err}`)
    return null
  }
}

// ── Act enumeration ────────────────────────────────────────────────────────────
// TNA year-level Atom feed: https://www.legislation.gov.uk/{type}/{year}/data.feed
// Returns only 20 items per page. Dense years (e.g. uksi/1983 has 1129 SIs) include
// range-bucket navigation links (href=".../uksi/1983/0-99/data.feed", ".../100-199/data.feed" etc.)
// that must be fetched individually and paginated.
//
// IMPORTANT: regex must match ONLY <id>...</id> elements.
// The bucket hrefs like ".../uksi/1983/0-99/data.feed" would otherwise match as
// "uksi/1983/0" (regex stops at the dash), producing fake sequential IDs.

function extractIdElements(xml: string, type: string, year: number, ids: string[], seen: Set<string>): void {
  const idRx = new RegExp(
    `<id>https?://www\\.legislation\\.gov\\.uk/(?:id/)?(${type}/${year}/\\d+)</id>`,
    'g'
  )
  let m: RegExpExecArray | null
  while ((m = idRx.exec(xml)) !== null) {
    if (!seen.has(m[1])) { ids.push(m[1]); seen.add(m[1]) }
  }
}

async function fetchAllPages(baseUrl: string, type: string, year: number, ids: string[], seen: Set<string>): Promise<void> {
  let start = 1
  while (true) {
    const url = start === 1 ? baseUrl : `${baseUrl}?start=${start}`
    const xml = await fetchText(url)
    if (!xml) break
    const before = ids.length
    extractIdElements(xml, type, year, ids, seen)
    const moreMatch = /<leg:morePages>(\d+)<\/leg:morePages>/.exec(xml)
    if (!moreMatch || parseInt(moreMatch[1], 10) === 0 || ids.length === before) break
    start += 20
  }
}

export async function listActIds(type: string, yearMin: number, yearMax: number): Promise<string[]> {
  const ids: string[] = []
  const seen = new Set<string>()
  let yearsWithResults = 0

  for (let year = yearMin; year <= yearMax; year++) {
    const yearUrl = `${TNA_BASE}/${type}/${year}/data.feed`
    const yearXml = await fetchText(yearUrl)
    if (!yearXml) continue

    const before = ids.length

    // Extract range-bucket URLs from year feed (present when year has >20 items)
    // e.g. href="http://www.legislation.gov.uk/uksi/1983/0-99/data.feed"
    const bucketRx = /href="(https?:\/\/www\.legislation\.gov\.uk\/[^"]+\/\d+-\d+\/data\.feed)"/g
    const bucketUrls: string[] = []
    let bm: RegExpExecArray | null
    while ((bm = bucketRx.exec(yearXml)) !== null) bucketUrls.push(bm[1])

    if (bucketUrls.length > 0) {
      // Paginate each range bucket — each bucket may itself have multiple pages
      for (const bucketUrl of bucketUrls) {
        await fetchAllPages(bucketUrl, type, year, ids, seen)
      }
    } else {
      // Small year: all items fit in one page, extract from year feed directly
      await fetchAllPages(yearUrl, type, year, ids, seen)
    }

    if (ids.length > before) yearsWithResults++
  }

  console.log(`[tna] listActIds type=${type} years=${yearMin}-${yearMax}: ${ids.length} acts across ${yearsWithResults} years`)
  if (ids.length > 0) console.log(`[tna]   first=${ids[0]}  last=${ids[ids.length - 1]}`)
  return ids
}

// ── Enacted-only detection ────────────────────────────────────────────────────
// TNA serves two versions of legislation: revised (consolidated with amendments)
// and enacted (original text only). When only the enacted version exists, the root
// element attributes contain the word "enacted". Detecting this early lets us flag
// sections so we can later identify acts that need amendment tracking.

function detectEnactedOnly(xml: string): boolean {
  // Skip XML declaration (<?xml ... ?>) if present, then inspect root element attrs
  const afterDecl = xml.trimStart().startsWith('<?') ? xml.indexOf('?>') + 2 : 0
  const rootTagEnd = xml.indexOf('>', afterDecl)
  if (rootTagEnd === -1) return false
  return /\benacted\b/i.test(xml.slice(afterDecl, rootTagEnd + 1))
}

// ── Section extraction ─────────────────────────────────────────────────────────
// Known CLML section element types that carry top-level numbered content.
// If none are found in the downloaded XML, the full XML is stored as clml-unparsed.
const CLML_SECTION_ELEMENTS = ['P1', 'Article', 'Regulation', 'Rule', 'Paragraph', 'Section']
const CLML_ELEM_PATTERN = CLML_SECTION_ELEMENTS.join('|')

// Matches <ElemName id="..."> ... </ElemName> non-greedily.
// Backreference \1 ensures the opening and closing tags are the same element type.
// Note: nested elements of the same type may get incorrect inner-match boundaries,
// but this is acceptable — content is preserved and ids are unique.
const CLML_SECTION_RX = new RegExp(
  `<(${CLML_ELEM_PATTERN})(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>`,
  'g'
)

function extractClmlSections(xml: string): TnaSection[] {
  const sections: TnaSection[] = []
  CLML_SECTION_RX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CLML_SECTION_RX.exec(xml)) !== null) {
    const attrs = m[2] ?? ''
    const idMatch = /\bid="([^"]+)"/.exec(attrs)
    if (!idMatch) continue
    sections.push({ sectionRef: idMatch[1], format: 'clml', xml: m[0] })
  }
  return sections
}

// ── enumerateSections — fetch priority chain ──────────────────────────────────
// 1. CLML (data.xml)  — extract known elements; if 0 found, store full XML as clml-unparsed
// 2. HTML  (data.htm) — strip tags in worker; stored as rawHtml
// 3. PDF   (data.pdf) — stored as binary; worker writes placeholder compiled text
// 4. Unavailable      — all three returned nothing; DB row with status=unavailable

export async function enumerateSections(actId: string): Promise<TnaSection[]> {
  // 1. CLML
  const xmlUrl = `${TNA_BASE}/${actId}/data.xml`
  const fullXml = await fetchText(xmlUrl)

  if (fullXml && fullXml.trim().length > 0) {
    const isEnactedOnly = detectEnactedOnly(fullXml)
    if (isEnactedOnly) console.log(`[tna] ${actId}: enacted-only (no consolidated version)`)

    const sections = extractClmlSections(fullXml)
    if (sections.length > 0) {
      return isEnactedOnly
        ? sections.map(s => ({ ...s, isEnactedOnly: true }))
        : sections
    }
    // XML returned but no known CLML elements found — store whole doc as one blob
    console.log(`[tna] ${actId}: 0 known CLML elements (XML ${fullXml.length} chars) — storing as clml-unparsed`)
    return [{
      sectionRef: 'full-doc',
      format: 'clml-unparsed',
      xml: fullXml,
      xmlPreview: fullXml.trim().slice(0, 200),
      isEnactedOnly,
    }]
  }

  // 2. HTML fallback
  const htmlUrl = `${TNA_BASE}/${actId}/data.htm`
  const rawHtml = await fetchText(htmlUrl)
  if (rawHtml && rawHtml.trim().length > 0) {
    console.log(`[tna] ${actId}: HTML fallback (${rawHtml.length} chars)`)
    return [{ sectionRef: 'full-doc-html', format: 'html', rawHtml }]
  }

  // 3. PDF fallback
  const pdfUrl = `${TNA_BASE}/${actId}/data.pdf`
  const pdfBuffer = await fetchBinary(pdfUrl)
  if (pdfBuffer && pdfBuffer.length > 0) {
    console.log(`[tna] ${actId}: PDF fallback (${pdfBuffer.length} bytes)`)
    return [{ sectionRef: 'full-doc-pdf', format: 'pdf', pdfBuffer }]
  }

  // 4. Unavailable
  console.log(`[tna] ${actId}: no CLML/HTML/PDF — marking unavailable`)
  return [{
    sectionRef: 'unavailable',
    format: 'unavailable',
    errorMsg: 'No CLML/HTML/PDF found on TNA',
  }]
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
