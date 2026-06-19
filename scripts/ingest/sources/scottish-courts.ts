/**
 * scottish-courts.ts — Scottish Courts & Tribunals Service judgments (V27 §2).
 *
 * Charlie captured the public API (no auth token — gated only by Origin/Referer;
 * CORS is browser-only, so a server-side fetch with these headers works):
 *
 *   Enumerate:  POST https://api.pa.web.scotcourts.gov.uk/web/search
 *               body {"indexType":"Judgments","category":"","filters":[],
 *                     "query":"","page":N,"limit":L}   ← page is 1-INDEXED
 *               → { results: [{ title, documentLink, date, court[], judges[] }],
 *                   pagination: { count:{total}, page:{current,total,limit} } }
 *   Fetch:      GET https://www.scotcourts.gov.uk{documentLink}   (a PDF)
 *
 * The capture mentioned GET /web/definition/{id}; in practice the search result
 * already carries `documentLink` straight to the judgment PDF, so no per-id
 * detail call is needed. The X-Ms-* headers in the capture are Azure-SDK
 * telemetry (client GUIDs), not auth — omitted.
 *
 * Universe (measured 19 Jun 2026): pagination.count.total = 13,066 judgments.
 * Licence: Crown copyright, OGL — judiciary.scot/crown-copyright states the
 * judiciary's published material (excluding logos/photographs) may be re-used
 * "free of charge in any format or medium, under the terms of the Open
 * Government Licence" (verified 19 Jun 2026).
 */

const SEARCH_API = 'https://api.pa.web.scotcourts.gov.uk/web/search'
export const JUDGMENT_BASE = 'https://www.scotcourts.gov.uk'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

const COMMON_HEADERS = {
  'Origin': 'https://www.scotcourts.gov.uk',
  'Referer': 'https://www.scotcourts.gov.uk/',
  'Accept': 'application/json',
  'User-Agent': UA,
}

export interface JudgmentEntry {
  documentLink: string   // e.g. "/media/0sdgd2yt/2026sacciv37-amin-...pdf"
  title: string
  date: string | null    // ISO "YYYY-MM-DD"
  court: string | null
}

export interface JudgmentPage {
  entries: JudgmentEntry[]
  total: number          // pagination.count.total
  pageTotal: number      // pagination.page.total (number of pages at this limit)
}

interface RawResult {
  title?: string
  documentLink?: string
  date?: string
  court?: string[]
}
interface RawSearch {
  results?: RawResult[]
  pagination?: { count?: { total?: number }; page?: { total?: number } }
}

// page is 1-indexed. Returns null on a transient fetch/parse failure so the
// caller can retry/abort deliberately (no silent partial enumeration).
export async function searchJudgmentsPage(page: number, limit: number): Promise<JudgmentPage | null> {
  let res: Response
  try {
    res = await fetch(SEARCH_API, {
      method: 'POST',
      headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ indexType: 'Judgments', category: '', filters: [], query: '', page, limit }),
    })
  } catch { return null }
  if (!res.ok) return null

  let data: RawSearch
  try { data = await res.json() as RawSearch } catch { return null }
  const results = data.results ?? []
  const entries: JudgmentEntry[] = []
  for (const r of results) {
    if (!r.documentLink) continue
    entries.push({
      documentLink: r.documentLink,
      title: (r.title ?? '').trim(),
      date: r.date ? r.date.slice(0, 10) : null,
      court: Array.isArray(r.court) && r.court.length > 0 ? r.court[0] : null,
    })
  }
  return {
    entries,
    total: data.pagination?.count?.total ?? 0,
    pageTotal: data.pagination?.page?.total ?? 0,
  }
}

// Walk every page (1-indexed) at `limit`, politely spaced, until exhausted.
// Returns the full de-duplicated judgment list (by documentLink).
export async function enumerateAllJudgments(
  limit = 200,
  delayMs = 1000,
  onProgress?: (collected: number, total: number) => void,
): Promise<JudgmentEntry[]> {
  const seen = new Map<string, JudgmentEntry>()
  const first = await searchJudgmentsPage(1, limit)
  if (!first) throw new Error('scottish-courts: enumeration failed on page 1')
  for (const e of first.entries) seen.set(e.documentLink, e)
  const pageTotal = first.pageTotal || Math.ceil(first.total / limit)
  onProgress?.(seen.size, first.total)

  for (let page = 2; page <= pageTotal; page++) {
    await new Promise(r => setTimeout(r, delayMs))
    let pg = await searchJudgmentsPage(page, limit)
    if (!pg) { // one polite retry
      await new Promise(r => setTimeout(r, 5000))
      pg = await searchJudgmentsPage(page, limit)
    }
    if (!pg) throw new Error(`scottish-courts: enumeration failed on page ${page}/${pageTotal}`)
    for (const e of pg.entries) seen.set(e.documentLink, e)
    onProgress?.(seen.size, pg.total)
  }
  return [...seen.values()]
}

// Stable, reversible queue key from a documentLink: strip the leading slash and
// the trailing ".pdf". e.g. "/media/0sdgd2yt/2026sacciv37-x.pdf"
//   → "media/0sdgd2yt/2026sacciv37-x". The /media/{id}/ segment is unique.
export function linkToKey(documentLink: string): string {
  return documentLink.replace(/[?#].*$/, '').replace(/^\//, '').replace(/\.pdf$/i, '')
}
export function keyToPdfUrl(key: string): string {
  return `${JUDGMENT_BASE}/${key}.pdf`
}

export async function fetchJudgmentPdf(key: string): Promise<Buffer | null> {
  try {
    const res = await fetch(keyToPdfUrl(key), {
      headers: { 'Referer': 'https://www.scotcourts.gov.uk/', 'User-Agent': UA, 'Accept': 'application/pdf' },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // Reject a JSON error body masquerading as 200 (the API host does this on 404)
    if (buf.length < 5 || buf.toString('latin1', 0, 4) !== '%PDF') return null
    return buf
  } catch { return null }
}
