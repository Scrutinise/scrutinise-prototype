/**
 * committees-api.ts — UK Parliament Committees API (V20 probe 1, replaces the
 * CF-blocked committees.parliament.uk portal scraper).
 *
 * Host: committees-api.parliament.uk — open JSON API, OpenAPI spec at
 * /swagger/v1/swagger.json. Verified 12 Jun 2026 from a residential IP:
 * no CF challenge on listings or document downloads; documents are served
 * FROM THE API HOST as base64 JSON (no redirect to publications.parliament.uk).
 * ⚠️ Railway egress unverified until the post-push canary — the old portal and
 * api.parliament.uk/v1/hansard both CF-block datacentre IPs (playbook §8).
 *
 * Endpoints used:
 *   /api/Publications?Skip&Take                          (50,846 on 12 Jun 2026)
 *   /api/OralEvidence?Skip&Take                          (15,803)
 *   /api/WrittenEvidence?Skip&Take                       (126,589)
 *   /api/Publications/{id}                               (detail, document list)
 *   /api/Publications/{id}/Document/{documentId}/{fmt}   (fmt: OriginalFormat|Html|Pdf)
 *   /api/OralEvidence/{id}/Document/{fmt}
 *   /api/WrittenEvidence/{id}/Document/{fmt}
 *
 * Format notes (probed): conversions (Html/Pdf) 500 when unavailable for a
 * document — preference Html > Pdf > OriginalFormat, sniffing the original's
 * extension. Document responses: { fileName, fileSize, data: base64 }.
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const API_BASE = 'https://committees-api.parliament.uk/api'
const UA = 'Scrutinise-Ingest/1.0 (legal corpus research)'
const FETCH_TIMEOUT_MS = 60_000

const throttle = new AdaptiveThrottle({
  floor: 500,
  // V22: ceiling must exceed suspendThresholdMs or onSuspend can never fire
  // (default ceiling 30s < 60s threshold made the suspend path dead code)
  ceiling: 120_000,
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('committees-api', delayMs * 2)
      .catch(err => console.warn('[committees-api] suspend write failed:', err))
  },
})

export type CommitteesApiKind = 'Publications' | 'OralEvidence' | 'WrittenEvidence'

export interface CommitteesApiFile {
  fileName: string
  fileSize: number
  fileDataFormat: 'OriginalFormat' | 'Html' | 'Pdf'
}

/** A committee. `house` is 'Commons' | 'Lords' | 'Joint'; `category` is Select / General / Other.
 *  Carried on every Publications listing item — this is what proves (or disproves) the
 *  ADDENDUM §C claim that all three houses are covered. */
export interface CommitteesApiCommittee {
  id?: number
  name?: string
  house?: string
  category?: { id: number; name: string } | null
}

/** A committee business — an Inquiry, usually. `id` is the STABLE INQUIRY ID the ADDENDUM §B
 *  join key needs: evidence, report and government response all hang off the same one. */
export interface CommitteesApiBusiness {
  id: number
  title?: string
  type?: { name: string; isInquiry?: boolean }
}

export interface CommitteesApiListItem {
  id: number
  // Publications
  description?: string
  publicationStartDate?: string
  hcNumber?: { number: string; sessionDescription?: string } | null
  hlPaper?: { number: string; sessionDescription?: string } | null
  type?: { name: string }
  documents?: Array<{ documentId: number; files: CommitteesApiFile[] }>
  businesses?: CommitteesApiBusiness[]
  // V32: the archive fallback. Pre-2020 publications carry metadata but an EMPTY
  // documents[]; the body is only reachable at these URLs on publications.parliament.uk
  // (…/NNN.pdf) or www.parliament.uk/globalassets (…). Both hosts sit behind a Cloudflare
  // bot challenge — see committees-archive.ts for the route that actually works.
  additionalContentUrl?: string | null
  additionalContentUrl2?: string | null
  // report ↔ government-response linkage (ADDENDUM §A2/§B), both directions
  governmentResponses?: { publication?: CommitteesApiListItem[] } | null
  responseToPublicationId?: number | null
  respondingDepartment?: string | null
  // Evidence
  publicationDate?: string
  document?: { documentId: number; files: CommitteesApiFile[] }
  committeeBusiness?: { title: string } | null
  committees?: Array<{ name: string }>
  committee?: CommitteesApiCommittee | null
  witnesses?: Array<{ name: string | null; organisations: unknown[] }>
  internalReference?: string
}

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function apiGet(path: string): Promise<{ status: number; json: unknown | null }> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal, headers: { 'User-Agent': UA } })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return { status: res.status, json: null } }
    if (!res.ok) return { status: res.status, json: null }
    throttle.success()
    return { status: res.status, json: await res.json() }
  } catch (err) {
    clear()
    // V22: socket-level failure is a rate signal (the API rate-limits sustained
    // walks); deterministic HTTP errors (e.g. deep-offset 500s) do NOT back off
    throttle.backoff()
    console.warn(`[committees-api] fetch error ${path}: ${err}`)
    return { status: 0, json: null }
  }
}

// window: optional StartDate/EndDate (YYYY-MM-DD, inclusive) — V22. Deep global
// offsets die server-side (HTTP 500 after ~31s, load-dependent: skip=100000
// failed on 12 Jun, skip=50000 on 13 Jun); within a date window Skip stays
// shallow and the same query answers in ~2s.
// publicationTypeId (V32): Publications only. A YEAR window alone is still not
// shallow enough on the busy years — an unfiltered 2018 walk 500s at skip=3700
// of 4,191 and silently returns a TRUNCATED year rather than an error. Adding
// the type filter keeps the busiest single (year, type) slice under ~750 items,
// and the walk completes. Measure the source with it; a walk that quietly stops
// early understates a gap.
export async function listCommitteesApiPage(kind: CommitteesApiKind, skip: number, take = 100,
  window?: { start: string; end: string }, publicationTypeId?: number):
  Promise<{ totalResults: number; items: CommitteesApiListItem[] } | null> {
  const win = window ? `&StartDate=${window.start}&EndDate=${window.end}` : ''
  const typ = publicationTypeId ? `&PublicationTypeIds=${publicationTypeId}` : ''
  const { json } = await apiGet(`/${kind}?Skip=${skip}&Take=${take}${win}${typ}`)
  if (!json || typeof json !== 'object') return null
  const obj = json as { totalResults?: number; items?: CommitteesApiListItem[] }
  if (typeof obj.totalResults !== 'number' || !Array.isArray(obj.items)) return null
  return { totalResults: obj.totalResults, items: obj.items }
}

export async function getCommitteesApiItem(kind: CommitteesApiKind, id: number): Promise<CommitteesApiListItem | null> {
  const { json } = await apiGet(`/${kind}/${id}`)
  if (!json || typeof json !== 'object') return null
  return json as CommitteesApiListItem
}

export interface ApiDocumentResult {
  fileName: string
  buffer: Buffer
  // which fileDataFormat actually served the bytes
  servedFormat: 'Html' | 'Pdf' | 'OriginalFormat'
}

// Fetch one document, preferring Html (clean text) > Pdf > OriginalFormat.
// advertised: the files[] list from the item — formats not advertised are not
// attempted (conversions 500 when unavailable; deterministic, don't poke them).
export async function fetchCommitteesApiDocument(
  kind: CommitteesApiKind, itemId: number, documentId: number,
  advertised: CommitteesApiFile[]
): Promise<ApiDocumentResult | null> {
  const have = new Set(advertised.map(f => f.fileDataFormat))
  const order: Array<'Html' | 'Pdf' | 'OriginalFormat'> =
    (['Html', 'Pdf', 'OriginalFormat'] as const).filter(f => have.has(f))

  for (const fmt of order) {
    const path = kind === 'Publications'
      ? `/Publications/${itemId}/Document/${documentId}/${fmt}`
      : `/${kind}/${itemId}/Document/${fmt}`
    const { json } = await apiGet(path)
    if (!json || typeof json !== 'object') continue
    const doc = json as { fileName?: string; data?: string }
    if (!doc.data) continue
    try {
      return { fileName: doc.fileName ?? `${documentId}.${fmt.toLowerCase()}`, buffer: Buffer.from(doc.data, 'base64'), servedFormat: fmt }
    } catch {
      continue
    }
  }
  return null
}
