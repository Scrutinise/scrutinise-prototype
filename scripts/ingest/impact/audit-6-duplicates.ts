/**
 * audit-6-duplicates.ts — 463 of 1,169 held ids share a body with another id. Is that GENUINE
 * PUBLISHING (one impact assessment deposited against many instruments, which legislation.gov.uk
 * does routinely) or an INGEST BUG (the wrong PDF fetched, or one PDF written under many keys)?
 *
 * ⚠ THE TWO ARE INDISTINGUISHABLE FROM THE DATABASE, and they have opposite consequences. If it is
 * publishing, the duplicates carry real instrument links and §4 needs every one of them. If it is a
 * bug, up to 463 assessments are holding somebody else's numbers and every figure extracted from
 * them would be wrong and attributed.
 *
 * Settled the only way it can be: go back to the publisher. For each duplicate group, compare the
 * PDF URLs the ITEM PAGES advertise. Same URL for every member = one deposit published under many
 * ids = publishing. Different URLs with identical extracted text = our fetch collapsed them = bug.
 *
 * Usage: tsx impact/audit-6-duplicates.ts [--groups 12]
 */
import fs from 'fs'
import path from 'path'

const CENSUS = path.join(__dirname, '../../../docs/census')
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function itemPdf(ukia: string): Promise<{ pdf: string | null; title: string | null }> {
  const url = `https://www.legislation.gov.uk/${ukia}`
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
      if (res.status >= 500) { await sleep(4000 * (a + 1)); continue }
      if (!res.ok) return { pdf: null, title: null }
      const html = await res.text()
      return {
        pdf: html.match(/href="([^"]*\/pdfs\/[^"]*\.pdf)"/i)?.[1] ?? null,
        title: html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null,
      }
    } catch { await sleep(4000 * (a + 1)) }
  }
  return { pdf: null, title: null }
}

async function main() {
  const nGroups = Number(process.argv[process.argv.indexOf('--groups') + 1] ?? 12)
  const layout = JSON.parse(fs.readFileSync(path.join(CENSUS, 'IMPACT_2_layout.json'), 'utf8'))
  const groups: string[][] = layout.dupGroups.slice().sort((a: string[], b: string[]) => b.length - a.length)

  console.log(`DUPLICATE PROVENANCE — ${groups.length} groups, ${groups.reduce((a, g) => a + g.length, 0)} ids`)
  console.log(`probing the ${nGroups} largest against the publisher\n`)

  const verdicts: any[] = []
  for (const g of groups.slice(0, nGroups)) {
    const seen: Array<{ ukia: string; pdf: string | null; title: string | null }> = []
    for (const ukia of g) { seen.push({ ukia, ...(await itemPdf(ukia)) }); await sleep(1200) }
    const pdfs = new Set(seen.map(s => s.pdf).filter(Boolean))
    const titles = new Set(seen.map(s => s.title).filter(Boolean))
    const unreachable = seen.filter(s => s.pdf === null).length
    const verdict = unreachable === seen.length ? 'NOT CHECKED (no page reachable)'
      : pdfs.size === 1 ? 'PUBLISHING — one deposit, many ids'
      : 'DIFFERENT SOURCE PDFs — investigate'
    verdicts.push({ n: g.length, verdict, distinctPdfs: pdfs.size, distinctTitles: titles.size, unreachable, members: seen })
    console.log(`  ${String(g.length).padStart(3)} ids  ${verdict}`)
    console.log(`        distinct source PDFs ${pdfs.size}   distinct titles ${titles.size}   unreachable ${unreachable}`)
    console.log(`        ${g.slice(0, 4).join(' ')}${g.length > 4 ? ' …' : ''}`)
    if (pdfs.size > 1) for (const s of seen.slice(0, 6)) console.log(`          ${s.ukia}  ${s.pdf}`)
    else console.log(`        pdf: ${[...pdfs][0] ?? '—'}`)
    console.log(`        title: ${[...titles][0]?.slice(0, 90) ?? '—'}${titles.size > 1 ? `   ⚠ +${titles.size - 1} other titles` : ''}`)
  }

  const pub = verdicts.filter(v => v.verdict.startsWith('PUBLISHING')).length
  const bad = verdicts.filter(v => v.verdict.startsWith('DIFFERENT')).length
  const nc = verdicts.filter(v => v.verdict.startsWith('NOT CHECKED')).length
  console.log(`\n════ VERDICT over the ${verdicts.length} largest groups ════`)
  console.log(`  one deposit published under many ids   ${pub}`)
  console.log(`  ⚠ different source PDFs, same text     ${bad}`)
  console.log(`  not checked (page unreachable)         ${nc}`)
  if (bad) console.log(`  ⚠⚠ ${bad} group(s) need explaining before any figure is extracted from them.`)

  fs.writeFileSync(path.join(CENSUS, 'IMPACT_6_duplicates.json'),
    JSON.stringify({ generated: new Date().toISOString(), groupsProbed: verdicts.length, totalGroups: groups.length, verdicts }, null, 2))
  console.log(`\nwrote docs/census/IMPACT_6_duplicates.json`)
}
main().catch(e => { console.error(e); process.exit(1) })
