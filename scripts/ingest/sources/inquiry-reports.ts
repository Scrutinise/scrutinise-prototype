/**
 * inquiry-reports.ts — public inquiry FINAL REPORTS (V24 §5). Reports-only;
 * evidence bundles are deferred (huge, mixed-licence — brief §5).
 *
 * Route: gov.uk publication pages expose their report volumes as PDF attachments
 * on assets.publishing.service.gov.uk (CF-free, TNA-grade infra). We seed ONE
 * queue row per report PDF — a 12-volume inquiry (Iraq) is 26 large PDFs that
 * would blow the 5-min row timeout if processed in a single row, which is why
 * this is a distinct sourceType from the govuk-content content-page processor
 * (which fetches all of a page's attachments in one claim). Per-PDF rows give
 * each volume its own budget.
 *
 * Licence: inquiry reports are Crown copyright under OGL v3.0 (gov.uk-published).
 *
 * Registry below = the V24 first seed (concluded major inquiries with reports on
 * gov.uk). Grenfell / dark-site own-domain reports need a Web Archive snapshot
 * adapter — a documented follow-up, not built this sprint.
 */
import { fetchPdfBuffer } from './govuk-content'

export interface InquiryDef { key: string; name: string; govukPath: string; status: 'concluded' | 'ongoing' }

// V25 §5: extended to the concluded-inquiry register (INQUIRIES_UNIVERSE.md),
// reports-only. Each path is a gov.uk publication page whose attachments are the
// inquiry's report volumes (verified non-null with PDFs at build time). Inquiries
// whose final reports live ONLY on a dark own-domain (some Manchester Arena /
// Undercover Policing / Shipman own-site material) still need a Web Archive
// snapshot adapter — a documented follow-up (see header).
export const INQUIRY_REGISTRY: InquiryDef[] = [
  // V24 first seed
  { key: 'infected-blood',      name: 'Infected Blood Inquiry',           govukPath: 'government/publications/infected-blood-inquiry-reports', status: 'concluded' },
  { key: 'iraq-chilcot',        name: 'Iraq Inquiry (Chilcot)',           govukPath: 'government/publications/the-report-of-the-iraq-inquiry', status: 'concluded' },
  { key: 'leveson',             name: 'Leveson Inquiry',                  govukPath: 'government/publications/leveson-inquiry-report-into-the-culture-practices-and-ethics-of-the-press', status: 'concluded' },
  { key: 'manchester-arena-1',  name: 'Manchester Arena Inquiry Vol 1',   govukPath: 'government/publications/manchester-arena-inquiry-volume-1-security-for-the-arena', status: 'concluded' },
  { key: 'manchester-arena-2',  name: 'Manchester Arena Inquiry Vol 2',   govukPath: 'government/publications/manchester-arena-inquiry-volume-2-emergency-response', status: 'concluded' },
  { key: 'manchester-arena-3',  name: 'Manchester Arena Inquiry Vol 3',   govukPath: 'government/publications/manchester-arena-inquiry-volume-3-radicalisation-and-preventability', status: 'concluded' },
  { key: 'brook-house',         name: 'Brook House Inquiry',              govukPath: 'government/publications/brook-house-inquiry', status: 'concluded' },
  { key: 'post-office-horizon', name: 'Post Office Horizon IT Inquiry',   govukPath: 'government/publications/post-office-horizon-it-inquiry-2020', status: 'ongoing' },
  // V25 register expansion (all verified → PDFs at build)
  { key: 'bloody-sunday-saville', name: 'Bloody Sunday Inquiry (Saville)', govukPath: 'government/publications/report-of-the-bloody-sunday-inquiry', status: 'concluded' },
  { key: 'mid-staffs-francis',  name: 'Mid Staffordshire NHS FT Public Inquiry (Francis)', govukPath: 'government/publications/report-of-the-mid-staffordshire-nhs-foundation-trust-public-inquiry', status: 'concluded' },
  { key: 'victoria-climbie',    name: 'Victoria Climbié Inquiry (Laming)', govukPath: 'government/publications/the-victoria-climbie-inquiry-report-of-an-inquiry-by-lord-laming', status: 'concluded' },
  { key: 'azelle-rodney',       name: 'Azelle Rodney Inquiry',           govukPath: 'government/publications/the-report-of-the-azelle-rodney-inquiry', status: 'concluded' },
  { key: 'rosemary-nelson',     name: 'Rosemary Nelson Inquiry',         govukPath: 'government/publications/the-rosemary-nelson-inquiry-report', status: 'concluded' },
  { key: 'litvinenko',          name: 'Litvinenko Inquiry',              govukPath: 'government/publications/the-litvinenko-inquiry-report-into-the-death-of-alexander-litvinenko', status: 'concluded' },
  { key: 'equitable-life',      name: 'Equitable Life Inquiry (Penrose)', govukPath: 'government/publications/report-of-the-equitable-life-inquiry', status: 'concluded' },
  { key: 'baha-mousa',          name: 'Baha Mousa Public Inquiry',       govukPath: 'government/publications/the-baha-mousa-public-inquiry-report', status: 'concluded' },
  { key: 'al-sweady',           name: 'Al-Sweady Inquiry',               govukPath: 'government/publications/al-sweady-inquiry-report', status: 'concluded' },
  { key: 'hillsborough-panel',  name: 'Hillsborough Independent Panel',   govukPath: 'government/publications/the-report-of-the-hillsborough-independent-panel', status: 'concluded' },
  { key: 'zahid-mubarek',       name: 'Zahid Mubarek Inquiry',           govukPath: 'government/publications/report-of-the-zahid-mubarek-inquiry', status: 'concluded' },
  { key: 'iicsa-final',         name: 'Independent Inquiry into Child Sexual Abuse (IICSA)', govukPath: 'government/publications/iicsa-report-of-the-independent-inquiry-into-child-sexual-abuse', status: 'concluded' },
  { key: 'grenfell-phase-2',    name: 'Grenfell Tower Inquiry Phase 2',   govukPath: 'government/publications/publication-of-the-grenfell-tower-inquiry-phase-2-report', status: 'concluded' },
]

export interface InquiryPdf { seq: number; url: string; title: string }

const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; OGL public inquiry reports)'

// Enumerate the PDF report volumes of a gov.uk publication via its content API.
// Returns null on fetch failure (so a seeder/worker can distinguish from "no
// PDFs"). Non-PDF attachments (HTML, CSV) are skipped — reports-only.
export async function listInquiryPdfs(govukPath: string): Promise<InquiryPdf[] | null> {
  const res = await fetch(`https://www.gov.uk/api/content/${govukPath}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) return null
  const json = await res.json() as { details?: { attachments?: Array<{ content_type?: string; url?: string; title?: string }> } }
  const att = json.details?.attachments ?? []
  const out: InquiryPdf[] = []
  let seq = 0
  for (const a of att) {
    if (a.content_type !== 'application/pdf' || !a.url) continue
    out.push({ seq: ++seq, url: a.url, title: (a.title ?? '').trim() || `Report volume ${seq}` })
  }
  return out
}

export { fetchPdfBuffer }
