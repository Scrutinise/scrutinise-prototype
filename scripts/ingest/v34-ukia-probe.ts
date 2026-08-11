/**
 * v34-ukia-probe.ts — §B step 2. The bulk route, measured.
 *
 * `/ukia/` is a first-class legislation.gov.uk type with year Atom feeds — the
 * BULK route the priority order demands, reusing the TNA pipeline we already
 * run. Before committing to it, three things must be true and none are assumed:
 *
 *   1. The universe is enumerable and countable (per-year totalResults).
 *   2. An item yields TEXT, not only a PDF link. `bytes before hypotheses` —
 *      fetch a real one and look at what comes back.
 *   3. If it IS a PDF, extraction quality must be checked on a sample, because
 *      the eur-lex sectioning fault is the standing warning about assuming a
 *      document type sections cleanly.
 */
import fs from 'fs'
import path from 'path'

const LEG = 'https://www.legislation.gov.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const OUT = path.join(__dirname, '../../docs/v34_probe')
fs.mkdirSync(OUT, { recursive: true })

async function raw(url: string, accept: string): Promise<{ status: number | string; ct: string; len: number; text: string; buf?: Buffer }> {
  try {
    const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': UA }, signal: AbortSignal.timeout(45_000) })
    const ct = res.headers.get('content-type') ?? ''
    const ab = await res.arrayBuffer()
    const buf = Buffer.from(ab)
    return { status: res.status, ct, len: buf.length, text: buf.toString('utf8'), buf }
  } catch (e: any) { return { status: 'ERR', ct: '', len: 0, text: String(e?.message) } }
}

async function main() {
  console.log('=== 1. The ukia universe, year by year ===')
  let grand = 0
  const years: Array<[number, number]> = []
  for (let y = 1998; y <= 2026; y++) {
    const r = await raw(`${LEG}/ukia/${y}/data.feed?page=1`, 'application/atom+xml')
    const t = Number(r.text.match(/<openSearch:totalResults>(\d+)</i)?.[1] ?? 0)
    if (t > 0) { years.push([y, t]); grand += t }
    process.stdout.write(`  ${y}: ${String(t).padStart(4)}   `)
    if ((y - 1997) % 5 === 0) process.stdout.write('\n')
    await new Promise(res => setTimeout(res, 300))
  }
  console.log(`\n\n  YEARS WITH CONTENT: ${years.length}  (${years[0]?.[0]}–${years[years.length - 1]?.[0]})`)
  console.log(`  TOTAL IMPACT ASSESSMENTS ON legislation.gov.uk: ${grand}`)
  fs.writeFileSync(path.join(OUT, 'ukia-years.json'), JSON.stringify({ grand, years }, null, 2))

  console.log('\n=== 2. One item — what actually comes back? ===')
  const feed = await raw(`${LEG}/ukia/2023/data.feed?page=1`, 'application/atom+xml')
  const first = feed.text.match(/<entry[\s\S]*?<\/entry>/i)?.[0] ?? ''
  fs.writeFileSync(path.join(OUT, 'ukia-first-entry.xml'), first)
  console.log(`  entry XML (${first.length} chars):`)
  console.log(first.replace(/></g, '>\n<').split('\n').slice(0, 40).map(l => '    ' + l.trim()).join('\n'))

  const idUrl = first.match(/<id>([^<]+)<\/id>/i)?.[1]
  console.log(`\n  id: ${idUrl}`)
  if (!idUrl) return
  const base = idUrl.replace(/^http:/, 'https:')

  for (const [label, url, accept] of [
    ['XML (CLML)',   `${base}/data.xml`,  'application/xml'],
    ['HTML',         `${base}`,           'text/html'],
    ['PDF',          `${base}/pdfs/${base.split('/').slice(-3).join('')}_en.pdf`, 'application/pdf'],
    ['resources',    `${base}/resources`, 'text/html'],
  ] as Array<[string, string, string]>) {
    const r = await raw(url, accept)
    console.log(`\n  --- ${label}: ${url}`)
    console.log(`      ${r.status} ${r.ct.split(';')[0]} ${r.len} bytes`)
    if (typeof r.status === 'number' && r.status === 200) {
      if (r.ct.includes('pdf')) {
        console.log(`      magic: ${r.buf?.slice(0, 8).toString('latin1')}`)
      } else {
        const stripped = r.text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        console.log(`      text after tag-strip: ${stripped.length} chars`)
        console.log(`      head: ${stripped.slice(0, 400)}`)
        if (label === 'resources') {
          const pdfs = [...r.text.matchAll(/href="([^"]+\.pdf)"/gi)].map(m => m[1])
          console.log(`      PDF links on the resources page: ${pdfs.length}`)
          pdfs.slice(0, 5).forEach(p => console.log(`        ${p}`))
        }
      }
      fs.writeFileSync(path.join(OUT, `ukia-item-${label.replace(/\W+/g, '')}.${r.ct.includes('pdf') ? 'pdf' : 'txt'}`), r.buf ?? Buffer.from(''))
    }
    await new Promise(res => setTimeout(res, 400))
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
