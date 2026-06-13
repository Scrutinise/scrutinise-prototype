/**
 * historic-hansard.ts — Historic Hansard 1803–1918 from the Parliament bulk
 * archive (V21). Bulk beats crawl: www.hansard-archive.parliament.uk serves
 * per-volume zips of hansard_v12 XML (one XML per zip, named after the stem).
 *
 * Verified 12 Jun 2026:
 *  - Listings are ASP.NET WebForms GridView pages (10 zips/page) — pagination
 *    via __doPostBack with VIEWSTATE round-tripping; plain Node fetch works.
 *  - The host soft-404s: ANY path returns HTTP 200 (unknown → text/html page),
 *    so the LISTING is the universe (unlisted volumes verified absent) and
 *    every zip fetch must check the PK magic bytes.
 *  - Volumes can be split (S1V0009P0_a/_b) or multi-part (P0/P1); each zip is
 *    one docId. Real gaps exist (e.g. S1 vol 2 was never digitised to XML).
 *  - Cloudflare fronts the host (__cf_bm) but serves the honest ingest UA
 *    locally; Railway egress unverified until the post-push canary.
 *
 * Scope cutoffs are PER-HOUSE (V22) — each house hands off to pwdata at the
 * exact first day its pwdata corpus covers:
 *  - Commons: items dated >= 1919-02-04 dropped (first pwdata-debates file;
 *    S5C vol 112 starts that exact day — Parliament did not sit between
 *    21 Nov 1918 and 4 Feb 1919). S5C vols 1–111 here.
 *  - Lords: items dated >= 1999-11-17 dropped (first pwdata-lords file,
 *    daylord1999-11-17a.xml — verified 13 Jun 2026; S5L vol 607 STARTS that
 *    exact day, vol 606 ends 11 Nov 1999 at prorogation). S5L vols 1–606 here
 *    — the V21 "Lords 1919–1999 hole" closed by V22.
 *
 * XML shape (hansard_v12): <hansard> → titlepage/frontmatter (chrome) →
 * <housecommons>/<houselords> per sitting, each with <title>, <date
 * format="yyyy-mm-dd">, intro <p>, and <debates> of nested <section>s whose
 * <p>s carry <member> + <membercontribution>. <index> blocks are back matter.
 * Items are emitted ONLY inside house containers, so chrome self-excludes.
 */
import AdmZip from 'adm-zip'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const BASE = 'https://www.hansard-archive.parliament.uk'
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'

// First in-scope pwdata day per house — see header. Exact, not approximate.
export const HISTORIC_HANSARD_CUTOFF = '1919-02-04'        // Commons (pwdata-debates)
export const HISTORIC_HANSARD_LORDS_CUTOFF = '1999-11-17'  // Lords (pwdata-lords, V22)

export interface HouseCutoffs { commons: string; lords: string }
export const DEFAULT_CUTOFFS: HouseCutoffs = {
  commons: HISTORIC_HANSARD_CUTOFF,
  lords: HISTORIC_HANSARD_LORDS_CUTOFF,
}

interface SeriesConfig {
  dir: string
  maxVol: number | null  // null = take everything listed
}

// Directory names are fixed strings on the archive site (verified 12 Jun 2026).
export const HANSARD_SERIES: Record<string, SeriesConfig> = {
  S1:  { dir: 'Parliamentary_Debates_Vol_1_(1803)_to_Vol_41_(Feb_1820)', maxVol: null },
  S2:  { dir: 'Parliamentary_Debates,_New_Series_Vol_1_(April_1820)_to_Vol_25_(July_1830)', maxVol: null },
  S3:  { dir: 'Parliamentary_Debates_(3rd_Series)_Vol_1_(Oct_1830)_to_Vol_356_(August_1891)', maxVol: null },
  S4:  { dir: 'Parliamentary_Debates_(4th_Series)_Vol_1_(February_1892)_to_Vol_199_(December_1908)', maxVol: null },
  // 5th series runs past each house's pwdata handoff — cap at the last volume
  // that sits before it (Commons: S5C 112 starts 1919-02-04; Lords: S5L 607
  // starts 1999-11-17 — V22 lifted the S5L cap from 32 to close the
  // Lords 1919–1999 hole; zips spot-checked PK-real to vol 606).
  S5C: { dir: 'Official_Report,_House_of_Commons_(5th_Series)_Vol_1_(Jan_1909)_to_Vol_1000_(March_1981)', maxVol: 111 },
  S5L: { dir: 'The_Official_Report,_House_of_Lords_(5th_Series)_Vol_1_(Jan_1909)_to_2004', maxVol: 606 },
}

// docId = zip filename stem, e.g. "S1V0001P0", "S1V0009P0_a", "S5CV0050P1".
const STEM_RE = /^(S5C|S5L|S[1-4])V(\d{4})P(\d)(_[a-z])?$/

export function parseVolumeStem(docId: string): { series: string; volume: number; part: number; split: string | null } | null {
  const m = STEM_RE.exec(docId)
  if (!m) return null
  return { series: m[1], volume: parseInt(m[2], 10), part: parseInt(m[3], 10), split: m[4]?.slice(1) ?? null }
}

export function volumeZipUrl(docId: string): string | null {
  const stem = parseVolumeStem(docId)
  if (!stem) return null
  return `${BASE}/${HANSARD_SERIES[stem.series].dir}/${docId}.zip`
}

// ── Listing walk (seeder only — runs locally, ~80 pages total) ───────────────

function hiddenField(html: string, name: string): string {
  const m = html.match(new RegExp(`id="${name}" value="([^"]*)"`))
  return m ? m[1] : ''
}

function zipStemsOf(html: string): string[] {
  return [...html.matchAll(/href="[^"]+\/([^/"]+)\.zip"/g)].map(m => m[1])
}

function pagerTargets(html: string): Array<{ target: string; label: string }> {
  return [...html.matchAll(/__doPostBack\('([^']*VolumeGrid[^']*)',''\)"[^>]*>([^<]+)</g)]
    .map(m => ({ target: m[1], label: m[2].trim() }))
}

// Listing fetches go through curl, not Node fetch (V23). CF JA3-blocks undici
// on the listing path with a near-zero budget — once a walk trips it, every
// undici request 403s for hours while curl is served 200 at the same moment
// (verified 13 Jun 2026; the committees-portal V16 fingerprint pattern). The
// cookie jar keeps CF's session continuity across postbacks (V16: jar sessions
// stay valid 100+ pages). spawnSync is fine here — the walk is a local seeder,
// never a Railway worker (no curl in Railway containers).
const LISTING_COOKIE_JAR = path.join(os.tmpdir(), 'hansard-archive-cookies.txt')

function curlFetch(url: string, post?: { body: string }): { status: number; text: string } {
  const args = [
    '-s', '-S', '--max-time', '60', '-w', '\n%{http_code}',
    '-A', UA, '-c', LISTING_COOKIE_JAR, '-b', LISTING_COOKIE_JAR,
  ]
  if (post) args.push('--data-raw', post.body, '-H', 'Content-Type: application/x-www-form-urlencoded')
  args.push(url)
  const res = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (res.error) throw res.error
  if (res.status !== 0) throw new Error(`curl exit ${res.status}: ${(res.stderr ?? '').trim()}`)
  const out = res.stdout
  const nl = out.lastIndexOf('\n')
  return { status: parseInt(out.slice(nl + 1).trim(), 10), text: out.slice(0, nl) }
}

interface WalkProgress { page: number; stems: string[]; html: string }

// Walks every listing page of a series via WebForms postbacks. The pager shows
// a numbered window plus "..." continuation links; we always click the link
// labelled with the next page number, falling back to the trailing "...".
// CF rate-limits sustained listing walks (403 at S5C page 24 on the first full
// run — the V20 committees/judiciaryni pattern), so page fetches retry after
// 60s cooling; and a series with maxVol stops as soon as a page is entirely
// past the cap (the listing is volume-ordered), which keeps S5C to ~12 pages
// instead of ~100.
//
// V23 — resumable walk: S5L at cap 606 is ~61 pages, well past CF's sustained-
// walk budget, so it WILL trip mid-walk. With `opts.resumeFile`, after every
// page we persist {page, stems, html} (html carries the VIEWSTATE needed to
// re-issue the next postback). A 403 after the in-fetch cooloff throws, but the
// sidecar holds every page crawled so far; the next run loads it and continues
// from the last good page. Once the walk completes the sidecar is deleted.
export async function listHistoricHansardVolumes(
  seriesKey: string,
  opts: { gapMs?: number; resumeFile?: string } = {},
): Promise<string[]> {
  const config = HANSARD_SERIES[seriesKey]
  if (!config) throw new Error(`Unknown Hansard series: ${seriesKey}`)
  const gapMs = opts.gapMs ?? 1000
  const url = `${BASE}/${config.dir}`

  const fetchWithCooling = async (post?: { body: string }): Promise<string> => {
    for (let attempt = 1; ; attempt++) {
      const { status, text } = curlFetch(url, post)
      if (status === 200) return text
      if (attempt >= 4) throw new Error(`hansard-archive listing ${seriesKey}: HTTP ${status} after ${attempt} attempts`)
      console.warn(`[hansard-archive] ${seriesKey}: HTTP ${status} — cooling 60s (attempt ${attempt})`)
      await new Promise(r => setTimeout(r, 60_000))
    }
  }

  const save = (p: WalkProgress) => { if (opts.resumeFile) fs.writeFileSync(opts.resumeFile, JSON.stringify(p), 'utf8') }

  let stems: string[]
  let html: string
  let page: number
  const resumed = opts.resumeFile && fs.existsSync(opts.resumeFile)
    ? JSON.parse(fs.readFileSync(opts.resumeFile, 'utf8')) as WalkProgress
    : null
  if (resumed) {
    ({ page, stems, html } = resumed)
    console.log(`[hansard-archive] ${seriesKey}: resuming walk from page ${page} (${stems.length} stems so far)`)
  } else {
    html = await fetchWithCooling()
    stems = [...zipStemsOf(html)]
    page = 1
    save({ page, stems, html })
  }

  const pastCap = (pageStems: string[]) =>
    config.maxVol != null &&
    pageStems.length > 0 &&
    pageStems.every(s => (parseVolumeStem(s)?.volume ?? 0) > config.maxVol!)

  while (!pastCap(zipStemsOf(html))) {
    const links = pagerTargets(html)
    const nextNumbered = links.find(l => l.label === String(page + 1))
    // GridView windows: when the next page number is not visible, the trailing
    // "..." advances the window. If neither exists, we are on the last page.
    const next = nextNumbered ?? (links.length > 0 && links[links.length - 1].label === '...' ? links[links.length - 1] : undefined)
    if (!next) break

    await new Promise(r => setTimeout(r, gapMs))
    const body = new URLSearchParams({
      __EVENTTARGET: next.target,
      __EVENTARGUMENT: '',
      __VIEWSTATE: hiddenField(html, '__VIEWSTATE'),
      __VIEWSTATEGENERATOR: hiddenField(html, '__VIEWSTATEGENERATOR'),
      __EVENTVALIDATION: hiddenField(html, '__EVENTVALIDATION'),
    })
    html = await fetchWithCooling({ body: body.toString() })
    const pageStems = zipStemsOf(html)
    if (pageStems.length === 0) break
    // Postback loops back to an already-seen page → done (defensive).
    if (pageStems.every(s => stems.includes(s))) break
    stems.push(...pageStems.filter(s => !stems.includes(s)))
    page++
    save({ page, stems, html })
  }

  if (opts.resumeFile && fs.existsSync(opts.resumeFile)) fs.unlinkSync(opts.resumeFile)
  const filtered = stems.filter(s => {
    const stem = parseVolumeStem(s)
    if (!stem || stem.series !== seriesKey) return false
    return config.maxVol == null || stem.volume <= config.maxVol
  })
  return filtered
}

// ── Volume fetch + unzip ──────────────────────────────────────────────────────

// Returns the volume XML, or null when the path resolves to the soft-404 HTML
// page (volume genuinely absent). Throws on real HTTP/zip errors.
export async function fetchVolumeXml(docId: string): Promise<string | null> {
  const url = volumeZipUrl(docId)
  if (!url) throw new Error(`historic-hansard: bad docId ${docId}`)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`historic-hansard ${docId}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // Soft-404: the host returns 200 text/html for unknown paths.
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) return null
  const zip = new AdmZip(buf)
  const entry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith('.xml'))
  if (!entry) throw new Error(`historic-hansard ${docId}: zip contains no XML entry`)
  return entry.getData().toString('utf8')
}

// ── hansard_v12 parsing (per-speech items, pwdata-shaped) ─────────────────────

export interface HansardV12Item {
  seq: number                // 1-based position in volume — stable sectionRef
  house: 'commons' | 'lords'
  itemDate: string | null    // sitting date yyyy-mm-dd
  heading: string | null     // outermost debate section title
  minorHeading: string | null// innermost section title when nested deeper
  speaker: string | null     // <member> for contributions; null for procedural text
  text: string
}

// Entities the v12 files use beyond XML defaults (numeric refs handled in
// stripTags; same fidelity set as twfy-pwdata).
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  pound: '£', euro: '€', sect: '§', copy: '©', reg: '®', deg: '°', middot: '·',
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  frac12: '½', frac14: '¼', frac34: '¾',
}

function stripTags(xml: string): string {
  return xml
    // page-number columns and images are layout chrome, not text — remove the
    // CONTENT, not just the tags, before the generic strip.
    .replace(/<col\b[^>]*>[\s\S]*?<\/col>/g, ' ')
    .replace(/<image\b[^>]*\/?>/g, ' ')
    .replace(/<lb\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => NAMED_ENTITIES[name] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── V22 gap-fill: api.parliament.uk/historic-hansard HTML crawl ──────────────
// Of the 170 volumes absent from the bulk archive, 114 exist on the HTML site
// (measured 13 Jun 2026: S3 40, S4 57, S5C 16, S5L 1; S1/S2 wholly unfillable —
// both stores share the same digitisation gaps there). Structure:
//   /historic-hansard/volumes/{code}/{vol}        volume index (404 = absent)
//   /historic-hansard/{house}/{yyyy}/{mon}/{dd}   sitting-day index
//   /historic-hansard/{house}/{yyyy}/{mon}/{dd}/{slug}  section page —
//     speeches in <div class='hentry…'> blocks, speaker in <cite class='member…'>
// Same OPL licence and corpus as the bulk volumes.

const HH_HTML_BASE = 'https://api.parliament.uk/historic-hansard'
export const HTML_SERIES_CODE: Record<string, string> = { S1: '1', S2: '2', S3: '3', S4: '4', S5C: '5C', S5L: '5L' }
const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }

const htmlThrottle = new AdaptiveThrottle({
  floor: 500,
  ceiling: 120_000,
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('historic-hansard-html', delayMs * 2)
      .catch(err => console.warn('[hh-html] suspend write failed:', err))
  },
})

// Returns { status, text } — text null on any failure; 404 is deterministic.
async function fetchHansardHtml(url: string): Promise<{ status: number; text: string | null }> {
  await htmlThrottle.wait()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': UA } })
    clearTimeout(timer)
    if (res.status === 429 || res.status === 503 || res.status === 403) { htmlThrottle.backoff(); return { status: res.status, text: null } }
    if (!res.ok) return { status: res.status, text: null }
    htmlThrottle.success()
    return { status: res.status, text: await res.text() }
  } catch (err) {
    clearTimeout(timer)
    htmlThrottle.backoff() // socket failure = rate signal
    console.warn(`[hh-html] fetch error ${url}: ${err}`)
    return { status: 0, text: null }
  }
}

// datePath = 'yyyy/mon/dd' as used in site URLs.
export function gapDateToIso(datePath: string): string | null {
  const m = /^(\d{4})\/([a-z]{3})\/(\d{1,2})$/.exec(datePath)
  if (!m || !MONTHS[m[2]]) return null
  return `${m[1]}-${MONTHS[m[2]]}-${m[3].padStart(2, '0')}`
}

// Sitting days of a volume, from its index page. null = fetch failure;
// [] only if the page exists but lists nothing (not expected).
export async function listGapVolumeDays(seriesKey: string, vol: number):
  Promise<Array<{ house: 'commons' | 'lords'; datePath: string }> | null> {
  const code = HTML_SERIES_CODE[seriesKey]
  if (!code) throw new Error(`unknown series ${seriesKey}`)
  const { status, text } = await fetchHansardHtml(`${HH_HTML_BASE}/volumes/${code}/${vol}`)
  if (status === 404) return [] // absent from the HTML site too — genuine gap
  if (!text) return null
  const seen = new Set<string>()
  const days: Array<{ house: 'commons' | 'lords'; datePath: string }> = []
  for (const m of text.matchAll(/href="\/historic-hansard\/(commons|lords)\/(\d{4}\/[a-z]{3}\/\d{1,2})\//g)) {
    const key = `${m[1]}:${m[2]}`
    if (seen.has(key)) continue
    seen.add(key)
    days.push({ house: m[1] as 'commons' | 'lords', datePath: m[2] })
  }
  return days
}

// Section slugs of one sitting day.
export async function listGapDaySections(house: string, datePath: string): Promise<string[] | null> {
  const { status, text } = await fetchHansardHtml(`${HH_HTML_BASE}/${house}/${datePath}`)
  if (status === 404) return []
  if (!text) return null
  const slugs = new Set<string>()
  const re = new RegExp(`href="/historic-hansard/${house}/${datePath}/([^"#]+)"`, 'g')
  for (const m of text.matchAll(re)) slugs.add(m[1])
  return [...slugs]
}

export interface GapSectionResult {
  heading: string | null
  items: Array<{ speaker: string | null; text: string }>
}

// One section page → per-speech items. Two item shapes (verified 13 Jun 2026):
//  - <div class='hentry member_contribution'> … <blockquote>speech</blockquote>
//    with the speaker in <cite class='member …'> inside the blockquote;
//  - sibling <p class='procedural'> elements (speaker null) — matching the v12
//    parser's treatment of procedural <p>s.
// Chunks are bounded by the NEXT item marker, so a speech's nested
// <blockquote class='quotation'> is closed by the LAST </blockquote> in its
// chunk, and the final chunk's page-tail (nav + script bodies, which
// stripTags would NOT remove) falls after that cut.
export async function fetchGapSectionItems(house: string, datePath: string, slug: string):
  Promise<GapSectionResult | null> {
  const { status, text } = await fetchHansardHtml(`${HH_HTML_BASE}/${house}/${datePath}/${slug}`)
  if (status === 404) return { heading: null, items: [] }
  if (!text) return null
  const titleM = /<title>([\s\S]*?)<\/title>/.exec(text)
  // "<SECTION NAME>. (Hansard, 24 March 1840)" → section name
  const heading = titleM ? stripTags(titleM[1]).replace(/\s*\(Hansard[^)]*\)\s*$/i, '').trim() || null : null

  const items: Array<{ speaker: string | null; text: string }> = []
  const markers = [...text.matchAll(/<div class='hentry[^>]*>|<p class='procedural'[^>]*>/g)]
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i]
    const chunkEnd = i + 1 < markers.length ? markers[i + 1].index! : text.length
    const chunk = text.slice(m.index! + m[0].length, chunkEnd)
    let body: string
    let speaker: string | null = null
    if (m[0].startsWith('<p')) {
      const close = chunk.indexOf('</p>')
      body = close >= 0 ? chunk.slice(0, close) : chunk
    } else {
      const cut = chunk.lastIndexOf('</blockquote>')
      body = cut >= 0 ? chunk.slice(0, cut) : chunk.split(/<script/)[0]
      const citeM = /<cite class='member[^']*'>([\s\S]*?)<\/cite>/.exec(body)
      speaker = citeM ? stripTags(citeM[1]) || null : null
      body = body.replace(/<cite class='member[^']*'>[\s\S]*?<\/cite>/g, ' ')
    }
    const cleaned = stripTags(body.replace(/<a [^>]*class='[^']*permalink[^']*'[\s\S]*?<\/a>/g, ' '))
    if (cleaned.length <= 20) continue
    items.push({ speaker, text: cleaned })
  }
  return { heading, items }
}

const EVENT_RE = /<(housecommons|houselords|index|section)\b[^>]*>|<\/(housecommons|houselords|index|section)>|<date\s+format="(\d{4}-\d{2}-\d{2})"[^>]*>|<title>([\s\S]*?)<\/title>|<p\b[^>]*>([\s\S]*?)<\/p>/g

export function parseHansardV12Items(xml: string, cutoffs: HouseCutoffs = DEFAULT_CUTOFFS): HansardV12Item[] {
  const items: HansardV12Item[] = []
  let seq = 0
  let house: 'commons' | 'lords' | null = null
  let date: string | null = null
  let indexDepth = 0
  // Section title stack: <section> pushes a null slot, the first <title> seen
  // while the top slot is empty fills it.
  const sectionTitles: Array<string | null> = []
  let awaitingTitle = false

  let m: RegExpExecArray | null
  while ((m = EVENT_RE.exec(xml)) !== null) {
    const [, openTag, closeTag, dateAttr, titleBody, pBody] = m

    if (openTag === 'housecommons' || openTag === 'houselords') {
      house = openTag === 'housecommons' ? 'commons' : 'lords'
      date = null
      sectionTitles.length = 0
      awaitingTitle = false
    } else if (openTag === 'index') {
      indexDepth++
    } else if (openTag === 'section') {
      sectionTitles.push(null)
      awaitingTitle = true
    } else if (closeTag === 'housecommons' || closeTag === 'houselords') {
      house = null
      sectionTitles.length = 0
    } else if (closeTag === 'index') {
      indexDepth = Math.max(0, indexDepth - 1)
    } else if (closeTag === 'section') {
      sectionTitles.pop()
      awaitingTitle = false
    } else if (dateAttr !== undefined) {
      if (house) date = dateAttr
    } else if (titleBody !== undefined) {
      if (awaitingTitle && sectionTitles.length > 0 && sectionTitles[sectionTitles.length - 1] === null) {
        sectionTitles[sectionTitles.length - 1] = stripTags(titleBody) || null
        awaitingTitle = false
      }
    } else if (pBody !== undefined) {
      if (!house || indexDepth > 0) continue
      if (date && date >= cutoffs[house]) continue
      const speakerMatch = /<member\b[^>]*>([\s\S]*?)<\/member>/.exec(pBody)
      const speaker = speakerMatch ? stripTags(speakerMatch[1]) || null : null
      const text = stripTags(pBody)
      if (text.length <= 20) continue
      const titles = sectionTitles.filter((t): t is string => !!t)
      items.push({
        seq: ++seq,
        house,
        itemDate: date,
        heading: titles[0] ?? null,
        minorHeading: titles.length > 1 ? titles[titles.length - 1] : null,
        speaker,
        text,
      })
    }
  }
  return items
}
