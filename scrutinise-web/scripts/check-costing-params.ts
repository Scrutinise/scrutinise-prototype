// check:costing-params — 325 (7 Nov 2026). The STPR schedule against HM Treasury's own published answer key.
//
// The answer key is Annex A of "Discounting: Green Book supplementary guidance" (October 2026): a discount factor for
// every year 0–125, read from the PDF text by INGEST-CBA-1 on 4 Nov 2026 and committed in
// docs/ingest_traces/cba1_pilot_readback.txt. It is PARSED from that file, never retyped here, so the check cannot
// agree with the code by copying it. It is non-circular (HMT computed it, not us) and it determines the answer (one
// factor per year, to 4 dp).
//
// Controls (each must stay FALSE — they prove the comparison can fail):
//   C1 spot-rate misreading (para 3.9 forbids it): 2.50% in every year up to 40 must NOT match Annex A at year 40
//   C2 the old 3.5% headline must NOT match Annex A at year 10
//   C3 a factor after year 125 must NOT be produced (para 3.10)
import fs from 'fs'
import path from 'path'
import {
  STPR_DISCOUNT_RATE, STPR_SCHEDULE, STPR_LAST_YEAR, discountFactor, stprRateForYear,
  HEALTH_DISCOUNT_RATE, HEALTH_VALUE_UPRATE,
} from '../lib/lex/costing-params'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) pass++; else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// ── the answer key ──────────────────────────────────────────────────────────────────────────────────────────────
const file = path.join(__dirname, '../../docs/ingest_traces/cba1_pilot_readback.txt')
const text = fs.readFileSync(file, 'utf8')
const start = text.indexOf('[Green Book discounting 3.13]')
const end = text.indexOf('HM Treasury contacts', start)
if (start < 0 || end < 0) throw new Error('Annex A not found in the read-back — the answer key is missing, so nothing can be checked')
const annex = new Map<number, { rate: number | null; factor: number }>()
const cell = /(\d{1,3}) (–|\d\.\d\d%) (\d\.\d{4})/g
for (const line of text.slice(start, end).split('\n')) {
  for (const m of line.matchAll(cell)) {
    annex.set(Number(m[1]), { rate: m[2] === '–' ? null : Number(m[2].replace('%', '')) / 100, factor: Number(m[3]) })
  }
}
ok('answer key: Annex A parsed for every year 0–125', annex.size === 126 && [...Array(126).keys()].every((y) => annex.has(y)), `${annex.size} years`)

// ── the schedule against the key ────────────────────────────────────────────────────────────────────────────────
let rateMiss = 0, factorMiss = 0, worst = 0
const misses: string[] = []
for (const [y, row] of annex) {
  const r = y === 0 ? null : stprRateForYear(y)
  if (r !== row.rate) { rateMiss++; misses.push(`y${y} rate ${r} vs ${row.rate}`) }
  const f = discountFactor(y)
  const rounded = f === null ? null : Math.round(f * 10_000) / 10_000
  if (rounded !== row.factor) { factorMiss++; misses.push(`y${y} factor ${rounded} vs ${row.factor}`) }
  if (f !== null) worst = Math.max(worst, Math.abs(f - row.factor))
}
ok('every year\'s forward rate equals Annex A (126 years)', rateMiss === 0, misses.filter((m) => m.includes('rate')).slice(0, 5).join('; '))
ok('every year\'s discount factor equals Annex A to 4 dp (126 years)', factorMiss === 0, `worst |Δ| ${worst.toExponential(2)}${factorMiss ? '; ' + misses.filter((m) => m.includes('factor')).slice(0, 5).join('; ') : ''}`)

// ── the paragraphs themselves ───────────────────────────────────────────────────────────────────────────────────
ok('headline STPR is 3.00% (GB discounting 2.1)', STPR_DISCOUNT_RATE.value === 0.03 && /3\.00% in real terms for the first 30 years/.test(text.replace(/\s+/g, ' ')))
ok('schedule bands are 1–30 / 31–75 / 76–125 (GB discounting 3.8)', JSON.stringify(STPR_SCHEDULE.value.map((b) => [b.fromYear, b.toYear])) === '[[1,30],[31,75],[76,125]]')
ok('health uprate 2% p.a. is in the Green Book text (8.58)', HEALTH_VALUE_UPRATE.value === 0.02 && /health effects should be uprated by 2% per annum/.test(text.replace(/\s+/g, ' ')))
ok('the February health discount rate cannot drive a figure', HEALTH_DISCOUNT_RATE.status === 'SUPERSEDED' && HEALTH_DISCOUNT_RATE.verified === false)
ok('no factor after year 125, none for a fractional or negative year', discountFactor(STPR_LAST_YEAR + 1) === null && discountFactor(2.5) === null && discountFactor(-1) === null)

// ── controls: each must be FALSE ────────────────────────────────────────────────────────────────────────────────
const spot40 = Math.round((1 / Math.pow(1.025, 40)) * 10_000) / 10_000
const old10 = Math.round((1 / Math.pow(1.035, 10)) * 10_000) / 10_000
const controls: Array<[string, boolean]> = [
  ['C1 spot 2.50% to year 40 matches Annex A', spot40 === annex.get(40)?.factor],
  ['C2 old 3.5% matches Annex A at year 10', old10 === annex.get(10)?.factor],
  ['C3 a factor is produced for year 126', discountFactor(126) !== null],
]
for (const [name, v] of controls) ok(`control stays false: ${name}`, v === false, `spot40=${spot40} old10=${old10} key40=${annex.get(40)?.factor} key10=${annex.get(10)?.factor}`)

console.log(`\ncheck:costing-params — ${pass} passed, ${fail} failed, ${pass + fail} run`)
process.exit(fail ? 1 : 0)
