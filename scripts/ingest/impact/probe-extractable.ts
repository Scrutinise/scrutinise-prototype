/**
 * probe-extractable.ts — §1.2's last question in numbers: given the layout as it actually is, WHAT
 * FRACTION OF THE HEADLINE FIGURES CAN BE PARSED? This is a FEASIBILITY PROBE, not the §2 extractor.
 * It exists because §1.2 says that if the layout is not stable "extraction is a different and larger
 * job than this brief assumes, and that is worth knowing on day one" — and that sentence needs a
 * number under it before Charlie is asked to decide anything.
 *
 * THE LAYOUT, AS MEASURED (ukia/2018/132, and it recurs):
 *
 *     Cost of Preferred (or more likely) Option
 *     Total Net / Present Value          ┐
 *     Business Net / Present Value       │ the column headers, one per line,
 *     Net cost to business per           │ wrapped mid-phrase by the PDF
 *     year (EANDCB in 2014 prices)       │
 *     One-In, / Three-Out                │
 *     Business Impact Target / Status    ┘
 *
 *     -£54m -£0.1m £0.01m Not applicable Not a regulatory provision   ← every value, one line
 *
 * So the summary sheet is not a table in the extracted text; it is a header BLOCK followed by a
 * value ROW. That is parseable — positionally, by ordinal — and it is NOT parseable by "find the
 * label, take the number after it", which is the approach anyone would reach for first and which
 * would return the header's own price year as the figure.
 *
 * ⚠ EVERY FIELD IS RECORDED WITH THE VERBATIM TEXT IT CAME FROM. A figure with no quotable source
 * is a claim, not a fact.
 * ⚠ UNPARSED IS UNPARSED, NEVER ZERO. `null` and `0` are different facts here and the difference is
 * the whole answer to "has this been costed?".
 *
 * Usage: tsx impact/probe-extractable.ts [--n 1200] [--show 5]
 */
import fs from 'fs'
import path from 'path'
import { docList, readCached } from './cache'

const CENSUS = path.join(__dirname, '../../../docs/census')

/** A £ figure as published. Keeps the sign, the unit and the original text. */
export interface Money { value: number | null; unit: string | null; raw: string }

/** ⚠ SIGN CONVENTION, ASSERTED HERE AND NOWHERE ELSE. In the EANDCB column a NEGATIVE number is a
 *  net BENEFIT to business. The parse preserves the published sign verbatim and never flips it; any
 *  reader that wants "cost" must negate deliberately. Getting this backwards makes every
 *  deregulatory measure read as a cost, which is trap 1 of the brief's three. */
export function parseMoney(raw: string): Money {
  const m = raw.match(/(-|−|\()?\s*£?\s*(-?[\d,]+(?:\.\d+)?)\s*(bn|billion|m|million|k|thousand)?\)?/i)
  if (!m) return { value: null, unit: null, raw }
  let v = Number(m[2].replace(/,/g, ''))
  if (!Number.isFinite(v)) return { value: null, unit: null, raw }
  const unit = (m[3] ?? '').toLowerCase()
  const scale = /^(bn|billion)$/.test(unit) ? 1_000 : /^(k|thousand)$/.test(unit) ? 0.001 : 1  // → £m
  // A leading "(" or "-" or a Unicode minus all mean negative. "(£5m)" is accounting negative.
  const neg = !!m[1] || /^\s*[-−]/.test(raw)
  v = Math.abs(v) * scale * (neg ? -1 : 1)
  return { value: v, unit: unit || 'm', raw: raw.trim() }
}

const NA = /^(n\/?a|not applicable|nil|none|optional|-|–|—|unknown|not known|tbc|choose an item)$/i

/** The ordered columns of the "Cost of Preferred Option" summary row. */
const SUMMARY_COLS = ['totalNpv', 'businessNpv', 'eandcb', 'oito', 'bitStatus'] as const

export interface Extract {
  ukia: string
  totalNpv: Money | null; businessNpv: Money | null; eandcb: Money | null
  oito: string | null; bitStatus: string | null
  priceBaseYear: number | null; priceBaseRaw: string | null
  eandcbPriceYear: number | null
  pvBaseYear: number | null; timePeriodYears: number | null
  transitionCost: Money | null; totalCostPv: Money | null; totalBenefitPv: Money | null
  rpcOpinion: string | null
  deMinimis: boolean
  nonMonetisedText: string | null
  /** Every value above, with the exact substring it was read from. */
  provenance: Record<string, string>
}

/** Pull the value ROW that follows the summary header BLOCK. */
function summaryRow(text: string): { cells: string[]; raw: string } | null {
  const anchor = text.search(/Business Impact Target\s*\n?\s*(?:\(BIT\)\s*)?Status/i)
  if (anchor < 0) return null
  const after = text.slice(anchor)
  const lines = after.split('\n').slice(1)
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    // The value row is the first non-empty line carrying a £ figure or an N/A in the first cell.
    if (!/£|\bN\/?A\b|Not applicable|Not known|Zero|nil/i.test(t)) continue
    // Split into cells: £-figures and N/A-ish tokens are cells; trailing prose is the BIT status.
    const cells = t.match(/-?£\s?[\d,]+(?:\.\d+)?\s*(?:bn|billion|m|million|k|thousand)?|\(£[\d,.]+\w*\)|N\/?A|Not applicable|Not known|Zero|Nil|Qualifying provision|Non[- ]qualifying provision|Not a regulatory provision|Not in scope|In scope/gi) ?? []
    if (cells.length >= 2) return { cells: cells.map(c => c.trim()), raw: t }
  }
  return null
}

function grab(text: string, re: RegExp): { v: string; raw: string } | null {
  const m = text.match(re)
  return m ? { v: (m[1] ?? '').trim(), raw: m[0].replace(/\s+/g, ' ').trim() } : null
}

export function extract(ukia: string, text: string): Extract {
  const prov: Record<string, string> = {}
  const e: Extract = {
    ukia, totalNpv: null, businessNpv: null, eandcb: null, oito: null, bitStatus: null,
    priceBaseYear: null, priceBaseRaw: null, eandcbPriceYear: null, pvBaseYear: null,
    timePeriodYears: null, transitionCost: null, totalCostPv: null, totalBenefitPv: null,
    rpcOpinion: null, deMinimis: false, nonMonetisedText: null, provenance: prov,
  }

  const row = summaryRow(text)
  if (row) {
    prov.summaryRow = row.raw
    row.cells.forEach((c, i) => {
      const col = SUMMARY_COLS[i]
      if (!col) return
      if (col === 'oito' || col === 'bitStatus') { (e as any)[col] = NA.test(c) ? null : c; prov[col] = c; return }
      if (NA.test(c)) { prov[col] = `${c} (declared not applicable — NOT zero)`; return }
      ;(e as any)[col] = parseMoney(c); prov[col] = c
    })
  }

  // Price base year. ⚠ TWO different ones exist in the same document — the PV base and the EANDCB
  // base — and measured over the corpus they DISAGREE in 88.4% of the documents that state both.
  const pb = grab(text, /Price Base\s*\n?\s*Year\s*:?\s*((?:19|20)\d\d)/i)
  if (pb) { e.priceBaseYear = Number(pb.v); e.priceBaseRaw = pb.raw; prov.priceBaseYear = pb.raw }
  const eb = grab(text, /EANDCB in ((?:19|20)\d\d) prices/i)
  if (eb) { e.eandcbPriceYear = Number(eb.v); prov.eandcbPriceYear = eb.raw }
  const pv = grab(text, /PV Base\s*\n?\s*Year\s*:?\s*((?:19|20)\d\d)/i)
  if (pv) { e.pvBaseYear = Number(pv.v); prov.pvBaseYear = pv.raw }
  const tp = grab(text, /Time Period\s*\n?\s*Years?\s*:?\s*(\d{1,3})/i)
  if (tp) { e.timePeriodYears = Number(tp.v); prov.timePeriodYears = tp.raw }

  const rpc = grab(text, /RPC Opinion\s*:?\s*([A-Za-z][A-Za-z \/-]{2,40})/i)
  if (rpc && !NA.test(rpc.v)) { e.rpcOpinion = rpc.v.replace(/\s+/g, ' ').trim(); prov.rpcOpinion = rpc.raw }
  else if (rpc) prov.rpcOpinion = `${rpc.raw} (declared not applicable — NOT missing)`

  e.deMinimis = /de\s?minimis/i.test(text)
  if (e.deMinimis) prov.deMinimis = (text.match(/.{0,60}de\s?minimis.{0,60}/i)?.[0] ?? '').replace(/\s+/g, ' ')

  // ⚠ HELD AS TEXT AND NEVER AS ZERO. "Not monetised" is not "no benefit".
  const nm = text.match(/Other key non[- ]monetised benefits[^\n]*\n([\s\S]{0,600}?)(?:\n\s*\n|Key assumptions)/i)
  if (nm) { e.nonMonetisedText = nm[1].replace(/\s+/g, ' ').trim(); prov.nonMonetisedText = e.nonMonetisedText.slice(0, 120) }

  return e
}

const pct = (a: number, b: number) => b ? `${(a / b * 100).toFixed(1)}%` : '—'

async function main() {
  const show = Number(process.argv[process.argv.indexOf('--show') + 1] ?? 6)
  const docs = await docList()
  const out: Extract[] = []
  for (const d of docs) {
    const t = readCached(d.url)
    if (t == null) continue
    out.push(extract(d.ukia, t))
  }

  // The honest denominator: a field can only be extracted from a document that HAS it. Every rate
  // below is "of the assessments where the marker is present at source", per the brief.
  const hasSummary = out.filter(o => o.provenance.summaryRow)
  const hasPB = out.filter(o => /price base/i.test(readCached(docs.find(d => d.ukia === o.ukia)!.url) ?? ''))

  console.log(`§1.2 FEASIBILITY PROBE — ${out.length} assessments\n`)
  console.log(`  summary value ROW located                ${hasSummary.length}/${out.length}  ${pct(hasSummary.length, out.length)}`)
  console.log(`\n  of those ${hasSummary.length}, a PARSED number for:`)
  for (const f of ['totalNpv', 'businessNpv', 'eandcb'] as const) {
    const got = hasSummary.filter(o => (o as any)[f]?.value != null).length
    const na = hasSummary.filter(o => !(o as any)[f] && /not applicable|N\/A/i.test(o.provenance[f] ?? '')).length
    console.log(`    ${f.padEnd(14)} ${String(got).padStart(5)} ${pct(got, hasSummary.length).padStart(7)}   declared N/A (not zero) ${na}`)
  }
  console.log(`\n  price base year        ${out.filter(o => o.priceBaseYear).length}/${out.length}  ${pct(out.filter(o => o.priceBaseYear).length, out.length)}`)
  console.log(`  EANDCB price year      ${out.filter(o => o.eandcbPriceYear).length}/${out.length}`)
  console.log(`  time period (years)    ${out.filter(o => o.timePeriodYears).length}/${out.length}`)
  console.log(`  RPC opinion (a verdict)${String(out.filter(o => o.rpcOpinion).length).padStart(6)}/${out.length}`)
  console.log(`  de minimis flagged     ${out.filter(o => o.deMinimis).length}/${out.length}`)
  console.log(`  non-monetised benefits ${out.filter(o => o.nonMonetisedText).length}/${out.length}  (held as TEXT)`)

  const signed = out.filter(o => o.eandcb?.value != null)
  const negative = signed.filter(o => o.eandcb!.value! < 0)
  console.log(`\n  ⚠ SIGN CONVENTION — a NEGATIVE EANDCB is a net BENEFIT to business`)
  console.log(`    EANDCB parsed          ${signed.length}`)
  console.log(`    negative (a benefit)   ${negative.length}  ${pct(negative.length, signed.length)}`)
  console.log(`    positive (a cost)      ${signed.length - negative.length}`)
  console.log(`    ⚠ both directions are present, so a sign bug would be INVISIBLE in a total and`)
  console.log(`      would invert ${negative.length} measures. §2 must assert this with a worked example each way.`)

  console.log(`\n  ── ${show} parsed rows, each with the text it was read from ──`)
  for (const o of out.filter(o => o.eandcb?.value != null).slice(0, show)) {
    console.log(`\n  ${o.ukia}`)
    console.log(`    EANDCB        ${o.eandcb!.value} (£${o.eandcb!.unit})   ← "${o.provenance.eandcb}"`)
    console.log(`    total NPV     ${o.totalNpv?.value ?? 'null'}          ← "${o.provenance.totalNpv ?? '—'}"`)
    console.log(`    price base    PV=${o.priceBaseYear ?? '—'} EANDCB=${o.eandcbPriceYear ?? '—'}`)
    console.log(`    RPC           ${o.rpcOpinion ?? 'null'}`)
    console.log(`    row read      "${(o.provenance.summaryRow ?? '').slice(0, 150)}"`)
  }

  fs.writeFileSync(path.join(CENSUS, 'IMPACT_4_probe.json'),
    JSON.stringify({ generated: new Date().toISOString(), n: out.length, rows: out }, null, 2))
  console.log(`\nwrote docs/census/IMPACT_4_probe.json`)
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
