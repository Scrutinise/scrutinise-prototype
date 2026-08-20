/**
 * probe-akn-shape.ts — what SHAPES does the National Archives actually publish?
 *
 * §2.1 says extract the correct node, not strip the wrong bytes. That is only safe if the set of
 * node shapes is known, so this counts them before a line of the extractor is written. Two
 * judgments printed end to end told us `<meta>/<presentation>/<html:style>` carries the CSS and
 * `<header>` + `<judgmentBody>` carries the judgment; this asks whether that holds at 300, and
 * what the exceptions look like.
 *
 * WRITES NOTHING. Run: --n=300
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'

const n = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '300', 10)

/** Does element `name` (with or without a namespace prefix) open anywhere in `xml`? */
function has(xml: string, name: string): boolean {
  return new RegExp(`<(?:\\w+:)?${name}[\\s/>]`).test(xml)
}

;(async () => {
  const p = namesPool()
  const rows = (await p.query(
    `SELECT id, "r2RawKey" FROM corpus_sections WHERE corpus='tna-caselaw' AND "r2RawKey" IS NOT NULL
      ORDER BY md5(id || 'shape') LIMIT $1`, [n])).rows

  const tally: Record<string, number> = {}
  const bump = (k: string) => { tally[k] = (tally[k] ?? 0) + 1 }
  const oddities: string[] = []
  let read = 0

  await Promise.all(rows.map(async r => {
    const xml = await r2Get(r.r2RawKey)
    if (!xml) { bump('R2 MISSING'); return }
    read++
    const rootM = /<akomaNtoso[^>]*>\s*<((?:\w+:)?\w+)([^>]*)>/.exec(xml)
    bump(`root child: ${rootM ? rootM[1] : 'UNRECOGNISED'}${rootM && /name="([^"]+)"/.test(rootM[2]) ? ` name=${/name="([^"]+)"/.exec(rootM[2])![1]}` : ''}`)
    for (const el of ['meta', 'presentation', 'style', 'header', 'judgmentBody', 'mainBody', 'attachments', 'coverPage', 'preface', 'conclusions']) {
      if (has(xml, el)) bump(`has <${el}>`)
    }
    // The question the extractor's safety rests on: is there ANY style block outside <meta>?
    const metaEnd = xml.search(/<\/(?:\w+:)?meta>/)
    const styleIdx: number[] = []
    const rx = /<(?:\w+:)?style[\s/>]/g
    let m: RegExpExecArray | null
    while ((m = rx.exec(xml)) !== null) styleIdx.push(m.index)
    if (styleIdx.some(i => metaEnd >= 0 && i > metaEnd)) {
      bump('STYLE OUTSIDE <meta>')
      if (oddities.length < 5) oddities.push(`${r.id} — style at ${styleIdx.join(',')}, </meta> at ${metaEnd}`)
    }
    if (!has(xml, 'judgmentBody') && !has(xml, 'mainBody')) {
      bump('NEITHER judgmentBody NOR mainBody')
      if (oddities.length < 5) oddities.push(`${r.id} — no body element; root child ${rootM?.[1]}`)
    }
  }))

  console.log(`read ${read} of ${rows.length} raw AKN objects\n`)
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${((100 * v) / read).toFixed(1).padStart(5)}%  ${k}`)
  }
  if (oddities.length) { console.log('\n  ODDITIES:'); oddities.forEach(o => console.log(`    ${o}`)) }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
