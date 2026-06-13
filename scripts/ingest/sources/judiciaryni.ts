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
  floor: 2000, // V22: halved from 1000 — host cut the fetching IP mid-drain on 12 Jun (politeness §1b)
  // V22: ceiling must exceed suspendThresholdMs or onSuspend can never fire
  // (default ceiling 30s < 60s threshold made the suspend path dead code —
  // why the 12 Jun IP cut burned 332 rows instead of suspending the source)
  ceiling: 120_000,
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
    // V22: 403 added — the host's IP cut serves 403/hangups, not 429 (12 Jun burn)
    if (res.status === 429 || res.status === 503 || res.status === 403) { throttle.backoff(); return { status: res.status, text: null } }
    if (!res.ok) return { status: res.status, text: null }
    throttle.success()
    return { status: res.status, text: await res.text() }
  } catch (err) {
    clear()
    // V22: socket-level failure (timeout/reset) is a rate signal here too —
    // sustained cuts must escalate to suspend, not burn rows at full speed
    throttle.backoff()
    console.warn(`[judiciaryni] fetch error ${url}: ${err}`)
    return { status: 0, text: null }
  }
}

// Decision slugs on one listing page. Real decision slugs contain NO slash —
// anything with one is a filter facet (/type/, /judiciary/{id}, /date/{year})
// that renders in the sidebar of EVERY page including the 404 page (found by
// diffing page 0 vs a 404 page; the facets fed the canary 229 junk rows).
// Returns null on fetch failure, [] when the page is past the end (Drupal 404).
export async function listNiDecisionsPage(page: number): Promise<string[] | null> {
  const { status, text } = await get(`${BASE}/judicial-decisions?page=${page}`)
  if (status === 404) return []
  if (!text) return null
  const slugs = new Set<string>()
  for (const m of text.matchAll(/href="\/judicial-decisions\/([a-z0-9][^"?#\/]*)"/gi)) {
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
    if (res.status === 429 || res.status === 503 || res.status === 403) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    clear()
    throttle.backoff()
    console.warn(`[judiciaryni] file fetch error ${url}: ${err}`)
    return null
  }
}
