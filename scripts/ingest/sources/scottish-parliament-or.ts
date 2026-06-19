/**
 * scottish-parliament-or.ts — Scottish Parliament Official Report (V28 §7).
 *
 * Supersedes the V27 §5 gated stub: the OR is conventional server-rendered HTML
 * (no Charlie capture needed). Structure (verified 19 Jun 2026):
 *
 *   Date-indexed browse (server-side paginated):
 *     GET /chamber-and-committees/official-report/search-what-was-said-in-parliament?page=N
 *     → report links: /…/search-what-was-said-in-parliament/{SLUG}-{DD-MM-YYYY}?meeting={id}
 *       SLUG = meeting-of-parliament (chamber) or a committee code (CJC, FPAC…).
 *       Newest first; ?page=N walks older meetings until exhausted.
 *
 *   Report page  GET /…/{slug}?meeting={id}  (full server-rendered OR):
 *     - title  <title>… | Scottish Parliament Website</title> / <h1 class="h3…">
 *     - agenda items  <h2 class="h3 u--mtop0">Heading</h2>
 *     - each speaker turn  <p id="orscontributions_…"><div><strong>
 *           <a href="/msps/…">Speaker (Role)</a></strong></div></p>
 *       followed by the speech's <p> paragraphs until the next marker/heading.
 *     - a full-report PDF: /api/sitecore/CustomMedia/OfficialReport?meetingId={id}
 *
 * Granularity: one section per speaker-turn (pwdata / niassembly / historic-
 * hansard shape) — heading + speaker + date carried as metadata.
 *
 * Licence: Scottish Parliament Copyright Licence (SPCB) — VERIFIED at
 * parliament.scot/about/copyright: published material reproducible without
 * formal permission subject to the licence, with attribution ("Contains
 * information licensed under the Scottish Parliament Copyright Licence");
 * excludes party-political / advertising-endorsement use (a serving-layer note).
 * Not OGL — the SPCB's own open licence. licence code `spcb`.
 */

const BASE = 'https://www.parliament.scot'
const BROWSE = `${BASE}/chamber-and-committees/official-report/search-what-was-said-in-parliament`
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

export interface ReportEntry { meetingId: number; slug: string; date: string | null; title: string }
export interface OrItem { seq: number; heading: string | null; speaker: string | null; text: string }
export interface OrReport { meetingId: number; title: string; date: string | null; items: OrItem[] }

async function getHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&pound;/g, '£').replace(/&hellip;/g, '…')
    .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
}
function stripTags(s: string): string { return decode(s.replace(/<[^>]+>/g, ' ')) }

// slug tail "…-09-06-2026" → 2026-06-09
function dateFromSlug(slug: string): string | null {
  const m = /(\d{2})-(\d{2})-(\d{4})$/.exec(slug)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// ── Listing: one browse page → distinct report entries ────────────────────────
export function parseReportLinks(html: string): ReportEntry[] {
  const seen = new Map<number, ReportEntry>()
  const rx = /href="\/chamber-and-committees\/official-report\/search-what-was-said-in-parliament\/([^"?]+)\?meeting=(\d+)(?:&amp;iob=\d+)?"(?:[^>]*)>(?:\s*<strong>)?([^<]*)/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(html)) !== null) {
    const slug = m[1]
    const meetingId = Number(m[2])
    if (seen.has(meetingId)) continue
    seen.set(meetingId, { meetingId, slug, date: dateFromSlug(slug), title: decode(m[3] || slug) })
  }
  return [...seen.values()]
}

export async function listReportPage(page: number): Promise<ReportEntry[] | null> {
  const html = await getHtml(`${BROWSE}?page=${page}`)
  if (html === null) return null
  return parseReportLinks(html)
}

// FULL enumeration via the site sitemap (the date-indexed browse paginates only
// ~2-3 pages deep). sitemap.xml is a flat ~12MB file listing every report URL
// once per agenda item; we collapse to distinct (meetingId, slug). Covers
// sessions 5–6 (2016→present, ~5,131 reports). Pre-2016 lives on the legacy
// archive host (archive2021.parliament.scot report.aspx) — a documented
// follow-up, not enumerable here.
const SITEMAP = `${BASE}/sitemap.xml`

export async function enumerateReportsFromSitemap(): Promise<ReportEntry[]> {
  const res = await fetch(SITEMAP, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`scottish-or: sitemap HTTP ${res.status}`)
  const xml = await res.text()
  const seen = new Map<number, ReportEntry>()
  for (const m of xml.matchAll(/search-what-was-said-in-parliament\/([^"<?]+)\?meeting=(\d+)/g)) {
    const slug = m[1]
    const meetingId = Number(m[2])
    if (seen.has(meetingId)) continue
    seen.set(meetingId, { meetingId, slug, date: dateFromSlug(slug), title: decode(slug) })
  }
  return [...seen.values()]
}

// Walk browse pages newest→oldest until a page yields no NEW meeting ids.
export async function enumerateReports(
  delayMs = 400, onProgress?: (n: number, page: number) => void,
): Promise<ReportEntry[]> {
  const all = new Map<number, ReportEntry>()
  for (let page = 1; ; page++) {
    let entries = await listReportPage(page)
    if (entries === null) { // one retry
      await new Promise(r => setTimeout(r, 3000))
      entries = await listReportPage(page)
    }
    if (entries === null) throw new Error(`scottish-or: browse page ${page} failed`)
    const before = all.size
    for (const e of entries) all.set(e.meetingId, e)
    onProgress?.(all.size, page)
    // stop when a page adds nothing new (end of archive, or pagination exhausted)
    if (entries.length === 0 || all.size === before) break
    await new Promise(r => setTimeout(r, delayMs))
  }
  return [...all.values()]
}

// ── Report parse: per speaker-turn ────────────────────────────────────────────
export function parseReport(meetingId: number, html: string, slugDate: string | null): OrReport {
  const titleM = /<title>([^<|]+)/.exec(html)
  const title = titleM ? decode(titleM[1]) : `Scottish Parliament Official Report ${meetingId}`
  // Body: from the first agenda heading (drop nav/contents/share chrome above it).
  const firstSpeaker = html.indexOf('orscontributions_')
  const body = firstSpeaker >= 0 ? html.slice(html.lastIndexOf('<h2', firstSpeaker) >= 0 ? html.lastIndexOf('<h2', firstSpeaker) : firstSpeaker) : html

  // Tokenize in document order: agenda headings | speaker markers | text paras.
  const tokenRx = /<h2 class="h3[^"]*"[^>]*>([\s\S]*?)<\/h2>|<p id="orscontributions_[^"]*">([\s\S]*?)<\/p>|<p(?![^>]*\bid="orscontributions_)[^>]*>([\s\S]*?)<\/p>/g
  const items: OrItem[] = []
  let heading: string | null = null
  let cur: OrItem | null = null
  let seq = 0
  const flush = () => { if (cur && cur.text.trim().length > 0) items.push(cur); cur = null }

  let m: RegExpExecArray | null
  while ((m = tokenRx.exec(body)) !== null) {
    if (m[1] !== undefined) {            // agenda heading
      flush()
      heading = stripTags(m[1]) || heading
    } else if (m[2] !== undefined) {     // speaker marker → new contribution
      flush()
      seq++
      let strongInner = (/<strong>([\s\S]*?)<\/strong>/.exec(m[2]) ?? [, ''])[1]
      strongInner = strongInner.split(/<div class="share-float-right"/)[0]
      const aM = /<a [^>]*>([^<]+)<\/a>/.exec(strongInner)
      const speaker = (aM ? decode(aM[1]) : stripTags(strongInner)) || null
      cur = { seq, heading, speaker, text: '' }
    } else if (m[3] !== undefined) {     // text paragraph
      const t = stripTags(m[3])
      if (!t) continue
      if (cur) cur.text += (cur.text ? '\n' : '') + t
      else { seq++; cur = { seq, heading, speaker: null, text: t } } // pre-speaker narrative
    }
  }
  flush()
  return { meetingId, title, date: slugDate, items }
}

// iob ids (agenda items) in document order from the base page's Contents nav.
export function parseIobIds(html: string): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  for (const m of html.matchAll(/iob=(\d+)/g)) {
    const id = Number(m[1])
    if (!seen.has(id)) { seen.add(id); out.push(id) }
  }
  return out
}

// Full report = the base page's inline contributions (Time for Reflection etc.)
// PLUS each agenda item, which the site renders server-side only on its own
// ?iob={id} page (the base page lazy-loads the rest). One base fetch + one fetch
// per iob, politely spaced; items re-sequenced globally.
export async function fetchReport(entry: ReportEntry, iobDelayMs = 250): Promise<OrReport | null> {
  const baseUrl = `${BROWSE}/${entry.slug}?meeting=${entry.meetingId}`
  const baseHtml = await getHtml(baseUrl)
  if (baseHtml === null) return null

  const base = parseReport(entry.meetingId, baseHtml, entry.date)
  const items: OrItem[] = [...base.items]
  for (const iob of parseIobIds(baseHtml)) {
    const iobHtml = await getHtml(`${baseUrl}&iob=${iob}`)
    if (iobHtml === null) continue
    items.push(...parseReport(entry.meetingId, iobHtml, entry.date).items)
    await new Promise(r => setTimeout(r, iobDelayMs))
  }
  // de-dup (a heading repeated across base+iob) and re-sequence
  const seen = new Set<string>()
  const deduped: OrItem[] = []
  let seq = 0
  for (const it of items) {
    const k = `${it.heading}|${it.speaker}|${it.text.slice(0, 60)}`
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push({ ...it, seq: ++seq })
  }
  return { meetingId: entry.meetingId, title: base.title, date: entry.date, items: deduped }
}

export function reportUrl(slug: string, meetingId: number): string {
  return `${BROWSE}/${slug}?meeting=${meetingId}`
}
