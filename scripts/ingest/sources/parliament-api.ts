import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const PARLIAMENT_BASE = 'https://api.parliament.uk/v1'
const WQS_BASE = 'https://questions-statements-api.parliament.uk'
const throttle = new AdaptiveThrottle({ floor: 500, ceiling: 60_000 })

export interface HansardDebate {
  id: string
  date: string
  house: 'Commons' | 'Lords'
  title: string
  url: string
}

export interface CommitteeReport {
  id: string
  committeeId: string
  title: string
  date: string
  url: string
}

const HEADERS = { 'User-Agent': 'Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)' }

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: HEADERS })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: HEADERS })
  if (res.status === 429) { throttle.backoff(); return null }
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// ── Hansard ───────────────────────────────────────────────────────────────────

export async function* listHansardDebates(
  house: 'Commons' | 'Lords',
  startDate: string,
  endDate: string,
  pageSize = 50,
): AsyncGenerator<HansardDebate> {
  let skip = 0
  while (true) {
    const url = `${PARLIAMENT_BASE}/hansard/search?house=${house}&startDate=${startDate}&endDate=${endDate}&take=${pageSize}&skip=${skip}`
    const data = await fetchJson(url) as { items?: Array<{ id: string; date: string; title?: string }> } | null
    if (!data || !Array.isArray(data.items) || data.items.length === 0) break

    for (const item of data.items) {
      yield {
        id: item.id,
        date: item.date,
        house,
        title: item.title ?? '',
        url: `${PARLIAMENT_BASE}/hansard/debates/${item.id}`,
      }
    }

    if (data.items.length < pageSize) break
    skip += pageSize
  }
}

// Probe first page to get total count — response may include totalResults/total/totalCount
export async function countHansardDebates(
  house: 'Commons' | 'Lords',
  startDate: string,
  endDate: string,
): Promise<number> {
  const url = `${PARLIAMENT_BASE}/hansard/search?house=${house}&startDate=${startDate}&endDate=${endDate}&take=1&skip=0`
  const data = await fetchJson(url) as {
    totalResults?: number
    total?: number
    totalCount?: number
  } | null
  return data?.totalResults ?? data?.total ?? data?.totalCount ?? 0
}

export async function fetchDebateText(debateId: string): Promise<string | null> {
  const data = await fetchJson(`${PARLIAMENT_BASE}/hansard/debates/${debateId}`) as {
    value?: { contributions?: Array<{ text?: string }> }
  } | null
  if (!data?.value?.contributions) return null

  return data.value.contributions
    .map(c => c.text ?? '')
    .filter(Boolean)
    .join('\n\n')
}

// ── Committees ────────────────────────────────────────────────────────────────

export async function* listCommitteeReports(): AsyncGenerator<CommitteeReport> {
  const committees = await fetchJson(`${PARLIAMENT_BASE}/committees`) as {
    items?: Array<{ id: string }>
  } | null

  for (const committee of committees?.items ?? []) {
    const pubs = await fetchJson(`${PARLIAMENT_BASE}/committees/${committee.id}/publications`) as {
      items?: Array<{ id: string; title?: string; publicationDate?: string; links?: Array<{ url?: string }> }>
    } | null

    for (const pub of pubs?.items ?? []) {
      yield {
        id: pub.id,
        committeeId: committee.id,
        title: pub.title ?? '',
        date: pub.publicationDate ?? '',
        url: pub.links?.[0]?.url ?? '',
      }
    }
  }
}

// ── Written Questions & Statements ───────────────────────────────────────────
// API confirmed live via swagger: questions-statements-api.parliament.uk
// Written Questions endpoint: /api/writtenquestions/questions
// Written Statements endpoint: /api/writtenstatements/statements

// Returns combined plain text of all written questions+answers in the date range.
// Answers may be HTML; stripped inline. Returns empty string if no results.
export async function fetchWrittenAnswers(fromDate: string, toDate: string, maxItems = 5000): Promise<string> {
  let skip = 0
  const take = 100
  const parts: string[] = []

  while (parts.length < maxItems) {
    const url = `${WQS_BASE}/api/writtenquestions/questions`
      + `?answeredWhenFrom=${fromDate}&answeredWhenTo=${toDate}&take=${take}&skip=${skip}`
    const data = await fetchJson(url) as {
      totalResults?: number
      results?: Array<{
        value?: { questionText?: string; answerText?: string; heading?: string }
      }>
    } | null
    if (!data || !Array.isArray(data.results) || data.results.length === 0) break

    for (const r of data.results) {
      const v = r.value
      if (!v) continue
      const heading  = (v.heading ?? '').trim()
      const question = (v.questionText ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const answer   = (v.answerText   ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (question || answer) parts.push([heading, question, answer].filter(Boolean).join('\n'))
    }

    if (data.results.length < take) break
    skip += take
  }

  return parts.join('\n\n---\n\n')
}

// V28 §1.1: per-item written Q&A (one record per question+answer) — replaces the
// date-range blob. The questions-statements API is already per-item; we carry the
// stable item id + question metadata so each becomes its own corpus_sections row.
export interface WrittenQaItem {
  id: string
  uin: string | null
  heading: string
  question: string
  answer: string
  dateAnswered: string | null   // YYYY-MM-DD
  askingMember: string | null
  answeringMember: string | null
  answeringBody: string | null
}

const stripHtml = (s: string | undefined | null) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

export async function fetchWrittenAnswerItems(fromDate: string, toDate: string, maxItems = 20000): Promise<WrittenQaItem[]> {
  let skip = 0
  const take = 100
  const out: WrittenQaItem[] = []
  while (out.length < maxItems) {
    const url = `${WQS_BASE}/api/writtenquestions/questions`
      + `?answeredWhenFrom=${fromDate}&answeredWhenTo=${toDate}&take=${take}&skip=${skip}`
    const data = await fetchJson(url) as {
      results?: Array<{ value?: {
        id?: number; uin?: string; heading?: string; questionText?: string; answerText?: string
        dateAnswered?: string; askingMember?: { name?: string } | null; answeringMember?: { name?: string } | null
        answeringBodyName?: string
      } }>
    } | null
    if (!data || !Array.isArray(data.results) || data.results.length === 0) break
    for (const r of data.results) {
      const v = r.value
      if (!v || v.id == null) continue
      const question = stripHtml(v.questionText)
      const answer = stripHtml(v.answerText)
      if (!question && !answer) continue
      out.push({
        id: String(v.id),
        uin: v.uin ?? null,
        heading: (v.heading ?? '').trim(),
        question, answer,
        dateAnswered: v.dateAnswered ? String(v.dateAnswered).slice(0, 10) : null,
        askingMember: v.askingMember?.name ?? null,
        answeringMember: v.answeringMember?.name ?? null,
        answeringBody: v.answeringBodyName ?? null,
      })
    }
    if (data.results.length < take) break
    skip += take
  }
  return out
}

// Render one Q&A to searchable text (heading + asking/answering members + Q + A).
export function compileWrittenQa(item: WrittenQaItem): string {
  const parts: string[] = []
  if (item.heading) parts.push(item.heading)
  const meta = [item.askingMember && `Asked by ${item.askingMember}`,
    item.answeringBody && `Answering body: ${item.answeringBody}`,
    item.answeringMember && `Answered by ${item.answeringMember}`,
    item.dateAnswered && `Answered: ${item.dateAnswered}`].filter(Boolean).join(' · ')
  if (meta) parts.push(meta)
  if (item.question) parts.push(`Question${item.uin ? ` (UIN ${item.uin})` : ''}: ${item.question}`)
  if (item.answer) parts.push(`Answer: ${item.answer}`)
  return parts.join('\n')
}

// Returns combined plain text of all written ministerial statements in the date range.
export async function fetchWrittenStatements(fromDate: string, toDate: string, maxItems = 2000): Promise<string> {
  let skip = 0
  const take = 100
  const parts: string[] = []

  while (parts.length < maxItems) {
    const url = `${WQS_BASE}/api/writtenstatements/statements`
      + `?madeWhenFrom=${fromDate}&madeWhenTo=${toDate}&take=${take}&skip=${skip}`
    const data = await fetchJson(url) as {
      totalResults?: number
      results?: Array<{
        value?: { title?: string; text?: string }
      }>
    } | null
    if (!data || !Array.isArray(data.results) || data.results.length === 0) break

    for (const r of data.results) {
      const v = r.value
      if (!v) continue
      const title = (v.title ?? '').trim()
      const text  = (v.text  ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (title || text) parts.push([title, text].filter(Boolean).join('\n'))
    }

    if (data.results.length < take) break
    skip += take
  }

  return parts.join('\n\n---\n\n')
}

// Worker 1: Hansard Commons A (1800–1980), Worker 2: Commons B (1981+)
// Worker 3: Lords A (1800–1980) + Committees A, Worker 4: Lords B (1981+) + Committees B
export const HANSARD_PARTITIONS: Record<number, { house: 'Commons' | 'Lords'; startDate: string; endDate: string }> = {
  1: { house: 'Commons', startDate: '1800-01-01', endDate: '1980-12-31' },
  2: { house: 'Commons', startDate: '1981-01-01', endDate: '2030-12-31' },
  3: { house: 'Lords',   startDate: '1800-01-01', endDate: '1980-12-31' },
  4: { house: 'Lords',   startDate: '1981-01-01', endDate: '2030-12-31' },
}

// Fetch the text content of a committee report publication.
// The publication URL (from the Parliament API) may point to HTML or PDF.
// For HTML we extract the main body; for PDFs we return null (no OCR available).
export async function fetchReportContent(url: string): Promise<string | null> {
  if (!url) return null
  const html = await fetchHtml(url)
  if (!html) return null

  // Extract body content — try <main>, then <article>, then <div class="content">
  const bodyMatch =
    /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html) ??
    /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html) ??
    /<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
  const body = bodyMatch ? bodyMatch[1] : html

  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
}
