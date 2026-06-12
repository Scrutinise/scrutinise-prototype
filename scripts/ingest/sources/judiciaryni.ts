/**
 * judiciaryni.ts — Judiciary NI judicial decisions (V20 probe 5).
 *
 * www.judiciaryni.uk is Drupal. Listing: /judicial-decisions?page=0..N
 * (page 396 404'd on 12 Jun 2026 → ~396 pages, ~15 decisions each ≈ ~5,900).
 * Decision pages /judicial-decisions/{slug} link judgment PDFs (occasionally
 * .doc) under /files/judiciaryni/…. This is the official NI record that Find
 * Case Law excludes (FCL is E&W; V19 retired bailii-privy-ni).
 *
 * Licence: footer says © Crown Copyright, no open licence stated
 * (pending-verification in the licence map; flagged in V20 CHANGE_LOG).
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const BASE = 'https://www.judiciaryni.uk'
const UA = 'Scrutinise-Ingest/1.0 (legal corpus research)'
const FETCH_TIMEOUT_MS = 60_000

const throttle = new AdaptiveThrottle({
  floor: 1000,
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('judiciaryni', delayMs * 2)
      .catch(err => console.warn('[judiciaryni] suspend write failed:', err))
  },
})

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function get(url: string): Promise<{ status: number; text: string | null }> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return { status: res.status, text: null } }
    if (!res.ok) return { status: res.status, text: null }
    throttle.success()
    return { status: res.status, text: await res.text() }
  } catch (err) {
    clear()
    console.warn(`[judiciaryni] fetch error ${url}: ${err}`)
    return { status: 0, text: null }
  }
}

// Decision slugs on one listing page (taxonomy /type/ links excluded).
// Returns null on fetch failure, [] when the page is past the end (Drupal 404).
export async function listNiDecisionsPage(page: number): Promise<string[] | null> {
  const { status, text } = await get(`${BASE}/judicial-decisions?page=${page}`)
  if (status === 404) return []
  if (!text) return null
  const slugs = new Set<string>()
  for (const m of text.matchAll(/href="\/judicial-decisions\/((?!type\/)[a-z0-9][^"?#]*)"/gi)) {
    slugs.add(m[1])
  }
  return [...slugs]
}

export interface NiDecision {
  title: string | null
  date: string | null      // YYYY-MM-DD
  fileUrls: string[]
}

export async function fetchNiDecision(slug: string): Promise<NiDecision | null> {
  const { text } = await get(`${BASE}/judicial-decisions/${slug}`)
  if (!text) return null
  const tm = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(text)
  const title = tm ? tm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null
  // Drupal renders the publication date in a <time datetime="…"> element
  const dm = /<time[^>]*datetime="(\d{4}-\d{2}-\d{2})/.exec(text)
  const fileUrls = [...text.matchAll(/href="([^"]+\.(?:pdf|docx?))"/gi)]
    .map(m => new URL(m[1], BASE).toString())
    .filter(u => u.includes('/files/'))
  return { title, date: dm ? dm[1] : null, fileUrls: [...new Set(fileUrls)] }
}

export async function fetchNiFile(url: string): Promise<Buffer | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    clear()
    console.warn(`[judiciaryni] file fetch error ${url}: ${err}`)
    return null
  }
}
