/** C3 Lane C3 gate 1 — can we reach publications.parliament.uk AT ALL from here? Report, do not plan. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const URLS = [
  'https://publications.parliament.uk/pa/ld/ldjudgmt.htm',
  'https://publications.parliament.uk/pa/ld199697/ldjudgmt/jd970206/index.htm',
  'https://www.parliament.uk/',
]
async function main() {
  for (const u of URLS) {
    for (const [label, headers] of [['node default', {}], ['browser UA', { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' }]] as Array<[string, any]>) {
      const t0 = Date.now()
      try {
        const r = await fetch(u, { headers, redirect: 'follow' })
        const body = await r.text()
        const cf = /Just a moment|cf-browser-verification|challenge-platform|Enable JavaScript and cookies/i.test(body)
        console.log(`${String(r.status).padStart(3)}  ${label.padEnd(12)} ${((Date.now()-t0)/1000).toFixed(1)}s  ${body.length} bytes  ${cf ? '⚠ CLOUDFLARE CHALLENGE PAGE' : ''}  ${u}`)
        if (r.ok && !cf) console.log(`     first 140: ${body.replace(/\s+/g,' ').slice(0,140)}`)
      } catch (e: any) {
        console.log(`ERR  ${label.padEnd(12)} ${((Date.now()-t0)/1000).toFixed(1)}s  ${e.message}  ${u}`)
      }
    }
    console.log('')
  }
}
main()
export {}
