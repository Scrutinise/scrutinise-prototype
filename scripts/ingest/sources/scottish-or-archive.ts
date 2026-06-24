/**
 * scottish-or-archive.ts — pre-2016 Scottish Parliament Official Report (V30 §4).
 *
 * The modern build (scottish-parliament-or.ts) enumerates the live site's
 * sitemap = sessions 5–6 (2016→present). Sessions 1–4 (1999–2016) lived on the
 * legacy ASP.NET site (report.aspx?r={reportId}&mode=html), which was retired in
 * the 2021 redesign and now exists only in web archives. This adapter ingests
 * those reports from the Internet Archive Wayback Machine — the licence (SPCB)
 * travels with the content regardless of the archive host (same pattern as the
 * UK Gov Web Archive for College of Policing).
 *
 * Route (verified 24 Jun 2026):
 *   - Legacy hosts (same OR backend, renamed across eras; r ids are stable):
 *       www.scottish.parliament.uk  (≤ 2016)
 *       www.parliament.scot         (2016–2021)
 *       archive2021.parliament.scot (2021 freeze)
 *   - Enumerate via the Wayback CDX API, filtered to captures BEFORE 2016-05
 *     (to=20160501): a report captured before session 5 began MUST be a
 *     sessions-1–4 report (you cannot capture a report before it is published),
 *     so the capture-timestamp filter cleanly separates pre-2016 from the modern
 *     build with no date double-coverage at the boundary.
 *   - Fetch each via the raw replay  web.archive.org/web/{ts}id_/{original}.
 *
 * Old HTML format (differs from the modern per-iob structure):
 *   - date     <meta name="DC.date" content="DD/MM/YYYY HH:MM:SS">
 *   - turns    <li>…<a class="or_speaker" alt="Surname, Name - Party - Region">
 *                Name (Role): </a><span class="SocialArea">…chrome…</span>
 *                {speech paragraphs}</li>
 *   One section per speaker-turn (pwdata / niassembly / modern-OR shape).
 *
 * Licence: Scottish Parliament Copyright Licence (SPCB) — same corpus
 * (scottish-parliament-or), same licence code `spcb`, extending coverage to
 * 1999. (Verified at parliament.scot/about/copyright; see licence-map.)
 */

const CDX = 'https://web.archive.org/cdx/search/cdx'
const WB = 'https://web.archive.org/web'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'
const LEGACY_HOSTS = [
  'www.scottish.parliament.uk',
  'www.parliament.scot',
  'archive2021.parliament.scot',
]
// Session 5 began with the 5 May 2016 election; the first session-5 sitting is
// 2016-05-12. Captures strictly before this are sessions 1–4.
const PRE2016_TO = '20160501'

export interface LegacyReport { r: number; ts: string; original: string; waybackUrl: string }
export interface OrItem { seq: number; heading: string | null; speaker: string | null; text: string }
export interface ParsedReport { r: number; date: string | null; title: string; items: OrItem[] }

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;|&#8217;|&#8216;/g, "'")
    .replace(/&#160;|&nbsp;/g, ' ').replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&pound;/g, '£').replace(/&hellip;|&#8230;/g, '…').replace(/&mdash;|&#8212;/g, '—')
    .replace(/&[a-z]+;/g, ' ').replace(/&#\d+;/g, ' ')
}
function stripTags(s: string): string { return decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() }

// Extract r and mode from a report.aspx query string.
function parseRptUrl(original: string): { r: number | null; isPdf: boolean } {
  const rm = /[?&]\s*r=(\d+)/.exec(original)
  return { r: rm ? Number(rm[1]) : null, isPdf: /mode=pdf/i.test(original) }
}

// Enumerate distinct pre-2016 OR report ids across the legacy hosts.
//   MEMBERSHIP: an r id is pre-2016 iff its EARLIEST capture is before 2016-05
//     (only sessions-1–4 reports were captured before session 5 began).
//   FETCH:      use the LATEST capture (≤ 2020) — the site re-rendered historical
//     reports in the modern `or_speaker` template, so old reports' early
//     contemporaneous captures predate that markup (→ 0 turns) while a later
//     capture of the same report parses cleanly. (Verified: r=4704's 2015 capture
//     yields 392 turns; its earliest capture did not.)
const FETCH_TO = '20200101'
interface RAgg { minTs: string; maxTs: string; maxOriginal: string }
export async function enumerateLegacyReports(
  onProgress?: (host: string, distinct: number) => void,
): Promise<LegacyReport[]> {
  const agg = new Map<number, RAgg>()
  for (const host of LEGACY_HOSTS) {
    const url = `${CDX}?url=${encodeURIComponent(host + '/parliamentarybusiness/report.aspx')}&matchType=prefix`
      + `&output=text&fl=original,timestamp,statuscode&filter=statuscode:200&from=1999&to=${FETCH_TO}&limit=400000`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) { onProgress?.(host, agg.size); continue }
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [original, ts] = line.split(' ')
      if (!original || !ts) continue
      const { r, isPdf } = parseRptUrl(original)
      if (r === null || isPdf) continue            // need the HTML view, with an r id
      const prev = agg.get(r)
      if (!prev) { agg.set(r, { minTs: ts, maxTs: ts, maxOriginal: original }); continue }
      if (ts < prev.minTs) prev.minTs = ts
      if (ts > prev.maxTs) { prev.maxTs = ts; prev.maxOriginal = original }
    }
    onProgress?.(host, agg.size)
    await new Promise(r => setTimeout(r, 400))
  }
  const out: LegacyReport[] = []
  for (const [r, a] of agg) {
    if (a.minTs >= PRE2016_TO) continue            // first captured in session 5+ → not ours
    out.push({ r, ts: a.maxTs, original: a.maxOriginal, waybackUrl: `${WB}/${a.maxTs}id_/${a.maxOriginal}` })
  }
  return out.sort((a, b) => a.r - b.r)
}

// Robust per-report fetch: capture quality varies (interstitials, pre-`or_speaker`
// old-format renderings, good modern renderings), so a single capture pick is
// unreliable. Gather candidate captures for this r across the legacy hosts and
// try them — `or_speaker`-era (2012–2019) newest-first, then the rest — returning
// the first that parses with contributions (else the last parsed, for an honest
// no-provisions marker). Bounded to ≤5 fetches.
const FETCH_HOSTS = ['www.parliament.scot', 'www.scottish.parliament.uk', 'archive2021.parliament.scot']
export async function fetchBestLegacyReport(r: number): Promise<ParsedReport | null> {
  const cands: Array<{ ts: string; original: string }> = []
  const seen = new Set<string>()
  for (const host of FETCH_HOSTS) {
    const url = `${CDX}?url=${encodeURIComponent(host + '/parliamentarybusiness/report.aspx?r=' + r)}&matchType=prefix`
      + `&output=text&fl=timestamp,original&filter=statuscode:200&limit=40`
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) continue
      for (const line of (await res.text()).split('\n')) {
        const [ts, original] = line.split(' ')
        if (!ts || !original) continue
        const { r: rr, isPdf } = parseRptUrl(original)
        if (isPdf || rr !== r) continue            // exact r (prefix would catch r=47030)
        const k = `${ts}|${original}`
        if (seen.has(k)) continue
        seen.add(k); cands.push({ ts, original })
      }
    } catch { /* try next host */ }
    if (cands.length >= 12) break
    await new Promise(r => setTimeout(r, 250))
  }
  if (cands.length === 0) return null
  const era = (ts: string) => (ts >= '2012' && ts < '2020' ? 0 : 1)
  cands.sort((a, b) => era(a.ts) - era(b.ts) || (a.ts < b.ts ? 1 : -1))
  let lastParsed: ParsedReport | null = null
  for (const c of cands.slice(0, 5)) {
    const html = await fetchLegacyHtml(`${WB}/${c.ts}id_/${c.original}`)
    if (html) {
      const p = parseLegacyReport(r, html)
      if (p.items.length > 0) return p
      lastParsed = p
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return lastParsed
}

export async function fetchLegacyHtml(waybackUrl: string): Promise<string | null> {
  try {
    const res = await fetch(waybackUrl, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const html = await res.text()
    // The Wayback "calendar / multiple captures" interstitial has this title and
    // no OR markup — treat as a miss so the worker can mark it unavailable.
    if (/<title>\s*Wayback Machine\s*<\/title>/i.test(html) && !/or_speaker/i.test(html)) return null
    return html
  } catch { return null }
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}
// The legacy <meta name="DC.date"> is a constant template value (NOT the sitting
// date — verified: r=3/r=4704/r=8855 all carry "24/05/2011"). The real sitting
// date is the "DD Month YYYY" string the report repeats in its own header/nav;
// take the most frequent occurrence. Returns YYYY-MM-DD or null.
function sittingDate(html: string): string | null {
  const text = decode(html.replace(/<[^>]+>/g, ' '))
  const counts = new Map<string, number>()
  const rx = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi
  let m: RegExpExecArray | null
  while ((m = rx.exec(text)) !== null) {
    const y = Number(m[3])
    if (y < 1999 || y > 2025) continue
    const iso = `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${String(Number(m[1])).padStart(2, '0')}`
    counts.set(iso, (counts.get(iso) ?? 0) + 1)
  }
  let best: string | null = null, bestN = 0
  for (const [iso, n] of counts) if (n > bestN) { best = iso; bestN = n }
  return best
}

// Parse the legacy report into speaker-turn items. Contributions are <li> blocks
// carrying an or_speaker anchor; agenda headings are short <li>/<h2> blocks
// between them (best-effort — carried as the turn's heading).
export function parseLegacyReport(r: number, html: string): ParsedReport {
  const date = sittingDate(html)
  // Restrict to the content region (drops nav/menu <li> chrome above it).
  const cstart = html.search(/<a\s+name="content"/i)
  const region = cstart >= 0 ? html.slice(cstart) : html
  // Cut footer chrome if present.
  const fend = region.search(/id="footer"|class="footer"|<!--\s*footer/i)
  const body = fend >= 0 ? region.slice(0, fend) : region

  const items: OrItem[] = []
  let heading: string | null = null
  let seq = 0
  // Tokenise agenda headings (h2/h3 inside content) and <li> contributions in
  // document order.
  const tokenRx = /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<li\b[^>]*>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = tokenRx.exec(body)) !== null) {
    if (m[1] !== undefined) {                      // agenda heading
      const h = stripTags(m[1])
      if (h && h.length < 160) heading = h
      continue
    }
    const li = m[2] ?? ''
    const spkM = /class="or_speaker"[^>]*>([\s\S]*?)<\/a>/i.exec(li)
    // Remove the or_speaker anchor and the SocialArea chrome span, then strip.
    let rest = li
      .replace(/<a\b[^>]*class="or_speaker"[^>]*>[\s\S]*?<\/a>/i, '')
      .replace(/<span\b[^>]*class="SocialArea"[\s\S]*?<\/span>\s*<\/span>/i, '')
      .replace(/<span\b[^>]*class="SocialArea"[\s\S]*?<\/span>/i, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
    const text = stripTags(rest)
    if (spkM) {
      const rawSpk = stripTags(spkM[1]).replace(/:\s*$/, '').trim()
      const speaker = rawSpk || null
      if (text.length > 0 || speaker) items.push({ seq: ++seq, heading, speaker, text })
    } else if (text) {
      // No speaker: a heading-like short block becomes the carried heading;
      // longer prose is pre-speaker narrative.
      if (text.length < 160 && !/[.?!]\s/.test(text)) heading = text
      else items.push({ seq: ++seq, heading, speaker: null, text })
    }
  }
  return { r, date, title: `Scottish Parliament Official Report${date ? ` — ${date}` : ''}`, items }
}

export function legacyReportUrl(original: string): string {
  return original.replace(/^http:/, 'https:')
}
