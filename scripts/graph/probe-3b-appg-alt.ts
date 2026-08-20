/**
 * probe-3b-appg-alt.ts — GRAPH 3B §2.1. Is there an OFFICIAL open-data route to the APPG register
 * that is not behind the Cloudflare challenge?
 *
 * ⚠ Working around a bot challenge is not on the table — that is not a thing this project builds.
 * So the question is whether Parliament publishes the same facts somewhere machine-readable.
 *
 * Usage (from scripts/graph):  npx tsx probe-3b-appg-alt.ts
 */
export {}
const CANDIDATES: Array<[string, string]> = [
  ['data.parliament.uk', 'https://data.parliament.uk/'],
  ['api.parliament.uk', 'https://api.parliament.uk/'],
  ['members-api Reference index', 'https://members-api.parliament.uk/index.html'],
  ['interests-api (registered interests)', 'https://interests-api.parliament.uk/api/v1/Categories'],
  ['interests-api Interests', 'https://interests-api.parliament.uk/api/v1/Interests?Take=2'],
  ['committees-api (control: an open parliament API)', 'https://committees-api.parliament.uk/api/Committees?take=1'],
  ['statistics.parliament.uk', 'https://statistics.parliament.uk/'],
]
async function main() {
  for (const [label, url] of CANDIDATES) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Scrutinise/1.0 (research; cl@scrutinise.org)', Accept: 'application/json,text/html' },
        signal: AbortSignal.timeout(20_000),
      })
      const b = await r.text()
      console.log(`   ${String(r.status).padStart(3)}  ${label.padEnd(42)} ${String(b.length).padStart(8)} b  ${(r.headers.get('content-type') ?? '').split(';')[0]}`)
      if (r.status === 200 && /json/.test(r.headers.get('content-type') ?? '')) console.log('        ' + b.slice(0, 260))
    } catch (e) {
      console.log(`   ERR  ${label.padEnd(42)} ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
