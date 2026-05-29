import { AdaptiveThrottle } from '../shared/adaptive-throttle'

// FCA Handbook API — https://www.handbook.fca.org.uk/api
const FCA_API = 'https://www.handbook.fca.org.uk/api'
const FCA_WEB = 'https://www.handbook.fca.org.uk'
const throttle = new AdaptiveThrottle({ floor: 500 })

export interface FcaSection {
  id: string
  instrumentCode: string
  title: string
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

async function fetchText(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

export async function* listFcaSections(): AsyncGenerator<FcaSection> {
  // FCA handbook structure: browse by instrument code
  const indexData = await fetchJson(`${FCA_API}/instruments`) as {
    instruments?: Array<{ code: string; title: string }>
  } | null

  for (const instrument of indexData?.instruments ?? []) {
    const sectionsData = await fetchJson(`${FCA_API}/instruments/${instrument.code}/sections`) as {
      sections?: Array<{ id: string; title: string }>
    } | null

    for (const section of sectionsData?.sections ?? []) {
      yield {
        id: `${instrument.code}/${section.id}`,
        instrumentCode: instrument.code,
        title: section.title,
        url: `${FCA_WEB}/handbook/${instrument.code}/${section.id}`,
      }
    }
  }
}

export async function fetchSectionText(url: string): Promise<string | null> {
  const html = await fetchText(url)
  if (!html) return null

  // Extract main content, strip nav/header/footer
  const contentMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)
  const content = contentMatch ? contentMatch[1] : html

  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
