/**
 * audit-1-retention.ts — BRIEF_INGEST_IMPACT_NUMBERS §1.1.
 *
 * "Take 50 impact assessments. For each, compare what the source publishes against what we hold,
 *  part by part: summary sheets, evidence base, annexes, tables."
 *
 * ⚠ THE COMPARISON THAT WOULD PROVE NOTHING. Ingest extracted these documents from the source PDF
 * with `pdfToText`. Re-running `pdfToText` and diffing character counts compares a tool against
 * ITSELF and would report ~100% on a pipeline that had silently thrown every annex away. So this
 * measures four different things, only the first of which is a same-tool comparison:
 *
 *   1. BULK   — held chars vs a fresh extraction of the same PDF. Catches truncation and dropped
 *               sections, i.e. the pipeline losing text it had.
 *   2. PARTS  — for each named part (summary sheet, evidence base, annex, PIR), is it present at
 *               SOURCE, and is it present in what we HOLD? Reported as a percentage of the
 *               assessments that HAVE that part at source, per the brief.
 *   3. FIGURES— every £ money token in the source, and how many survive into the held text. This is
 *               the one that matters: an assessment whose prose survived and whose numbers did not
 *               is exactly the "confident, empty table" §1.1 warns about.
 *   4. NUMBERS— the same multiset test over EVERY numeric token, not just £ ones. An annex's figures
 *               are mostly bare numbers in a table; £-only retention would miss losing all of them.
 *   5. TABLES — a money figure is only usable if its ROW LABEL is still adjacent to it. Measured by
 *               taking source lines that look like a table row (a label followed by >=2 numeric
 *               cells) and asking whether that label and its first figure are still within 200
 *               chars of each other in the held text.
 *               ⚠ THIS METRIC IS EXPECTED TO FIND NOTHING, AND THE COUNT OF ROWS IT FOUND AT SOURCE
 *               IS PRINTED FOR THAT REASON. `pdfToText` flattens a PDF table into a header block
 *               followed by loose cells on separate lines, at SOURCE as much as in what we hold —
 *               measured on ukia/2018/132, whose summary row reads "Best Estimate\n0.3  6.2 54.0"
 *               with the column names 40 lines earlier. So "0 rows intact" would be a false alarm
 *               and "0 rows found" is the true statement. A metric whose denominator is zero is
 *               reported as NOT MEASURED, never as a pass.
 *
 * Sampling: `ORDER BY md5(...)`, never `ORDER BY id` — ukia ids begin with the year, so id-order
 * would draw the whole sample from one year (the tna-caselaw trap, docs/census).
 *
 * Usage: tsx impact/audit-1-retention.ts [--n 50]
 */
import fs from 'fs'
import path from 'path'
import { pool } from '../c2/db'
import { r2Get } from '../shared/r2-client'
import { pdfToText } from '../shared/compile'

const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const OUT = path.join(__dirname, '../../../docs/census')

const N = Number(process.argv[find('--n') + 1] ?? 50)
function find(flag: string) { return process.argv.indexOf(flag) }

/** The parts §1.1 names, each with a detector that is deliberately generous at SOURCE (so a part
 *  we fail to hold is never excused by a strict source test) and IDENTICAL on the held text. */
const PARTS: Array<[string, RegExp]> = [
  ['summary sheet',  /summary:\s*intervention and options|summary:\s*analysis (?:and|&) evidence|RPC Opinion:|Type of measure:/i],
  ['evidence base',  /evidence base(?:\s*\(for summary sheets\))?|^\s*evidence base/im],
  ['annex',          /\bannex(?:e[sx])?\s*[A-Z0-9]|\bappendix\s*[A-Z0-9]/i],
  ['PIR / review',   /post[- ]implementation review|will the policy be reviewed|review date/i],
  ['costs table',    /total (?:net )?(?:present value|cost)|net cost to business per year|EANDCB|equivalent annual/i],
]

/** A money token. Deliberately narrow: a £ sign with a number attached. Matching bare numbers would
 *  count page numbers and dates and make retention look better than it is. */
const MONEY = /£\s?-?[\d,]+(?:\.\d+)?\s*(?:m|bn|billion|million|k|thousand)?/gi

/** A table-row-shaped source line: a text label, then two or more numeric cells. */
const TABLE_ROW = /^\s*([A-Za-z][A-Za-z ,'()\/&-]{4,60}?)\s{2,}(-?[\d,]+(?:\.\d+)?)\s{2,}(-?[\d,]+(?:\.\d+)?)/

function norm(s: string) { return s.replace(/\s+/g, ' ').toLowerCase() }
function moneySet(s: string) { return (s.match(MONEY) ?? []).map(m => m.replace(/\s+/g, '').toLowerCase()) }
/** Every numeric token of 1+ digits, commas and decimals kept, so 1,234.5 is one token not three. */
const NUM = /-?\d[\d,]*(?:\.\d+)?/g
function numSet(s: string) { return (s.match(NUM) ?? []).map(m => m.replace(/,/g, '')) }

async function fetchBuf(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90_000) })
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      // legislation.gov.uk rate-limits sequential fetches: 500/504 back-to-back. Back off, don't
      // record it as a failure until it has actually refused three times.
      if (res.status >= 500) { await sleep(4000 * (attempt + 1)); continue }
      return null
    } catch { await sleep(4000 * (attempt + 1)) }
  }
  return null
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Row {
  ukia: string; url: string; sections: number
  fetched: boolean
  srcChars: number; heldChars: number; bulkPct: number | null
  parts: Record<string, { source: boolean; held: boolean }>
  srcMoney: number; heldMoney: number; moneyPct: number | null
  srcNums: number; heldNums: number; numPct: number | null
  srcRows: number; intactRows: number; rowPct: number | null
}

async function main() {
  const p = pool()
  const docs = (await p.query(
    `SELECT "sourceUrl" url, count(*) sections, min(id) any_id
       FROM corpus_sections WHERE corpus = 'impact-assessments' AND status = 'compiled'
      GROUP BY 1 ORDER BY md5(min(id)) LIMIT $1`, [N])).rows as any[]

  console.log(`§1.1 RETENTION — ${docs.length} assessments, sampled by md5\n`)
  const rows: Row[] = []

  for (const d of docs) {
    const ukia = d.url.replace(/^.*\/ukia\//, 'ukia/')
    // The held text: every section of this assessment, in section order, as a user would read it.
    const keys = (await p.query(
      `SELECT "r2Key" FROM corpus_sections
        WHERE corpus='impact-assessments' AND "sourceUrl"=$1 AND "r2Key" IS NOT NULL
        ORDER BY (regexp_replace(id, '^.*:', ''))::int`, [d.url])).rows as any[]
    const held = (await Promise.all(keys.map(k => r2Get(k.r2Key)))).filter(Boolean).join('\n\n')

    // The source PDF. ⚠ TAKEN FROM THE PAGE, never constructed — the natural guess
    // (`ukia2018133_en.pdf`) 404s; the published form is `ukia_20180133_en.pdf`. And there is no
    // per-document `data.feed`: `/ukia/2018/133/data.feed` is a 404 HTML page, so the link comes
    // off the item page, which is a 200.
    const page = await fetchText(d.url)
    const href = page?.match(/href="([^"]*\/pdfs\/[^"]*\.pdf)"/i)?.[1]
    const pdfUrl = href ? new URL(href, 'https://www.legislation.gov.uk').toString().replace(/^http:/, 'https:') : undefined
    const buf = pdfUrl ? await fetchBuf(pdfUrl) : null
    const src = buf ? (await pdfToText(buf, pdfUrl!)) ?? '' : ''

    const row: Row = {
      ukia, url: d.url, sections: Number(d.sections),
      fetched: !!src,
      srcChars: src.length, heldChars: held.length,
      bulkPct: src.length ? +(held.length / src.length * 100).toFixed(1) : null,
      parts: {}, srcMoney: 0, heldMoney: 0, moneyPct: null,
      srcNums: 0, heldNums: 0, numPct: null,
      srcRows: 0, intactRows: 0, rowPct: null,
    }

    if (src) {
      for (const [name, re] of PARTS) {
        row.parts[name] = { source: re.test(src), held: re.test(held) }
      }
      // FIGURES — multiset retention, so five identical "£1m" at source need five in held.
      const sm = moneySet(src), hm = moneySet(held)
      const pot = new Map<string, number>()
      for (const t of hm) pot.set(t, (pot.get(t) ?? 0) + 1)
      let survived = 0
      for (const t of sm) { const c = pot.get(t) ?? 0; if (c > 0) { pot.set(t, c - 1); survived++ } }
      row.srcMoney = sm.length; row.heldMoney = survived
      row.moneyPct = sm.length ? +(survived / sm.length * 100).toFixed(1) : null

      // NUMBERS — every numeric token. An annex table is mostly bare numbers; a £-only test would
      // score 100% on a document that had lost every figure in every annex.
      const sn = numSet(src), hn = numSet(held)
      const npot = new Map<string, number>()
      for (const t of hn) npot.set(t, (npot.get(t) ?? 0) + 1)
      let nsurv = 0
      for (const t of sn) { const c = npot.get(t) ?? 0; if (c > 0) { npot.set(t, c - 1); nsurv++ } }
      row.srcNums = sn.length; row.heldNums = nsurv
      row.numPct = sn.length ? +(nsurv / sn.length * 100).toFixed(1) : null

      // TABLES — label still adjacent to its first figure?
      const heldN = norm(held)
      for (const line of src.split('\n')) {
        const m = line.match(TABLE_ROW)
        if (!m) continue
        row.srcRows++
        const label = norm(m[1]).trim(), cell = m[2]
        const at = heldN.indexOf(label)
        if (at >= 0 && heldN.slice(at, at + 200).includes(cell.toLowerCase())) row.intactRows++
      }
      row.rowPct = row.srcRows ? +(row.intactRows / row.srcRows * 100).toFixed(1) : null
    }

    rows.push(row)
    console.log(
      `${ukia.padEnd(16)} ${row.fetched ? '' : 'SOURCE UNFETCHED  '}` +
      (row.fetched
        ? `bulk ${String(row.bulkPct).padStart(6)}%  money ${String(row.moneyPct ?? '—').padStart(6)}% (${row.heldMoney}/${row.srcMoney})  ` +
          `tablerows ${String(row.rowPct ?? '—').padStart(6)}% (${row.intactRows}/${row.srcRows})  ` +
          `parts ${Object.entries(row.parts).filter(([, v]) => v.source).map(([k, v]) => `${k[0]}${v.held ? '+' : '✗'}`).join('')}`
        : '')
    )
    await sleep(1500)
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const got = rows.filter(r => r.fetched)
  console.log(`\n════ SUMMARY ════`)
  console.log(`assessments sampled       ${rows.length}`)
  console.log(`source fetched            ${got.length}   (unfetchable = NOT CHECKED, not failed)`)
  if (got.length < rows.length * 0.6) {
    console.log(`⚠ FLOOR BREACHED: fewer than 60% of the sample could be fetched. Retention is NOT`)
    console.log(`  measured by this run — skipping cannot be allowed to pass as a result.`)
  }

  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
  console.log(`\nBULK TEXT (held chars / freshly-extracted source chars)`)
  console.log(`  median ${med(got.map(r => r.bulkPct!)).toFixed(1)}%   under 90%: ${got.filter(r => r.bulkPct! < 90).length}   over 110%: ${got.filter(r => r.bulkPct! > 110).length}`)

  console.log(`\nPARTS — held as a % of the assessments that HAVE that part at source`)
  for (const [name] of PARTS) {
    const atSource = got.filter(r => r.parts[name]?.source)
    const kept = atSource.filter(r => r.parts[name].held)
    console.log(`  ${name.padEnd(16)} at source ${String(atSource.length).padStart(3)}/${got.length}   held ${String(kept.length).padStart(3)}/${String(atSource.length).padStart(3)}  ${atSource.length ? (kept.length / atSource.length * 100).toFixed(1) : '—'}%`)
  }

  const withMoney = got.filter(r => r.srcMoney > 0)
  const totSrc = withMoney.reduce((a, r) => a + r.srcMoney, 0), totHeld = withMoney.reduce((a, r) => a + r.heldMoney, 0)
  console.log(`\nFIGURES — £ tokens at source that survive into what we hold`)
  console.log(`  assessments with any £ figure at source  ${withMoney.length}/${got.length}`)
  console.log(`  tokens                                   ${totHeld}/${totSrc}  ${totSrc ? (totHeld / totSrc * 100).toFixed(1) : '—'}%`)
  console.log(`  median per-assessment retention           ${med(withMoney.map(r => r.moneyPct!)).toFixed(1)}%`)
  console.log(`  assessments under 90%                     ${withMoney.filter(r => r.moneyPct! < 90).length}`)

  const withNum = got.filter(r => r.srcNums > 0)
  const nSrc = withNum.reduce((a, r) => a + r.srcNums, 0), nHeld = withNum.reduce((a, r) => a + r.heldNums, 0)
  console.log(`
NUMBERS — EVERY numeric token, the test the annex tables actually need`)
  console.log(`  tokens                                   ${nHeld}/${nSrc}  ${nSrc ? (nHeld / nSrc * 100).toFixed(1) : '—'}%`)
  console.log(`  median per-assessment retention           ${med(withNum.map(r => r.numPct!)).toFixed(1)}%`)
  console.log(`  assessments under 90%                     ${withNum.filter(r => r.numPct! < 90).length}`)

  const withRows = got.filter(r => r.srcRows > 0)
  const tr = withRows.reduce((a, r) => a + r.srcRows, 0), ti = withRows.reduce((a, r) => a + r.intactRows, 0)
  console.log(`\nTABLE ROWS — label still within 200 chars of its first figure`)
  console.log(`  assessments with a detectable table row  ${withRows.length}/${got.length}`)
  if (tr === 0) {
    console.log(`  ⚠ NOT MEASURED — 0 table rows found AT SOURCE, so there was nothing to lose and`)
    console.log(`    nothing to score. pdfToText flattens a PDF table into a header block followed by`)
    console.log(`    loose cells on their own lines, so no line carries a label AND its cells. This is`)
    console.log(`    a property of the SOURCE FORMAT, not of our ingest — and it is the single fact`)
    console.log(`    that decides how §2 must extract. Reported as not measured, never as a pass.`)
  } else {
    console.log(`  rows intact                              ${ti}/${tr}  ${(ti / tr * 100).toFixed(1)}%`)
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'IMPACT_1_retention.json'), JSON.stringify({ generated: new Date().toISOString(), n: rows.length, rows }, null, 2))
  console.log(`\nwrote docs/census/IMPACT_1_retention.json`)
  await p.end()
}

async function fetchText(url: string): Promise<string | null> {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) })
      if (res.ok) return await res.text()
      if (res.status >= 500) { await sleep(4000 * (a + 1)); continue }
      return null
    } catch { await sleep(4000 * (a + 1)) }
  }
  return null
}

main().catch(e => { console.error(e); process.exit(1) })
