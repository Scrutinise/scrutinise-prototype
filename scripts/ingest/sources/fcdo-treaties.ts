// FCDO UK Treaties Online (UKTO) client — TREATY_INGEST_BRIEF.md STEP 1.
//
// treaties.fcdo.gov.uk is a legacy Knowvation/AWARE (PTFS Inc, Solr-backed)
// federated-search deployment: a Backbone.js SPA with NO server-rendered HTML
// and no bulk/CSV export (data.gov.uk's "UK Treaties Database" dataset's only
// bulk resource is a stale one-off Nov-2015–Feb-2016 CSV bulletin, confirmed
// dead-end 8 Jul 2026). The SPA itself talks to an underlying JSON REST API
// (`/awweb/awfp/...`) that is reachable directly with NO auth beyond an
// anonymous session cookie (`GET /awweb/federated/users/op/login/anonymous` —
// the same "public" guest account the UI silently logs in as). This is the
// best-available route per the bulk→HTML→API priority order: bulk doesn't
// exist, HTML is JS-only, so the API tier is used directly.
//
// Verified live 8 Jul 2026: single collection ("Local Repository", id=1,
// library2_lib) holds 21,970 records — NOT the ~15,000 the brief/gov.uk page
// estimate (honest-denominator correction, not a silent substitution). Every
// record has an HTML "page" that is ALWAYS just a country/action-date summary
// table (never full text, confirmed on multiple samples) — full text lives
// ONLY in linked Treaty Series PDFs embedded in the `references` field.
// 7,184 records (33%) carry at least one such PDF; 14,786 (67%) are
// metadata-only records with no full text anywhere on the site.
//
// Licence: OGL v3.0 — verified via the FCDO's own data.gov.uk catalogue entry
// for this exact dataset (organisation "Foreign and Commonwealth Office",
// license_id "uk-ogl", https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
// treaties.fcdo.gov.uk itself has no dedicated terms/copyright page (checked
// /copyright, /terms, /about etc. — all 404); the data.gov.uk catalogue record
// is the FCDO's own published licence statement for this dataset, same
// evidentiary tier as the gov.uk-adjacent pages used elsewhere in licence-map.ts.

const BASE = 'https://treaties.fcdo.gov.uk'
const AWWEB = `${BASE}/awweb`
const COLLECTION_ID = 1
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const SESSION_TTL_MS = 10 * 60_000

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  return { signal: ctl.signal, clear: () => clearTimeout(t) }
}

let cachedCookie: string | null = null
let cookieFetchedAt = 0

async function getSessionCookie(forceFresh = false): Promise<string> {
  if (!forceFresh && cachedCookie && Date.now() - cookieFetchedAt < SESSION_TTL_MS) return cachedCookie
  const { signal, clear } = withTimeout(30_000)
  try {
    const res = await fetch(`${AWWEB}/federated/users/op/login/anonymous`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal,
    })
    clear()
    if (!res.ok) throw new Error(`fcdo-treaties anonymous login: HTTP ${res.status}`)
    const cookies = typeof (res.headers as any).getSetCookie === 'function'
      ? (res.headers as any).getSetCookie() as string[]
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : [])
    if (cookies.length === 0) throw new Error('fcdo-treaties anonymous login: no Set-Cookie in response')
    const cookie = cookies.map(c => c.split(';')[0]).join('; ')
    cachedCookie = cookie
    cookieFetchedAt = Date.now()
    return cookie
  } catch (err) {
    clear()
    throw err
  }
}

interface SearchDetailsOpts {
  queryStr?: string | null
  fieldsValue?: Record<string, string>
  offset: number
  pageSize: number
  queryType?: number   // 64 = Pattern (default free-text), 16 = Boolean (exact field match)
}

function buildSearchBody(opts: SearchDetailsOpts) {
  return {
    type: 'SavedSearch',
    id: null,
    name: 'scrutinise-ingest',
    searchDetails: {
      bounds: null,
      queryStr: opts.queryStr ?? null,
      sortBy: [],
      queryType: opts.queryType ?? 64,
      fieldsValue: opts.fieldsValue ?? {},
      isRecurrent: false,
      pageNumber: 1,
      offset: opts.offset,
      pageSize: opts.pageSize,
      restrictedFieldsValue: {},
      GeoType: '',
      GeoRadius: 0,
      GeoRadiusMetrics: 'kilometers',
      searchMode: { mode: 'SEARCH' },
    },
    searchLibraryList: [],
    isCacheQuery: false,
    ftpDetailsList: null,
    deliveryOptions: { isMetadata: false, isBase: true, isOverview: false, isImportPackage: false, format: 'none' },
    email: null,
    showBrowse: false,
    browseFolderSort: null,
    browseFolderStructure: null,
    isReturnFacets: false,
  }
}

interface CswSearchResults {
  numberOfRecordsMatched?: number
  numberOfRecordsReturned?: number
  nextRecord?: number
  iStoreRecord?: unknown
}

async function postSearch(body: unknown, retrying = false): Promise<CswSearchResults> {
  const cookie = await getSessionCookie()
  const { signal, clear } = withTimeout(60_000)
  try {
    const res = await fetch(`${AWWEB}/awfp/search/${COLLECTION_ID}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
      signal,
    })
    clear()
    const data = await res.json().catch(() => null) as any
    // Session-expiry / auth failure comes back as a 401/440-ish status, or as a
    // 200 with an ows:ExceptionReport body (seen for other malformed requests) —
    // one retry with a forced fresh login covers the expiry case.
    if ((res.status === 401 || res.status === 440 || data?.['ows:ExceptionReport']) && !retrying) {
      await getSessionCookie(true)
      return postSearch(body, true)
    }
    if (!res.ok) throw new Error(`fcdo-treaties search: HTTP ${res.status}`)
    if (data?.['ows:ExceptionReport']) {
      const text = data['ows:ExceptionReport']?.['ows:Exception']?.['ows:ExceptionText'] ?? JSON.stringify(data)
      throw new Error(`fcdo-treaties search: ${text}`)
    }
    const sr = data?.['csw:GetRecordsResponse']?.['csw:SearchResults']
    if (!sr) throw new Error('fcdo-treaties search: malformed response (no SearchResults)')
    return sr as CswSearchResults
  } catch (err) {
    clear()
    throw err
  }
}

export interface FcdoTreatyRecord {
  id: number             // lb_document_id — stable, used as docId
  uuid: string | null
  title: string
  signedDate: string | null       // ISO YYYY-MM-DD, if parseable
  effectiveDate: string | null    // ISO YYYY-MM-DD, if parseable
  subject: string | null
  countryNames: string | null
  references: string | null       // raw archive-reference string (may embed PDF urls)
  documentUrl: string | null      // metadata-table HTML page (never full text — see header)
  pdfUrls: string[]               // full-text PDFs extracted from `references`
}

function toIsoDate(d: unknown): string | null {
  if (typeof d !== 'string') return null
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function fixSlashes(url: unknown): string | null {
  return typeof url === 'string' && url.length > 0 ? url.split('\\').join('/') : null
}

function normaliseRecord(raw: any): FcdoTreatyRecord | null {
  const id = Number(raw?.lb_document_id ?? raw?.id)
  if (!Number.isFinite(id)) return null
  const references: string = typeof raw?.references === 'string' ? raw.references : ''
  const pdfUrls = Array.from(new Set(
    (references.match(/https?:\/\/\S+?\.pdf/gi) ?? []).map(u => u.trim())
  ))
  return {
    id,
    uuid: typeof raw?.uuid === 'string' ? raw.uuid : null,
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim() : `UK Treaties Online record ${id}`,
    signedDate: toIsoDate(raw?.signed_event_date),
    effectiveDate: toIsoDate(raw?.definative_eif_event_date),
    subject: typeof raw?.subject === 'string' ? raw.subject : null,
    countryNames: typeof raw?.country_name === 'string' ? raw.country_name : null,
    references: references || null,
    documentUrl: fixSlashes(raw?.document_url),
    pdfUrls,
  }
}

function toRecordArray(raw: unknown): any[] {
  if (raw == null) return []
  return Array.isArray(raw) ? raw : [raw]
}

// Full-universe enumeration, paginated (44 pages at the max pageSize=500 the
// server was confirmed to honour on 8 Jul 2026). Yields normalised batches.
export async function* enumerateAll(pageSize = 500): AsyncGenerator<FcdoTreatyRecord[]> {
  let offset = 1
  for (;;) {
    const sr = await postSearch(buildSearchBody({ queryStr: '*', offset, pageSize }))
    const arr = toRecordArray(sr.iStoreRecord)
    if (arr.length === 0) return
    const records = arr.map(normaliseRecord).filter((r): r is FcdoTreatyRecord => r !== null)
    yield records
    if (!sr.nextRecord || sr.nextRecord <= offset) return
    offset = sr.nextRecord
  }
}

// Single-record re-fetch by lb_document_id (queryType 16 = Boolean/exact field
// match — the same mechanism the SPA's own permalink URLs use, per
// datasourceManager.js's documented `lb_document_id=[N]` example). Used by the
// processor so ingest_queue only needs to carry the numeric id as docId.
export async function fetchByLbDocumentId(id: number | string): Promise<FcdoTreatyRecord | null> {
  const sr = await postSearch(buildSearchBody({
    queryStr: null,
    fieldsValue: { lb_document_id: String(id) },
    offset: 1,
    pageSize: 1,
    queryType: 16,
  }))
  const arr = toRecordArray(sr.iStoreRecord)
  return arr.length ? normaliseRecord(arr[0]) : null
}

export async function fetchPdfBuffer(url: string): Promise<Buffer | null> {
  const { signal, clear } = withTimeout(90_000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal })
    clear()
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    clear()
    return null
  }
}
