/**
 * v25-seed-scottish.ts — V25 §6 (GATED). Scottish Parliament Official Report.
 *
 * Seeds NOTHING. The structured SpOpenData route needs the auth key from the
 * site's XHR calls (Charlie's devtools capture, brief §6/§7). This script
 * confirms the HTML route is live and reports the blocker. When the captured
 * request URL + headers are supplied, the seeder gains a --config path and the
 * sources/scottish-parliament.ts integration seam is wired.
 */
import { endNeonPool } from './shared/neon-pool'
import { probeHtmlRoute } from './sources/scottish-parliament'

async function main() {
  const status = await probeHtmlRoute()
  console.log('[scottish] HTML Official Report route status:', status, status === 200 ? '(live)' : '')
  console.log('[scottish] SpOpenData API base: NOT exposed in static assets — auth key lives in the site XHR calls.')
  console.log('[scottish] GATED — no rows seeded. Waiting on Charlie’s devtools Network-tab capture')
  console.log('           (one api.parliament.scot / SpOpenData request: full URL + headers).')
  console.log('[scottish] Do NOT brute-force or guess the key (brief §6).')
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
