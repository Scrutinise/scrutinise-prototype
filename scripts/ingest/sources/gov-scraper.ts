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
  yield* searchGovUk('site:nao.org.uk report', 'nao-reports', 2000)
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
