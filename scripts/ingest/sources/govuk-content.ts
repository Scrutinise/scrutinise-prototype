// GOV.UK Content API client (V18) — generic per-page fetcher used by the
// hmrc-manuals full-depth corpus and the govuk-core-docs small corpora.
//
// Endpoints:
//   https://www.gov.uk/api/search.json   — enumeration (filter_format, paging
//     verified live to start=84,000+ on 10 Jun 2026 — no 10k deep-page cap)
//   https://www.gov.uk/api/content{path} — clean JSON per page; manual sections
//     carry details.body (HTML) + details.section_id; publications carry
//     details.attachments (PDF urls on assets.publishing.service.gov.uk)

const SEARCH = 'https://www.gov.uk/api/search.json'
const CONTENT = 'https://www.gov.uk/api/content'
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  return { signal: ctl.signal, clear: () => clearTimeout(t) }
}

export interface GovukSearchHit {
  link: string   // path with leading slash
  title: string
}

// Enumerate every document of a search format (e.g. 'hmrc_manual_section').
// Yields batches to keep the seeder's insert batching natural.
export async function* searchByFormat(format: string, pageSize = 1000): AsyncGenerator<GovukSearchHit[]> {
  let start = 0
  for (;;) {
    // order must be a sortable field — `link` is not (HTTP 422, found on first
    // seeder run). public_timestamp keeps deep paging deterministic.
    const url = `${SEARCH}?filter_format=${encodeURIComponent(format)}&count=${pageSize}&start=${start}&fields=link,title&order=public_timestamp`
    const { signal, clear } = withTimeout(60_000)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal })
      clear()
      if (!res.ok) throw new Error(`govuk search ${format} start=${start}: HTTP ${res.status}`)
      const data = await res.json() as { results: GovukSearchHit[] }
      if (!data.results?.length) return
      yield data.results
      start += pageSize
    } catch (err) {
      clear()
      throw err
    }
  }
}

// Free-text search constrained to a document type (used for white papers).
export async function* searchByQuery(q: string, documentType: string, pageSize = 200): AsyncGenerator<GovukSearchHit[]> {
  let start = 0
  for (;;) {
    const url = `${SEARCH}?q=${encodeURIComponent(q)}&filter_content_store_document_type=${encodeURIComponent(documentType)}&count=${pageSize}&start=${start}&fields=link,title`
    const { signal, clear } = withTimeout(60_000)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal })
      clear()
      if (!res.ok) throw new Error(`govuk search "${q}" start=${start}: HTTP ${res.status}`)
      const data = await res.json() as { results: GovukSearchHit[] }
      if (!data.results?.length) return
      yield data.results
      start += pageSize
    } catch (err) {
      clear()
      throw err
    }
  }
}

export interface GovukAttachment {
  title: string | null
  url: string | null
  content_type: string | null
}

export interface GovukContent {
  title: string
  documentType: string
  bodyHtml: string | null
  sectionId: string | null        // e.g. EIM23151 for manual sections
  attachments: GovukAttachment[]  // application/pdf entries only
  publicUpdatedAt: string | null  // ISO date
  notFound: boolean
}

export async function fetchGovukContent(path: string): Promise<GovukContent> {
  const p = path.startsWith('/') ? path : `/${path}`
  const { signal, clear } = withTimeout(30_000)
  try {
    const res = await fetch(`${CONTENT}${p}`, { headers: { 'User-Agent': UA }, signal })
    clear()
    if (res.status === 404 || res.status === 410) {
      return { title: '', documentType: '', bodyHtml: null, sectionId: null, attachments: [], publicUpdatedAt: null, notFound: true }
    }
    if (!res.ok) throw new Error(`govuk content ${p}: HTTP ${res.status}`)
    const data = await res.json() as any
    const details = data.details ?? {}
    const attachments: GovukAttachment[] = (details.attachments ?? [])
      .filter((a: any) => a?.content_type === 'application/pdf' && a?.url)
      .map((a: any) => ({ title: a.title ?? null, url: a.url, content_type: a.content_type }))
    return {
      title: data.title ?? '',
      documentType: data.document_type ?? '',
      bodyHtml: typeof details.body === 'string' ? details.body : null,
      sectionId: details.section_id ?? null,
      attachments,
      publicUpdatedAt: (data.public_updated_at ?? data.first_published_at ?? null)?.slice(0, 10) ?? null,
      notFound: false,
    }
  } catch (err) {
    clear()
    throw err
  }
}

export async function fetchPdfBuffer(url: string): Promise<Buffer | null> {
  const { signal, clear } = withTimeout(90_000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal })
    clear()
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    clear()
    return null
  }
}
