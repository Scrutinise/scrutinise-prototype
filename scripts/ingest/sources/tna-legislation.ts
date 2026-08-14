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
  // V36: this note used to read "The text of this instrument exists as a PDF on
  // legislation.gov.uk but has not yet been extracted. It is queued for PDF
  // processing." BOTH halves were false for every one of 52 randomly sampled
  // instruments carrying this status: no PDF exists at the address the classifier
  // probed, and `specialist_queue` — where the "queued" rows go — has one writer,
  // no consumer, and 117,667 rows that have been `pending` since June 2026.
  // Telling a user their document is queued for processing that nobody performs is
  // the never-claim discipline broken in the quietest possible way.
  'pdf-only':
    'legislation.gov.uk holds no structured text for this instrument. A scanned or ' +
    'PDF version may exist on the source site; we have not been able to retrieve one. ' +
    'The title, number and date are held.',
  'metadata-only':
    'Only the title, number, and date of this instrument are held. No text has been ' +
    'digitised. This is typically the case for instruments made before 1980 that were ' +
    'not included in TNA\'s digitisation programme.',
  'no-provisions':
    'This instrument exists in the legislation database but contains no structured text. ' +
    'It may be a very short instrument (a single sentence) or may require manual review.',
}

/**
 * Thrown when every format for an instrument came back empty AND at least one of
 * those non-answers was retryable (429/503/5xx/network/timeout).
 *
 * The worker loop catches it and marks the queue row `failed` with this message,
 * which is a state we can see and re-run. The alternative — the behaviour this
 * replaces — was an `unavailable` section row claiming the instrument has no text,
 * which is indistinguishable from a genuine `NumberOfProvisions="0"` and which the
 * reseed dedup treats as work already done.
 */
export class RetryableSourceError extends Error {
  readonly retryable = true
  constructor(message: string) { super(message); this.name = 'RetryableSourceError' }
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000
const HEAD_TIMEOUT_MS  = 10_000

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

// Status-aware fetch: callers that enumerate universes must distinguish a
// deterministic miss (404/410 — the resource is absent) from a retryable
// failure (429/503/network — V19's enumeration silently dropped 429'd years
// because both came back as null).
async function fetchTextWithStatus(url: string): Promise<{ text: string | null; retryable: boolean }> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    clear()
    if (res.status === 404 || res.status === 410) return { text: null, retryable: false }
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return { text: null, retryable: true } }
    // 300 Multiple Choices is an ANSWER, not a non-answer: the id is ambiguous and
    // the body carries the disambiguation list. `!res.ok` below would sweep it in
    // with 5xx and retry it to the attempt cap, which is what recorded
    // `ukpga/Geo5Sess2/13/3` as a rate-limit failure after five tries. An ambiguity
    // is deterministic — the same request returns the same 300 forever.
    if (res.status === 300) return { text: null, retryable: false }
    if (!res.ok) return { text: null, retryable: true }
    throttle.success()
    return { text: await res.text(), retryable: false }
  } catch (err) {
    clear()
    console.warn(`[tna] fetch error ${url}: ${err}`)
    return { text: null, retryable: true }
  }
}

async function fetchText(url: string): Promise<string | null> {
  return (await fetchTextWithStatus(url)).text
}

// ⚠ UNUSED since V36, and kept only so the next person does not reinvent it:
// legislation.gov.uk answers HEAD on data.pdf with **405 Method Not Allowed**, so
// this returns false for every instrument whether or not a PDF exists. It cannot
// be used as an existence probe against TNA. Use pdfExists() below, which GETs a
// 1KB range and checks the %PDF- magic.
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

// Binary twin of fetchTextWithStatus. V36: enumerateSections needs the retryable
// flag from the PDF leg too — a 429 on data.pdf was the last of the three
// non-answers that let a rate limit be recorded as "this instrument has no text".
async function fetchBinaryWithStatus(url: string): Promise<{ buf: Buffer | null; retryable: boolean }> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    clear()
    if (res.status === 404 || res.status === 410) return { buf: null, retryable: false }
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return { buf: null, retryable: true } }
    if (res.status === 300) return { buf: null, retryable: false }  // see fetchTextWithStatus
    if (!res.ok) return { buf: null, retryable: true }
    throttle.success()
    return { buf: Buffer.from(await res.arrayBuffer()), retryable: false }
  } catch (err) {
    clear()
    console.warn(`[tna] fetch error ${url}: ${err}`)
    return { buf: null, retryable: true }
  }
}

async function fetchBinary(url: string): Promise<Buffer | null> {
  return (await fetchBinaryWithStatus(url)).buf
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

// Enumerate ONE year. Returns null when the year could not be fetched cleanly
// (429/503/network somewhere in the walk) so the caller can retry it — a 404'd
// year feed is a deterministic empty year and returns []. Never silently
// partial: any retryable failure mid-walk poisons the whole year.
export async function listActEntriesYear(type: string, year: number): Promise<TnaActEntry[] | null> {
  const out: TnaActEntry[] = []
  const seen = new Set<string>()
  const yearUrl = `${TNA_BASE}/${type}/${year}/data.feed`
  const first = await fetchTextWithStatus(yearUrl)
  if (!first.text) return first.retryable ? null : []

  const bucketRx = /href="(https?:\/\/www\.legislation\.gov\.uk\/[^"]+\/\d+-\d+\/data\.feed)"/g
  const bucketUrls: string[] = []
  let bm: RegExpExecArray | null
  while ((bm = bucketRx.exec(first.text)) !== null) bucketUrls.push(bm[1])

  const startUrls = bucketUrls.length > 0 ? bucketUrls : [yearUrl]
  for (const startUrl of startUrls) {
    let url: string | null = startUrl
    let xml = startUrl === yearUrl ? first.text : null
    while (url) {
      if (xml === null) {
        const page = await fetchTextWithStatus(url)
        if (!page.text) {
          if (page.retryable) return null
          break // deterministic miss on a continuation page — accept what we have
        }
        xml = page.text
      }
      const before = out.length
      extractEntries(xml, type, out, seen)
      const next = /<link rel="next"[^>]*href="([^"]+)"/.exec(xml)
      if (!next || out.length === before) break
      url = next[1].replace(/^http:/, 'https:')
      xml = null
    }
  }
  return out
}

// Checkpointed year-range enumeration (V20). Playbook §8 rules baked in:
// progress logged per year, checkpoint written per year so reruns resume,
// throttled years retried across passes, and an EXPLICIT throw if any year
// stays unfetchable — never a silently partial universe.
export async function enumerateActEntriesCheckpointed(
  type: string, yearMin: number, yearMax: number, checkpointPath: string, maxPasses = 5
): Promise<TnaActEntry[]> {
  const fs = await import('fs')
  const done: Record<string, TnaActEntry[]> = fs.existsSync(checkpointPath)
    ? JSON.parse(fs.readFileSync(checkpointPath, 'utf8'))
    : {}

  let pending: number[] = []
  for (let y = yearMin; y <= yearMax; y++) if (!done[`${type}/${y}`]) pending.push(y)
  console.log(`[tna-enum] ${type} ${yearMin}-${yearMax}: ${Object.keys(done).filter(k => k.startsWith(`${type}/`)).length} years from checkpoint, ${pending.length} to fetch`)

  for (let pass = 1; pass <= maxPasses && pending.length > 0; pass++) {
    const failed: number[] = []
    for (const year of pending) {
      const entries = await listActEntriesYear(type, year)
      if (entries === null) {
        console.warn(`[tna-enum] ${type}/${year}: throttled — will retry (pass ${pass})`)
        failed.push(year)
        continue
      }
      done[`${type}/${year}`] = entries
      fs.writeFileSync(checkpointPath, JSON.stringify(done))
      console.log(`[tna-enum] ${type}/${year}: ${entries.length}`)
    }
    pending = failed
    if (pending.length > 0 && pass < maxPasses) {
      console.warn(`[tna-enum] pass ${pass} left ${pending.length} throttled years — cooling 120s`)
      await new Promise(r => setTimeout(r, 120_000))
    }
  }

  if (pending.length > 0) {
    throw new Error(`[tna-enum] ${type}: ${pending.length} years still unfetchable after ${maxPasses} passes (${pending.slice(0, 10).join(', ')}…) — universe INCOMPLETE, rerun when TNA cools`)
  }

  const out: TnaActEntry[] = []
  const seen = new Set<string>()
  for (let y = yearMin; y <= yearMax; y++) {
    for (const e of done[`${type}/${y}`] ?? []) {
      if (seen.has(e.docId)) continue
      seen.add(e.docId)
      out.push(e)
    }
  }
  console.log(`[tna] enumerate type=${type} years=${yearMin}-${yearMax}: ${out.length} acts`)
  return out
}

// ── Explanatory Notes / Memoranda (V20 probe 3) ──────────────────────────────
// EN (Acts, 1999+): /{actId}/pdfs/{type}en_{year}{nnnn}_en.pdf, HTML at /{actId}/notes
// EM (SIs, ~2002+): /{siId}/pdfs/{type}em_{year}{nnnn}_en.pdf, HTML at /{siId}/memorandum/contents
// Routes verified 12 Jun 2026 (ukpga/2020/1 EN 1.6MB pdf; uksi/2020/100 EM 47KB pdf).
// Uses the SAME adaptive throttle as everything else in this file — one
// politeness budget per host (playbook §1b).

export interface ExplanatoryDoc {
  pdf?: Buffer
  html?: string
  absent: boolean
}

export async function fetchExplanatoryDocument(kind: 'en' | 'em', legId: string): Promise<ExplanatoryDoc | null> {
  const m = /^([a-z]+)\/([0-9]{4})\/([0-9]+)$/.exec(legId)
  if (!m) return { absent: true }
  const [, type, year, num] = m
  const pdfUrl = `${TNA_BASE}/${legId}/pdfs/${type}${kind}_${year}${num.padStart(4, '0')}_en.pdf`
  const pdf = await fetchBinary(pdfUrl)
  if (pdf && pdf.slice(0, 5).toString('ascii') === '%PDF-') return { pdf, absent: false }

  const htmlUrl = kind === 'en' ? `${TNA_BASE}/${legId}/notes` : `${TNA_BASE}/${legId}/memorandum/contents`
  const html = await fetchText(htmlUrl)
  if (html) return { html, absent: false }
  return { absent: true }
}

export async function listActEntries(type: string, yearMin: number, yearMax: number): Promise<TnaActEntry[]> {
  const out: TnaActEntry[] = []
  const seen = new Set<string>()
  for (let year = yearMin; year <= yearMax; year++) {
    const entries = await listActEntriesYear(type, year)
    if (entries === null) { console.warn(`[tna-enum] ${type}/${year}: SKIPPED (throttled) — universe may be partial; prefer enumerateActEntriesCheckpointed`); continue }
    for (const e of entries) {
      if (seen.has(e.docId)) continue
      seen.add(e.docId)
      out.push(e)
    }
    console.log(`[tna-enum] ${type}/${year}: +${entries.length} (total ${out.length})`)
  }
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

  // Does a PDF actually exist? V36: this was a HEAD request, and TNA answers HEAD
  // on data.pdf with **405 Method Not Allowed** — so the probe cannot distinguish
  // "there is a PDF" from anything else. 117,667 instruments are already classified
  // `pdf-only` on its say-so, and a random sample of 52 of them found **0 with a
  // PDF**: /{id}/data.pdf 301s to /{id}/made/data.pdf, which 404s. The user-facing
  // note for `pdf-only` told readers "The text of this instrument exists as a PDF
  // on legislation.gov.uk", which for those 52 is a claim about a file that is not
  // there.
  //
  // A real GET, checking the content type of what actually arrives, is the only
  // probe that answers the question. It costs a request; a wrong classification
  // costs a false statement to a user, which is the more expensive of the two.
  if (await pdfExists(docId)) return 'pdf-only'

  return 'no-provisions'
}

/** True only when a GET returns a body that is actually a PDF — redirects followed,
 *  content type checked, and a zero-length body rejected. */
async function pdfExists(docId: string): Promise<boolean> {
  await throttle.wait()
  const { signal, clear } = withTimeout(HEAD_TIMEOUT_MS)
  try {
    const res = await fetch(`${TNA_BASE}/${docId}/data.pdf`, {
      signal,
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)', Range: 'bytes=0-1023' },
    })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return false }
    if (!res.ok && res.status !== 206) return false
    throttle.success()
    const ct = (res.headers.get('content-type') ?? '').toLowerCase()
    if (!ct.includes('pdf')) return false
    const head = Buffer.from(await res.arrayBuffer())
    // %PDF- magic. A 200 that serves an HTML error page with a PDF content type is
    // exactly the shape of miss this whole comment exists about.
    return head.length > 4 && head.subarray(0, 5).toString('latin1') === '%PDF-'
  } catch {
    clear()
    return false
  }
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
  const [clml, effectsXml] = await Promise.all([
    fetchTextWithStatus(`${TNA_BASE}/${actId}/data.xml`),
    fetchText(`${TNA_BASE}/${actId}/effects/data.feed`),
  ])
  const fullXml = clml.text
  // V36: carried all the way to the fallback so a rate limit cannot be written
  // down as a property of the instrument. See RetryableSourceError below.
  let anyRetryable = clml.retryable

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
    const htm = await fetchTextWithStatus(`${TNA_BASE}/${actId}/data.htm`)
    const rawHtml = htm.text
    anyRetryable = anyRetryable || htm.retryable
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
      const pdf = await fetchBinaryWithStatus(`${TNA_BASE}/${actId}/data.pdf`)
      const pdfBuffer = pdf.buf
      anyRetryable = anyRetryable || pdf.retryable
      if (pdfBuffer && pdfBuffer.length > 0) {
        console.log(`[tna] ${actId}: PDF fallback (${pdfBuffer.length} bytes)`)
        sections.push({ sectionRef: 'full-doc-pdf', format: 'pdf', pdfBuffer })
      } else if (anyRetryable) {
        // V36. THE DIFFERENCE THIS MAKES, measured: 8,583 instruments carry
        // `No CLML/HTML/PDF found on TNA`, all written during the June 2026 sweep
        // at a steady 1–2.5% of every SI year — and 27.5% of a random sample of
        // them returns real CLML on a plain re-fetch today. The marker was never a
        // fact about the instrument; it was the fetch outcome of one minute,
        // written into corpus_sections where the reseed dedup then saw a row and
        // never came back. Throwing hands the row to the worker's catch, which
        // marks it `failed` with the reason — visible in the queue and retryable,
        // instead of invisible and permanent. §18's rule, applied to a fetch: a
        // degradation must announce itself, with its cause attached.
        throw new RetryableSourceError(
          `${actId}: no CLML/HTML/PDF, and at least one format failed RETRYABLY ` +
          `(429/503/5xx/network) — refusing to record "unavailable" for what may be a rate limit`)
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
