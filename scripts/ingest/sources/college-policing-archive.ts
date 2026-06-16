/**
 * college-policing-archive.ts — College of Policing Authorised Professional
 * Practice (APP), from the UK Government Web Archive 2022 snapshots (V25 §3).
 *
 * WHY the archive: the live app.college.police.uk is Cloudflare-blocked from
 * Railway and fresher archive snapshots are JS-SPA shells with no static text
 * (V24 finding). The 2022 snapshots are the last WordPress-rendered static-HTML
 * captures (Charlie's decision, brief §3). Snapshot date is recorded per row so
 * staleness (~4yr) is visible.
 *
 * Licence: Non-Commercial College Licence (licence='college-nc', verified V24).
 * This corpus is flagged for COMMERCIAL-SURFACE EXCLUSION (same default-exclude
 * posture as nao-nc / oecd BY-NC) — see shared/licence-map.ts and
 * scrutinise-docs/LICENCE_COMPLIANCE.md.
 *
 * Host: webarchive.nationalarchives.gov.uk — TNA infra, CF-free, Railway-safe.
 *   CDX enumeration:  /ukgwa/cdx?url=app.college.police.uk/app-content*&output=text…
 *   Raw capture:      /ukgwa/{timestamp}id_/{originalUrl}   (id_ = original bytes,
 *                     no archive banner/rewrite — clean for text extraction)
 */
import { rawToText } from '../shared/compile'

const ARCHIVE = 'https://webarchive.nationalarchives.gov.uk'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org; College APP via UKGWA)'

export interface AppPage { url: string; timestamp: string } // timestamp = YYYYMMDDhhmmss

// Enumerate distinct APP content pages captured in the date window. Dedupes by
// normalised URL, keeping the LATEST capture (freshest static snapshot). Excludes
// query-string variants (?s= search pages) and non-200/non-html. Returns null on
// CDX fetch failure.
export async function listArchivedAppPages(from = '20220101', to = '20221231'): Promise<AppPage[] | null> {
  const cdx = `${ARCHIVE}/ukgwa/cdx?url=app.college.police.uk/app-content*` +
    `&output=text&filter=statuscode:200&filter=mimetype:text/html&from=${from}&to=${to}&limit=50000`
  let text: string
  try {
    const res = await fetch(cdx, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    text = await res.text()
  } catch { return null }

  const latest = new Map<string, AppPage>() // normalised url → freshest capture
  for (const line of text.split('\n')) {
    const cols = line.split(' ')
    if (cols.length < 4) continue
    const timestamp = cols[1]
    const original = cols[2]
    if (!original || original.includes('?')) continue
    const norm = original.replace(/\/$/, '')
    const prev = latest.get(norm)
    if (!prev || timestamp > prev.timestamp) latest.set(norm, { url: original, timestamp })
  }
  return [...latest.values()].sort((a, b) => a.url.localeCompare(b.url))
}

export function snapshotIsoDate(timestamp: string): string {
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`
}

// Fetch + extract one archived APP page. Returns { title, text } or null on fetch
// failure. Content lives in <div id="content" class="content" role="main"> … cut
// at the footer/sidebar so navigation chrome stays out of the FTS text.
export async function fetchArchivedAppPage(ts: string, url: string): Promise<{ title: string; text: string } | null> {
  let html: string
  try {
    const res = await fetch(`${ARCHIVE}/ukgwa/${ts}id_/${url}`, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    html = await res.text()
  } catch { return null }

  const titleM = /<title>([\s\S]*?)<\/title>/i.exec(html)
  const title = (titleM ? titleM[1] : '').replace(/\s+/g, ' ').trim()

  const start = html.search(/<div[^>]*id="content"[^>]*role="main"[^>]*>/i)
  let body = start >= 0 ? html.slice(start) : html
  // cut at the first chrome boundary after the content
  const endRx = /(<footer\b|<div[^>]*id="footer"|<div[^>]*id="sidebar"|<div[^>]*class="[^"]*sidebar|<!--\s*\/?\s*content)/i
  const endM = endRx.exec(body.slice(200)) // skip the opening container itself
  if (endM) body = body.slice(0, endM.index + 200)

  const text = rawToText(body)
  return { title, text }
}
