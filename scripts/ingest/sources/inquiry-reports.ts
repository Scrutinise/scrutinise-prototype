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
  // V28 §4 register completion — concluded statutory/public-inquiry FINAL or
  // substantive (phase/tranche) reports discovered via the gov.uk Search API and
  // PDF-verified (v28-discover-inquiries.ts). Reports-only: government responses,
  // terms of reference, cost returns, panel-appointment notices and inquiry
  // case-statistics were all excluded. Some live inquiries' interim/phase reports
  // are included (status 'ongoing') because the published report is itself the
  // unit of value. Dark-site-only reports (BSE/Phillips, Bristol Royal Infirmary
  // full report, Morecambe Bay, Gosport, Daniel Morgan, Hutton, Scott, Penrose-
  // Scotland, Vale of Leven, Telford CSE) still need a Web Archive adapter —
  // documented follow-up, not built this sprint.
  { key: 'stephen-lawrence',    name: 'Stephen Lawrence Inquiry (Macpherson)', govukPath: 'government/publications/the-stephen-lawrence-inquiry', status: 'concluded' },
  { key: 'shipman-2',           name: 'Shipman Inquiry Second Report',     govukPath: 'government/publications/the-shipman-inquiry-second-report-the-police-investigation-of-march-1988', status: 'concluded' },
  { key: 'shipman-3',           name: 'Shipman Inquiry Third Report',      govukPath: 'government/publications/the-shipman-inquiry-third-report-death-certification-and-the-investigation-of-deaths-by-coroners', status: 'concluded' },
  { key: 'detainee-gibson',     name: 'Detainee Inquiry (Gibson)',         govukPath: 'government/publications/report-of-the-detainee-inquiry', status: 'concluded' },
  { key: 'paterson',            name: 'Paterson Inquiry',                  govukPath: 'government/publications/paterson-inquiry-report', status: 'concluded' },
  { key: 'angiolini-1',         name: 'Angiolini Inquiry Part 1',          govukPath: 'government/publications/angiolini-inquiry-part-1-report', status: 'concluded' },
  { key: 'david-fuller-1',      name: 'David Fuller Inquiry Phase 1',      govukPath: 'government/publications/david-fuller-inquiry-phase-1-report', status: 'concluded' },
  { key: 'david-fuller-2',      name: 'David Fuller Inquiry Phase 2',      govukPath: 'government/publications/david-fuller-inquiry-phase-2-report', status: 'concluded' },
  { key: 'southport-1',         name: 'Southport Inquiry Phase 1',         govukPath: 'government/publications/the-southport-inquiry-phase-1-report', status: 'ongoing' },
  { key: 'wass-st-helena',      name: 'Wass Inquiry (St Helena/Ascension)', govukPath: 'government/publications/the-wass-inquiry-report-into-allegations-surrounding-child-safeguarding-issues-on-st-helena-and-ascension-island-redacted-version', status: 'concluded' },
  { key: 'laidlaw',             name: 'Laidlaw Inquiry (West Coast rail franchise)', govukPath: 'government/publications/report-of-the-laidlaw-inquiry', status: 'concluded' },
  { key: 'magnox',              name: 'Magnox Inquiry',                    govukPath: 'government/publications/magnox-inquiry-final-report', status: 'concluded' },
  { key: 'kerr-haslam',         name: 'Kerr/Haslam Inquiry',               govukPath: 'government/publications/the-kerrhaslam-inquiry-report', status: 'concluded' },
  { key: 'billy-wright',        name: 'Billy Wright Inquiry',              govukPath: 'government/publications/the-billy-wright-inquiry-report', status: 'concluded' },
  { key: 'cranston',            name: 'Cranston Inquiry (Western Jet Foil/Manston)', govukPath: 'government/publications/the-report-of-the-cranston-inquiry', status: 'concluded' },
  { key: 'royal-liverpool-children', name: 'Royal Liverpool Children’s Inquiry (Alder Hey/Redfern)', govukPath: 'government/publications/the-royal-liverpool-childrens-inquiry-report', status: 'concluded' },
  { key: 'confait',             name: 'Inquiry into the death of Maxwell Confait (Fisher)', govukPath: 'government/publications/report-of-an-inquiry-into-the-death-of-maxwell-confait', status: 'concluded' },
  { key: 'sonny-lodge',         name: 'Inquiry into the death of Bernard (Sonny) Lodge', govukPath: 'government/publications/report-of-the-inquiry-into-the-death-of-bernard-sonny-lodge', status: 'concluded' },
  { key: 'ashworth',            name: 'Ashworth Special Hospital Committee of Inquiry', govukPath: 'government/publications/ashworth-special-hospital-report-of-the-committee-of-inquiry', status: 'concluded' },
  { key: 'hunting-with-dogs-burns', name: 'Committee of Inquiry into Hunting with Dogs (Burns)', govukPath: 'government/publications/report-of-committee-of-inquiry-into-hunting-with-dogs-in-england-wales', status: 'concluded' },
  { key: 'anthony-grainger',    name: 'Anthony Grainger Inquiry',          govukPath: 'government/publications/anthony-grainger-inquiry-report-into-the-death-of-anthony-grainger', status: 'concluded' },
  { key: 'bvi-coi',             name: 'British Virgin Islands Commission of Inquiry', govukPath: 'government/publications/british-virgin-islands-commission-of-inquiry-report', status: 'concluded' },
  { key: 'sheehy',              name: 'Inquiry into Police Responsibilities and Rewards (Sheehy)', govukPath: 'government/publications/inquiry-into-police-responsibilities-and-rewards-vol-1-report', status: 'concluded' },
  { key: 'fife-child-care',     name: 'Inquiry into Child Care Policies in Fife (Kearney)', govukPath: 'government/publications/the-report-of-the-inquiry-into-child-care-policies-in-fife-1992', status: 'concluded' },
  { key: 'may-guildford-final', name: 'May Inquiry — Guildford & Woolwich convictions (final)', govukPath: 'government/publications/final-report-of-the-inquiry-into-the-convictions-arising-from-bomb-attacks-in-guildford-and-woolwich', status: 'concluded' },
  { key: 'icl-stockline',       name: 'ICL/Stockline Inquiry (Glasgow explosion)', govukPath: 'government/publications/the-icl-inquiry-report-explosion-at-grovepark-mills-maryhill-glasgow-11-may-2004', status: 'concluded' },
  { key: 'jermaine-baker',      name: 'Jermaine Baker Inquiry',            govukPath: 'government/publications/jermaine-baker-public-inquiry', status: 'concluded' },
  { key: 'dawn-sturgess',       name: 'Dawn Sturgess Inquiry',             govukPath: 'government/publications/dawn-sturgess-inquiry-report', status: 'concluded' },
  { key: 'jalal-uddin',         name: 'Inquiry into the death of Jalal Uddin', govukPath: 'government/publications/inquiry-report-into-the-death-of-jalal-uddin', status: 'concluded' },
  { key: 'ucpi-tranche-1',      name: 'Undercover Policing Inquiry Tranche 1 (interim)', govukPath: 'government/publications/undercover-policing-inquiry-tranche-1-interim-report', status: 'ongoing' },
  { key: 'redfern-nuclear',     name: 'Redfern Inquiry (human tissue, nuclear facilities) Vol 1', govukPath: 'government/publications/the-redfern-inquiry-into-human-tissue-analysis-in-uk-nuclear-facilities-volume-1', status: 'concluded' },
  { key: 'orkney',              name: 'Inquiry into the Removal of Children from Orkney (Clyde)', govukPath: 'government/publications/inquiry-into-the-removal-of-children-from-orkney-in-february-1991', status: 'concluded' },
  { key: 'crown-agents-fay',    name: 'Crown Agents Inquiry (Fay)',        govukPath: 'government/publications/inquiry-into-the-circumstances-which-led-to-the-crown-agents-requesting-financial-assistance-1974', status: 'concluded' },
  { key: 'acheson-health',      name: 'Independent Inquiry into Inequalities in Health (Acheson)', govukPath: 'government/publications/independent-inquiry-into-inequalities-in-health-report', status: 'concluded' },
  { key: 'turks-caicos-coi',    name: 'Turks and Caicos Islands Commission of Inquiry', govukPath: 'government/publications/turks-and-caicos-islands-commission-of-inquiry-2008-2009', status: 'concluded' },
  { key: 'cps-deaths-custody',  name: 'Inquiry into CPS Decision-Making re Deaths in Custody (Butler)', govukPath: 'government/publications/inquiry-into-crown-prosecution-service-decision-making-in-relation-to-deaths-in-custody-and-related-matters', status: 'concluded' },
  { key: 'sutherland-sats',     name: 'Sutherland Inquiry (2008 National Curriculum tests)', govukPath: 'government/publications/the-sutherland-inquiry-an-independent-inquiry-into-the-delivery-of-national-curriculum-tests-in-2008', status: 'concluded' },
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
