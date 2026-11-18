// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26y — LEX 26-Y (BRIEF_26Y §8; decisions 334–341). Counts what RAN (§23.2): ran, passed, controls fired, dead, not run.
// Spends NOTHING: the narrative is a stubbed call here (its real price is scripts/measure-26y.ts's).
//
//   1 · benefit lines: CRUD through the route's writers, parity (Lex's path = the form's), a FieldRevision per save, the "not valued" rule
//   2 · the costing companion on a scratch action with staffing, systems and a capital line: the floor label, the uplift only when set,
//       Table 1 named, the Gaps non-empty
//   3 · the engine's arithmetic (§4c) to the penny against Annex A's published factors (parsed from the committed read-back, never retyped);
//       deflator round trip; past year 125 refused; a no-source benefit never in a total; a suppressed/absent salary never a zero; the
//       sensitivity rows; trace coverage (every printed figure has a trace)
//   4 · the manifest: an unmanifested citation refused with nearest keys; a held key passes; every key the engine prints is held
//   5 · the report: generate, versions, "stale: N lines changed since" after a line changes, Word/PDF text match
//   6 · Deepening section 5's states (locked / open; valued / not valued), RENDERED
//   7 · Lex: a cost question answered from the trace; an invented figure caught by the honesty rule (fixture)
//   8 · regression is run separately, one suite at a time (CHANGE_LOG lists them)
//
//   npm run check:lex-26y
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import * as E from '../lib/lex/cba/engine-pure'
import * as PER from '../lib/lex/cba/period'
import * as LA from '../lib/lex/cba/line-appraisal'
import * as CM from '../lib/lex/cba/citation-manifest-pure'
import * as BL from '../lib/lex/cba/benefit-lines-pure'
import * as CP from '../lib/lex/costing-params'
import { buildCbaReport } from '../lib/documents/build-cba-report'
import { runsToText } from '../lib/documents/model'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { prisma } from '../lib/prisma'
import { r2Exists } from '../lib/r2'
import { renderDocx } from '../lib/documents/render-docx'
import { renderPdf } from '../lib/documents/render-pdf'
import { execute, toolByName } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'
import { checkReply, figuresInData, sumsIn, type ToolOutcome } from '../lib/lex/agent/honesty'
import { draftCostingCompanion } from '../lib/lex/cba/costing-companion'
import { writeNarrative as realWriteNarrative, type writeNarrative } from '../lib/lex/cba/narrative'
import { runCba } from '../lib/lex/cba/engine'
import { loadManifest, resolveCitations } from '../lib/lex/cba/citation-manifest'
import { cbaReportStatus, generateCbaReport } from '../lib/lex/cba/report'
import { cbaSummary } from '../lib/lex/cba/summary-pure'
import { recordFigures } from '../lib/lex/cba/record-figures'
import { NARRATIVE_PRICE } from '../lib/lex/cba/prices'
import { developmentState } from '../lib/lex/development'
import * as DD from '../lib/lex/document-drafting'
import * as SL from '../lib/lex/screen-labels'
import { guideEntries, normLabel } from '../lib/lex/field-guide'
import DeepeningCostsBenefits, { staleWords, type CbaRead } from '../components/lex/DeepeningCostsBenefits'
import ActionCbaLines from '../components/lex/ActionCbaLines'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const penny = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100)

// ── the answer key: Annex A, parsed from the committed read-back (as check:costing-params) ──
const readback = fs.readFileSync(path.join(__dirname, '../../docs/ingest_traces/cba1_pilot_readback.txt'), 'utf8')
const annexStart = readback.indexOf('[Green Book discounting 3.13]'), annexEnd = readback.indexOf('HM Treasury contacts', annexStart)
const ANNEX = new Map<number, number>()
for (const line of readback.slice(annexStart, annexEnd).split('\n')) for (const m of line.matchAll(/(\d{1,3}) (–|\d\.\d\d%) (\d\.\d{4})/g)) ANNEX.set(Number(m[1]), Number(m[3]))

// ── fixtures ──
const PERIOD = (years = 12, startYear = 2025, priceYear = 2025): PER.AppraisalPeriod => ({ years, startYear, priceYear, set: { years: true, startYear: false, priceYear: false } })
const DEFLATOR = [{ year: 2020, index: 90 }, { year: 2025, index: 100 }]
const NOAPP: LA.LineAppraisal = { payer: null, onCost: null, ob: null }
const cost = (id: string, o: Partial<E.EngineCostLine>): E.EngineCostLine => ({ id, actionId: 'a1', actionNumber: 1, actionTitle: 'One', headingId: 'h1', label: id, costType: 'OTHER', category: 'IMPLEMENTATION', low: null, high: null, priceYear: 2025, recurrence: null, durationMonths: null, basis: null, citationKey: null, benchmarkId: null, appraisal: NOAPP, ...o })
const ben = (id: string, o: Partial<E.EngineBenefitLine>): E.EngineBenefitLine => ({ id, actionId: 'a1', actionNumber: 1, actionTitle: 'One', headingId: 'h1', label: id, beneficiary: 'CITIZENS', beneficiaryName: null, measure: null, low: null, high: null, priceYear: 2025, recurrence: null, durationMonths: null, isHealth: false, valuation: 'VALUED', notValuedWhy: null, sourceWords: '[Ref: 3]', ownerEstimate: false, ...o })
const HELD = { civilServiceStatistics: false, deflatorReleaseDates: false, manifest: 'held-rows' as const }
const input = (costs: E.EngineCostLine[], benefits: E.EngineBenefitLine[], period = PERIOD()): E.EngineInput => ({ period, deflator: DEFLATOR, costs, benefits, headings: [{ id: 'h1', name: 'Heading one' }], held: HELD, uncostedActions: 0 })
type Ok = Extract<E.CbaResult, { ok: true }>
const must = (r: E.CbaResult): Ok => { if (!r.ok) throw new Error(`engine refused: ${(r as { error: string }).error}`); return r as Ok }

// The six lines of §4c, over 12 years.
const SIX = () => input([
  cost('capital', { costType: 'CAPITAL', low: 120000, high: 120000, recurrence: 'ONE_OFF', appraisal: { ...NOAPP, payer: { kind: 'EXCHEQUER', name: null }, ob: { type: 'standard-buildings', lowered: null } } }),
  cost('staff', { costType: 'STAFF', low: 50000, high: 50000, recurrence: 'PER_YEAR', appraisal: { ...NOAPP, payer: { kind: 'DEPARTMENT', name: 'Cabinet Office' }, onCost: { rate: 0.3, source: 'owner’s figure', by: 'OWNER', status: 'ACCEPTED' } } }),
  cost('systems', { costType: 'OTHER', low: 20000, high: 20000, priceYear: 2020, recurrence: 'PER_YEAR', durationMonths: 30 }),
], [
  ben('faster', { low: 80000, high: 80000, recurrence: 'PER_YEAR', durationMonths: 120 }),
  ben('health', { low: 10000, high: 10000, recurrence: 'PER_YEAR', isHealth: true, sourceWords: 'green-book:8.58' }),
  ben('unsourced', { low: 999999, high: 999999, recurrence: 'PER_YEAR', sourceWords: null, valuation: 'NOT_VALUED', notValuedWhy: 'a figure was given with no source, so it is not counted' }),
])

function part3() {
  section('3 · the engine — arithmetic to the penny, the rules, sensitivity, trace')
  ok('answer key: Annex A parsed for every year 0–125 from the committed read-back', ANNEX.size === 126, `${ANNEX.size} years`)
  ok('the engine uses Annex A’s published factor for every year 0–125', [...ANNEX].every(([y, f]) => E.factorAt(y) === f))
  // HAND computation, from the published factors and the stated rules — not the engine
  const f = (t: number) => ANNEX.get(t)!
  const hc = 120000 * f(0) + [...Array(12).keys()].reduce((s, t) => s + 65000 * f(t), 0) + (20000 * 100 / 90) * (f(0) + f(1) + 0.5 * f(2))
  const hb = [...Array(10).keys()].reduce((s, t) => s + 80000 * f(t), 0) + [...Array(12).keys()].reduce((s, t) => s + 10000 * Math.pow(1.02, t) * f(t), 0)
  const r = must(E.computeCba(SIX()))
  ok(`PV costs equal the hand computation to the penny (${hc.toFixed(2)})`, penny(r.totals.pvCosts.low, hc) && penny(r.totals.pvCosts.high, hc), `engine ${r.totals.pvCosts.low.toFixed(2)}`)
  ok(`PV benefits equal the hand computation to the penny (${hb.toFixed(2)})`, penny(r.totals.pvBenefits.low, hb), `engine ${r.totals.pvBenefits.low.toFixed(2)}`)
  ok(`NPV equals the hand computation to the penny (${(hb - hc).toFixed(2)})`, !!r.npv && penny(r.npv.low, hb - hc) && penny(r.npv.high, hb - hc), `engine ${r.npv?.low.toFixed(2)}`)
  ok('BCR = PV benefits / PV costs', !!r.bcr && Math.abs(r.bcr.low - hb / hc) < 1e-9)
  control('the unsourced £999,999 benefit would change the NPV if it were let in (the property the rule protects)', penny(hb - hc, hb + [...Array(12).keys()].reduce((s, t) => s + 999999 * f(t), 0) - hc))
  ok('a benefit with no source never enters a total: excluded, and named in Gaps as not valued', r.lines.find((l) => l.id === 'unsourced')?.included === false && r.gaps.some((g) => g.kind === 'not-valued' && g.lineIds.includes('unsourced')))
  const marked = must(E.computeCba({ ...SIX(), benefits: SIX().benefits.map((b) => (b.id === 'unsourced' ? { ...b, valuation: 'VALUED' as const } : b)) }))
  ok('…even when its valuation says VALUED: no source, no total', penny(marked.totals.pvBenefits.low, hb))
  // deflator round trip
  const there = must(E.computeCba(input([cost('x', { low: 1000, high: 1000, priceYear: 2020, recurrence: 'ONE_OFF' })], [], PERIOD(1, 2025, 2025))))
  const back = must(E.computeCba({ ...input([cost('x', { low: there.totals.costs.low, high: there.totals.costs.low, priceYear: 2025, recurrence: 'ONE_OFF' })], [], PERIOD(1, 2025, 2025)), period: PERIOD(1, 2020, 2020) }))
  ok('deflator conversion round-trips: £1,000 in 2020-21 → 2025-26 prices → back to 2020-21 is £1,000', penny(back.totals.costs.low, 1000) && penny(there.totals.costs.low, 1000 * 100 / 90), `${there.totals.costs.low} → ${back.totals.costs.low}`)
  const noIdx = must(E.computeCba(input([cost('y', { low: 1000, high: 1000, priceYear: 2011, recurrence: 'ONE_OFF' })], [], PERIOD(1))))
  ok('a year the deflator does not hold is summed AS ENTERED and named in Gaps, never guessed', penny(noIdx.totals.costs.low, 1000) && noIdx.gaps.some((g) => g.kind === 'not-converted' && /2011-12/.test(g.text)))
  // past year 125
  const far = E.computeCba(input([cost('z', { low: 1, high: 1, recurrence: 'PER_YEAR' })], [], { years: 60, startYear: 2025 + 70, priceYear: 2025, set: { years: true, startYear: true, priceYear: false } }))
  ok('a period reaching past year 125 is refused, in words naming the paragraph, and nothing is computed', !far.ok && /125/.test((far as { error: string }).error) && /gb-discounting:3\.10/.test((far as { error: string }).error))
  ok('…and the settings refuse it first (periodRefusal, the same rule)', /125/.test(PER.periodRefusal({ years: 60, startYear: 2095, priceYear: 2025 }) ?? ''))
  ok('a start year before the price year is refused (no retrospective discounting)', !E.computeCba(input([], [], { ...PERIOD(), startYear: 2020 })).ok)
  ok('period.ts restates the schedule’s last year and Table 1’s capital types; they agree with costing-params (outsourcing is opex, not a capital type)', PER.SCHEDULE_LAST_YEAR === CP.STPR_LAST_YEAR && JSON.stringify([...LA.OB_TYPES].sort()) === JSON.stringify(Object.keys(CP.OPTIMISM_BIAS_TABLE_1.value).filter((k) => k !== 'outsourcing').sort()))
  // 340 — staffing: no on-cost, no Civil Service Statistics → never a zero, always a floor
  const staffBare = must(E.computeCba(input([cost('s', { costType: 'STAFF', low: 40000, high: 40000, recurrence: 'ONE_OFF' })], [], PERIOD(1))))
  ok('a staffing line with no on-cost keeps its figure (never zero) and reads "excludes employer costs" — a floor in Gaps', penny(staffBare.totals.costs.low, 40000) && staffBare.lines[0].steps.some((s) => /excludes employer costs/.test(s)) && staffBare.gaps.some((g) => g.kind === 'excludes-employer-costs'))
  ok('Civil Service Statistics not held → said in Gaps; the line is not zeroed', staffBare.gaps.some((g) => g.kind === 'not-held' && /Civil Service Statistics/.test(g.text)))
  const staffNoFig = must(E.computeCba(input([cost('s0', { costType: 'STAFF', recurrence: 'ONE_OFF' })], [], PERIOD(1))))
  ok('a staffing line with no figure (a suppressed or absent salary) is "no figure" in Gaps — never £0 counted as a cost', staffNoFig.gaps.some((g) => g.kind === 'no-figure') && staffNoFig.lines[0].included === false && staffNoFig.trace['line:s0'].value === 'no figure')
  const proposedOc = must(E.computeCba(input([cost('s2', { costType: 'STAFF', low: 40000, high: 40000, recurrence: 'ONE_OFF', appraisal: { ...NOAPP, onCost: { rate: 0.3, source: '[Ref: 1]', by: 'LEX', status: 'PROPOSED' } } })], [], PERIOD(1))))
  ok('Lex’s PROPOSED on-cost is not applied until accepted, and the wait is in Gaps', penny(proposedOc.totals.costs.low, 40000) && proposedOc.gaps.some((g) => g.kind === 'on-cost-waiting'))
  // 342 — optimism bias: a BAND beside the headline, never in it
  const ob = r.optimismBias
  ok('342: the headline carries NO optimism bias (PV costs above are the hand computation without any uplift)', penny(r.totals.pvCosts.low, hc))
  ok('the capital line is banded by its type, Table 1’s lower to upper bound (2%–24%, standard buildings), named per line', ob.some((o) => o.lineId === 'capital' && o.kind === 'capital' && o.band?.lower === 0.02 && o.band?.upper === 0.24 && /standard buildings/.test(o.why)))
  ok('a running-cost line is banded by the outsourcing row (0–41%), labelled the nearest analogue, not a rule', ob.filter((o) => o.lineId !== 'capital').every((o) => o.kind === 'opex-analogue' && o.band?.lower === 0 && o.band?.upper === 0.41 && o.why === E.OPEX_OB_WHY && /nearest analogue in the guidance, not a rule/.test(o.why)))
  const opexPv = (rate: number) => [...Array(12).keys()].reduce((a, t) => a + 65000 * rate * f(t), 0) + (20000 * 100 / 90) * rate * (f(0) + f(1) + 0.5 * f(2))
  const bandLow = hb - (hc + 120000 * 0.24 * f(0) + opexPv(0.41)), bandHigh = hb - (hc + 120000 * 0.02 * f(0) + opexPv(0))
  ok(`the band equals the hand computation to the penny: NPV between ${bandLow.toFixed(2)} and ${bandHigh.toFixed(2)}`, !!r.obBand?.npv && penny(r.obBand.npv.low, bandLow) && penny(r.obBand.npv.high, bandHigh), `engine ${r.obBand?.npv?.low.toFixed(2)} to ${r.obBand?.npv?.high.toFixed(2)}`)
  ok('…and its words are CCh’s sentence: "With optimism bias at HM Treasury’s indicative starting values, the NPV would be between £X and £Y"', /^With optimism bias at HM Treasury’s indicative starting values, the NPV would be between −?£[\d,]+ and −?£[\d,]+$/.test(E.obBandWords(r.obBand!)))
  ok('the guidance’s own caveat is quoted verbatim from the read-back (not a paraphrase)', readback.replace(/\s+/g, ' ').includes(E.OB_INDICATIVE))
  const lowered = must(E.computeCba(input([cost('c2', { costType: 'CAPITAL', low: 1000, high: 1000, recurrence: 'ONE_OFF', appraisal: { ...NOAPP, ob: { type: 'standard-buildings', lowered: { rate: 0.1, reason: 'design fixed and contract let' } } } })], [], PERIOD(1))))
  ok('the owner may lower the rate with a reason: it changes the BAND (2%–10%), never the headline (£1,000), and it is the owner’s assumption in Gaps', penny(lowered.totals.costs.low, 1000) && lowered.optimismBias[0].band?.upper === 0.1 && penny(lowered.obBand!.pvCosts.high, 1100) && lowered.optimismBias[0].why.includes('design fixed') && lowered.gaps.some((g) => g.kind === 'owners'))
  const untyped = must(E.computeCba(input([cost('c3', { costType: 'CAPITAL', low: 1000, high: 1000, recurrence: 'ONE_OFF' })], [], PERIOD(1))))
  ok('a capital line with no project type is in no band, and Gaps says so', penny(untyped.totals.costs.low, 1000) && untyped.optimismBias[0].band === null && untyped.obBand === null && untyped.gaps.some((g) => g.kind === 'ob-type'))
  // 343 — Table 1, both bounds, row by row against the PDF text
  const t1 = readback.slice(readback.indexOf('Table 1: Recommended Adjustment Ranges'), readback.indexOf('* The optimism bias for outsourcing'))
  const rowOf = (name: string) => { const m = new RegExp(`${name.replace(/ /g, '\\s+')}\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)`).exec(t1.replace(/\s+/g, ' ')); return m ? m.slice(1).map((x) => x.replace('*', '')) : null }
  const ROWS: Array<[string, keyof typeof CP.OPTIMISM_BIAS_TABLE_1.value]> = [['Standard Buildings', 'standard-buildings'], ['Non-standard Buildings', 'non-standard-buildings'], ['Standard Civil Engineering', 'standard-civil'], ['Non-standard Civil Engineering', 'non-standard-civil'], ['Equipment/Development', 'equipment-and-development'], ['Outsourcing', 'outsourcing']]
  const pc = (x: string) => (x === 'N/A' ? null : Number(x) / 100)
  const mism = ROWS.filter(([name, key]) => {
    const r0 = rowOf(name); const h = CP.OPTIMISM_BIAS_TABLE_1.value[key]
    if (!r0) return true
    const [wu, wl, cu, cl] = r0.map(pc)
    const money = h.capex ?? h.opex!
    return money.upper !== cu || money.lower !== cl || (h.works ? h.works.upper !== wu || h.works.lower !== wl : wu !== null || wl !== null)
  }).map(([n]) => n)
  ok('343: Table 1 is held with BOTH bounds, and every row equals the read-back of the PDF, all four columns (6 rows)', mism.length === 0, mism.join(', '))
  ok('…outsourcing is held as OPERATING expenditure, as Table 1’s own footnote says', !!CP.OPTIMISM_BIAS_TABLE_1.value.outsourcing.opex && !CP.OPTIMISM_BIAS_TABLE_1.value.outsourcing.capex && /measured for operating expenditure/.test(readback))
  control('a Table 1 row that disagreed with the read-back would be caught', (() => { const r0 = rowOf('Standard Buildings'); return !!r0 && pc(r0[2]) === 0.25 })())
  // the price year's default: the latest deflator year (CCh GO 18 Nov)
  const dp = PER.resolvePeriod({ appraisalYears: null, appraisalStartYear: null, cbaPriceYear: null }, new Date('2026-11-18T12:00:00Z'), 2025)
  ok('the price year defaults to the latest year the deflator holds, said as such: "Price year 2025-26 (latest deflator release held)"', dp.priceYear === 2025 && dp.startYear === 2025 && PER.priceYearWords(dp) === 'Price year 2025-26 (latest deflator release held)')
  ok('…with no series held it falls back to the current financial year, and says that', PER.resolvePeriod({ appraisalYears: null, appraisalStartYear: null, cbaPriceYear: null }, new Date('2026-11-18T12:00:00Z'), null).priceYear === 2026)
  // not valued → no BCR, never a zero
  const nv = must(E.computeCba(input([cost('k', { low: 5000, high: 5000, recurrence: 'ONE_OFF' })], [ben('n', { valuation: 'NOT_VALUED', sourceWords: null, notValuedWhy: 'no source measures it yet' })], PERIOD(3))))
  ok('no valued benefit → NPV and BCR are NULL, printed "benefits not valued — no BCR", never 0', nv.npv === null && nv.bcr === null && nv.trace.bcr.value === E.NOT_VALUED_WORDS && !/£0\b|0\.00/.test(nv.trace.bcr.value))
  ok('…and Gaps says so', nv.gaps.some((g) => g.kind === 'no-benefit-valued'))
  // undated / no duration
  const und = must(E.computeCba(input([cost('u', { low: 700, high: 700 }), cost('p', { low: 10, high: 10, recurrence: 'PER_YEAR' })], [], PERIOD(4))))
  ok('a line with no recurrence is counted, placed in no year, not discounted', und.undated.lines === 1 && penny(und.undated.costs.low, 700) && penny(und.totals.costs.low, 40) && und.gaps.some((g) => g.kind === 'undated'))
  ok('a per-year line with no duration runs the whole period, and Gaps names it', und.gaps.some((g) => g.kind === 'no-duration' && g.lineIds.includes('p')))
  // health
  const h = must(E.computeCba(input([], [ben('hh', { low: 100, high: 100, recurrence: 'PER_YEAR', isHealth: true })], PERIOD(3))))
  ok('a health benefit is uprated 2% a year and discounted at the same schedule (338: no separate rate)', penny(h.totals.pvBenefits.low, 100 * f(0) + 102 * f(1) + 104.04 * f(2)))
  // sensitivity
  const s = Object.fromEntries(r.sensitivity.map((x) => [x.key, x]))
  ok('sensitivity is five ROWS: costs +20%, valued benefits −50%, a year’s delay, the schedule ±0.5 points', r.sensitivity.length === 5 && ['costs+20', 'benefits-50', 'delay-1', 'rate+0.5', 'rate-0.5'].every((k) => !!s[k]))
  ok('costs +20%: PV costs × 1.2, benefits unchanged', penny(s['costs+20'].pvCosts.low, hc * 1.2) && penny(s['costs+20'].pvBenefits.low, hb))
  ok('valued benefits −50%: PV benefits × 0.5 (the not-valued line still absent)', penny(s['benefits-50'].pvBenefits.low, hb * 0.5))
  const hcDelay = 120000 * f(1) + [...Array(11).keys()].reduce((a, t) => a + 65000 * f(t + 1), 0) + (20000 * 100 / 90) * (f(1) + f(2) + 0.5 * f(3))
  ok('a year’s delay: every flow one year later; the last year’s flow falls out and the row says so', penny(s['delay-1'].pvCosts.low, hcDelay) && /fall out/.test(s['delay-1'].note ?? '') && penny(s['delay-1'].lost?.costs.low ?? 0, 65000) && !!r.trace['sens:delay-1.lost'])
  ok('a higher schedule lowers both PVs; a lower one raises them', s['rate+0.5'].pvCosts.low < r.totals.pvCosts.low && s['rate-0.5'].pvCosts.low > r.totals.pvCosts.low)
  // trace coverage — on the RENDERED report text
  const built = buildCbaReport(r, { costs: 'The costs are staff and a building.', benefits: 'Faster decisions for citizens.', pence: 1, cut: 0, model: 'stub' }, { ideaTitle: 'Fixture', version: 1, heldOn: '2026-11-14', generatedAt: new Date('2026-11-18T12:00:00Z'), narrativeNote: null })
  const text = built.model.blocks.map((b) => b.kind === 'paragraph' || b.kind === 'heading' ? runsToText(b.runs) : b.kind === 'bullets' ? b.items.map(runsToText).join('\n') : b.kind === 'table' ? [...b.header, ...b.rows.flat()].map(runsToText).join(' | ') : b.kind === 'note' ? b.text : b.kind === 'section' ? b.title : '').join('\n')
  const money = [...text.matchAll(/−?£[\d,]+(?: to −?£[\d,]+)?/g)].length
  const marks = new Set([...text.matchAll(/\[T(\d+)\]/g)].map((m) => m[1]))
  const annexText = text.slice(text.indexOf('ANNEX — THE TRACE'))
  ok('every [T n] mark in the report is listed in the annex with what it comes from', [...marks].every((m) => new RegExp(`(^|\\| )T${m} \\|`, 'm').test(annexText)) && marks.size === built.printed.length, `${marks.size} marks, ${built.printed.length} printed`)
  const body = text.slice(0, text.indexOf('ANNEX — THE TRACE'))
  const untagged = body.split('\n').flatMap((l) => l.split(' | ')).filter((c) => /£\d/.test(c) && !/\[T\d+\]/.test(c) && !/^(Version|.* — Cost–benefit)/.test(c))
  ok(`every sum of money printed before the annex carries a trace mark (${money} sums)`, untagged.length === 0, untagged.slice(0, 3).join(' ‖ '))
  ok('Gaps come BEFORE the first table of figures (341)', text.indexOf('GAPS') < text.indexOf('COSTS AND BENEFITS BY YEAR') && text.indexOf('GAPS') > 0)
  ok('the caveat is printed, with the date the guidance was held', text.includes(E.CAVEAT('2026-11-14')))
  let threw = false
  try { buildCbaReport({ ...r, trace: { ...r.trace, npv: undefined as never } }, null, { ideaTitle: 'x', version: 1, heldOn: 'x', generatedAt: new Date(), narrativeNote: null }) } catch { threw = true }
  ok('a figure with no trace cannot be printed: the builder throws', threw)
  ok('the report’s Gaps are non-empty (an empty Gaps section would be improbable, 341)', r.gaps.length > 0)
}

function part4pure() {
  section('4 · the manifest (pure) — refusal with nearest keys; a held key passes')
  const rows: CM.HeldRow[] = [
    { id: 's1', parentDocId: CM.MANIFEST_DOCS[0].docId, sectionTitle: 'The Green Book (2026) › Chapter 6 › Discounting › 6.58', sourceUrl: null },
    { id: 's2', parentDocId: CM.MANIFEST_DOCS[0].docId, sectionTitle: 'The Green Book (2026) › Chapter 6 › Discounting › 6.57', sourceUrl: null },
    { id: 's3', parentDocId: CM.MANIFEST_DOCS[1].docId, sectionTitle: 'Green Book supplementary guidance: discounting (2026) › Chapter 3 › 3.8', sourceUrl: null },
    { id: 's4', parentDocId: CM.MANIFEST_DOCS[0].docId, sectionTitle: 'The Green Book (2026) › Table: Table 1. The appraisal process', sourceUrl: null },
    { id: 's5', parentDocId: CM.MANIFEST_DOCS[0].docId, sectionTitle: 'The Green Book (2026) › Front matter', sourceUrl: null },
  ]
  const m = CM.manifestFromRows(rows)
  ok('keys are derived from held rows: paragraphs and tables, not front matter', m.entries.has('green-book:6.58') && m.entries.has('gb-discounting:3.8') && m.entries.has('green-book:table-1') && m.entries.size === 4)
  ok('a held key passes, however it is typed ("Green Book 6.58", "green-book:6.58", "green-book §6.58")', ['Green Book 6.58', 'green-book:6.58', 'green-book §6.58', 'the green book para 6.58'].every((k) => CM.checkCitation(k, m).ok))
  const bad = CM.checkCitation('green-book:6.59', m)
  ok('an unheld paragraph is refused in words, with the nearest held keys (same document first)', !bad.ok && /not a paragraph the platform holds/.test((bad as { error: string }).error) && (bad as { nearest: string[] }).nearest[0] === 'green-book:6.58')
  ok('a free-hand citation that is not a key at all is refused', !CM.checkCitation('Green Book chapter six', m).ok)
  ok('a document the manifest does not cover is refused, naming what it covers', /does not cover/.test((CM.checkCitation('magenta-book:1.1', m) as { error: string }).error ?? ''))
  control('the refusal would pass if every key were let in', CM.checkCitation('green-book:6.59', { ...m, entries: new Map([...m.entries, ['green-book:6.59', m.entries.get('green-book:6.58')!]]) }).ok === false)
}

function part1pure() {
  section('1 · benefit lines (pure) — the "not valued" rule and worded refusals')
  const a = BL.normaliseBenefit({ label: 'Faster decisions', beneficiary: 'CITIZENS', low: 100, high: 200, recurrence: 'PER_YEAR' })
  ok('a figure with NO source is kept but stored NOT_VALUED, with the reason said', a.ok && (a as { row: BL.BenefitRow }).row.valuation === 'NOT_VALUED' && /no source/.test((a as { row: BL.BenefitRow }).row.notValuedWhy ?? '') && (a as { row: BL.BenefitRow }).row.low === 100)
  const b = BL.normaliseBenefit({ label: 'Faster decisions', beneficiary: 'CITIZENS', low: 100, high: 200, recurrence: 'PER_YEAR', sourceKind: 'OWNER', ownerReason: 'two days saved per case, my count' })
  ok('the owner’s estimate with a reason is a source: VALUED', b.ok && (b as { row: BL.BenefitRow }).row.valuation === 'VALUED')
  ok('no figure and no reason → refused in words', !BL.normaliseBenefit({ label: 'Trust', beneficiary: 'CITIZENS' }).ok)
  ok('no figure with a reason → NOT_VALUED', (BL.normaliseBenefit({ label: 'Trust', beneficiary: 'CITIZENS', notValuedWhy: 'no source measures trust yet' }) as { row: BL.BenefitRow }).row?.valuation === 'NOT_VALUED')
  const long = BL.normaliseBenefit({ label: 'x'.repeat(301), beneficiary: 'CITIZENS', notValuedWhy: 'n/a' })
  ok('an over-long field is refused naming the field and the limit (never cut)', !long.ok && /what is gained is 301 characters; the limit is 300/.test((long as { error: string }).error))
  ok('high below low is refused', !BL.normaliseBenefit({ label: 'abc', beneficiary: 'CITIZENS', low: 5, high: 1, sourceKind: 'OWNER', ownerReason: 'xyz' }).ok)
}

// ── the database half: a scratch copy of 452c5ade, the real routes and writers, the narrative STUBBED (no spend) ──
const SOURCE = '452c5ade'
const ctxFor = (ideaId: string, userId: string, userMessages: string[]): ToolCtx => ({
  ideaId, userId, confirmed: true, agreedPence: null,
  turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages, pastedText: null },
})
// The stub replaces the MODEL CALL only, so the real writeNarrative — and its guard — runs on the answer (a sum and an unheld [Ref] in it).
const stubCall = (async () => ({ ok: true, value: { costs: 'The costs fall on the staff and a room. They cost £1,234,567 in all.', benefits: 'Citizens gain faster decisions, valued from [Ref: 9999]. Trust is not valued.' }, usage: { model: 'stub', tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } } })) as never
const stubNarrative: typeof writeNarrative = (input, result, ctx) => realWriteNarrative(input, result, { ...ctx, call: stubCall })
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ')
async function docxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml')!.async('string')
  return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
async function pdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try { return (await parser.getText()).text } finally { await parser.destroy() }
}
const squash = (s: string) => s.replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim()

async function partDb() {
  const scratch = await scratchCopy(SOURCE, '26y-cba')
  try {
    const user = await prisma.user.findUnique({ where: { id: scratch.userId } })
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = user
    const params = { params: Promise.resolve({ id: scratch.id }) }
    const { POST: benefitPOST, GET: benefitGET } = await import('../app/api/ideas/[id]/benefit-lines/route')
    const { POST: costPOST } = await import('../app/api/ideas/[id]/cost-lines/route')
    const { PATCH: apprPATCH } = await import('../app/api/ideas/[id]/appraisal/route')
    const call = async (fn: (r: Request, p: typeof params) => Promise<Response>, body: unknown, method = 'POST') => { const r = await fn(new Request('http://x', { method, body: JSON.stringify(body) }), params); return { status: r.status, json: await r.json() as Record<string, unknown> & { error?: string } } }
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: scratch.id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, number: true } })
    const A = live[0], B = live[1]
    // a known period: 12 years from 2025-26 in 2025-26 prices (the deflator holds 2025)
    const ps = await call(apprPATCH as never, { years: 12, startYear: 2025, priceYear: 2025 }, 'PATCH')

    section('1 · benefit lines — CRUD through the route, parity with Lex, a FieldRevision per save, the "not valued" rule')
    ok('the appraisal settings save through the route (owner)', ps.status === 200, JSON.stringify(ps.json).slice(0, 200))
    const revs0 = await prisma.fieldRevision.count({ where: { ideaId: scratch.id, fieldKey: 'benefitLine' } })
    const add1 = await call(benefitPOST as never, { op: 'add', actionId: A.id, label: 'Faster decisions', beneficiary: 'CITIZENS', measure: 'days from request to decision', low: 80000, high: 80000, priceYear: 2025, recurrence: 'PER_YEAR', durationMonths: 120, sourceKind: 'OWNER', ownerReason: 'two days saved per case, my count' })
    ok('add: a valued line with the owner’s estimate is saved ACCEPTED and VALUED', add1.status === 200 && (add1.json.result as { valuation: string })?.valuation === 'VALUED', JSON.stringify(add1.json).slice(0, 300))
    const add2 = await call(benefitPOST as never, { op: 'add', actionId: A.id, label: 'Lower cost of complaints', beneficiary: 'DEPARTMENT', beneficiaryName: 'Cabinet Office', low: 999999, high: 999999, recurrence: 'PER_YEAR' })
    ok('add: a figure with no source is SAVED, as NOT_VALUED, and the screen is told why', add2.status === 200 && (add2.json.result as { valuation: string })?.valuation === 'NOT_VALUED' && /no source/.test(String((add2.json.result as { note?: string })?.note)))
    const add3 = await call(benefitPOST as never, { op: 'add', actionId: A.id, label: 'Trust in the service', beneficiary: 'CITIZENS', notValuedWhy: 'no source measures trust in this service yet' })
    ok('add: a line with no figure and a reason is NOT_VALUED', add3.status === 200)
    const bad = await call(benefitPOST as never, { op: 'add', actionId: A.id, label: 'x'.repeat(301), beneficiary: 'CITIZENS', notValuedWhy: 'n/a' })
    ok('an over-long label is refused in words naming the field and the limit (§30)', bad.status === 422 && /What is gained/.test(bad.json.error ?? '') && /300/.test(bad.json.error ?? ''), bad.json.error)
    const badRef = await call(benefitPOST as never, { op: 'add', actionId: A.id, label: 'Something', beneficiary: 'CITIZENS', low: 1, high: 1, sourceKind: 'REF', sourceRef: 99999 })
    ok('a [Ref: n] that is not on the idea is refused, in words', badRef.status === 422 && /not in this idea/.test(badRef.json.error ?? ''), badRef.json.error)
    const badCite = await call(benefitPOST as never, { op: 'add', actionId: A.id, label: 'Something', beneficiary: 'CITIZENS', low: 1, high: 1, sourceKind: 'CITATION', citationKey: 'green-book:99.99' })
    ok('337: an unmanifested citation is refused at write time, with the nearest held keys offered', badCite.status === 422 && /not a paragraph the platform holds/.test(badCite.json.error ?? '') && /Nearest held: green-book:/.test(badCite.json.error ?? ''), badCite.json.error)
    const lines1 = (await prisma.benefitLine.findMany({ where: { actionId: A.id } }))
    const faster = lines1.find((l) => l.label === 'Faster decisions')!
    const edit = await call(benefitPOST as never, { op: 'set', lineId: faster.id, low: 70000, high: 90000 })
    ok('set: the line changes through the route', edit.status === 200 && (await prisma.benefitLine.findUnique({ where: { id: faster.id } }))!.high === 90000)
    const rm = await call(benefitPOST as never, { op: 'remove', lineId: lines1.find((l) => l.label === 'Trust in the service')!.id })
    const trust = await prisma.benefitLine.findFirst({ where: { actionId: A.id, label: 'Trust in the service' } })
    ok('remove: nothing is deleted — the row is kept as REMOVED', rm.status === 200 && trust?.status === 'REMOVED')
    const rs = await call(benefitPOST as never, { op: 'restore', lineId: trust!.id })
    ok('restore brings it back', rs.status === 200 && (await prisma.benefitLine.findUnique({ where: { id: trust!.id } }))!.status === 'ACCEPTED')
    const revs1 = await prisma.fieldRevision.count({ where: { ideaId: scratch.id, fieldKey: 'benefitLine' } })
    ok(`every save is a FieldRevision (3 adds + 1 edit + remove + restore = 6; counted ${revs1 - revs0})`, revs1 - revs0 === 6)
    // parity: Lex's tool writes through the same writer — a PROPOSAL unless dictated
    const t1 = await execute(toolByName('add_benefit_line')!, ctxFor(scratch.id, scratch.userId, ['please add something']), { action: A.number, label: 'Fewer appeals', beneficiary: 'EXCHEQUER', notValuedWhy: 'no held source counts appeals', why: 'the Brief names appeals' })
    const prop = await prisma.benefitLine.findFirst({ where: { actionId: A.id, label: 'Fewer appeals' } })
    ok('parity: Lex’s add_benefit_line writes the same table through the same writer — as a PROPOSAL, with its reason', t1.ok && prop?.status === 'PROPOSED' && prop.proposedWhy === 'the Brief names appeals')
    const t2 = await execute(toolByName('add_benefit_line')!, ctxFor(scratch.id, scratch.userId, ['Add "Shorter waits" for citizens, not valued: no source yet']), { action: A.number, label: 'Shorter waits', beneficiary: 'CITIZENS', notValuedWhy: 'no source yet', dictated: true })
    ok('…and the owner’s dictated words, said this turn, are ACCEPTED', t2.ok && (await prisma.benefitLine.findFirst({ where: { actionId: A.id, label: 'Shorter waits' } }))?.status === 'ACCEPTED')
    const t3 = await execute(toolByName('add_benefit_line')!, ctxFor(scratch.id, scratch.userId, ['add a benefit']), { action: A.number, label: 'Claimed dictation', beneficiary: 'CITIZENS', notValuedWhy: 'x yz', dictated: true })
    ok('…but "dictated" Lex claims for words the owner never said is a PROPOSAL', t3.ok && (await prisma.benefitLine.findFirst({ where: { actionId: A.id, label: 'Claimed dictation' } }))?.status === 'PROPOSED')
    const t4 = await execute(toolByName('add_benefit_line')!, ctxFor(scratch.id, scratch.userId, ['value it']), { action: A.number, label: 'Saved staff time', beneficiary: 'DEPARTMENT', low: 5000, high: 5000, recurrence: 'PER_YEAR', source: { kind: 'OWNER', reason: 'I think so' } })
    ok('2b: Lex may NOT value a benefit as the owner’s estimate — refused, and told to write it not valued', !t4.ok && /not valued/.test(JSON.stringify(t4)) && !(await prisma.benefitLine.findFirst({ where: { actionId: A.id, label: 'Saved staff time' } })), JSON.stringify(t4).slice(0, 300))
    const ans = await execute(toolByName('answer_benefit_line')!, ctxFor(scratch.id, scratch.userId, []), { action: A.number, line: 'Fewer appeals', op: 'accept' })
    ok('the owner answers Lex’s proposal through the same writer (accept)', ans.ok && (await prisma.benefitLine.findFirst({ where: { actionId: A.id, label: 'Fewer appeals' } }))?.status === 'ACCEPTED')
    const g = await benefitGET(new Request(`http://x?actionId=${A.id}`), params)
    const gj = await g.json() as { lines: Array<{ label: string }> }
    ok('the form’s GET reads back every line on the action, all statuses', g.status === 200 && ['Faster decisions', 'Lower cost of complaints', 'Trust in the service', 'Fewer appeals', 'Shorter waits', 'Claimed dictation'].every((l) => gj.lines.some((x) => x.label === l)))

    section('2 · the costing companion on a scratch action — staffing, systems and a capital line')
    await prisma.costLine.deleteMany({ where: { action: { ideaId: scratch.id } } })
    const addCost = async (b: Record<string, unknown>) => call(costPOST as never, { action: 'add', actionId: A.id, ...b })
    await addCost({ label: 'Two policy officers', costType: 'STAFF', low: 50000, high: 50000, priceYear: 2025, recurrence: 'PER_YEAR' })
    await addCost({ label: 'Case system', costType: 'OTHER', low: 20000, high: 20000, priceYear: 2020, recurrence: 'PER_YEAR', durationMonths: 30 })
    await addCost({ label: 'Hearing room fit-out', costType: 'CAPITAL', low: 120000, high: 120000, priceYear: 2025, recurrence: 'ONE_OFF' })
    const cl = await prisma.costLine.findMany({ where: { actionId: A.id } })
    const staff = cl.find((c) => c.costType === 'STAFF')!, cap = cl.find((c) => c.costType === 'CAPITAL')!
    const draftBody = async () => {
      const r = await draftCostingCompanion(scratch.id, A.id, scratch.userId, { narrative: stubNarrative })
      if (!r.ok) return { body: '', reason: (r as { error: string }).error }
      const doc = await prisma.actionDocument.findFirst({ where: { actionId: A.id, kind: 'COSTING' }, select: { id: true } })
      const v = await prisma.actionDocumentVersion.findFirst({ where: { documentId: doc!.id, role: 'PROPOSAL' }, orderBy: { v: 'desc' }, select: { body: true } })
      return { body: v?.body ?? '', reason: r.data.reason }
    }
    const c1 = await draftBody()
    ok('the companion is written as a PROPOSAL on the action’s Costing document, through the drafting path', c1.body.length > 0, c1.reason)
    ok('…in the Green Book shape: Cost lines, Benefit lines, Assumptions, Totals, Optimism bias, Gaps, the narrative, Caveat — in that order', ['## Cost lines', '## Benefit lines', '## Assumptions', '## Totals', '## Optimism bias', '## Gaps', '## What the costs and benefits are', '## Caveat'].every((h, i, a) => c1.body.indexOf(h) >= 0 && (i === 0 || c1.body.indexOf(h) > c1.body.indexOf(a[i - 1]))))
    ok('340: the staffing line with no on-cost reads "excludes employer costs" (the floor label)', /Two policy officers[^\n]*excludes employer costs/.test(c1.body))
    ok('the capital line with no project type is in no band, and the Gaps say so', /Hearing room fit-out \| none \| A capital line with no project type/.test(c1.body) && /no Table 1 project type/.test(c1.body))
    ok('341: the Gaps section is non-empty', /## Gaps\n1\. /.test(c1.body))
    ok('the narrative passes through the guard: its sentence stating a sum and its unheld [Ref: 9999] are cut, the rest kept, and the cut is said', !c1.body.includes('£1,234,567') && !c1.body.includes('[Ref: 9999]') && c1.body.includes('Trust is not valued.') && /2 sentences stating a figure were removed/.test(c1.reason), c1.reason)
    const oc = await call(costPOST as never, { action: 'appraisal', lineId: staff.id, onCost: { rate: 0.3, source: 'the owner’s figure for NI and pension' }, payer: { kind: 'DEPARTMENT', name: 'Cabinet Office' } })
    const ob = await call(costPOST as never, { action: 'appraisal', lineId: cap.id, obType: 'standard-buildings', payer: { kind: 'EXCHEQUER' } })
    ok('the appraisal controls save through the cost-lines route (on-cost, payer, project type)', oc.status === 200 && ob.status === 200, `${oc.json.error ?? ''} ${ob.json.error ?? ''}`)
    const obOther = await call(costPOST as never, { action: 'appraisal', lineId: staff.id, obType: 'standard-buildings' })
    ok('a project type on a non-capital line is refused, in words', obOther.status === 422 && /capital line only/.test(obOther.json.error ?? ''))
    const lexOc = await execute(toolByName('set_cost_line_appraisal')!, ctxFor(scratch.id, scratch.userId, []), { action: A.number, line: 'Case system', onCost: { rate: 0.3, source: 'about right' } })
    ok('340: Lex’s on-cost with no held source is refused (and only STAFF lines take one)', !lexOc.ok)
    const lexOc2 = await execute(toolByName('set_cost_line_appraisal')!, ctxFor(scratch.id, scratch.userId, []), { action: A.number, line: 'Two policy officers', onCost: { rate: 0.25, source: 'my hunch' } })
    ok('…and on a staffing line, still refused without a source it holds', !lexOc2.ok && /source it holds/.test(JSON.stringify(lexOc2)), JSON.stringify(lexOc2).slice(0, 300))
    const c2 = await draftBody()
    ok('the uplift applies only once set: 30% on the staffing line, with its source', /Two policy officers[^\n]*employer on-cost uplift 30%/.test(c2.body))
    ok('342: the capital line is BANDED 2%–24% (standard buildings), named, and the band sentence and the guidance’s caveat are printed — not an uplift in the totals', /Hearing room fit-out \| 2%–24% \| standard buildings: Table 1’s lower to upper bound/.test(c2.body) && c2.body.includes('With optimism bias at HM Treasury’s indicative starting values') && c2.body.includes(E.OB_INDICATIVE) && /Never in the totals above/.test(c2.body))
    ok('the companion’s totals are the engine’s: its PV of costs equals runCba over the action alone', (await (async () => { const r = await runCba(scratch.id, { actionId: A.id }); return !!r && r.result.ok && c2.body.includes((r.result as { trace: Record<string, { value: string }> }).trace['pv-costs'].value) })()))
    const revA = await prisma.fieldRevision.count({ where: { ideaId: scratch.id, fieldKey: 'costLineAppraisal' } })
    ok('every appraisal change is a FieldRevision', revA >= 2)
    const viaKind = await DD.draftKindDocument(scratch.id, A.id, 'COSTING', scratch.userId, { call: (async () => ({ ok: true, value: { costs: 'The staff and the room.', benefits: 'Faster decisions.' }, usage: { model: 'stub', tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } } })) as never })
    ok('the drafting path ("Draft it", Lex’s draft_document) reaches the re-templated companion, with the stub call passed through (no spend)', viaKind.ok && /cost–benefit engine/.test((viaKind as { data: { reason: string } }).data.reason))

    section('4 · the manifest (database) — what Ingest wrote on 14 Nov')
    const m = await loadManifest({ fresh: true })
    ok(`the manifest is derived from the held paragraph rows (${m.entries.size} keys)`, m.entries.size >= 400 && m.from === 'held-rows')
    const missingEngine = Object.values(CM.ENGINE_CITATIONS).filter((k) => !m.entries.has(k))
    ok('every key the engine prints is held', missingEngine.length === 0, missingEngine.join(', '))
    ok('a held key passes (green-book:8.58, gb-discounting:3.8, gb-optimism-bias:3.11)', ['green-book:8.58', 'gb-discounting:3.8', 'gb-optimism-bias:3.11'].every((k) => CM.checkCitation(k, m).ok))
    const resolved = await resolveCitations(Object.values(CM.ENGINE_CITATIONS))
    ok('each key records the section id it resolved to and a hash of the held text (key → id → hash, as Ingest’s manifest will)', resolved.every((x) => !!x.sectionId && /^[0-9a-f]{16}$/.test(x.textHash ?? '')), JSON.stringify(resolved.filter((x) => !x.sectionId || !x.textHash)))
    const fileSame = CM.manifestFromFile({ keys: resolved.map((x) => ({ key: x.key, id: x.sectionId, hash: x.textHash })) })!
    const withHashes: CM.Manifest = { ...m, entries: new Map([...m.entries].map(([k, e]) => [k, { ...e, textHash: resolved.find((x) => x.key === k)?.textHash ?? null }])) }
    ok('compareManifests: the derived manifest and a file carrying the same key → id → hash agree', CM.compareManifests(withHashes, fileSame, resolved.map((x) => x.key)).length === 0)
    const fileRepointed = CM.manifestFromFile({ keys: resolved.map((x, i) => ({ key: x.key, id: i === 0 ? 'govuk-core-docs:somewhere-else:186' : x.sectionId, hash: i === 1 ? '0000000000000000' : x.textHash })) })!
    const dis = CM.compareManifests(withHashes, fileRepointed, resolved.map((x) => x.key))
    ok('…and a re-pointed id, or changed text under the same id, is named', dis.length === 2 && /resolves to/.test(dis[0].why) && /text has changed/.test(dis[1].why), JSON.stringify(dis))
    const cite = await call(costPOST as never, { action: 'appraisal', lineId: staff.id, citationKey: 'Green Book 6.58' })
    ok('a cost line’s citation, typed loosely, is stored as its key', cite.status === 200 && (await prisma.costLine.findUnique({ where: { id: staff.id } }))!.citationKey === 'green-book:6.58')
    const cite2 = await call(costPOST as never, { action: 'appraisal', lineId: staff.id, citationKey: 'gb-discounting:9.99' })
    ok('…an unheld one is refused with the nearest keys, and the stored key is unchanged', cite2.status === 422 && /Nearest held: gb-discounting:/.test(cite2.json.error ?? '') && (await prisma.costLine.findUnique({ where: { id: staff.id } }))!.citationKey === 'green-book:6.58')

    section('5 · the report — generate, versions, stale after a line change, Word/PDF text')
    const st0 = await cbaReportStatus(scratch.id)
    const gen = await generateCbaReport(scratch.id, scratch.userId, { narrativeFor: (a) => stubNarrative(...a) })
    ok('generate makes version 1, with Word and PDF in R2 at version keys', gen.ok && (gen as { version: number }).version === (st0.versions[0]?.version ?? 0) + 1, JSON.stringify(gen).slice(0, 200))
    const row = await prisma.cbaReport.findFirst({ where: { ideaId: scratch.id }, orderBy: { version: 'desc' } })
    ok('…the files are in R2', !!row && await r2Exists(row.docxKey!) && await r2Exists(row.pdfKey!))
    const st1 = await cbaReportStatus(scratch.id)
    ok('…and the version reads "current" while nothing has changed', st1.versions[0].stale?.lines === 0 && !st1.versions[0].stale?.period)
    await prisma.costLine.update({ where: { id: cap.id }, data: { high: 150000 } })
    const st2 = await cbaReportStatus(scratch.id)
    ok('a line changes → the version reads "stale: 1 line changed since"', st2.versions[0].stale?.lines === 1 && staleWords(st2.versions[0].stale) === 'stale: 1 line changed since')
    const gen2 = await generateCbaReport(scratch.id, scratch.userId, { narrative: false })
    const st3 = await cbaReportStatus(scratch.id)
    ok('generating again makes version 2 and KEEPS version 1 (still stale)', gen2.ok && st3.versions.length === st1.versions.length + 1 && st3.versions[1].stale?.lines === 1 && st3.versions[0].stale?.lines === 0)
    // Word / PDF text: render the stored version's own model, both formats, and read them back
    const eng = (row!.result as unknown as { engine: Extract<E.CbaResult, { ok: true }> }).engine
    const built = buildCbaReport(eng, null, { ideaTitle: 'x', version: 1, heldOn: '2026-11-14', generatedAt: new Date(), narrativeNote: null })
    const [docx, pdf] = await Promise.all([renderDocx(built.model), renderPdf(built.model)])
    const [dt, pt] = await Promise.all([docxText(docx), pdfText(pdf)])
    // a section's TITLE is its running header in Word (not body text), so the probes are body text: a Gap, the annex's note, a figure, a mark
    const probes = [eng.gaps[0].text.slice(0, 60), 'Every figure above carries a mark', eng.trace['pv-costs'].value, `T${built.printed.length}`]
    ok('Word and PDF carry the same text: the first Gap, the annex, the PV of costs, the last trace mark', probes.every((p) => squash(dt).includes(squash(p)) && squash(pt).includes(squash(p))), probes.filter((p) => !squash(dt).includes(squash(p)) || !squash(pt).includes(squash(p))).join(' ‖ '))
    ok('the stored result names every printed figure’s trace id', (row!.result as { printed: string[] }).printed.every((id) => !!eng.trace[id]))
    const cr = (row!.result as unknown as { citationsResolved: Array<{ key: string; sectionId: string | null; textHash: string | null }> }).citationsResolved
    ok('the version stores key → section id → text hash for every citation it prints', cr.length === eng.citations.length && cr.every((x) => !!x.sectionId && !!x.textHash))

    section('6 · Deepening section 5, RENDERED — locked / open; valued / not valued')
    const { GET: cbaGET } = await import('../app/api/ideas/[id]/cba/route')
    const read = await (await cbaGET(new Request('http://x'), params)).json() as CbaRead
    const locked = textOf(renderToStaticMarkup(React.createElement(DeepeningCostsBenefits, { ideaId: scratch.id, open: false, initial: read, toGo: 7 })))
    const opened = textOf(renderToStaticMarkup(React.createElement(DeepeningCostsBenefits, { ideaId: scratch.id, open: true, initial: read, toGo: 0 })))
    ok('locked: the title, the roll-up and the analysis show, read-only', locked.includes(SL.DEEPENING_UI.costs) && /Heading|Total/.test(locked) && locked.includes(SL.CBA_UI.npv))
    ok('locked: the lock’s count in words, and NO Generate', /7 actions are still to go/.test(locked) && !locked.includes(SL.CBA_UI.generate))
    control('Generate would render while locked (must be FALSE)', locked.includes(SL.CBA_UI.generateFree))
    ok('open: Generate, with the narrative’s price ("not yet measured" until measured) and the free version beside it', opened.includes(SL.CBA_UI.generate) && opened.includes(SL.CBA_UI.generateFree) && (NARRATIVE_PRICE.pence == null ? /narrative price not yet measured/.test(opened) : opened.includes('about ')))
    ok('the optimism-bias band renders beside the headline, with the guidance’s caveat', /Optimism bias, not in the figures above: With optimism bias at HM Treasury’s indicative starting values/.test(opened) && opened.includes('indicative starting values for calculating optimism bias levels'))
    ok('valued: the NPV is a figure and the Gaps are counted', read.summary.benefitsValued && /£/.test(read.summary.npv) && new RegExp(`Gaps: ${read.summary.gaps.length}`).test(opened))
    ok('the versions list shows both, with "current" and "stale: 1 line changed since" in words, and Word / PDF', /Version 2[^·]*· [^·]*· current/.test(opened) && /stale: 1 line changed since/.test(opened) && /Word · PDF/.test(opened))
    const nvRead: CbaRead = { ...read, summary: cbaSummary(E.computeCba(input([cost('k', { low: 5, high: 5, recurrence: 'ONE_OFF' })], [ben('n', { valuation: 'NOT_VALUED', sourceWords: null, notValuedWhy: 'no source yet' })], PERIOD(2)))) }
    const nvHtml = textOf(renderToStaticMarkup(React.createElement(DeepeningCostsBenefits, { ideaId: scratch.id, open: true, initial: nvRead, toGo: 0 })))
    ok('not valued: the NPV reads "not computed — benefits not valued — no BCR" and the BCR the same words, never a zero', nvHtml.includes('not computed — benefits not valued — no BCR') && !/Benefit–cost ratio\s*0/.test(nvHtml))
    const page = readFileSync(path.join(__dirname, '../app/ideas/create/CreateIdeaClient.tsx'), 'utf8')
    ok('the page mounts section 5 OUTSIDE the "open &&" block, beside section 6 (so it renders locked)', /\n\s*<DeepeningCostsBenefits ideaId=\{state\.ideaId\} open=\{open\} \/>\n\s*<DeepeningWho/.test(page))
    ok('…and DeepeningSections no longer draws a section 5 of its own', !/<Section id="costs"/.test(readFileSync(path.join(__dirname, '../components/lex/DeepeningSections.tsx'), 'utf8')))
    const rec = textOf(renderToStaticMarkup(React.createElement(ActionCbaLines, { ideaId: scratch.id, actionId: A.id, actionNumber: A.number })))
    ok('the record’s component renders (its first paint says it is reading)', /Reading the benefit lines/.test(rec))
    const ws = readFileSync(path.join(__dirname, '../components/lex/ActionsWorkspace.tsx'), 'utf8')
    ok('…and the record mounts it in the Costs section (section 3), under the cost lines', /3: <div className="space-y-2">\{renderFull\(a, 3\)\}<ActionCbaLines /.test(ws))
    const out = readFileSync(path.join(__dirname, '../components/lex/OutputsPanel.tsx'), 'utf8')
    ok('the Output Reports list the Cost–benefit report with its versions, and the IA draft as not available', /<CbaOutputs ideaId=\{ideaId\} \/>/.test(out) && st3.ia.reason === 'not available: IA template not held')

    section('7 · Lex — a cost question answered from the trace; an invented figure caught')
    const sum = await execute(toolByName('read_cba_summary')!, ctxFor(scratch.id, scratch.userId, []), {})
    const sd = sum.data as { npv: string; pvCosts: string; figures: Array<{ id: string; value: string }> }
    ok('read_cba_summary returns the NPV, the present values and the figures with their trace ids', sum.ok && /£/.test(sd.npv) && sd.figures.some((f) => f.id === 'pv-costs'))
    const ex = await execute(toolByName('explain_cba_figure')!, ctxFor(scratch.id, scratch.userId, []), { id: 'pv-costs' })
    ok('explain_cba_figure names the lines, the schedule years and how it is computed', ex.ok && (ex.data as { lines: string[] }).lines.some((l) => /Two policy officers/.test(l)) && (ex.data as { scheduleYears: number[] }).scheduleYears.length === 12)
    const pvc = sumsIn(sd.pvCosts)[0].pounds
    const outcomes: ToolOutcome[] = [{ name: 'read_cba_summary', category: 'see', ok: true, figures: figuresInData(sum.data) }]
    const good = checkReply({ reply: `The present value of the costs is ${sd.pvCosts}, from the trace pv-costs.`, outcomes, knownLabels: new Set(), userMessage: 'what does this cost?' })
    ok('a figure quoted from the summary passes the honesty rule', !good.some((v) => v.kind === 'invented-figure'), JSON.stringify(good))
    const invented = checkReply({ reply: `It will cost about £${(pvc * 3 + 12345).toLocaleString('en-GB')} over ten years.`, outcomes, knownLabels: new Set(), userMessage: 'what does this cost?' })
    ok('an INVENTED figure is caught (fixture)', invented.some((v) => v.kind === 'invented-figure'))
    const est = checkReply({ reply: 'My estimate is £2m, because a comparable scheme cost that.', outcomes: [], knownLabels: new Set(), userMessage: 'roughly?' })
    ok('a figure labelled "my estimate" with a reason is allowed', !est.some((v) => v.kind === 'invented-figure'))
    const rounded = checkReply({ reply: `Roughly £${Math.round(pvc / 1000)}k in present value.`, outcomes, knownLabels: new Set(), userMessage: '' })
    ok('a held figure rounded ("£870k" for £869,490) is not called invented', !rounded.some((v) => v.kind === 'invented-figure'), JSON.stringify(rounded))
    const rf = await recordFigures(scratch.id)
    ok('the record’s own sums (lines, the latest report) are known to the check without a tool call this turn', rf.has(50000) && rf.has(pvc))
    control('the invented figure would pass if every figure were known (must be FALSE)', invented.length === 0)
    const notCosted = await execute(toolByName('read_cba_summary')!, ctxFor(scratch.id, scratch.userId, []), { action: B.number })
    ok('an action with no cost lines reads as uncosted (the prompt’s "not costed yet — add cost lines on #N")', notCosted.ok && /costs are not in these totals|no figure/.test(JSON.stringify(notCosted.data)))
    const prompt = readFileSync(path.join(__dirname, '../lib/lex/agent/system-prompt.ts'), 'utf8')
    ok('the prompt carries the rule: no cost figure that is not on a line or in the report; quote the trace', /never state a cost or benefit figure that is not on a cost or benefit line/.test(prompt) && /read_cba_summary/.test(prompt))
    ok('every 26-Y tool is offered to the model', ['add_benefit_line', 'set_benefit_line', 'answer_benefit_line', 'set_cost_line_appraisal', 'read_cba_summary', 'explain_cba_figure', 'generate_cba_report', 'set_appraisal_period'].every((n) => !!toolByName(n)))
    const gl = await execute(toolByName('generate_cba_report')!, ctxFor(scratch.id, scratch.userId, []), { narrative: false })
    const lockNow = await developmentState(scratch.id)
    ok(`generate_cba_report obeys the lock (it is ${lockNow.deepeningOpen ? 'open' : 'shut'} on the copy: ${lockNow.deepeningOpen ? 'made' : 'refused'})`, lockNow.deepeningOpen ? gl.ok : !gl.ok && /once the Deepening opens/.test(JSON.stringify(gl)), JSON.stringify(gl).slice(0, 300))

    section('E · the guide has an entry for every new label')
    const entries = guideEntries()
    const missingG = Object.values(SL.CBA_UI).filter((l) => !entries.some((e) => normLabel(e.label) === normLabel(l)))
    ok('every CBA_UI label has a field-guide entry', missingG.length === 0, missingG.join(', '))
  } finally {
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = undefined
    console.log(`  (scratch copy deleted: ${await deleteScratch(scratch.id)})`)
  }
}

async function main() {
  part1pure()
  part3()
  part4pure()
  if (process.argv.includes('--pure')) skip('parts 1, 2, 4–7 on the database', '--pure')
  else await partDb()
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  void skip
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
