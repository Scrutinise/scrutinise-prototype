/**
 * v27-seed-scottish-parliament.ts — V27 §5 (GATED). Scottish Parliament Official
 * Report (~320k sections est). Distinct from the V27 §2 courts API.
 *
 * Seeds NOTHING. Confirms the HTML OR route is live, records the V27 recon
 * (no open API host exposed in static assets), and states the exact capture
 * Charlie must supply. When the captured request URL + headers are provided,
 * sources/scottish-parliament.ts:listOfficialReports gains its config and this
 * seeder seeds 'scottish-parliament-or' rows — mirroring the §2 courts build.
 */
import { endNeonPool } from './shared/neon-pool'
import { probeHtmlRoute } from './sources/scottish-parliament'

async function probe(url: string): Promise<number> {
  try { return (await fetch(url, { method: 'GET', redirect: 'manual' })).status } catch { return 0 }
}

async function main() {
  const html = await probeHtmlRoute()
  console.log('[scottish-parl] HTML Official Report route:', html, html === 200 ? '(live)' : '')
  console.log('[scottish-parl] open-API recon (19 Jun 2026):')
  for (const u of ['https://data.parliament.scot/api/', 'https://www.parliament.scot/api/']) {
    console.log(`    ${u} -> ${await probe(u)} (not an open base)`)
  }
  console.log('[scottish-parl] The OR landing page references no api/data host in static HTML —')
  console.log('                search results load via a runtime XHR whose URL+key are not in any asset.')
  console.log('')
  console.log('[scottish-parl] GATED — 0 rows seeded. WAITS ON CHARLIE’S CAPTURE:')
  console.log('   devtools → Network → run a search on the Scottish Parliament OR →')
  console.log('   copy the one XHR request’s full URL + request headers.')
  console.log('   Template: the V27 §2 courts API (api.pa.web.scotcourts.gov.uk) works server-side')
  console.log('   with just Origin + Referer (no token). The OR API is expected to be similar.')
  console.log('[scottish-parl] Do NOT brute-force or guess the key (brief §5).')
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
