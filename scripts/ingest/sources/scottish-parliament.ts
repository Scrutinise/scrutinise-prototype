/**
 * scottish-parliament.ts — Scottish Parliament Official Report (V25 §6).
 *
 * GATED: the structured route is the SpOpenData platform, whose API base is NOT
 * exposed in any static asset — the auth key lives in the site's XHR calls. The
 * seeder is built to the point of needing that key; it seeds NOTHING until
 * Charlie supplies the captured request URL + headers (brief §6). We do NOT
 * brute-force or guess the key.
 *
 * Confirmed routes (live, 16 Jun 2026):
 *  - HTML: https://www.parliament.scot/chamber-and-committees/official-report
 *    (date-based + meeting-of-parliament report pages) → 200. An HTML-crawl
 *    fallback is possible but heavy; preferred is the SpOpenData API once keyed.
 *  - SpOpenData API base: not exposed (data.parliament.scot/api/ → 404). Needs
 *    the devtools Network-tab capture (one request's URL + headers).
 *
 * Licence (to record at build): Scottish Parliament Official Report is © Scottish
 * Parliamentary Corporate Body; expected OGL/SPCB open licence — verify the
 * licence page when the route is unblocked. Placeholder licence in licence-map
 * is 'pending-verification'.
 */

const HTML_BASE = 'https://www.parliament.scot/chamber-and-committees/official-report'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

export interface ScottishApiConfig {
  // Supplied by Charlie from a devtools XHR capture. Until then the build is inert.
  baseUrl: string
  headers: Record<string, string>
}

// Liveness probe for the HTML route (used by the seeder dry-run).
export async function probeHtmlRoute(): Promise<number> {
  try {
    const res = await fetch(HTML_BASE, { headers: { 'User-Agent': UA }, redirect: 'manual' })
    return res.status
  } catch { return 0 }
}

// V27 §5 recon (19 Jun 2026): the OR landing page (200, 160KB) exposes NO api/
// data host in its static HTML; data.parliament.scot/api/ and
// www.parliament.scot/api/ both 404. The search results load via a runtime XHR
// whose URL + key are not in any static asset — confirming the gate. We do NOT
// guess the key.
//
// CAPTURE TEMPLATE (what Charlie supplies): the Scottish COURTS API cracked in
// V27 §2 is the model — a server-side fetch works with just Origin + Referer
// headers (no token), CORS being browser-only. On the OR search at
// parliament.scot, open devtools → Network → run a search → copy the one XHR
// request's full URL + request headers into ScottishApiConfig below. The build
// then pages it exactly like sources/scottish-courts.ts.
export interface ScottishReportEntry {
  id: string
  title: string
  date: string | null
  url: string
}

// Once Charlie supplies the captured request, this pages Official Report
// meetings. Integration seam — NOT called until a config is provided.
export async function listOfficialReports(_cfg: ScottishApiConfig): Promise<ScottishReportEntry[]> {
  throw new Error('scottish-parliament: SpOpenData config not supplied — gated on Charlie’s XHR capture (V25 §6 / V27 §5).')
}
