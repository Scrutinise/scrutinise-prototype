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
 * Scope cutoff: items dated >= 1919-02-04 are dropped — that is the first
 * pwdata-debates file, and S5C vol 112 / S5L vol 33 both start that exact day
 * (Parliament did not sit between 21 Nov 1918 and 4 Feb 1919), so the
 * parliamentary record hands off cleanly: S5C vols 1–111 + S5L vols 1–32 here,
 * pwdata thereafter. (Lords 1919–1999 stays a known hole — pwdata-lords starts
 * 1999; out of V21 scope, recorded in the sprint report.)
 *
 * XML shape (hansard_v12): <hansard> → titlepage/frontmatter (chrome) →
 * <housecommons>/<houselords> per sitting, each with <title>, <date
 * format="yyyy-mm-dd">, intro <p>, and <debates> of nested <section>s whose
 * <p>s carry <member> + <membercontribution>. <index> blocks are back matter.
 * Items are emitted ONLY inside house containers, so chrome self-excludes.
 */
import AdmZip from 'adm-zip'

const BASE = 'https://www.hansard-archive.parliament.uk'
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'

// First in-scope pwdata day — see header. Exact, not approximate.
export const HISTORIC_HANSARD_CUTOFF = '1919-02-04'

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
  // 5th series runs past 1918 — cap at the last volume that sits before the
  // pwdata handoff (S5C 112 / S5L 33 start 1919-02-04).
  S5C: { dir: 'Official_Report,_House_of_Commons_(5th_Series)_Vol_1_(Jan_1909)_to_Vol_1000_(March_1981)', maxVol: 111 },
  S5L: { dir: 'The_Official_Report,_House_of_Lords_(5th_Series)_Vol_1_(Jan_1909)_to_2004', maxVol: 32 },
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

// Walks every listing page of a series via WebForms postbacks. The pager shows
// a numbered window plus "..." continuation links; we always click the link
// labelled with the next page number, falling back to the trailing "...".
// CF rate-limits sustained listing walks (403 at S5C page 24 on the first full
// run — the V20 committees/judiciaryni pattern), so page fetches retry after
// 60s cooling; and a series with maxVol stops as soon as a page is entirely
// past the cap (the listing is volume-ordered), which keeps S5C to ~12 pages
// instead of ~100.
export async function listHistoricHansardVolumes(
  seriesKey: string,
  opts: { gapMs?: number } = {},
): Promise<string[]> {
  const config = HANSARD_SERIES[seriesKey]
  if (!config) throw new Error(`Unknown Hansard series: ${seriesKey}`)
  const gapMs = opts.gapMs ?? 1000
  const url = `${BASE}/${config.dir}`

  const fetchWithCooling = async (init?: RequestInit): Promise<string> => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init?.headers ?? {}) } })
      if (res.ok) return res.text()
      if (attempt >= 4) throw new Error(`hansard-archive listing ${seriesKey}: HTTP ${res.status} after ${attempt} attempts`)
      console.warn(`[hansard-archive] ${seriesKey}: HTTP ${res.status} — cooling 60s (attempt ${attempt})`)
      await new Promise(r => setTimeout(r, 60_000))
    }
  }

  const stems: string[] = []
  let html = await fetchWithCooling()
  stems.push(...zipStemsOf(html))

  const pastCap = (pageStems: string[]) =>
    config.maxVol != null &&
    pageStems.length > 0 &&
    pageStems.every(s => (parseVolumeStem(s)?.volume ?? 0) > config.maxVol!)

  let page = 1
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
    html = await fetchWithCooling({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const pageStems = zipStemsOf(html)
    if (pageStems.length === 0) break
    // Postback loops back to an already-seen page → done (defensive).
    if (pageStems.every(s => stems.includes(s))) break
    stems.push(...pageStems.filter(s => !stems.includes(s)))
    page++
  }

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

const EVENT_RE = /<(housecommons|houselords|index|section)\b[^>]*>|<\/(housecommons|houselords|index|section)>|<date\s+format="(\d{4}-\d{2}-\d{2})"[^>]*>|<title>([\s\S]*?)<\/title>|<p\b[^>]*>([\s\S]*?)<\/p>/g

export function parseHansardV12Items(xml: string, cutoff = HISTORIC_HANSARD_CUTOFF): HansardV12Item[] {
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
      if (date && date >= cutoff) continue
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
