import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const PARLIAMENT_BASE = 'https://api.parliament.uk/v1'
const throttle = new AdaptiveThrottle({ floor: 500 })

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

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
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

// Worker 1: Hansard Commons A (1800–1980), Worker 2: Commons B (1981+)
// Worker 3: Lords A (1800–1980) + Committees A, Worker 4: Lords B (1981+) + Committees B
export const HANSARD_PARTITIONS: Record<number, { house: 'Commons' | 'Lords'; startDate: string; endDate: string }> = {
  1: { house: 'Commons', startDate: '1800-01-01', endDate: '1980-12-31' },
  2: { house: 'Commons', startDate: '1981-01-01', endDate: '2030-12-31' },
  3: { house: 'Lords',   startDate: '1800-01-01', endDate: '1980-12-31' },
  4: { house: 'Lords',   startDate: '1981-01-01', endDate: '2030-12-31' },
}
