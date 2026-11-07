/**
 * pilot-text.ts — BRIEF_INGEST_CBA_1 §5.3 pilot, §1 rows 1–2 (the method documents). DRY RUN:
 * fetches the publisher's own files, splits in memory, and writes a READ-BACK for review.
 * Writes nothing to Neon or R2. Production write waits for the read-back to be reviewed (as 307).
 *
 *   npx tsx cba/pilot-text.ts
 * Output: docs/ingest_traces/cba1_pilot_text.json (summary) + cba1_pilot_readback.txt (every section)
 */
import fs from 'fs'
import path from 'path'
import { pdfToText } from '../shared/compile'
import { splitNumberedParagraphs, htmlTables } from './numbered-paras'

const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const DOCS = [
  { key: 'green-book-2026', cite: 'Green Book', page: 'government/publications/the-green-book--2', html: 'government/publications/the-green-book--2/the-green-book-2026',
    pdf: 'https://assets.publishing.service.gov.uk/media/6ae0ba897b7111c482d80a3b/The_Green_Book_2026.pdf', runningTitle: 'The Green Book',
    probes: ['6.56', '6.57', '6.58', '10.12', 'A.1', 'A.18'] },
  { key: 'gb-discounting', cite: 'Green Book discounting', page: 'government/publications/green-book-supplementary-guidance-discounting', html: null,
    pdf: 'https://assets.publishing.service.gov.uk/media/6ae0b34016428df537606216/Green_Book_supplementary_guidance_-_discounting.pdf', runningTitle: null,
    probes: ['2.1', '3.8'] },
  { key: 'gb-optimism-bias', cite: 'Green Book optimism bias', page: 'government/publications/green-book-supplementary-guidance-optimism-bias', html: null,
    pdf: 'https://assets.publishing.service.gov.uk/media/5a74dae740f0b65f61322c72/Optimism_bias.pdf', runningTitle: null,
    probes: ['3.1', '3.3', '4.1', 'Example 1 (Part 1) – Capital Expenditure', 'APPENDIX'] },
]

async function getJson(p: string) { const r = await fetch(`https://www.gov.uk/api/content/${p}`, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${p}`); return r.json() }

async function main() {
  const summary: any[] = []
  const rb: string[] = []
  for (const d of DOCS) {
    const page = await getJson(d.page)
    const r = await fetch(d.pdf, { headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error(`${r.status} ${d.pdf}`)
    const text = (await pdfToText(Buffer.from(await r.arrayBuffer()), d.pdf)) ?? ''
    const split = splitNumberedParagraphs(text, d.runningTitle)
    const tables = d.html ? htmlTables((await getJson(d.html)).details.body) : []
    const all = split.sections.map(s => s.text).join('\n')
    const words = (t: string) => t.split(/\s+/).filter(Boolean).length
    const srcWords = words(text), keptWords = words(all)
    const rec = {
      key: d.key, publisherUpdated: page.public_updated_at, pdf: d.pdf, licence: 'ogl-3.0 (gov.uk terms)',
      paragraphs: split.sections.length, first: split.sections[0]?.num, last: split.sections.at(-1)?.num,
      chapters: Object.keys(split.chapters).length, restarts: split.restarts, gaps: split.gaps,
      htmlTables: tables.map(t => `${t.title} (${t.rows} rows)`),
      wordsSource: srcWords, wordsInParagraphs: keptWords, keptPct: Math.round(1000 * keptWords / srcWords) / 10,
      adversarial: { pound: (all.match(/£/g) ?? []).length, curly: (all.match(/[‘’“”]/g) ?? []).length, dash: (all.match(/[–—]/g) ?? []).length, kernSplitInSource: (text.match(/\bf [rlif][a-z]+/g) ?? []).length, kernSplitAfterRepair: (all.match(/\bf [rlif][a-z]+/g) ?? []).length },
      wordsMin: Math.min(...split.sections.map(s => words(s.text))), wordsMax: Math.max(...split.sections.map(s => words(s.text))),
      probes: d.probes.map(n => { const s = split.sections.find(x => x.num === n); return s ? `${d.cite} ${n} [${s.path.join(' › ')}] ${s.text.replace(/\s+/g, ' ').slice(0, 220)}` : `${d.cite} ${n}: NOT FOUND` }),
    }
    summary.push(rec)
    console.log(`\n== ${d.key} | updated ${rec.publisherUpdated} | ${rec.paragraphs} paragraphs ${rec.first}…${rec.last} | chapters ${rec.chapters} | restarts ${rec.restarts} | gaps ${rec.gaps.length} ${rec.gaps.slice(0, 8).join('; ')}`)
    console.log(`   words: source ${srcWords}, in paragraphs ${keptWords} (${rec.keptPct}%) | per-para ${rec.wordsMin}–${rec.wordsMax} | £ ${rec.adversarial.pound} curly ${rec.adversarial.curly} dash ${rec.adversarial.dash} split ligatures ${rec.adversarial.kernSplitInSource} → ${rec.adversarial.kernSplitAfterRepair}`)
    console.log(`   html tables: ${tables.length}`)
    for (const pr of rec.probes) console.log('   ' + pr)
    rb.push(`\n######## ${d.key} — ${d.pdf}`)
    for (const s of split.sections) rb.push(`\n[${d.cite} ${s.num}] ${s.path.join(' › ')}\n${s.text}`)
    for (const t of tables) rb.push(`\n[${d.cite} — ${t.title}]\n${t.text}`)
  }
  const dir = path.join(__dirname, '../../../docs/ingest_traces')
  fs.writeFileSync(path.join(dir, 'cba1_pilot_text.json'), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(dir, 'cba1_pilot_readback.txt'), rb.join('\n'))
  console.log('\nWROTE docs/ingest_traces/cba1_pilot_text.json + cba1_pilot_readback.txt')
}
main().catch(e => { console.error(e); process.exit(1) })
