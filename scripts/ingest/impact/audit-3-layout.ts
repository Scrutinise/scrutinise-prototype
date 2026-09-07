/**
 * audit-3-layout.ts — BRIEF_INGEST_IMPACT_NUMBERS §1.2, measured over the WHOLE held collection
 * rather than the three documents §1.2 asks to be read by eye. Three documents establish the shape;
 * 1,169 establish whether it is stable.
 *
 * Answers, from the documents:
 *   - where the headline figures sit, and whether the layout is stable across years/departments
 *   - how many are the standardised summary-sheet format vs free prose
 *   - whether the RPC opinion is in the document or published separately
 *
 * ⚠ AND ONE THE BRIEF DID NOT ASK FOR, because §1.2's "how many" questions are meaningless without
 * it: how many of the 1,169 are DISTINCT DOCUMENTS. Three assessments (2021/56, /57, /58) share an
 * identical 106,674-word body, because one impact assessment deposited against three instruments is
 * published three times under three ukia ids.
 *
 * Usage: tsx impact/audit-3-layout.ts
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { docList, readCached, Doc } from './cache'

const OUT = path.join(__dirname, '../../../docs/census')

/** Template markers. Each identifies a DIFFERENT document family; they are not degrees of one. */
const TEMPLATES: Array<[string, RegExp]> = [
  ['IA proforma (summary sheet)', /summary:\s*intervention and options|summary:\s*analysis\s*(?:and|&)\s*evidence/i],
  ['PIR template',                /post[- ]implementation review\s*(?:\(PIR\))?\s*(?:of|:)|PIR\b.{0,40}\bquestion\s*1|has the policy achieved/i],
  ['NI regulatory screening',     /regulatory impact assessment screening|screening questions/i],
  ['de minimis / no-IA note',     /de\s?minimis|below the de minimis|no impact assessment (?:has been|is) (?:prepared|produced)/i],
]

/** Where the headline figures sit, and in what form. */
const FIELDS: Array<[string, RegExp]> = [
  ['EANDCB label',       /net cost to business per\s*\n?\s*year|EANDCB|equivalent annual net direct cost/i],
  ['price base year',    /price base\s*\n?\s*year\s*:?\s*(\d{4}|N\/?A)/i],
  ['EANDCB price year',  /EANDCB in (\d{4}) prices/i],
  ['NPV label',          /net benefit \(present value|total net\s*\n?\s*present value/i],
  ['COSTS (£m) block',   /\bCOSTS\s*\(£m\)/i],
  ['BENEFITS (£m) block',/\bBENEFITS\s*\(£m\)/i],
  ['transition cost',    /total transition/i],
  ['business population',/business population|businesses? in scope|number of (?:businesses|firms)/i],
  ['non-monetised',      /other key non[- ]monetised/i],
  ['RPC opinion in-doc', /RPC Opinion\s*:/i],
  ['review clause',      /will the policy be reviewed|review date|sunset clause|statutory review/i],
  ['BIT status',         /business impact target/i],
]

const RPC_VERDICT = /RPC Opinion\s*:?\s*([A-Za-z \/-]{3,40})/i

function pct(a: number, b: number) { return b ? `${(a / b * 100).toFixed(1)}%` : '—' }

async function main() {
  const docs = await docList()
  console.log(`§1.2 LAYOUT — ${docs.length} held assessments, read from the local cache\n`)

  const byHash = new Map<string, string[]>()
  const rows: any[] = []

  for (const d of docs) {
    const text = readCached(d.url)
    if (text == null) { console.log(`NOT CACHED: ${d.ukia}`); continue }
    const h = crypto.createHash('sha256').update(text).digest('hex')
    byHash.set(h, [...(byHash.get(h) ?? []), d.ukia])

    const r: any = {
      ukia: d.ukia, year: Number(d.ukia.split('/')[1]), words: d.words, sections: d.sections,
      instrument: d.instrument, hash: h, templates: {}, fields: {},
      rpcVerdict: text.match(RPC_VERDICT)?.[1]?.trim() ?? null,
      priceBaseYear: text.match(/price base\s*\n?\s*year\s*:?\s*(\d{4})/i)?.[1] ?? null,
      eandcbPriceYear: text.match(/EANDCB in (\d{4}) prices/i)?.[1] ?? null,
    }
    for (const [n, re] of TEMPLATES) r.templates[n] = re.test(text)
    for (const [n, re] of FIELDS) r.fields[n] = re.test(text)
    rows.push(r)
  }

  // ── Distinct documents ────────────────────────────────────────────────────
  const dupGroups = [...byHash.values()].filter(g => g.length > 1)
  const dupCopies = dupGroups.reduce((a, g) => a + g.length, 0)
  console.log(`════ HOW MANY DOCUMENTS ARE THERE, REALLY ════`)
  console.log(`  ukia ids held                    ${rows.length}`)
  console.log(`  DISTINCT bodies (sha256)         ${byHash.size}`)
  console.log(`  ids that share a body            ${dupCopies} in ${dupGroups.length} groups`)
  console.log(`  largest duplicate group          ${Math.max(0, ...dupGroups.map(g => g.length))}`)
  console.log(`  examples: ${dupGroups.slice(0, 4).map(g => g.join('=')).join('  ')}`)

  // ── Template families ─────────────────────────────────────────────────────
  console.log(`\n════ WHICH TEMPLATE ════  (families overlap: a PIR can sit inside a proforma IA)`)
  for (const [n] of TEMPLATES) {
    const k = rows.filter(r => r.templates[n]).length
    console.log(`  ${n.padEnd(30)} ${String(k).padStart(5)}  ${pct(k, rows.length)}`)
  }
  const none = rows.filter(r => !TEMPLATES.some(([n]) => r.templates[n]))
  console.log(`  ${'NONE of the above (free prose)'.padEnd(30)} ${String(none.length).padStart(5)}  ${pct(none.length, rows.length)}`)

  // ── Is the layout stable across years? ────────────────────────────────────
  console.log(`\n════ IS THE PROFORMA STABLE ACROSS YEARS ════`)
  console.log(`  year   held   proforma        EANDCB label    COSTS(£m)       RPC in-doc`)
  const years = [...new Set(rows.map(r => r.year))].sort()
  for (const y of years) {
    const g = rows.filter(r => r.year === y)
    const f = (k: string, t: 'templates' | 'fields') => `${String(g.filter(r => r[t][k]).length).padStart(4)} ${pct(g.filter(r => r[t][k]).length, g.length).padStart(6)}`
    console.log(`  ${y}  ${String(g.length).padStart(5)}   ${f('IA proforma (summary sheet)', 'templates')}  ${f('EANDCB label', 'fields')}  ${f('COSTS (£m) block', 'fields')}  ${f('RPC opinion in-doc', 'fields')}`)
  }

  // ── Field presence overall ────────────────────────────────────────────────
  console.log(`\n════ WHERE THE FIGURES SIT — marker present, over all ${rows.length} ════`)
  const pro = rows.filter(r => r.templates['IA proforma (summary sheet)'])
  console.log(`  ${'field marker'.padEnd(24)} ${'all'.padStart(12)} ${'proforma only'.padStart(16)}`)
  for (const [n] of FIELDS) {
    const a = rows.filter(r => r.fields[n]).length, b = pro.filter(r => r.fields[n]).length
    console.log(`  ${n.padEnd(24)} ${String(a).padStart(5)} ${pct(a, rows.length).padStart(6)} ${String(b).padStart(7)} ${pct(b, pro.length).padStart(8)}`)
  }

  // ── The RPC question the brief asks explicitly ────────────────────────────
  console.log(`\n════ RPC OPINION — in the document, or published separately? ════`)
  const withRpc = rows.filter(r => r.fields['RPC opinion in-doc'])
  console.log(`  carries "RPC Opinion:" in the document   ${withRpc.length}/${rows.length}  ${pct(withRpc.length, rows.length)}`)
  const verdicts = new Map<string, number>()
  for (const r of withRpc) {
    const v = (r.rpcVerdict ?? '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 30)
    verdicts.set(v, (verdicts.get(v) ?? 0) + 1)
  }
  for (const [v, c] of [...verdicts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${String(c).padStart(4)}  "${v}"`)

  // ── The price-year trap, measured ─────────────────────────────────────────
  console.log(`\n════ PRICE BASE YEAR — one per assessment, or one per figure? ════`)
  const both = rows.filter(r => r.priceBaseYear && r.eandcbPriceYear)
  const differ = both.filter(r => r.priceBaseYear !== r.eandcbPriceYear)
  console.log(`  a "Price Base Year YYYY"                 ${rows.filter(r => r.priceBaseYear).length}/${rows.length}`)
  console.log(`  an "EANDCB in YYYY prices"               ${rows.filter(r => r.eandcbPriceYear).length}/${rows.length}`)
  console.log(`  BOTH                                     ${both.length}`)
  console.log(`  ⚠ and they DISAGREE                      ${differ.length}  ${pct(differ.length, both.length)}`)
  console.log(`    examples: ${differ.slice(0, 6).map(r => `${r.ukia} PV=${r.priceBaseYear} EANDCB=${r.eandcbPriceYear}`).join('; ')}`)

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'IMPACT_2_layout.json'),
    JSON.stringify({ generated: new Date().toISOString(), n: rows.length, distinctBodies: byHash.size, dupGroups, rows }, null, 2))
  console.log(`\nwrote docs/census/IMPACT_2_layout.json`)
}
main().catch(e => { console.error(e); process.exit(1) })
