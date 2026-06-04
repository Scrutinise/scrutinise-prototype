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

async function* searchGovUkByOrg(org: string, corpus: string, count = 1000): AsyncGenerator<GovDocument> {
  let start = 0
  const pageSize = 50
  while (start < count) {
    const url = `${GOV_SEARCH}?organisations[]=${encodeURIComponent(org)}&count=${pageSize}&start=${start}`
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

export async function* listSentencingCouncilGuidelines(): AsyncGenerator<GovDocument> {
  // Sentencing guidelines via GOV.UK (sentencing-council org) and direct site listing
  yield* searchGovUkByOrg('sentencing-council', 'sentencing-council', 2000)
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
// OTS was abolished in 2021 — historical reports remain on gov.uk.

export async function* listOtsReports(): AsyncGenerator<GovDocument> {
  yield* searchGovUk('office of tax simplification report', 'ots-reports', 500)
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
