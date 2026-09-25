// ─────────────────────────────────────────────────────────────────────────────
// S24 — REDIRECT LINKS. Gemini's Google Search grounding does not hand back the page it
// found — `groundingChunks[].web.uri` is a `vertexaisearch.cloud.google.com/
// grounding-api-redirect/…` wrapper URL, Google's own citation-tracking indirection. Every
// [W]-cited source and every orientation item built from a grounded call has been carrying
// that wrapper as its `url` since S6, not the underlying page — a citation a reader cannot
// usefully hover, copy, or judge by domain.
//
// ⚠ RESOLVED BEFORE STORAGE OR DISPLAY, PER THE BRIEF — this is the one function that does
// it, so a caller cannot forget to. Both the redirect and the resolved address are kept:
// the redirect is what Gemini actually gave us (provenance, and the fallback if resolution
// fails); the resolved address is what a reader can act on.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedUrl {
  /** The original grounding-API redirect URL, exactly as Gemini returned it. */
  redirectUrl: string
  /** The final address after following redirects. Equal to `redirectUrl` when the redirect
   *  itself could not be followed at all (network error, timeout) — never left blank, so a
   *  caller with no special handling still gets a URL. */
  url: string
  /**
   * TRUE only when `url` genuinely could not be obtained — the redirect itself failed,
   * timed out, or DNS/connection-refused. This is "dead" in the brief's word.
   *
   * ⚠ A 403 IS NOT DEAD. `ofwat.gov.uk` and other government/news hosts routinely refuse an
   * automated fetch with 403 (the same bot-blocking this codebase has already measured on
   * parliament.uk, hansard.parliament.uk — see docs/SEARCH_S21_REPORT.md §7) while the page is
   * perfectly real and a human's browser sees it fine. `redirect: 'follow'` still resolves the
   * real address in that case — `url` is correct, `status` just isn't 2xx. Conflating "the
   * destination is real but blocked us" with "the link is dead" would overstate a defect that
   * isn't there; `dead` is reserved for the case where no real address was ever obtained.
   */
  dead: boolean
  /** The destination's own HTTP status, where a response was received at all. Null when the
   *  fetch failed outright (network error, timeout, DNS) rather than answering with a status. */
  status: number | null
}

/**
 * Resolve every URL to its final address, in parallel, bounded by `timeoutMs` each.
 * Never throws: a URL that cannot be resolved comes back `ok: false` with `url` equal to
 * the input, so a caller always has SOMETHING to show rather than a hole in the list.
 */
export async function resolveGroundingUrls(
  urls: string[], timeoutMs = 8000,
): Promise<Map<string, ResolvedUrl>> {
  const unique = [...new Set(urls)]
  const entries = await Promise.all(unique.map(async (redirectUrl): Promise<[string, ResolvedUrl]> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      // GET, not HEAD — several government and news hosts refuse HEAD outright (405) while
      // answering GET fine, and a redirect chain must actually be followed to know the real
      // destination, not merely probed. `redirect: 'follow'` is fetch's default; named here
      // because it is the one thing about this call that matters.
      const res = await fetch(redirectUrl, { method: 'GET', redirect: 'follow', signal: ctrl.signal })
      // The body is not read — this call exists to learn the final URL and its status, never
      // to fetch content (S21 §4's own rule: fetched content only ever reaches an isolated
      // extraction pass, and this is not one).
      void res.body?.cancel().catch(() => {})
      const resolved = res.url || redirectUrl
      // A response was received — even a 403 or 404 — so the redirect DID resolve. Only a
      // thrown fetch (network error, timeout, DNS failure) below counts as dead.
      return [redirectUrl, { redirectUrl, url: resolved, dead: false, status: res.status }]
    } catch (err) {
      console.warn('[resolve-redirect] could not resolve', redirectUrl, err instanceof Error ? err.message : err)
      return [redirectUrl, { redirectUrl, url: redirectUrl, dead: true, status: null }]
    } finally {
      clearTimeout(timer)
    }
  }))
  return new Map(entries)
}
