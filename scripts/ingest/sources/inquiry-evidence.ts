/**
 * inquiry-evidence.ts — public-inquiry EVIDENCE (V30 §3): the witness statements,
 * expert reports, disclosed documents and hearing transcripts BEHIND the findings
 * (inquiry-reports holds the reports). Governed by the §0 sensitive-evidence
 * policy (SENSITIVE_EVIDENCE_POLICY.md): ingest evidence but EXCLUDE clearly-
 * sensitive personal categories at the level the inquiry's OWN structure already
 * separates them — never per-paragraph PII redaction.
 *
 * Each inquiry publishes evidence on a bespoke route, so this is a registry of
 * per-inquiry adapters. Built this sprint: the Post Office Horizon IT Inquiry
 * (postofficehorizoninquiry.org.uk) — a Drupal evidence library with a faceted
 * listing (/evidence/all-evidence?page=N) of ~13,070 items, each a detail page
 * carrying a /file/{id}/download PDF + structural metadata (Evidence type,
 * Witness, Witness category, Phase). Licence VERIFIED OGL v3.0 at
 * /terms-and-conditions ("© Crown copyright. Licensed under the Open Government
 * Licence v3.0"). Lower sensitivity than the abuse/health inquiries → the §0
 * exclusion only drops the human-impact personal-testimony category.
 *
 * Infected Blood + Grenfell are PROBED + sequenced (see the V30 report), not
 * built here — they are higher-sensitivity and larger, and the brief says pilot
 * + sequence, do not blanket-build.
 */
import { fetchPdfBuffer } from './govuk-content'
export { fetchPdfBuffer }

const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; OGL inquiry evidence)'

export type Sensitivity = 'low' | 'high'
export interface InquiryEvidenceSource {
  key: string; name: string; route: 'poh-drupal'; base: string; sensitivity: Sensitivity; note: string
}
export const INQUIRY_EVIDENCE_SOURCES: InquiryEvidenceSource[] = [
  {
    key: 'post-office-horizon', name: 'Post Office Horizon IT Inquiry — evidence',
    route: 'poh-drupal', base: 'https://www.postofficehorizoninquiry.org.uk',
    sensitivity: 'low',
    note: 'OGL v3.0 verified. ~13,070 published evidence items. §0 excludes only human-impact personal testimony.',
  },
]

export interface EvidenceRef { slug: string; ref: string; refPrefix: string }
export interface EvidenceItem {
  slug: string; ref: string; refPrefix: string
  title: string; pdfUrl: string | null
  evidenceType: string | null; witness: string | null; witnessCategory: string | null
  phase: string | null; date: string | null
}

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
}
function field(html: string, label: string): string | null {
  // Drupal field markup: a label followed by the value text.
  const rx = new RegExp(`${label}\\s*</[^>]+>\\s*<[^>]+>\\s*([^<]{1,80})`, 'i')
  const m = rx.exec(html)
  const v = m ? decode(m[1]) : null
  return v && v !== '.' && v.length > 0 ? v : null
}

// ── Post Office Horizon (Drupal evidence library) ─────────────────────────────
const REF_RX = /\/evidence\/([a-z]{2,5}[0-9]{6,}[a-z0-9-]*)/gi

export async function pohLastPage(base: string): Promise<number> {
  const res = await fetch(`${base}/evidence/all-evidence`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return 0
  const html = await res.text()
  let max = 0
  for (const m of html.matchAll(/[?&]page=(\d+)/g)) max = Math.max(max, Number(m[1]))
  return max
}

export async function pohListPage(base: string, page: number): Promise<EvidenceRef[]> {
  const res = await fetch(`${base}/evidence/all-evidence?page=${page}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const html = await res.text()
  const seen = new Set<string>()
  const out: EvidenceRef[] = []
  for (const m of html.matchAll(REF_RX)) {
    const slug = m[1]
    if (slug.startsWith('all-evidence') || seen.has(slug)) continue
    seen.add(slug)
    const pm = /^([a-z]+)/i.exec(slug)
    out.push({ slug, ref: slug.split('-')[0], refPrefix: (pm ? pm[1] : '').toUpperCase() })
  }
  return out
}

export async function pohFetchItem(base: string, slug: string): Promise<EvidenceItem | null> {
  const res = await fetch(`${base}/evidence/${slug}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const html = await res.text()
  const dl = /href="(\/file\/\d+\/download[^"]*)"/i.exec(html)
  const titleM = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  const pm = /^([a-z]+)/i.exec(slug)
  return {
    slug, ref: slug.split('-')[0], refPrefix: (pm ? pm[1] : '').toUpperCase(),
    title: titleM ? decode(titleM[1].replace(/<[^>]+>/g, ' ')) : slug,
    pdfUrl: dl ? base + decode(dl[1]) : null,
    evidenceType: field(html, 'Evidence type'),
    witness: field(html, 'Witness'),
    witnessCategory: field(html, 'Witness category'),
    phase: field(html, 'Phase'),
    date: field(html, 'Date added'),
  }
}

// ── §0 STRUCTURAL SENSITIVE-EVIDENCE EXCLUSION (reusable) ──────────────────────
// Decide keep / exclude / flag at the level the inquiry's own structure separates
// — NOT per-paragraph. See SENSITIVE_EVIDENCE_POLICY.md.
export type EvidenceDecision = 'keep' | 'exclude' | 'flag'
export interface ClassifyInput {
  sensitivity: Sensitivity
  refPrefix?: string | null
  evidenceType?: string | null
  witnessCategory?: string | null
  witness?: string | null
  title?: string | null
}

// Categories the inquiry's own structure labels as sensitive personal material.
const SENSITIVE_CATEGORY = /human impact|personal (statement|account|testimony)|survivor|victim|bereaved|impacted (person|individual)|complainant/i
const SENSITIVE_TYPE = /impact statement|personal statement|medical record|health record|patient record|gp record/i
const RESTRICTED = /anonymi|cipher|restricted|protected party|under (restriction|anonymity)/i
// Always-keep institutional/expert/official material (overrides nothing sensitive,
// but classifies the bulk as clearly non-sensitive).
const KEEP_TYPE = /expert report|transcript|judgment|report|statistical|guidance|policy|board (minutes|paper)|correspondence|letter|email|act of parliament|article/i

export function classifyEvidence(i: ClassifyInput): { decision: EvidenceDecision; reason: string } {
  const cat = i.witnessCategory ?? ''
  const type = i.evidenceType ?? ''
  const wit = i.witness ?? ''
  const title = i.title ?? ''
  if (RESTRICTED.test(cat) || RESTRICTED.test(title)) return { decision: 'exclude', reason: 'restriction/anonymity order' }
  if (SENSITIVE_CATEGORY.test(cat) || SENSITIVE_CATEGORY.test(wit)) return { decision: 'exclude', reason: 'sensitive personal-testimony category' }
  if (SENSITIVE_TYPE.test(type) || SENSITIVE_TYPE.test(title)) return { decision: 'exclude', reason: 'individual medical/health-detail or impact statement' }
  // High-sensitivity inquiries: a witness statement from an individual (not an
  // institution/expert) whose category is unlabelled is NOT cleanly separable →
  // flag for human review rather than ingest-blind or drop-wholesale.
  if (i.sensitivity === 'high' && /witness statement/i.test(type) && !KEEP_TYPE.test(type) && !/expert|professor|dr |institution|company|department|trust|authority|police/i.test(wit)) {
    return { decision: 'flag', reason: 'individual witness statement, category unlabelled — not cleanly separable' }
  }
  return { decision: 'keep', reason: 'institutional/expert/official/transcript/factual' }
}
