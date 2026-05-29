import { AdaptiveThrottle } from '../shared/adaptive-throttle'

// BAILII is a charity — floor must never drop below 1000ms
const throttle = new AdaptiveThrottle({ floor: 1000, ceiling: 60_000 })
const BAILII_BASE = 'https://www.bailii.org'

export interface BailiiCase {
  url: string
  court: string
  caseRef: string
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Scrutinise-Ingest/1.0 (academic research, contact: cl@scrutinise.org)',
    },
  })
  if (res.status === 429 || res.status === 503 || res.status === 408) {
    throttle.backoff()
    return null
  }
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// BAILII database list — jurisdiction/court paths
const BAILII_DATABASES: Array<{ jurisdiction: string; court: string; path: string }> = [
  { jurisdiction: 'UK',  court: 'UKSC',  path: '/uk/cases/UKSC/' },
  { jurisdiction: 'EW',  court: 'EWCA',  path: '/ew/cases/EWCA/' },
  { jurisdiction: 'EW',  court: 'EWHC',  path: '/ew/cases/EWHC/' },
  { jurisdiction: 'EW',  court: 'EAT',   path: '/uk/cases/UKEAT/' },
  { jurisdiction: 'EW',  court: 'ET',    path: '/uk/cases/UKET/' },
  { jurisdiction: 'SC',  court: 'CSIH',  path: '/scot/cases/ScotCS/CSIH/' },
  { jurisdiction: 'SC',  court: 'CSOH',  path: '/scot/cases/ScotCS/CSOH/' },
  { jurisdiction: 'NI',  court: 'NIQB',  path: '/nie/cases/NIHC/QB/' },
  { jurisdiction: 'NI',  court: 'NICA',  path: '/nie/cases/NICA/' },
  { jurisdiction: 'UK',  court: 'UKPC',  path: '/uk/cases/UKPC/' },
]

// Map worker ID to which database subset to handle
export const WORKER_DB_SUBSETS: Record<number, typeof BAILII_DATABASES> = {
  5: BAILII_DATABASES.filter(d => ['UKET', 'ET'].includes(d.court) || d.court.startsWith('ET')),
  6: BAILII_DATABASES.filter(d => ['EAT', 'UKEAT'].includes(d.court)),
  7: BAILII_DATABASES.filter(d => ['UKPC', 'NICA', 'NIQB'].includes(d.court)),
}

export async function* listCases(courtPath: string): AsyncGenerator<BailiiCase> {
  const indexUrl = `${BAILII_BASE}${courtPath}`
  const html = await fetchHtml(indexUrl)
  if (!html) return

  // Extract year-level links
  const yearRx = /href="(\/[^"]+\/\d{4}\/)"[^>]*>\d{4}/g
  let m: RegExpExecArray | null
  const yearPaths: string[] = []
  while ((m = yearRx.exec(html)) !== null) yearPaths.push(m[1])

  for (const yearPath of yearPaths) {
    const yearHtml = await fetchHtml(`${BAILII_BASE}${yearPath}`)
    if (!yearHtml) continue

    // Extract individual case links
    const caseRx = /href="(\/[^"]+\.(html?))"/g
    while ((m = caseRx.exec(yearHtml)) !== null) {
      const casePath = m[1]
      if (!casePath.includes('/cases/')) continue
      const parts = casePath.split('/')
      const caseRef = parts.pop()?.replace(/\.html?$/, '') ?? ''
      yield {
        url: `${BAILII_BASE}${casePath}`,
        court: courtPath.split('/').filter(Boolean).pop() ?? '',
        caseRef,
      }
    }
  }
}

export async function fetchCaseHtml(url: string): Promise<string | null> {
  return fetchHtml(url)
}

export function extractCaseText(html: string): string {
  // Extract judgment body — try common BAILII div patterns
  let body = html

  const bodyMatch = /<div[^>]+class="[^"]*judgment[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
    ?? /<div[^>]+id="content"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
  if (bodyMatch) body = bodyMatch[1]

  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
