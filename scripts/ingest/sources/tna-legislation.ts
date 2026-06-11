import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const TNA_BASE = 'https://www.legislation.gov.uk'
const throttle = new AdaptiveThrottle({
  // TNA_THROTTLE_FLOOR_MS: local enumeration runs raise this (V19: TNA 429'd a
  // 200ms feed-pagination sweep; politeness budget says halve, so 500ms there).
  floor: Number(process.env.TNA_THROTTLE_FLOOR_MS ?? 200),
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('tna-legislation', delayMs * 2)
      .catch(err => console.warn('[tna-leg] suspend write failed:', err))
  },
})

export type SectionFormat = 'clml' | 'clml-unparsed' | 'html' | 'pdf' | 'unavailable' | 'effects'

export type NoProvisionsClass = 'commencement' | 'revoked' | 'pdf-only' | 'metadata-only' | 'no-provisions'

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
  // Set when format === 'unavailable' and hasNoProvisions=true — result of classifyNoProvisionsItem()
  classifiedAs?: NoProvisionsClass
  legislationTitle?: string
  legislationYear?: number
}

// User-facing notes for each availability status — Lex shows these to users.
export const AVAILABILITY_NOTES: Record<NoProvisionsClass, string> = {
  commencement:
    'This is a commencement order that brought other legislation into force. ' +
    'The full text exists on legislation.gov.uk but has not yet been extracted. ' +
    'It is queued for processing by a specialist worker.',
  revoked:
    'This instrument was revoked or repealed. Metadata is held but the full text ' +
    'has not been digitised. The original may be available in parliamentary archives ' +
    'or the British Library. Case law may refer to this instrument.',
  'pdf-only':
    'The text of this instrument exists as a PDF on legislation.gov.uk but has not ' +
    'yet been extracted. It is queued for PDF processing.',
  'metadata-only':
    'Only the title, number, and date of this instrument are held. No text has been ' +
    'digitised. This is typically the case for instruments made before 1980 that were ' +
    'not included in TNA\'s digitisation programme.',
  'no-provisions':
    'This instrument exists in the legislation database but contains no structured text. ' +
    'It may be a very short instrument (a single sentence) or may require manual review.',
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000
const HEAD_TIMEOUT_MS  = 10_000

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    clear()
    if (res.status === 404 || res.status === 410) return null
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return res.text()
  } catch (err) {
    clear()
    console.warn(`[tna] fetch error ${url}: ${err}`)
    return null
  }
}

async function headRequest(url: string): Promise<boolean> {
  await throttle.wait()
  const { signal, clear } = withTimeout(HEAD_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal,
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    clear()
    if (res.ok) { throttle.success(); return true }
    if (res.status === 429 || res.status === 503) throttle.backoff()
    return false
  } catch {
    clear()
    return false
  }
}

async function fetchBinary(url: string): Promise<Buffer | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    clear()
    if (res.status === 404 || res.status === 410) return null
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    clear()
    console.warn(`[tna] fetch error ${url}: ${err}`)
    return null
  }
}

// ── Format discovery ──────────────────────────────────────────────────────────
// Before attempting CLML/HTML/PDF, query TNA's per-document Atom feed to discover
// what formats are actually available.  Never attempt a format that isn't listed.
//
// Returns e.g. ["xml", "html", "pdf"] or [] if the feed is unavailable.
// Stored as formatsAvailable in ingest_queue for permanent record.
export async function discoverFormats(actId: string): Promise<string[]> {
  const feedUrl = `${TNA_BASE}/${actId}/data.feed`
  const xml = await fetchText(feedUrl)
  if (!xml) return []

  const formats: string[] = []
  // <link rel="alternate" type="application/xml" title="XML" href="..."/>
  // <link rel="alternate" type="application/pdf" .../>
  // <link rel="alternate" type="text/html" .../>
  const linkRx = /<link[^>]+type="([^"]+)"[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = linkRx.exec(xml)) !== null) {
    const mime = m[1]
    if (mime.includes('xml'))  formats.push('xml')
    else if (mime.includes('pdf'))  formats.push('pdf')
    else if (mime.includes('html')) formats.push('html')
  }
  // Deduplicate preserving order
  return [...new Set(formats)]
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
  // V18 fix: feeds paginate via <link rel="next" href="...?page=N">, not
  // ?start=N. The old ?start= param was ignored by TNA, so page 2+ returned
  // page 1 again and the ids.length guard stopped after 20 items. Years with
  // range buckets (dense uksi years) were unaffected; bucket-less years —
  // ALL eur/eudn/eudr years — were silently capped at 20 instruments each,
  // which is why retained-eu was under-enumerated from V2 to V17.
  let url: string | null = baseUrl
  while (url) {
    const xml = await fetchText(url)
    if (!xml) break
    const before = ids.length
    extractIdElements(xml, type, year, ids, seen)
    const next = /<link rel="next"[^>]*href="([^"]+)"/.exec(xml)
    if (!next || ids.length === before) break
    url = next[1].replace(/^http:/, 'https:')
  }
}

// ── Entry-level enumeration (V19) ─────────────────────────────────────────────
// Pre-1963 acts are canonically identified by REGNAL session, not calendar year:
// the feed <id> is e.g. .../id/ukpga/Geo5/14-15/41 and the calendar identity
// lives in <ukm:Year>/<ukm:Number>. listActIds' regex (type/year/number) silently
// dropped every regnal id, so pre-1963 acts were never enumerable — the V19
// root cause of the primary-acts-pre-2000 "gap". A calendar id is not even
// addressable for some of them: ukpga/1924/3 is HTTP 300 (two acts are chapter 3
// of 1924 under different sessions). Use the regnal id as docId for those.
export interface TnaActEntry {
  docId: string        // canonical id from the feed (regnal for pre-1963)
  calendarId: string | null  // `${type}/${year}/${number}` when both attrs present
}

function extractEntries(xml: string, type: string, out: TnaActEntry[], seen: Set<string>): void {
  for (const chunk of xml.split('<entry>').slice(1)) {
    const idm = /<id>https?:\/\/www\.legislation\.gov\.uk\/(?:id\/)?([^<]+)<\/id>/.exec(chunk)
    if (!idm || !idm[1].startsWith(`${type}/`) || idm[1].includes('data.feed')) continue
    const docId = idm[1]
    if (seen.has(docId)) continue
    seen.add(docId)
    const ym = /<ukm:Year Value="(\d+)"/.exec(chunk)
    const nm = /<ukm:Number Value="(\d+)"/.exec(chunk)
    out.push({ docId, calendarId: ym && nm ? `${type}/${ym[1]}/${nm[1]}` : null })
  }
}

async function fetchAllEntryPages(baseUrl: string, type: string, out: TnaActEntry[], seen: Set<string>): Promise<void> {
  let url: string | null = baseUrl
  while (url) {
    const xml = await fetchText(url)
    if (!xml) break
    const before = out.length
    extractEntries(xml, type, out, seen)
    const next = /<link rel="next"[^>]*href="([^"]+)"/.exec(xml)
    if (!next || out.length === before) break
    url = next[1].replace(/^http:/, 'https:')
  }
}

export async function listActEntries(type: string, yearMin: number, yearMax: number): Promise<TnaActEntry[]> {
  const out: TnaActEntry[] = []
  const seen = new Set<string>()
  let yearsWithResults = 0

  for (let year = yearMin; year <= yearMax; year++) {
    const yearUrl = `${TNA_BASE}/${type}/${year}/data.feed`
    const yearXml = await fetchText(yearUrl)
    if (!yearXml) continue

    const before = out.length
    const bucketRx = /href="(https?:\/\/www\.legislation\.gov\.uk\/[^"]+\/\d+-\d+\/data\.feed)"/g
    const bucketUrls: string[] = []
    let bm: RegExpExecArray | null
    while ((bm = bucketRx.exec(yearXml)) !== null) bucketUrls.push(bm[1])

    if (bucketUrls.length > 0) {
      for (const bucketUrl of bucketUrls) await fetchAllEntryPages(bucketUrl, type, out, seen)
    } else {
      await fetchAllEntryPages(yearUrl, type, out, seen)
    }
    if (out.length > before) yearsWithResults++
  }

  console.log(`[tna] listActEntries type=${type} years=${yearMin}-${yearMax}: ${out.length} acts across ${yearsWithResults} years`)
  return out
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

// ── Root attribute helpers ────────────────────────────────────────────────────

function rootAttrs(xml: string): string {
  // Returns the root element's opening tag, skipping any XML declaration.
  const afterDecl = xml.trimStart().startsWith('<?') ? xml.indexOf('?>') + 2 : 0
  const end = xml.indexOf('>', afterDecl)
  return end === -1 ? '' : xml.slice(afterDecl, end + 1)
}

// TNA serves two versions of legislation:
//   revised  — consolidated with amendments applied by TNA editorial
//   enacted/made — original text only (Primary Acts: /enacted, SIs: /made)
// The DocumentURI attribute identifies which version this document is.
// Revised versions have no suffix (just /ukpga/2000/8).
function detectEnactedOnly(xml: string): boolean {
  return /\bDocumentURI="[^"]*\/(enacted|made)"/.test(rootAttrs(xml))
}

// NumberOfProvisions="0" means the CLML contains metadata only — no body text.
// These acts exist as PDF-only; falling through to the HTML/PDF fetchers is correct.
function hasNoProvisions(xml: string): boolean {
  return /\bNumberOfProvisions="0"/.test(rootAttrs(xml))
}

// ── hasNoProvisions classification ────────────────────────────────────────────
// WHY: hasNoProvisions items are real legal instruments, not errors.
// We classify them and record metadata rather than silently discarding.
// This ensures Lex can tell users what exists and what's missing.

function extractTitleFromXml(xml: string): string | undefined {
  const m = /<ShortTitle>([^<]+)<\/ShortTitle>/.exec(xml)
    ?? /<Title>([^<]+)<\/Title>/.exec(xml)
  return m ? m[1].trim() : undefined
}

function extractYearFromDocId(docId: string): number | undefined {
  const m = /\/(\d{4})\//.exec(docId)
  return m ? parseInt(m[1], 10) : undefined
}

export async function classifyNoProvisionsItem(
  docId: string,
  fullXml: string,
): Promise<NoProvisionsClass> {
  const title = (extractTitleFromXml(fullXml) ?? '').toLowerCase()
  const year = extractYearFromDocId(docId)

  // Commencement/appointed day orders identifiable by title
  if (
    title.includes('commencement') ||
    title.includes('appointed day') ||
    title.includes('coming into force')
  ) {
    return 'commencement'
  }

  // Pre-digitisation threshold — pre-1980 items rarely have text
  if (year !== undefined && year < 1980) return 'metadata-only'

  // Check if PDF exists on TNA (lightweight HEAD request, no body fetch)
  const hasPdf = await headRequest(`${TNA_BASE}/${docId}/data.pdf`)
  if (hasPdf) return 'pdf-only'

  return 'no-provisions'
}

export function extractSectionMetadata(
  docId: string,
  fullXml: string,
): { title?: string; year?: number } {
  return {
    title: extractTitleFromXml(fullXml),
    year: extractYearFromDocId(docId),
  }
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

// ── enumerateSections — fetch priority chain + parallel effects feed ──────────
// Primary content: CLML (data.xml) → HTML (data.htm) → PDF (data.pdf) → unavailable
// Effects feed: fetched in parallel with data.xml; appended as a separate section
//   if the feed returns content regardless of which primary format was used.

export async function enumerateSections(actId: string): Promise<TnaSection[]> {
  // Kick off CLML and effects feed in parallel — saves one RTT per act
  const [fullXml, effectsXml] = await Promise.all([
    fetchText(`${TNA_BASE}/${actId}/data.xml`),
    fetchText(`${TNA_BASE}/${actId}/effects/data.feed`),
  ])

  const sections: TnaSection[] = []

  // ── Primary format ────────────────────────────────────────────────────────
  if (fullXml && fullXml.trim().length > 0) {
    const isEnactedOnly = detectEnactedOnly(fullXml)
    if (isEnactedOnly) console.log(`[tna] ${actId}: enacted/made — flagging as enacted-only`)

    const clmlSections = extractClmlSections(fullXml)
    if (clmlSections.length > 0) {
      sections.push(...(isEnactedOnly
        ? clmlSections.map(s => ({ ...s, isEnactedOnly: true }))
        : clmlSections))
    } else if (hasNoProvisions(fullXml)) {
      // NumberOfProvisions="0": real legal instruments in a distinct state requiring
      // different handling. Classify them so Lex can explain what exists to users.
      const classifiedAs = await classifyNoProvisionsItem(actId, fullXml)
      const { title, year } = extractSectionMetadata(actId, fullXml)
      console.log(`[tna] ${actId}: hasNoProvisions — classified as ${classifiedAs}`)
      sections.push({
        sectionRef: 'unavailable',
        format: 'unavailable',
        errorMsg: `hasNoProvisions — classified as ${classifiedAs}`,
        classifiedAs,
        legislationTitle: title,
        legislationYear: year,
      })
    } else {
      // CLML present but no recognised element types — store as clml-unparsed
      // so the scheduler email can show the XML preview for regex diagnosis.
      console.log(`[tna] ${actId}: 0 known CLML elements (XML ${fullXml.length} chars) — storing as clml-unparsed`)
      sections.push({
        sectionRef: 'full-doc',
        format: 'clml-unparsed',
        xml: fullXml,
        xmlPreview: fullXml.trim().slice(0, 200),
        isEnactedOnly,
      })
    }
  }

  // HTML/PDF fallback — runs only when CLML was entirely absent (no XML returned)
  if (sections.length === 0) {
    const rawHtml = await fetchText(`${TNA_BASE}/${actId}/data.htm`)
    // V19 guard: data.htm on acts with no digitised text redirects to the act's
    // landing page — site chrome with zero body text. 5,840 pre-1963 acts were
    // silently ingested as ~834 words of boilerplate each (uniform wordCount was
    // the tell). Real legislation HTML carries LegRHS/LegP1ParaText/LegSnippet
    // body markers; chrome-only pages carry none. Reject chrome so genuinely
    // textless acts fall through to PDF and then a classified unavailable marker.
    const hasLegContent = !!rawHtml && /LegRHS|LegP1ParaText|LegP2ParaText|LegClearFix LegProv/.test(rawHtml)
    if (rawHtml && rawHtml.trim().length > 0 && hasLegContent) {
      console.log(`[tna] ${actId}: HTML fallback (${rawHtml.length} chars)`)
      sections.push({ sectionRef: 'full-doc-html', format: 'html', rawHtml })
    } else {
      if (rawHtml && !hasLegContent) console.log(`[tna] ${actId}: data.htm is chrome-only (no Leg* body markers) — trying PDF`)
      const pdfBuffer = await fetchBinary(`${TNA_BASE}/${actId}/data.pdf`)
      if (pdfBuffer && pdfBuffer.length > 0) {
        console.log(`[tna] ${actId}: PDF fallback (${pdfBuffer.length} bytes)`)
        sections.push({ sectionRef: 'full-doc-pdf', format: 'pdf', pdfBuffer })
      } else {
        console.log(`[tna] ${actId}: no CLML/HTML/PDF — marking unavailable`)
        sections.push({ sectionRef: 'unavailable', format: 'unavailable', errorMsg: 'No CLML/HTML/PDF found on TNA' })
      }
    }
  }

  // ── Effects feed — appended regardless of primary format ─────────────────
  if (effectsXml && effectsXml.trim().length > 0) {
    sections.push({ sectionRef: 'effects', format: 'effects', xml: effectsXml })
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
