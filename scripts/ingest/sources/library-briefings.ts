/**
 * library-briefings.ts — Commons & Lords Library research briefings (V28 §5).
 *
 * ── STATUS: BUILT TO THE GATE — Cloudflare managed-challenge blocks the content
 *    endpoints from a server context. Seeds nothing until a capture is provided.
 *
 * Probe findings (19 Jun 2026, all verified):
 *  - commonslibrary.parliament.uk / lordslibrary.parliament.uk run on WordPress.
 *    The WP REST root `/wp-json/` is edge-cached and DOES return JSON with
 *    browser headers (confirming a WP REST API + custom post type architecture),
 *    but the dynamic content endpoints (`/wp-json/wp/v2/posts`, the
 *    research-briefing custom type) return Cloudflare's "Just a moment…" JS
 *    managed-challenge (HTTP 403) consistently — even with a full browser header
 *    set, across retries.
 *  - researchbriefings.files.parliament.uk (the briefing PDF host): CF 403.
 *  - lda.data.parliament.uk/researchbriefings (the old Linked-Data API): host
 *    unreachable (HTTP 000) — the LDA platform is decommissioned (consistent with
 *    the V19 lda deprecation note).
 *  - No `*-api.parliament.uk` briefings host exists (bills-api/votes-api pattern).
 *  - UK Gov Web Archive (TNA) has no usable capture of these hosts (empty CDX).
 *
 * UNBLOCK ROUTE (matches the V27 Scottish Courts precedent — Charlie capture):
 *  1. Open a Library research-briefings listing page in a browser, solve the CF
 *     challenge once, and from devtools → Application copy the `cf_clearance`
 *     cookie (+ the matching User-Agent — cf_clearance is UA-bound).
 *  2. From devtools → Network, copy the exact WP REST request the listing page
 *     fires for the research-briefing custom post type (URL + the `_embed` /
 *     `per_page` / `page` params). Likely
 *       /wp-json/wp/v2/{post-type-slug}?per_page=100&page=N
 *     where {post-type-slug} is the research-briefing CPT (e.g. `research-briefing`).
 *  3. Set COMMONS_LIB_CF_CLEARANCE / LORDS_LIB_CF_CLEARANCE + COMMONS_LIB_UA and
 *     fill BRIEFING_CONFIG.endpoint below; the fetchers + seeder are then turn-key.
 *
 * Alternatively: a Railway-IP canary (some CF zones treat datacentre ASNs
 * differently) — though committees.parliament.uk being CF-blocked from Railway
 * suggests the same wall. Licence: expected Open Parliament Licence v3.0 (the
 * T&Cs page could not be loaded through CF to verify — pending-verification).
 */

export type LibraryHouse = 'commons' | 'lords'

export interface BriefingConfig {
  host: string
  // The research-briefing custom-post-type REST endpoint, captured from devtools.
  // Empty until provided — the seeder reports the gate when this is blank.
  postTypeSlug: string | null
  cfClearanceEnv: string
  uaEnv: string
}

export const BRIEFING_CONFIG: Record<LibraryHouse, BriefingConfig> = {
  commons: { host: 'https://commonslibrary.parliament.uk', postTypeSlug: null, cfClearanceEnv: 'COMMONS_LIB_CF_CLEARANCE', uaEnv: 'COMMONS_LIB_UA' },
  lords:   { host: 'https://lordslibrary.parliament.uk',   postTypeSlug: null, cfClearanceEnv: 'LORDS_LIB_CF_CLEARANCE',   uaEnv: 'LORDS_LIB_UA' },
}

export interface BriefingEntry {
  id: string            // WP post id
  slug: string
  title: string
  date: string | null   // YYYY-MM-DD
  url: string           // canonical briefing page
  bodyHtml: string      // rendered content
  pdfUrls: string[]     // attached briefing PDF(s)
}

function headers(cfg: BriefingConfig): Record<string, string> {
  const ua = process.env[cfg.uaEnv] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
  const cf = process.env[cfg.cfClearanceEnv]
  const h: Record<string, string> = {
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Referer': cfg.host + '/',
  }
  if (cf) h['Cookie'] = `cf_clearance=${cf}`
  return h
}

// True once a capture has been wired in (post-type slug + cf_clearance cookie).
export function isReady(house: LibraryHouse): boolean {
  const cfg = BRIEFING_CONFIG[house]
  return !!cfg.postTypeSlug && !!process.env[cfg.cfClearanceEnv]
}

// Verify the WP REST root is reachable (it is, edge-cached) and report whether a
// capture is wired. Returns a human-readable status — used by the probe seeder.
export async function probe(house: LibraryHouse): Promise<string> {
  const cfg = BRIEFING_CONFIG[house]
  try {
    const res = await fetch(`${cfg.host}/wp-json/`, { headers: headers(cfg) })
    const ok = res.ok
    const ct = res.headers.get('content-type') ?? ''
    const rootReachable = ok && ct.includes('json')
    if (!cfg.postTypeSlug || !process.env[cfg.cfClearanceEnv]) {
      return `${house}: wp-json root ${rootReachable ? 'reachable' : 'blocked'}; NOT READY — capture cf_clearance + research-briefing post-type slug (see header).`
    }
    // Capture wired — try one page of the content endpoint.
    const url = `${cfg.host}/wp-json/wp/v2/${cfg.postTypeSlug}?per_page=1`
    const r2 = await fetch(url, { headers: headers(cfg) })
    return `${house}: content endpoint HTTP ${r2.status} — ${r2.ok ? 'READY' : 'still challenged (cf_clearance stale?)'}`
  } catch (e) {
    return `${house}: probe error ${e instanceof Error ? e.message : e}`
  }
}

// Turn-key once a capture is wired: page the research-briefing CPT (WP REST is
// 1-indexed `page`, `per_page` max 100; X-WP-TotalPages header bounds it).
export async function listBriefingsPage(house: LibraryHouse, page: number, perPage = 100): Promise<{ entries: BriefingEntry[]; totalPages: number } | null> {
  const cfg = BRIEFING_CONFIG[house]
  if (!cfg.postTypeSlug) return null
  const url = `${cfg.host}/wp-json/wp/v2/${cfg.postTypeSlug}?per_page=${perPage}&page=${page}&_embed=1`
  const res = await fetch(url, { headers: headers(cfg) })
  if (!res.ok) return null
  const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '0')
  const arr = await res.json() as any[]
  const entries = arr.map(p => ({
    id: String(p.id),
    slug: p.slug ?? String(p.id),
    title: (p.title?.rendered ?? '').replace(/<[^>]+>/g, '').trim(),
    date: p.date ? String(p.date).slice(0, 10) : null,
    url: p.link ?? `${cfg.host}/research-briefings/${p.slug}/`,
    bodyHtml: p.content?.rendered ?? '',
    pdfUrls: extractPdfUrls(p),
  }))
  return { entries, totalPages }
}

function extractPdfUrls(post: any): string[] {
  const urls = new Set<string>()
  const html = (post.content?.rendered ?? '') as string
  for (const m of html.matchAll(/href="([^"]+\.pdf)"/gi)) urls.add(m[1])
  // _embedded media (attached PDFs) if present
  const media = post._embedded?.['wp:attachment'] ?? []
  for (const a of media) if (a?.source_url?.endsWith('.pdf')) urls.add(a.source_url)
  return [...urls]
}
