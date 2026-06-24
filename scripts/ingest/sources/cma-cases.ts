/**
 * cma-cases.ts — Competition & Markets Authority cases & decisions (V30 §1.1).
 *
 * The "financial/competition corpus" anchor: the bodies that make and interpret
 * competition/economic law. The CMA case finder (gov.uk/cma-cases) is the
 * authoritative index — it includes CMA cases AND the Office for the Internal
 * Market (OIM) + Subsidy Advice Unit (SAU) cases (the finder's own description
 * states this). All carry content_store_document_type = `cma_case`.
 *
 * Route (verified 24 Jun 2026):
 *   - Enumerate: GET /api/search.json?filter_content_store_document_type=cma_case
 *       → 2,562 cases, paged via start/count (one entry per case slug).
 *   - Per case:  GET /api/content/cma-cases/{slug}
 *       details.body        = HTML case narrative (admin timetable, decisions,
 *                             contacts) — the case OVERVIEW section.
 *       details.attachments = the DECISION DOCUMENTS — application/pdf assets on
 *                             assets.publishing.service.gov.uk (CF-free TNA-grade
 *                             infra), e.g. final reports, decisions to refer,
 *                             terms of reference, commencement notices.
 *
 * Granularity: one OVERVIEW section per case (the body) + one section per
 * decision-document PDF (per-PDF rows reuse the inquiry-reports budget model — a
 * merger case can carry ~30 PDFs, too many to extract under one 5-min claim).
 *
 * Licence: OGL v3.0 — VERIFIED clean. The CMA is a non-ministerial department
 * (Crown copyright); its gov.uk-published case material rides gov.uk's terms
 * (gov.uk/help/terms-conditions: OGL v3.0). Decision PDFs on
 * assets.publishing.service.gov.uk are the same Crown-copyright material.
 *
 * Dedup: corpus_sections holds no /cma-cases/ pages under quangos-govuk
 * (verified 24 Jun 2026) — the quango builds enumerated other document types,
 * so cma-cases is additive with no overlap.
 */
import { fetchPdfBuffer } from './govuk-content'
export { fetchPdfBuffer }

const SEARCH = 'https://www.gov.uk/api/search.json'
const CONTENT = 'https://www.gov.uk/api/content'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; OGL CMA cases)'

export interface CmaCaseRef { slug: string; title: string }
export interface CmaPdf { seq: number; url: string; title: string }
export interface CmaCase {
  slug: string
  title: string
  date: string | null
  body: string        // plain text extracted from details.body
  pdfs: CmaPdf[]
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#160;|&nbsp;/g, ' ').replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&pound;/g, '£').replace(/&hellip;/g, '…').replace(/&[a-z]+;/g, ' ')
}
function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<\/(p|div|li|h[1-6]|tr|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// Enumerate every cma_case slug via the gov.uk search index (deep paging works).
export async function enumerateCmaCases(onProgress?: (n: number) => void): Promise<CmaCaseRef[]> {
  const out = new Map<string, CmaCaseRef>()
  const PAGE = 200
  for (let start = 0; ; start += PAGE) {
    const url = `${SEARCH}?filter_content_store_document_type=cma_case&count=${PAGE}&start=${start}&fields=title,link&order=-public_timestamp`
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    if (!res.ok) throw new Error(`cma-cases enum HTTP ${res.status} at start=${start}`)
    const j = await res.json() as { results?: Array<{ title?: string; link?: string }>; total?: number }
    const results = j.results ?? []
    if (results.length === 0) break
    for (const r of results) {
      const link = r.link ?? ''
      if (!link.startsWith('/cma-cases/')) continue
      const slug = link.replace(/^\/cma-cases\//, '')
      if (!slug || out.has(slug)) continue
      out.set(slug, { slug, title: (r.title ?? '').trim() || slug })
    }
    onProgress?.(out.size)
    if (results.length < PAGE) break
    await new Promise(r => setTimeout(r, 150))
  }
  return [...out.values()]
}

// Fetch one case: body overview text + decision-document PDFs. null on fetch
// failure (distinguished from a case with no PDFs).
export async function fetchCmaCase(slug: string): Promise<CmaCase | null> {
  const res = await fetch(`${CONTENT}/cma-cases/${slug}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!res.ok) return null
  const j = await res.json() as {
    title?: string; first_published_at?: string; public_updated_at?: string
    details?: { body?: string; attachments?: Array<{ content_type?: string; url?: string; title?: string }> }
  }
  const d = j.details ?? {}
  const body = typeof d.body === 'string' ? htmlToText(d.body) : ''
  const pdfs: CmaPdf[] = []
  let seq = 0
  for (const a of d.attachments ?? []) {
    if (a.content_type !== 'application/pdf' || !a.url) continue
    pdfs.push({ seq: ++seq, url: a.url, title: (a.title ?? '').trim() || `Decision document ${seq}` })
  }
  return {
    slug,
    title: (j.title ?? '').trim() || slug,
    date: (j.first_published_at ?? j.public_updated_at ?? '').slice(0, 10) || null,
    body,
    pdfs,
  }
}
