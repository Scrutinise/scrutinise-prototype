/**
 * audit-7-dupcause.ts — the duplicate groups have DISTINCT source PDF URLs and, in the 2007 group,
 * 15 DISTINCT TITLES against ONE stored body. That rules out "one deposit published under many ids"
 * and leaves two possibilities with opposite consequences:
 *
 *   (a) the publisher serves identical CONTENT at distinct URLs — a shared umbrella assessment
 *       copied per instrument. Then our storage is correct and the duplication is real.
 *   (b) our ingest wrote one document's text under several ids. Then up to 463 assessments hold
 *       SOMEBODY ELSE'S NUMBERS, attributed, and every figure §2 extracts from them is wrong.
 *
 * Settled by bytes: download each member's PDF, hash the PDF itself, extract it independently, and
 * compare all three against what we hold.
 *
 * Usage: tsx impact/audit-7-dupcause.ts <ukia> <ukia> [...]
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { pdfToText } from '../shared/compile'
import { docList, readCached } from './cache'

const CENSUS = path.join(__dirname, '../../../docs/census')
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16)

async function get(url: string): Promise<Buffer | null> {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90_000) })
      if (res.status >= 500) { await sleep(4000 * (a + 1)); continue }
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch { await sleep(4000 * (a + 1)) }
  }
  return null
}

async function main() {
  const want = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const docs = await docList()
  const out: any[] = []

  for (const ukia of want) {
    const page = await get(`https://www.legislation.gov.uk/${ukia}`)
    const html = page?.toString('utf8') ?? ''
    const href = html.match(/href="([^"]*\/pdfs\/[^"]*\.pdf)"/i)?.[1]
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const pdfUrl = href ? new URL(href, 'https://www.legislation.gov.uk').toString() : null
    const buf = pdfUrl ? await get(pdfUrl) : null
    const fresh = buf ? (await pdfToText(buf, pdfUrl!)) ?? '' : ''
    const d = docs.find(x => x.ukia === ukia)
    const held = d ? (readCached(d.url) ?? '') : ''

    const row = {
      ukia, title, pdfUrl,
      pdfBytes: buf?.length ?? null,
      pdfHash: buf ? sha(buf) : null,
      freshChars: fresh.length, freshHash: fresh ? sha(fresh) : null,
      heldChars: held.length, heldHash: held ? sha(held) : null,
      freshMatchesHeld: !!fresh && fresh.replace(/\s+/g, ' ').trim() === held.replace(/\s+/g, ' ').trim(),
      freshHead: fresh.slice(0, 160).replace(/\s+/g, ' '),
      heldHead: held.slice(0, 160).replace(/\s+/g, ' '),
    }
    out.push(row)
    console.log(`\n████ ${ukia}`)
    console.log(`  title      ${title}`)
    console.log(`  pdf        ${pdfUrl}`)
    console.log(`  pdf bytes  ${row.pdfBytes}   sha ${row.pdfHash}`)
    console.log(`  fresh text ${row.freshChars} chars  sha ${row.freshHash}`)
    console.log(`  held  text ${row.heldChars} chars  sha ${row.heldHash}`)
    console.log(`  fresh head "${row.freshHead}"`)
    console.log(`  held  head "${row.heldHead}"`)
    await sleep(1500)
  }

  console.log(`\n════ VERDICT ════`)
  const pdfHashes = new Set(out.map(o => o.pdfHash).filter(Boolean))
  const freshHashes = new Set(out.map(o => o.freshHash).filter(Boolean))
  const heldHashes = new Set(out.map(o => o.heldHash).filter(Boolean))
  console.log(`  distinct source PDF bytes   ${pdfHashes.size} of ${out.length}`)
  console.log(`  distinct FRESH extractions  ${freshHashes.size} of ${out.length}`)
  console.log(`  distinct HELD bodies        ${heldHashes.size} of ${out.length}`)

  // ⚠ Evaluate PER GROUP, not across the sample. A run spanning two duplicate groups legitimately
  // shows several distinct hashes, and an across-the-sample test reads that as "the grouping was
  // wrong" when both groups are internally perfect. The first version of this verdict did exactly
  // that on a five-document run covering two groups.
  const byHeld = new Map<string, any[]>()
  for (const o of out) if (o.heldHash) byHeld.set(o.heldHash, [...(byHeld.get(o.heldHash) ?? []), o])

  let verdict = 'inconclusive'
  for (const [h, g] of byHeld) {
    if (g.length < 2) { console.log(`  ${g[0].ukia}: only member of its body in this run — not tested`); continue }
    const pdfs = new Set(g.map(o => o.pdfHash))
    const fresh = new Set(g.map(o => o.freshHash))
    const label = `${g.length} ids sharing held body ${h}`
    if (fresh.size === 1 && pdfs.size === 1) {
      console.log(`  ✔ ${label}: ONE PDF FILE at ${g.length} distinct URLs. Faithful.`)
      verdict = 'publishing'
    } else if (fresh.size === 1) {
      console.log(`  ✔ ${label}: ${pdfs.size} distinct PDF FILES, identical extracted TEXT — the`)
      console.log(`      publisher re-uploaded the same document. Faithful.`)
      verdict = 'publishing'
    } else {
      console.log(`  ⚠⚠ ${label}: the publisher's files extract to ${fresh.size} DIFFERENT texts but we`)
      console.log(`      hold ONE. Ingest collapsed them. Every figure extracted from these ids would`)
      console.log(`      be wrong AND attributed. STOP — do not build §2 over them.`)
      verdict = 'INGEST FAULT'
    }
  }
  console.log(`
  overall: ${verdict}`)
  if (verdict === 'publishing') {
    console.log(`  ⚠ A TITLE IS NOT THE DOCUMENT. Each id carries its own title naming its own measure`)
    console.log(`    ("…amending s237 Town and Country Planning Act", "…minor amendments to existing`)
    console.log(`    planning permissions") while the shared body is ONE umbrella assessment covering`)
    console.log(`    all of them. So the body hash is the safe de-duplication key and the title is not —`)
    console.log(`    and a figure read from that body belongs to the WHOLE Bill, not to the one measure`)
    console.log(`    the id is named for. §2 must attribute an umbrella figure to the umbrella.`)
  }

  const mismatched = out.filter(o => o.heldChars && o.freshChars && !o.freshMatchesHeld)
  console.log(`\n  held text differs from a fresh extraction of its OWN pdf: ${mismatched.length}/${out.length}`)
  for (const m of mismatched) console.log(`    ${m.ukia}  held ${m.heldChars} vs fresh ${m.freshChars}`)

  fs.writeFileSync(path.join(CENSUS, 'IMPACT_7_dupcause.json'),
    JSON.stringify({ generated: new Date().toISOString(), rows: out }, null, 2))
  console.log(`\nwrote docs/census/IMPACT_7_dupcause.json`)
}
main().catch(e => { console.error(e); process.exit(1) })
