/**
 * own-domain-reviews.ts — flagship independent reviews published on their OWN
 * microsites rather than gov.uk (V30 §2). These feed the SAME corpus as
 * independent-reviews (reports-only, per-PDF rows), via a web-archive adapter.
 *
 * The route reality (verified 24 Jun 2026): the marquee modern reviews (the Cass
 * Review and the rest of the *.independent-review.uk family, the IMMDS/Cumberlege
 * review) are single-page-application microsites. Their live sites are gone; they
 * survive only as JS-SPA SHELLS in the UK Gov Web Archive (UKGWA), which exposes
 * no public CDX. The Internet Archive (Wayback) — which DOES expose a CDX — holds
 * 0 PDF captures for these hosts (the report PDFs sat on separate asset/CDN paths
 * the SPA loaded client-side, so they were never crawled). So a static
 * archive-CDX PDF enumeration finds nothing for the SPA family; those are the
 * "identified but PDF-route-blocked" reviews listed for Charlie (acceptance §2).
 *
 * This adapter therefore supports BOTH routes:
 *   1. Wayback CDX PDF enumeration per host (works for static microsites that
 *      Wayback crawled with their PDFs — the older reviews).
 *   2. Pinned PDF URLs (`pdfs`) for a review whose report URL is known directly
 *      (resolved by hand from the archive / a mirror), bypassing enumeration.
 *
 * Licence: commissioned reviews are Crown/OGL even off gov.uk, but it is verified
 * PER SITE before ingest (licence-at-the-licence-page) — the seeder records the
 * per-site finding; default treat-as-OGL only where the site states it.
 */
import { fetchPdfBuffer } from './govuk-content'
export { fetchPdfBuffer }

const CDX = 'https://web.archive.org/cdx/search/cdx'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

export interface OwnDomainReview {
  key: string
  name: string
  host: string                 // microsite host (for CDX enumeration)
  archive: 'wayback' | 'ukgwa'
  spa: boolean                 // JS-SPA shell → static enumeration won't find PDFs
  pdfs?: Array<{ url: string; title: string }>  // pinned report PDFs (optional)
  note?: string
}

// Curated registry of flagship reviews published on their own microsites. Each
// is licence-verified at its own copyright page by the seeder before ingest.
export const OWN_DOMAIN_REVIEWS: OwnDomainReview[] = [
  { key: 'cass-review', name: 'Cass Review (gender identity services for children)',
    host: 'cass.independent-review.uk', archive: 'ukgwa', spa: true,
    note: 'UKGWA-only (no Wayback PDFs; UKGWA has no public CDX); SPA shell. PDF route blocked — pin the report PDF or use the NHS England mirror.' },
  { key: 'childrens-social-care', name: 'Independent Review of Children’s Social Care (MacAlister)',
    host: 'childrenssocialcare.independent-review.uk', archive: 'wayback', spa: true,
    note: 'SPA microsite; 0 PDF captures in Wayback. PDF route blocked.' },
  { key: 'immds-cumberlege', name: 'Independent Medicines & Medical Devices Safety Review (Cumberlege)',
    host: 'immdsreview.org.uk', archive: 'wayback', spa: true,
    note: 'SPA microsite; 0 PDF captures in Wayback. PDF route blocked.' },
]

// Enumerate archived report PDFs for a host via the Wayback CDX (PDF mimetype,
// collapsed to distinct URLs). Returns [] for SPA/UKGWA-only hosts (no PDFs
// crawled) — the caller treats that as "PDF route blocked", not an error.
export async function enumerateArchivedPdfs(host: string): Promise<Array<{ url: string; title: string }>> {
  const url = `${CDX}?url=${encodeURIComponent(host)}*&matchType=prefix&output=text`
    + `&fl=original,timestamp&filter=mimetype:application/pdf&collapse=urlkey&limit=500`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const out: Array<{ url: string; title: string }> = []
  const seen = new Set<string>()
  for (const line of (await res.text()).split('\n')) {
    const [original, ts] = line.split(' ')
    if (!original || !ts) continue
    // Skip report ToRs / annex thumbnails by title later; here keep all PDFs.
    const key = original.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const fname = decodeURIComponent(original.split('/').pop() || '').replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()
    // Fetch the contemporaneous archived copy (raw) when ingesting.
    out.push({ url: `https://web.archive.org/web/${ts}id_/${original}`, title: fname || 'report' })
  }
  return out
}

// Resolve a review to its ingestable PDFs: pinned first, else archive enumeration.
export async function resolveReviewPdfs(r: OwnDomainReview): Promise<Array<{ url: string; title: string }>> {
  if (r.pdfs && r.pdfs.length) return r.pdfs
  if (r.archive === 'ukgwa') return []          // no CDX → not enumerable here
  return enumerateArchivedPdfs(r.host)
}
