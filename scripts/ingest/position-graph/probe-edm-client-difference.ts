/**
 * probe-edm-client-difference.ts — an observation that has to be checked before it goes in a report,
 * and then deliberately NOT acted on.
 *
 * At 04:39:43 UTC `curl` received **200** from `/EarlyDayMotion/66501`. Eleven seconds later, at
 * 04:39:54, `node`'s `fetch()` received **429 with Retry-After 1425** for the identical URL, from the
 * same machine, with the same `User-Agent` and `Accept` headers. Both observations are on the record
 * above; at most one of them can be a fact about "the IP is blocked".
 *
 * ⚠⚠ WHY THIS SCRIPT DOES NOT BECOME A WORKAROUND. If the limiter's mitigation is keyed on something
 * client-shaped (a TLS fingerprint, an HTTP version, a connection) rather than on the IP, then
 * swapping HTTP client to get past an ACTIVE block is circumventing a rate limit that a public service
 * has deliberately applied to us. That is not a thing to do to Parliament's API, and it would be
 * fragile as well as wrong. The sweep's answer to the limiter is to pace itself so it never trips —
 * see sweep-edm-signatures.ts.
 *
 * So this script exists to establish WHAT IS TRUE, once, in one controlled pair of requests, so that
 * the report says the right thing about why the first run failed. It is not used by the sweep.
 *
 * ⚠ READ-ONLY, and it spends exactly four requests.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-edm-client-difference.ts
 */
import { execFileSync } from 'child_process'

export {}

const URL_ = 'https://oralquestionsandmotions-api.parliament.uk/EarlyDayMotion/66501'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

async function viaFetch(label: string) {
  const t0 = Date.now()
  try {
    const res = await fetch(URL_, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    const body = await res.text()
    console.log(`   ${label.padEnd(28)} ${res.status}  ${Date.now() - t0}ms  Retry-After ${res.headers.get('retry-after') ?? '—'}  ${body.length}b  alpn/http ${(res as any).httpVersion ?? 'n/a'}`)
  } catch (e) {
    console.log(`   ${label.padEnd(28)} ERR  ${(e as Error).message}`)
  }
}

function viaCurl(label: string, extra: string[] = []) {
  const t0 = Date.now()
  try {
    const out = execFileSync('curl', [
      '-s', '-o', 'NUL', '-w', '%{http_code} %{http_version}',
      '-H', `User-Agent: ${UA}`, '-H', 'Accept: application/json',
      ...extra, URL_,
    ], { encoding: 'utf8' })
    console.log(`   ${label.padEnd(28)} ${out.trim()}  ${Date.now() - t0}ms`)
  } catch (e) {
    console.log(`   ${label.padEnd(28)} ERR  ${(e as Error).message}`)
  }
}

async function main() {
  console.log(`\n════ THE SAME URL, FOUR CLIENTS, INSIDE ONE MINUTE ${'═'.repeat(28)}`)
  console.log(`   ${'client'.padEnd(28)} status http_version  timing`)
  await viaFetch('node fetch (undici)')
  viaCurl('curl, default')
  viaCurl('curl --http1.1', ['--http1.1'])
  await viaFetch('node fetch, second try')
  console.log(`\n   ⚠ If these disagree, the mitigation is NOT simply "this IP is blocked", and the`)
  console.log(`     report must say what it actually is. It is still not a licence to switch clients:`)
  console.log(`     the sweep's answer to a rate limit is to stay under it.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
