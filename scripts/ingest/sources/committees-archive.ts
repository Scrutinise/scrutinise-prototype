/**
 * committees-archive.ts — fetch pre-2020 committee report bodies via the Wayback Machine (V32).
 *
 * WHY NOT THE ORIGIN. `committees-api.parliament.uk` lists 11,588 report / government-response /
 * special-report publications and serves a downloadable `documents[]` for only 3,935 of them.
 * The other 7,651 carry an `additionalContentUrl` pointing at `publications.parliament.uk` or
 * `www.parliament.uk/globalassets` — and BOTH hosts sit behind a Cloudflare bot challenge.
 * Measured 7 Aug 2026, past the first 403 as docs/CLAUDE.md §0 requires:
 *
 *     fetch + ingest UA ............ 403 "Just a moment…"      (site root too, not one path)
 *     fetch + full browser headers .. 403
 *     headless Chromium (Playwright)  403 "Performing security verification"
 *     real Chrome ................... 200
 *     Wayback Machine ............... 200
 *     committees-api (control) ...... 200
 *
 * A real browser passes and headless does not, so it is fingerprinting rather than an IP ban.
 * Wayback is the route Charlie chose: programmatic, robust, no evasion, and proven on the
 * canonical missing document — the Carillion report, "recklessness, hubris and greed" included.
 *
 * PREFER THE PDF. `additionalContentUrl` is the whole report as one PDF; `additionalContentUrl2`
 * is the HTML *contents* page, whose body is spread across sibling files (76902.htm is the
 * contents, the Summary is in 76903.htm, and so on). One PDF fetch beats crawling an unknown
 * number of HTML parts, and pdfToText already handles it.
 *
 * `id_` IN THE SNAPSHOT URL IS LOAD-BEARING: it returns the ORIGINAL bytes. Without it Wayback
 * injects its own toolbar and rewrites links, which for an HTML fallback would land banner markup
 * in the corpus body.
 *
 * POLITENESS, AND WHAT IT IS NOT. Wayback is a donated public service, so this paces itself at
 * roughly 1.3 requests/second aggregate. But note carefully: measurement showed the archive does
 * NOT rate-limit this workload at all — see the throttle comment below. Pacing here is courtesy,
 * not a workaround, and slowing further does not fix the failure this file actually hits.
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const UA = 'Scrutinise-Ingest/1.0 (legal corpus research; contact cl@scrutinise.org)'
const FETCH_TIMEOUT_MS = 120_000

// ⚠ THE CEILING IS DELIBERATELY LOW, which is the opposite of the usual instinct, and the reason
// is the most useful thing measured in this sprint (7 Aug 2026):
//
//   Wayback NEVER returns 429 or 503 for this workload. What happens under sustained use is that
//   the PROCESS's connections start dropping — `TypeError: fetch failed`, status 0 — after roughly
//   30–50 requests, and never recover however long we wait. A FRESH process fetching the same URLs
//   scores 10/10 at ~1.5s each with NO pacing at all.
//
// So the drops are a stale keep-alive pool on our side, not the archive pushing back. The throttle
// counts a socket failure as a rate signal, so the first full run read them as rate limiting and
// doubled to a 120s ceiling, where it sat: 40 documents in 20 minutes, an ETA in days. Backing off
// does not reopen a dead socket. The cure is a new process — see MAX_DOCS in
// v32-backfill-archive.ts — and the ceiling here is only a short cushion for a genuinely bad patch.
// Floor 1s is courtesy to a donated service, not a workaround.
const throttle = new AdaptiveThrottle({ floor: 1_000, ceiling: 30_000, suspendThresholdMs: 25_000 })

/**
 * Hosts the Wayback Machine actually holds.
 *
 * Measured, not assumed: every `publications.parliament.uk` target probed returned a 200 PDF,
 * and every `www.parliament.uk/globalassets` one returned "NO SNAPSHOT" with an empty CDX index —
 * that asset store was never crawled. Attempting them costs two requests each (the direct form,
 * then the availability lookup) and can never succeed, so they are excluded up front and recorded
 * as a known-unknown instead. 6,411 of the 7,636 targets are on the archived host.
 */
/**
 * Consecutive TRANSIENT failures — the signature of the stale keep-alive pool described above.
 * A run of these means this process's sockets are dead and no amount of waiting will revive them;
 * the caller should exit so a fresh process can take over. Reset by any success or clean 404,
 * so a genuinely unarchived stretch does not trip it.
 *
 * Counting the signal beats guessing a batch size: degradation was observed at ~30-50 requests,
 * but a --max of 40 documents is 40-80 requests, so a fixed count still degraded mid-batch and
 * spent the rest of it at the 30s ceiling.
 */
let consecutiveTransient = 0
export function transientStreak(): number { return consecutiveTransient }

export function isArchivableHost(url: string | null | undefined): boolean {
  return /(^|\/\/)(www\.)?publications\.parliament\.uk\//.test(String(url ?? ''))
}

export interface ArchiveFetch {
  buffer: Buffer
  contentType: string
  /** The snapshot actually served, e.g. '20200214031122' — recorded so a body can be traced. */
  timestamp: string | null
  sourceUrl: string
  kind: 'pdf' | 'html'
}

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return { signal: c.signal, clear: () => clearTimeout(t) }
}

/** Strip the scheme — Wayback accepts either, but normalising keeps cache keys stable. */
function bare(url: string): string { return url.replace(/^https?:\/\//, '') }

/**
 * Ask Wayback whether it holds a snapshot at all.
 * Returns the snapshot URL, or null if the archive has never seen this URL — which is a real
 * outcome to RECORD (an honest known-unknown), not an error to retry.
 */
export async function resolveSnapshot(originalUrl: string): Promise<{ url: string; timestamp: string } | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(bare(originalUrl))}`,
      { signal, headers: { 'User-Agent': UA } })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    const j = await res.json() as { archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string } } }
    const c = j.archived_snapshots?.closest
    if (!c?.available || !c.url) return null
    return { url: c.url, timestamp: c.timestamp ?? '' }
  } catch (err) {
    clear(); throttle.backoff()
    return null
  }
}

/**
 * Fetch a document body from the archive.
 *
 * Tries the direct `id_` form first — it needs no availability lookup, so it costs one request
 * rather than two — and falls back to the availability API when that misses. `2020id_` asks for
 * the snapshot closest to 2020, which is the right side of the pre-2020 corpus we are filling.
 */
/** Flat, not a discriminated union — the caller reads both fields, and narrowing on `got`
 *  proved fragile. `settled` is meaningful only when `got` is null: true means the archive
 *  genuinely has no snapshot (do not retry), false means a socket drop that says nothing about
 *  whether one exists (retry later). */
export type ArchiveOutcome = { got: ArchiveFetch | null; settled: boolean }

export async function fetchArchivedDocument(originalUrl: string): Promise<ArchiveOutcome> {
  const isPdf = /\.pdf(\?|$)/i.test(originalUrl)
  const direct = await rawFetch(`https://web.archive.org/web/2020id_/${originalUrl}`)
  if (direct.outcome === 'ok' && direct.value) return { got: { ...direct.value, kind: isPdf ? 'pdf' : 'html', sourceUrl: originalUrl }, settled: true }

  // ⚠ The availability-API fallback runs ONLY for a transient failure, never for a clean 404.
  // Measured over a 12-URL probe: whenever the direct form returned 404, the availability API
  // said "NO SNAPSHOT" and the CDX index was empty — it rescued nothing, 12 times out of 12. It
  // is a second request against a donated service on every genuine miss, and misses are ~35% of
  // attempts, so running it unconditionally roughly doubled the cost of the slowest part of the
  // backfill for no recovered documents.
  if (direct.outcome === 'not-found') return { got: null, settled: true }

  const snap = await resolveSnapshot(originalUrl)
  if (!snap) return { got: null, settled: false }
  const idForm = snap.url.replace(/\/web\/(\d+)\//, '/web/$1id_/')
  const got = await rawFetch(idForm)
  if (got.outcome !== 'ok' || !got.value) return { got: null, settled: got.outcome === 'not-found' }
  return { got: { ...got.value, kind: isPdf ? 'pdf' : 'html', sourceUrl: originalUrl, timestamp: snap.timestamp }, settled: true }
}

/** Deliberately NOT a discriminated union on `ok`: a flat record needs no narrowing, and the
 *  caller has to read `outcome` explicitly, which is the point — a genuine 404 and a dropped
 *  socket must not be treated the same way. */
type RawResult = {
  outcome: 'ok' | 'not-found' | 'transient'
  value: { buffer: Buffer; contentType: string; timestamp: string | null } | null
}

async function rawFetch(url: string): Promise<RawResult> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    clear()
      if (res.status === 429 || res.status === 503) { throttle.backoff(); consecutiveTransient++; return { outcome: 'transient', value: null } }
    // 404 (and Wayback's 403 for an unarchived host) is a settled answer, not a hiccup.
    if (!res.ok) {
      const settled = res.status === 404 || res.status === 403
      if (settled) consecutiveTransient = 0; else consecutiveTransient++
      return { outcome: settled ? 'not-found' : 'transient', value: null }
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    // Wayback answers 200 with an HTML "not archived" page for some misses; a PDF that is not
    // a PDF is exactly that case, and writing it would put an error page in the corpus.
    if (buffer.length < 512) { consecutiveTransient = 0; return { outcome: 'not-found', value: null } }
    throttle.success()
    consecutiveTransient = 0
    return {
      outcome: 'ok',
      value: {
        buffer,
        contentType: res.headers.get('content-type') ?? '',
        timestamp: /\/web\/(\d+)/.exec(url)?.[1] ?? null,
      },
    }
  } catch {
    clear(); throttle.backoff(); consecutiveTransient++
    return { outcome: 'transient', value: null }
  }
}

/** A PDF starts with %PDF-. Guards against Wayback's HTML miss pages being run through a PDF parser. */
export function looksLikePdf(buf: Buffer): boolean {
  return buf.subarray(0, 5).toString('latin1') === '%PDF-'
}
