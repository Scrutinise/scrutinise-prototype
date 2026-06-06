/**
 * TheyWorkForYou API — Hansard debates (MySociety)
 * Docs: https://www.theyworkforyou.com/api/docs/getDebates
 * Rate limit: 1 req/sec free tier; more with key
 * Coverage: Commons + Lords + Westminster Hall from ~1988
 *
 * API key: free for non-commercial/civic use
 * Register at: https://www.theyworkforyou.com/api/key
 * Set env var: TWFY_API_KEY
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const TWFY_BASE = 'https://www.theyworkforyou.com/api'
const throttle = new AdaptiveThrottle({ floor: 1_000, ceiling: 30_000 })

export type TwfyHouse = 'commons' | 'lords' | 'westminhall'

export interface TwfyDebate {
  date: string
  house: TwfyHouse
  text: string       // combined plain text for this date
  url: string
}

async function fetchDebatesForDate(type: TwfyHouse, date: string): Promise<string | null> {
  const key = process.env.TWFY_API_KEY
  if (!key) throw new Error('TWFY_API_KEY env var not set')

  await throttle.wait()
  const url = `${TWFY_BASE}/getDebates?type=${type}&date=${date}&output=json&key=${key}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)' } })

  if (res.status === 429) {
    throttle.backoff()
    throw new Error(`TWFY API usage limit reached (HTTP 429) — daily quota exhausted for this key. Row will be marked failed and retried when limit resets.`)
  }
  if (!res.ok) { console.warn(`[twfy] ${type} ${date}: HTTP ${res.status}`); return null }
  throttle.success()

  try {
    const data = await res.json() as { error?: string; rows?: Array<{ body?: string; speaker?: unknown; subject?: string }> }
    if (data.error) {
      console.warn(`[twfy] ${type} ${date}: API error — ${data.error} — raw keys: ${Object.keys(data).join(', ')}`)
      return null
    }
    if (!data.rows?.length) return null
    // Combine all debate sections into one text block
    return data.rows
      .map(r => r.body ?? '')
      .filter(Boolean)
      .join('\n\n')
  } catch { return null }
}

// Fetch all debates within a month (YYYY-MM) for one house.
// Iterates day by day; parliament doesn't sit every day so most days return null.
export async function* listDebatesForMonth(type: TwfyHouse, yearMonth: string): AsyncGenerator<TwfyDebate> {
  const [y, m] = yearMonth.split('-').map(Number)
  if (!y || !m) return
  const daysInMonth = new Date(y, m, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const text = await fetchDebatesForDate(type, date)
    if (!text) continue
    yield {
      date,
      house: type,
      text,
      url: `https://www.theyworkforyou.com/debates/?d=${date}`,
    }
  }
}

// Date range for each house
export const TWFY_RANGES: Record<TwfyHouse, { from: string; to: string }> = {
  commons:     { from: '1988-01', to: new Date().toISOString().slice(0, 7) },
  lords:       { from: '1988-01', to: new Date().toISOString().slice(0, 7) },
  westminhall: { from: '1999-11', to: new Date().toISOString().slice(0, 7) },
}

// Generate all monthly docIds for a house between from and to (inclusive)
export function* twfyMonthlyDocIds(type: TwfyHouse): Generator<string> {
  const { from, to } = TWFY_RANGES[type]
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    yield `twfy:${type}:${y}-${String(m).padStart(2, '0')}`
    m++; if (m > 12) { m = 1; y++ }
  }
}
