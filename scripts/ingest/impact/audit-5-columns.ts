/**
 * audit-5-columns.ts — the finding that decides how §2 must be built.
 *
 * ⚠⚠ THE SUMMARY SHEET'S COLUMN ORDER IS NOT STABLE, AND A POSITIONAL PARSE OVER IT PRODUCES
 * CONFIDENT WRONG NUMBERS WITH NO ERROR. Hand-verified on six documents before this was written:
 *
 *   ukia/2017/13   Total Net Present Value │ Business Net Present Value │ EANDCB │ OI3O │ BIT
 *                  £41.38m  £41.38m  -£4.73m  No  Non qualifying provision          ← canonical
 *
 *   ukia/2021/16   EANDCB alone. No NPV columns at all. "…(EANDCB in 2019 prices) Nil £m Nil"
 *
 *   ukia/2023/159  Total Net Present SOCIAL Value │ Business NPV │ Net cost to business per year
 *                  and the BIT status has moved INTO the header block, ahead of the values:
 *                  " £300-£500m £-120m £8.4m"
 *                  — three cells against five canonical columns, a RANGE in the first cell, and a
 *                  minus sign written INSIDE the £ ("£-120m"). A fixed-ordinal reader assigns
 *                  £300 → total NPV, -£500m → business NPV, £8.4m → EANDCB. Two of three wrong.
 *
 *   ukia/2026/90   no "Cost of Preferred" anchor at all — the 2026 template has moved on.
 *
 * So this script measures, over every held assessment: which column labels the header block carries,
 * in what ORDER, how many distinct orderings exist, and how many documents the canonical ordering
 * actually covers. That number is the difference between "§2 is a regex pass" and "§2 is a
 * label-mapped parse with a refusal path", and it is worth having before a line of §2 is written.
 *
 * Usage: tsx impact/audit-5-columns.ts
 */
import fs from 'fs'
import path from 'path'
import { docList, readCached } from './cache'

const CENSUS = path.join(__dirname, '../../../docs/census')

/** The column labels as published, each with the variants seen. Order here is the CANONICAL order;
 *  it is what a document is compared against, never what it is assumed to have. */
const COLUMNS: Array<[string, RegExp]> = [
  ['totalNpv',    /total\s+net\s+present\s+(?:social\s+)?value/i],
  ['businessNpv', /business\s+net\s+present\s+value/i],
  ['eandcb',      /net\s+cost\s+to\s+business\s+per\s+year|equivalent\s+annual\s+net\s+(?:direct\s+)?cost\s+to\s+business|EAN[CD]?CB/i],
  ['oito',        /one[\s-]*in,?\s*(?:two|three)[\s-]*out|OI[23]O|OITO/i],
  ['bitStatus',   /business\s+impact\s+target\s*(?:\(BIT\))?\s*status|measure\s+qualifies\s+as/i],
]

/** Value-cell tokens, in the forms actually published. ⚠ Each of these was added because a document
 *  used it and the previous pattern silently skipped it — never because it seemed likely. */
const CELL = new RegExp([
  /£\s?-?[\d,]+(?:\.\d+)?\s*(?:bn|billion|m|million|k|thousand)?\s*(?:-|–|to)\s*£?\s?-?[\d,]+(?:\.\d+)?\s*(?:bn|billion|m|million|k|thousand)?/.source, // a RANGE first — "£300-£500m"
  /-?\s?£\s?-?[\d,]+(?:\.\d+)?\s*(?:bn|billion|m|million|k|thousand)?/.source,   // "£-120m" and "-£54m"
  /\(\s?£\s?[\d,.]+\s*\w*\s?\)/.source,                                          // "(£5m)" accounting negative
  /(?<![\w.])-?\d[\d,]*(?:\.\d+)?(?![\w.])/.source,                               // ⚠ BARE NUMBER, NO £ AT ALL
  /N\/?A|Not applicable|Not known|Nil|Zero|Unknown|Optional/.source,
  /(?:Non[- ]?qualifying|Qualifying)(?: regulatory)? provision(?: \([^)]{0,40}\))?|Not a regulatory provision|Not in scope|In scope|Out of scope|No|Yes/.source,
].join('|'), 'gi')

const ANCHOR = /Cost of Preferred(?: \(or more likely\))? Option/i

function headerOrder(block: string): string[] {
  // ⚠ NORMALISE FIRST. The PDF justifies these headings, so the SAME label arrives as
  // "Business Net Present Value" and "Business   Net / Present Value" and "Business    Net
  // Present  Value". A literal regex reads those as three different documents and reports a
  // stable layout as chaotic — which is exactly what the first version of this script did:
  // it scored 72.8% MISMATCHED, and hand-reading four of the mismatches found all four
  // carried the full canonical five columns. The defect was in the reader, not the corpus.
  const flat = block.replace(/\s+/g, ' ')
  const found: Array<{ at: number; name: string }> = []
  for (const [name, re] of COLUMNS) {
    const m = flat.match(re)
    if (m && m.index != null) found.push({ at: m.index, name })
  }
  return found.sort((a, b) => a.at - b.at).map(f => f.name)
}

const pct = (a: number, b: number) => b ? `${(a / b * 100).toFixed(1)}%` : '—'

async function main() {
  const docs = await docList()
  const rows: any[] = []
  const orderings = new Map<string, string[]>()

  for (const d of docs) {
    const text = readCached(d.url)
    if (text == null) continue
    const at = text.search(ANCHOR)
    if (at < 0) { rows.push({ ukia: d.ukia, anchored: false, order: null, cells: null }); continue }

    // The header block runs from the anchor to the first line that carries value cells.
    const after = text.slice(at, at + 1400)
    const lines = after.split('\n')
    let headerEnd = -1, valueLine = ''
    for (let i = 1; i < lines.length; i++) {
      const t = lines[i].trim()
      if (!t) continue
      const cells = t.match(CELL)
      // A value line: cells that account for most of the line, i.e. it is data not a label.
      if (cells && cells.join('').length >= t.length * 0.5) { headerEnd = i; valueLine = t; break }
    }
    const block = lines.slice(0, headerEnd < 0 ? lines.length : headerEnd).join('\n')
    const order = headerOrder(block)
    const cells = valueLine ? (valueLine.match(CELL) ?? []).map(c => c.trim()) : []
    const key = order.join('>')
    orderings.set(key, [...(orderings.get(key) ?? []), d.ukia])
    rows.push({ ukia: d.ukia, anchored: true, order, cells, valueLine, matched: order.length === cells.length })
  }

  const anchored = rows.filter(r => r.anchored)
  console.log(`§1.2 COLUMN STABILITY — ${rows.length} held assessments\n`)
  console.log(`  carry the "Cost of Preferred Option" anchor   ${anchored.length}/${rows.length}  ${pct(anchored.length, rows.length)}`)
  console.log(`  distinct header ORDERINGS                     ${orderings.size}`)

  const canonical = COLUMNS.map(c => c[0]).join('>')
  const canonN = (orderings.get(canonical) ?? []).length
  console.log(`  the canonical 5-column ordering               ${canonN}  ${pct(canonN, anchored.length)} of anchored, ${pct(canonN, rows.length)} of all`)
  console.log(`\n  every ordering seen, most common first:`)
  for (const [k, v] of [...orderings.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
    console.log(`    ${String(v.length).padStart(5)}  ${k === canonical ? '✔ CANONICAL  ' : '              '}${k || '(no recognised column label)'}`)
    console.log(`           e.g. ${v.slice(0, 3).join(' ')}`)
  }

  // The load-bearing number: does the count of header labels match the count of value cells?
  const withCells = anchored.filter(r => r.cells.length > 0)
  const agree = withCells.filter(r => r.matched)
  console.log(`\n  ════ THE NUMBER THAT DECIDES §2 ════`)
  console.log(`  anchored, and a value row found               ${withCells.length}`)
  console.log(`  header labels COUNT == value cells COUNT      ${agree.length}  ${pct(agree.length, withCells.length)}`)
  console.log(`  ⚠ MISMATCHED                                  ${withCells.length - agree.length}  ${pct(withCells.length - agree.length, withCells.length)}`)
  console.log(`    On a mismatch a fixed-ordinal reader does NOT fail — it assigns the wrong figure`)
  console.log(`    to the right field name and returns it with full confidence. So §2 assigns by`)
  console.log(`    LABEL and REFUSES on a mismatch; it never counts from the left.`)
  for (const r of withCells.filter(r => !r.matched).slice(0, 6)) {
    console.log(`      ${r.ukia}  ${r.order.length} labels [${r.order.join(',')}] vs ${r.cells.length} cells [${r.cells.join(' | ')}]`)
  }

  fs.writeFileSync(path.join(CENSUS, 'IMPACT_5_columns.json'),
    JSON.stringify({ generated: new Date().toISOString(), canonical, orderings: [...orderings].map(([k, v]) => ({ order: k, n: v.length, examples: v.slice(0, 5) })), rows }, null, 2))
  console.log(`\nwrote docs/census/IMPACT_5_columns.json`)
}
main().catch(e => { console.error(e); process.exit(1) })
