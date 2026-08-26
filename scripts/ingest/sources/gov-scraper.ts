import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const throttle = new AdaptiveThrottle({ floor: 300 })

export interface GovDocument {
  id: string
  title: string
  url: string
  corpus: string
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0', Accept: 'application/json' } })
  if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

// ── GOV.UK content API ────────────────────────────────────────────────────────

const GOV_SEARCH = 'https://www.gov.uk/api/search.json'
const GOV_CONTENT = 'https://www.gov.uk/api/content'

async function* searchGovUk(query: string, corpus: string, count = 1000): AsyncGenerator<GovDocument> {
  let start = 0
  const pageSize = 50
  while (start < count) {
    const url = `${GOV_SEARCH}?q=${encodeURIComponent(query)}&count=${pageSize}&start=${start}`
    const data = await fetchJson(url) as {
      results?: Array<{ title?: string; link?: string; _id?: string }>
    } | null
    if (!data || !Array.isArray(data.results) || data.results.length === 0) break

    for (const r of data.results) {
      if (!r.link) continue
      yield {
        id: (r._id ?? r.link).replace(/[^a-z0-9-]/gi, '-'),
        title: r.title ?? '',
        url: r.link.startsWith('http') ? r.link : `https://www.gov.uk${r.link}`,
        corpus,
      }
    }

    if (data.results.length < pageSize) break
    start += pageSize
  }
}

export async function* listHmrcManuals(): AsyncGenerator<GovDocument> {
  // HMRC manuals via GOV.UK content API
  yield* searchGovUk('HMRC manual site:gov.uk/hmrc-internal-manuals', 'hmrc-manuals', 5000)
}

export async function* listNaoReports(): AsyncGenerator<GovDocument> {
  // GOV.UK search index includes most NAO reports; also try direct NAO Atom feed
  yield* searchGovUkByOrg('national-audit-office', 'nao-reports', 3000)
}

/**
 * Seed from the PUBLISHING ORGANISATION rather than from a phrase.
 *
 * ⚠⚠ `organisations[]=` IS DEAD. Measured 26 Aug 2026: gov.uk answers that parameter with
 * **HTTP 422 and an HTML error page** — for every organisation, not just one. `fetchJson` returns
 * null on a non-OK response, the loop `break`s on the first page, and the generator yields NOTHING.
 * It fails silently: no throw, no log, an empty run that looks like "no new documents".
 *
 *     organisations[]=national-audit-office           → 422  (52 KB of HTML)
 *     filter_organisations=national-audit-office      → 200  application/json
 *
 * The supported parameter is `filter_organisations=`. That is what the `ots-reports` repair rests
 * on and it is what this function now sends.
 *
 * ⚠⚠ THE FIX DOES NOT RESURRECT `nao-reports`, AND SAYING SO MATTERS MORE THAN THE FIX. The two
 * collections that used the broken form were seeding nothing, but the parameter was only the
 * outer cause. Measured the same day:
 *
 *     filter_organisations=national-audit-office   → total **0**
 *     /api/content/government/organisations/national-audit-office → **404**
 *
 * The NAO is not a gov.uk publishing organisation at all — it publishes on `nao.org.uk`, which is
 * what `sources/nao.ts` is for. So `listNaoReports()` yields zero under EITHER parameter, and the
 * 3,983 rows we hold did not come from here. `fca-publications` is retired and blocked in
 * `corpus_targets` and holds zero rows. See `docs/INGEST_C3A_REPORT.md` §1.
 */
async function* searchGovUkByOrg(org: string, corpus: string, count = 1000): AsyncGenerator<GovDocument> {
  let start = 0
  const pageSize = 50
  while (start < count) {
    const url = `${GOV_SEARCH}?filter_organisations=${encodeURIComponent(org)}&count=${pageSize}&start=${start}`
    const data = await fetchJson(url) as {
      results?: Array<{ title?: string; link?: string; _id?: string }>
    } | null
    if (!data || !Array.isArray(data.results) || data.results.length === 0) break
    for (const r of data.results) {
      if (!r.link) continue
      yield {
        id: (r._id ?? r.link).replace(/[^a-z0-9-]/gi, '-'),
        title: r.title ?? '',
        url: r.link.startsWith('http') ? r.link : `https://www.gov.uk${r.link}`,
        corpus,
      }
    }
    if (data.results.length < pageSize) break
    start += pageSize
  }
}

export async function* listFcaPublications(): AsyncGenerator<GovDocument> {
  yield* searchGovUkByOrg('financial-conduct-authority', 'fca-publications', 3000)
}

// WHY: GOV.UK search API returns 0 results for sentencing-council org (not indexed there).
// The direct site at sentencingcouncil.org.uk embeds all guideline URLs as JSON in the
// crown-court and magistrates listing pages, which we can parse without JavaScript rendering.
export async function* listSentencingCouncilGuidelines(): AsyncGenerator<GovDocument> {
  const BASE = 'https://sentencingcouncil.org.uk'
  const listingPages = ['/guidelines/crown-court/', '/guidelines/magistrates/']
  const seen = new Set<string>()

  for (const listingPath of listingPages) {
    const html = await fetchHtml(`${BASE}${listingPath}`)
    if (!html) continue

    // Guidelines are embedded as JSON: "url":"/guidelines/{slug}/?source=..."
    const urlRx = /"url":"(\/guidelines\/[^"?]+?)(?:\?[^"]*)?"/g
    let m: RegExpExecArray | null
    while ((m = urlRx.exec(html)) !== null) {
      const path = m[1].replace(/\/$/, '')
      if (!path || seen.has(path) || path === '/guidelines/crown-court' || path === '/guidelines/magistrates') continue
      seen.add(path)
      const slug = path.replace('/guidelines/', '').replace(/\//g, '-')
      yield {
        id: slug,
        title: slug.replace(/-/g, ' '),
        url: `${BASE}${path}/`,
        corpus: 'sentencing-council',
      }
    }
  }
}

export async function* listCollegeOfPolicing(): AsyncGenerator<GovDocument> {
  // College of Policing Authorised Professional Practice via gov.uk search
  yield* searchGovUk('college of policing authorised professional practice', 'college-of-policing', 2000)
}

export async function* listHoCLReports(): AsyncGenerator<GovDocument> {
  yield* searchGovUk('House of Commons Library research briefing', 'hocl-briefings', 3000)
}

export async function* listExplanatoryNotes(): AsyncGenerator<GovDocument> {
  yield* searchGovUk('explanatory notes legislation', 'explanatory-notes', 2000)
}

export async function* listImpactAssessments(): AsyncGenerator<GovDocument> {
  yield* searchGovUk('impact assessment gov.uk', 'impact-assessments', 2000)
}

export async function* listConsultations(): AsyncGenerator<GovDocument> {
  yield* searchGovUk('consultation response gov.uk', 'consultations', 3000)
}

// ── HMRC TIINs ────────────────────────────────────────────────────────────────
// Tax Information and Impact Notes published via gov.uk content API.
// Collection URL: /government/collections/tax-information-and-impact-notes-tiins

export async function* listHmrcTiins(): AsyncGenerator<GovDocument> {
  // Use the gov.uk content API to enumerate the TIINS collection
  const collection = await fetchJson(`${GOV_CONTENT}/government/collections/tax-information-and-impact-notes-tiins`) as {
    links?: { documents?: Array<{ api_url?: string; title?: string; web_url?: string }> }
  } | null

  const docs = collection?.links?.documents ?? []
  if (docs.length === 0) {
    // Fallback: search API
    yield* searchGovUk('tax information impact note TIIN', 'hmrc-tiins', 3000)
    return
  }

  for (const doc of docs) {
    if (!doc.web_url) continue
    const id = (doc.api_url ?? doc.web_url).replace(/[^a-z0-9-]/gi, '-').slice(-120)
    yield { id, title: doc.title ?? '', url: doc.web_url, corpus: 'hmrc-tiins' }
  }
}

// ── Office of Tax Simplification Reports ─────────────────────────────────────
/**
 * ⚠⚠ THIS WAS A FREE-TEXT RELEVANCE SEARCH AND IT MADE THE COLLECTION 84.7% NOT-OTS.
 *
 *     searchGovUk('office of tax simplification report', 'ots-reports', 500)
 *
 * That query reports **348,062** results. We kept the first 500 and called them OTS reports.
 * Classified row by row against the publisher's own organisation field (497 of 497 readable, and
 * the same verdicts on two runs two days apart):
 *
 *     76   published by the Office of Tax Simplification
 *    421   published by somebody else — 187 HMRC, 69 HM Treasury, 53 GDS…
 *
 * Ten bodies read at random included *Renew your driving licence*, *Apply online for a UK passport*
 * and *Spain travel advice*. Ranks 481–485 are Spring Budget 2017 and customs notices: relevance
 * decays continuously, so there is no category of contamination to strip — the cut has to come from
 * OUTSIDE the query. `document_type` cannot make it either (policy_paper is 23 KEEP / 62 DELETE).
 *
 * The instrument that works is who published it. The OTS was abolished in 2023, so
 * `filter_organisations=office-of-tax-simplification` is a CLOSED universe of **222** documents —
 * a denominator the publisher maintains rather than one we inferred from our own row count.
 *
 * ⚠ 222 documents ANNOUNCED is not 222 documents HELD: what this fetch stores is the gov.uk
 * landing page, and most of these documents keep their substance in a PDF attachment.
 */
export async function* listOtsReports(): AsyncGenerator<GovDocument> {
  yield* searchGovUkByOrgFiltered('office-of-tax-simplification', 'ots-reports', 500)
}

/** Named separately so a re-seed script can assert the publisher filter is in place before queueing. */
async function* searchGovUkByOrgFiltered(org: string, corpus: string, count: number): AsyncGenerator<GovDocument> {
  yield* searchGovUkByOrg(org, corpus, count)
}

// ── Planning Policy (NPPF + PPG) ──────────────────────────────────────────────
// Planning Practice Guidance (PPG): 63 chapters enumerated from gov.uk collection.
// Each chapter is a detailed_guide with full HTML body text (avg ~60KB).
// NPPF itself is a separate guidance document.
// V1 audit confirmed accessible (HTTP 200). V2 Part 3 implementation.

export async function* listPlanningPolicyNppf(): AsyncGenerator<GovDocument> {
  // Enumerate the PPG collection — 63 guidance chapters
  const collData = await fetchJson(`${GOV_CONTENT}/government/collections/planning-practice-guidance`) as {
    links?: { documents?: Array<{ base_path?: string; title?: string }> }
  } | null

  const docs = collData?.links?.documents ?? []
  for (const doc of docs) {
    if (!doc.base_path) continue
    yield {
      id: doc.base_path.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').slice(0, 160),
      title: doc.title ?? '',
      url: `https://www.gov.uk${doc.base_path}`,
      corpus: 'planning-policy',
    }
  }

  // Yield the NPPF document itself
  yield {
    id: 'guidance-national-planning-policy-framework',
    title: 'National Planning Policy Framework',
    url: 'https://www.gov.uk/guidance/national-planning-policy-framework',
    corpus: 'planning-policy',
  }
}

// ── Building Regulations (Approved Documents) ─────────────────────────────────
// 21 Approved Documents enumerated from gov.uk collection.
// Content is primarily in PDF attachments — fetchDocumentText captures description text.
// Full PDF ingest is future work.
// V1 audit confirmed accessible (HTTP 200). V2 Part 3 implementation.

export async function* listBuildingRegs(): AsyncGenerator<GovDocument> {
  const collData = await fetchJson(`${GOV_CONTENT}/government/collections/approved-documents`) as {
    links?: { documents?: Array<{ base_path?: string; title?: string }> }
  } | null

  const docs = collData?.links?.documents ?? []
  for (const doc of docs) {
    if (!doc.base_path) continue
    yield {
      id: doc.base_path.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').slice(0, 160),
      title: doc.title ?? '',
      url: `https://www.gov.uk${doc.base_path}`,
      corpus: 'building-regs',
    }
  }
}

// ── Text extraction ────────────────────────────────────────────────────────────

export async function fetchDocumentText(url: string): Promise<string | null> {
  const html = await fetchHtml(url)
  if (!html) return null
  return extractMainText(html)
}

export function extractMainText(html: string): string {
  // Remove scripts, styles, nav
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')

  // Try to extract main content
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(text)
    ?? /<article[^>]*>([\s\S]*?)<\/article>/i.exec(text)
    ?? /<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(text)
  if (mainMatch) text = mainMatch[1]

  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
