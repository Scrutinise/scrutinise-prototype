/**
 * independent-reviews.ts — commissioned independent reviews / audits (V29 §5).
 *
 * Distinct from statutory public inquiries (inquiry-reports): expert-led reviews
 * commissioned by a department / ALB / the NHS (Cass, Casey, Augar, Lammy,
 * Windrush, Francis, Taylor, Laming…). Mostly gov.uk-published OGL PDFs, so they
 * reuse the inquiry-reports machinery exactly — per-PDF rows, gov.uk publication
 * attachments, OGL v3.0. Reports-only: government responses, terms of reference
 * and cost returns are excluded.
 *
 * The universe = a curated, PDF-verified registry (REVIEW_REGISTRY, from
 * INDEPENDENT_REVIEWS_UNIVERSE.md) ∪ a gov.uk Search discovery pass
 * (document_type=independent_report, title ~ review/audit). Own-domain reviews
 * (e.g. Cass on cass.independent-review.uk) need a Web Archive adapter — a
 * documented follow-up, not built this sprint.
 */
import { listInquiryPdfs, fetchPdfBuffer } from './inquiry-reports'
export { listInquiryPdfs, fetchPdfBuffer }

export interface ReviewDef { key: string; name: string; govukPath: string }

// Curated, gov.uk-published commissioned reviews (reports-only). Each is a
// /government/publications page whose attachments are the review's report
// PDF(s). The seeder PDF-verifies every path live and drops any that no longer
// resolves (gov.uk reorganises slugs), so a stale entry is self-healing.
export const REVIEW_REGISTRY: ReviewDef[] = [
  { key: 'casey-cse-audit',     name: 'Casey — National Audit on Group-Based CSE',          govukPath: 'government/publications/national-audit-on-group-based-child-sexual-exploitation-and-abuse' },
  { key: 'augar-post18',        name: 'Augar — Post-18 Education & Funding Review',          govukPath: 'government/publications/post-18-review-of-education-and-funding-independent-panel-report' },
  { key: 'windrush-lessons',    name: 'Williams — Windrush Lessons Learned Review',          govukPath: 'government/publications/windrush-lessons-learned-review' },
  { key: 'lammy-review',        name: 'Lammy Review (CJS & BAME)',                            govukPath: 'government/publications/lammy-review-final-report' },
  { key: 'taylor-working',      name: 'Taylor Review of Modern Working Practices',            govukPath: 'government/publications/good-work-the-taylor-review-of-modern-working-practices' },
  { key: 'francis-speak-up',    name: 'Francis — Freedom to Speak Up Review',                 govukPath: 'government/publications/sir-robert-francis-freedom-to-speak-up-review' },
  { key: 'timpson-exclusions',  name: 'Timpson Review of School Exclusion',                   govukPath: 'government/publications/timpson-review-of-school-exclusion' },
  { key: 'munro-child-protect', name: 'Munro Review of Child Protection',                     govukPath: 'government/publications/munro-review-of-child-protection-final-report-a-child-centred-system' },
  { key: 'wood-lscb',           name: 'Wood Review of Local Safeguarding Children Boards',    govukPath: 'government/publications/wood-review-of-local-safeguarding-children-boards' },
  { key: 'harris-custody',      name: 'Harris Review — Deaths of young people in custody',    govukPath: 'government/publications/the-harris-review-into-the-deaths-of-18-24-year-olds-in-custody' },
  { key: 'farmer-families',     name: 'Farmer Review (male prisoners family ties)',           govukPath: 'government/publications/the-importance-of-strengthening-prisoners-family-ties-to-prevent-reoffending-and-reduce-intergenerational-crime' },
  { key: 'stevenson-farmer-mh', name: 'Stevenson/Farmer — Thriving at Work (mental health)',  govukPath: 'government/publications/thriving-at-work-a-review-of-mental-health-and-employers' },
  { key: 'naylor-nhs-property', name: 'Naylor Review — NHS property and estates',             govukPath: 'government/publications/naylor-review-nhs-property-and-estates' },
  { key: 'bichard-soham',       name: 'Bichard Inquiry / Review (Soham — vetting)',           govukPath: 'government/publications/bichard-inquiry-report' },
  { key: 'macgregor-tax',       name: 'Independent review (where gov.uk-published)',          govukPath: 'government/publications/independent-review-of-the-loan-charge' },
]

const SEARCH = 'https://www.gov.uk/api/search.json'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; OGL independent reviews)'

// gov.uk Search discovery — independent_report doc type whose title looks like a
// commissioned review/audit. Returns candidate gov.uk paths (no leading slash),
// excluding ones already in REVIEW_REGISTRY.
export async function discoverReviewPaths(): Promise<Array<{ path: string; title: string }>> {
  const registered = new Set(REVIEW_REGISTRY.map(r => r.govukPath))
  const queries = [
    'independent review', 'review final report', 'independent audit',
    'review of', 'lessons learned review',
  ]
  const cand = new Map<string, string>()
  for (const q of queries) {
    const url = `${SEARCH}?q=${encodeURIComponent(q)}&filter_content_store_document_type=independent_report&count=200&fields=title,link`
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    if (!res.ok) continue
    const j = await res.json() as { results?: Array<{ title?: string; link?: string }> }
    for (const r of j.results ?? []) {
      const link = r.link ?? ''
      const title = r.title ?? ''
      if (!link.startsWith('/government/publications/')) continue
      if (!/\b(review|audit)\b/i.test(title)) continue
      // Reports-only (brief §5): drop ToRs, government responses, consultations.
      if (/terms of reference|^response to|government response|: terms\b|\bconsultation\b/i.test(title)) continue
      const path = link.replace(/^\//, '')
      if (registered.has(path)) continue
      cand.set(path, title)
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return [...cand.entries()].map(([path, title]) => ({ path, title }))
}
