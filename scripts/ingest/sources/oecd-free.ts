import { AdaptiveThrottle } from '../shared/adaptive-throttle'

// OECD iLibrary free tier — only open-access content
const OECD_BASE = 'https://www.oecd-ilibrary.org'
const OECD_API = 'https://stats.oecd.org/SDMX-JSON/data'
const throttle = new AdaptiveThrottle({ floor: 500 })

export interface OecdDoc {
  id: string
  title: string
  url: string
  type: string
}

async function fetchJson(url: string): Promise<unknown | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// OECD open-access working papers and policy briefs relevant to UK
export async function* listOecdOpenDocs(): AsyncGenerator<OecdDoc> {
  // Use OECD iLibrary open search for UK-relevant policy papers
  const searchUrl = `${OECD_BASE}/content/search?q=united+kingdom+policy&access=free&format=json`
  const data = await fetchJson(searchUrl) as {
    contentItems?: Array<{ id?: string; title?: string; url?: string; type?: string }>
  } | null

  for (const item of data?.contentItems ?? []) {
    if (!item.id || !item.url) continue
    yield {
      id: item.id,
      title: item.title ?? '',
      url: item.url,
      type: item.type ?? 'paper',
    }
  }
}

export async function fetchDocText(url: string): Promise<string | null> {
  const html = await fetchText(url)
  if (!html) return null

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
