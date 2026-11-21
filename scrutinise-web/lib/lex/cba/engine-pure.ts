// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §4a (decisions 334–341) — THE ANALYSIS ENGINE. PURE; CLIENT-SAFE; NO MODEL. Every figure it returns carries a TRACE: which lines,
// which deflator rows, which schedule years, which Table 1 row.
//
// Inputs: an idea's live cost and benefit lines, its appraisal period and price year, the deflator series, the 325 schedule (costing-params
// discountFactor, verified against Annex A), Table 1 (costing-params OPTIMISM_BIAS_TABLE_1, both bounds — 343).
//
// THE RULES, each from a decision:
//   · Year t of the appraisal is financial year startYear+t; its DISCOUNT year is (startYear − priceYear) + t (period.ts). Year 0 of the
//     schedule is undiscounted. A discount year past 125 is REFUSED, never discounted (338, GB discounting 3.10).
//   · A one-off line falls in appraisal year 0. A per-year line falls in each year of its duration — a part year is that part of the year
//     (as cost-years-pure) — and with no duration runs the whole period (said in Gaps). A line with no recurrence is counted and placed in
//     NO year (Gaps). A line with no figure adds nothing (Gaps). A line given as one number is a floor (Gaps).
//   · Figures are converted to the price year by the deflator (index[priceYear] / index[lineYear]). A line with no price year, or whose
//     year the deflator does not hold, is summed AS ENTERED and named in Gaps — never converted by a guess.
//   · 340 — a STAFF line takes an employer on-cost uplift only when an ACCEPTED one is set (the owner's, or Lex's with a cited source once
//     taken). Otherwise it reads "excludes employer costs" — a floor (Gaps).
//   · 342 (replaces 339) — optimism bias NEVER adjusts the headline NPV. It is a BAND beside it: the analysis recomputed with every banded
//     cost line at Table 1's lower bound and at its upper bound. A CAPITAL line is banded by its project type (capex lower–upper; the
//     owner's lowered rate, with its reason, replaces the upper end). A running-cost line is banded by the outsourcing row (opex 0–41%),
//     labelled "nearest analogue in the guidance, not a rule". A capital line with no type is in no band (Gaps). Every band quotes the
//     guidance's own caveat (OB_INDICATIVE, gb-optimism-bias:3.6).
//   · 334 — only an ACCEPTED, VALUED benefit with a source enters a total. "Not valued" never does, and is never a zero.
//   · 338 — a health benefit's real value is uprated 2% a year (Green Book 8.58) and then discounted at the same schedule. No separate rate.
//   · NPV and BCR only where some benefit is valued; otherwise "benefits not valued — no BCR", never a zero.
//   · Ranges stay ranges: NPV low = PV benefits low − PV costs high; high = the other way round.
// ─────────────────────────────────────────────────────────────────────────────

import { discountFactor, stprRateForYear, OPTIMISM_BIAS_TABLE_1, HEALTH_VALUE_UPRATE, STPR_LAST_YEAR } from '../costing-params'
import { type AppraisalPeriod, discountYearOf, fyWords } from './period'
import { type LineAppraisal, type PartyKind, PARTY_WORD, partyWords, pct, OB_TYPE_WORD } from './line-appraisal'
import { ENGINE_CITATIONS } from './citation-manifest-pure'
import { releaseWords } from '../../stats/cell-pure'

export interface Money { low: number; high: number }
const Z = (): Money => ({ low: 0, high: 0 })
const addM = (a: Money, b: Money): Money => ({ low: a.low + b.low, high: a.high + b.high })
const mulM = (a: Money, k: number): Money => ({ low: a.low * k, high: a.high * k })
const isZero = (m: Money) => Math.abs(m.low) < 0.005 && Math.abs(m.high) < 0.005

export interface EngineCostLine {
  id: string; actionId: string; actionNumber: number | null; actionTitle: string; headingId: string | null
  label: string; costType: string; category: string
  low: number | null; high: number | null; priceYear: number | null
  recurrence: 'ONE_OFF' | 'PER_YEAR' | null; durationMonths: number | null
  basis: string | null; citationKey: string | null; benchmarkId: string | null
  appraisal: LineAppraisal
  /** 26-AA item 9(a) — the licence attribution of the held unit-cost row the figure came from (GMCA's CC BY 4.0), or null. */
  attribution?: string | null
}
export interface EngineBenefitLine {
  id: string; actionId: string; actionNumber: number | null; actionTitle: string; headingId: string | null
  label: string; beneficiary: PartyKind; beneficiaryName: string | null; measure: string | null
  low: number | null; high: number | null; priceYear: number | null
  recurrence: 'ONE_OFF' | 'PER_YEAR' | null; durationMonths: number | null; isHealth: boolean
  valuation: 'VALUED' | 'NOT_VALUED'; notValuedWhy: string | null
  /** The source in words ("[Ref: 12]", "GMCA … entry HO1.0", "green-book:8.58", "owner's estimate — …"); null = none. */
  sourceWords: string | null
  ownerEstimate: boolean
  /** 26-AA item 9(a) — as EngineCostLine.attribution, for a benefit valued from a held unit-cost row. */
  attribution?: string | null
}
export interface EngineInput {
  period: AppraisalPeriod
  deflator: ReadonlyArray<{ year: number; index: number }>
  costs: readonly EngineCostLine[]
  benefits: readonly EngineBenefitLine[]
  headings: ReadonlyArray<{ id: string; name: string }>
  /** What Ingest holds — each absence is a Gap (341). */
  held: {
    civilServiceStatistics: boolean; deflatorReleaseDates: boolean; manifest: 'file' | 'held-rows' | 'none'
    /** 26-AA item 9(c) — the dated release the deflator index IS (matched year by year), or why it is none. */
    deflatorRelease?: { vintage: string; releaseDate: string | null; priceBasis: string | null } | null
    deflatorWhy?: string | null
    /** 26-AA item 9(c) — Civil Service Statistics 2026 as held: its release and price basis. */
    css?: { releaseDate: string | null; priceBasis: string | null } | null
  }
  /** Live actions with neither a cost line nor a "no cost" answer. */
  uncostedActions: number
}

export type GapKind = 'not-valued' | 'no-benefit-valued' | 'no-figure' | 'undated' | 'no-duration' | 'beyond-period' | 'no-price-year'
  | 'not-converted' | 'floor' | 'excludes-employer-costs' | 'on-cost-waiting' | 'payer' | 'ob-type' | 'owners' | 'not-held' | 'uncosted'
export interface Gap { kind: GapKind; text: string; lineIds: string[] }
export interface Assumption { text: string; source: string; owners: boolean }
export interface Trace {
  id: string; label: string; value: string
  lines: string[]; deflatorYears: number[]; scheduleYears: number[]; tableRows: string[]
  how: string
}
export interface YearRow { t: number; fy: number; discountYear: number; factor: number; costs: Money; benefits: Money; pvCosts: Money; pvBenefits: Money }
export interface GroupRow { key: string; words: string; costs: Money; benefits: Money; pvCosts: Money; pvBenefits: Money; costYears: Money[]; benefitYears: Money[] }
export interface SensitivityRow { key: 'costs+20' | 'benefits-50' | 'delay-1' | 'rate+0.5' | 'rate-0.5'; label: string; pvCosts: Money; pvBenefits: Money; npv: Money | null; bcr: Money | null; note: string | null
  /** Undiscounted amounts moved past the period's end (the delay test) — traced as `sens:<key>.lost`, null when none. */
  lost: { costs: Money; benefits: Money } | null }
export interface LineOut {
  id: string; side: 'cost' | 'benefit'; actionNumber: number | null; label: string
  /** In the price year, before discounting, summed over the period (the one-off amount, or the per-year amount × years). */
  nominal: Money; pv: Money
  included: boolean; whyNot: string | null
  /** What was done to the figure, in order, in words. */
  steps: string[]
  payer: string
}
/** 342 — one line's optimism-bias band (never applied to the headline). `band` null = the line is in no band (no figure; capital with no type). */
export interface ObRow { lineId: string; actionNumber: number | null; label: string; kind: 'capital' | 'opex-analogue' | 'none'; band: { lower: number; upper: number } | null; why: string; source: string }
/** 342 — the headline recomputed with every banded line at Table 1's lower and upper bounds. `npv` when benefits are valued, else null. */
export interface ObBand { pvCosts: Money; npv: Money | null; lines: number; capital: number; opex: number }
export type CbaResult = {
  ok: true
  period: AppraisalPeriod
  years: YearRow[]
  totals: { costs: Money; benefits: Money; pvCosts: Money; pvBenefits: Money }
  benefitsValued: boolean
  npv: Money | null
  bcr: Money | null
  byHeading: GroupRow[]
  byPayer: GroupRow[]
  byBeneficiary: GroupRow[]
  sensitivity: SensitivityRow[]
  lines: LineOut[]
  optimismBias: ObRow[]
  /** 342 — the band beside the headline; null when no line is banded. */
  obBand: ObBand | null
  undated: { costs: Money; lines: number }
  gaps: Gap[]
  assumptions: Assumption[]
  trace: Record<string, Trace>
  citations: string[]
  /** 26-AA item 9(a) — every licence attribution the figures here carry, once each: printed wherever they are shown or cited. */
  attributions: string[]
} | { ok: false; error: string }

// ── words ────────────────────────────────────────────────────────────────────
/** "£1,234" / "£1,234–5,678"; negatives "−£1,234"; rounded to the pound. Zero prints "£0" (a figure), never "—". */
export function gbp(n: number): string {
  const r = Math.round(n)
  return `${r < 0 ? '−' : ''}£${Math.abs(r).toLocaleString('en-GB')}`
}
export function rangeWords(m: Money): string {
  const lo = Math.round(m.low), hi = Math.round(m.high)
  return lo === hi ? gbp(lo) : `${gbp(lo)} to ${gbp(hi)}`
}
export function ratioWords(m: Money): string {
  const f = (x: number) => (Math.round(x * 100) / 100).toFixed(2)
  return f(m.low) === f(m.high) ? f(m.low) : `${f(m.low)} to ${f(m.high)}`
}
export const NOT_VALUED_WORDS = 'benefits not valued — no BCR'
/** 342 — a running-cost line's band, and why it is only an analogue. */
export const OPEX_OB_WHY = 'A running cost: banded by Table 1’s outsourcing row (0–41%, measured on operating expenditure) — the nearest analogue in the guidance, not a rule. Table 1 has no category for a statutory duty or an administrative process.'
/** The guidance’s own caveat on Table 1, verbatim (2013 guidance, the note under 3.6 on the Table 1 page). Quoted with every band. */
export const OB_INDICATIVE = 'Note that these values are indicative starting values for calculating optimism bias levels in current projects. The upper bound (U) does not represent the highest possible values for optimism bias that can result and the lower bound (L) does not represent the lowest possible values that can be achieved for optimism bias.'
/** The band sentence beside the headline. */
export function obBandWords(b: ObBand): string {
  return b.npv
    ? `With optimism bias at HM Treasury’s indicative starting values, the NPV would be between ${rangeLow(b.npv)} and ${rangeHigh(b.npv)}`
    : `With optimism bias at HM Treasury’s indicative starting values, the present value of costs would be between ${rangeLow(b.pvCosts)} and ${rangeHigh(b.pvCosts)}`
}
const rangeLow = (m: Money) => gbp(m.low), rangeHigh = (m: Money) => gbp(m.high)
export const CAVEAT = (heldOn: string) => `Prepared from the action’s lines and HM Treasury guidance as held on ${heldOn}; not an Impact Assessment; every figure traces to a line or a held source.`

// ── discounting ─────────────────────────────────────────────────────────────
/** The factor for discount year n, AS PUBLISHED: Annex A of GB discounting gives every factor to 4 decimal places, and a reviewer
 *  reproducing these figures by hand uses that table. round4(discountFactor(n)) equals Annex A for every year 0–125
 *  (check:costing-params), so the engine uses exactly the published table. `delta` moves every band's rate (sensitivity only),
 *  rounded the same way. Null past year 125 (GB discounting 3.10). */
export function factorAt(n: number, delta = 0): number | null {
  if (!Number.isInteger(n) || n < 0 || n > STPR_LAST_YEAR) return null
  if (delta === 0) { const f = discountFactor(n); return f == null ? null : round4(f) }
  let f = 1
  for (let t = 1; t <= n; t++) f /= 1 + (stprRateForYear(t) as number) + delta
  return round4(f)
}
const round4 = (x: number) => Math.round(x * 10000) / 10000

/** The fraction of appraisal year t (0-based) a per-year line with this duration covers; null duration = every year. */
export function shareOfYear(t: number, durationMonths: number | null): number {
  if (durationMonths == null || !(durationMonths > 0)) return 1
  return Math.max(0, Math.min(1, durationMonths / 12 - t))
}

// ── one line → its flows in the price year ─────────────────────────────────
interface Flow { id: string; side: 'cost' | 'benefit'; perYear: Money[]; undated: Money | null; health: boolean; group: string; party: string; partyWords: string; out: LineOut; deflatorYears: number[]; tableRows: string[]; ob?: { lower: number; upper: number } | null }

function bounds(low: number | null, high: number | null): { m: Money; oneSided: boolean } | null {
  if (low == null && high == null) return null
  const lo = low ?? (high as number), hi = high ?? lo
  return { m: { low: Math.min(lo, hi), high: Math.max(lo, hi) }, oneSided: low == null || high == null }
}

export function computeCba(input: EngineInput): CbaResult {
  const P = input.period
  const T = P.years
  // 338 — refuse before anything is summed: the last year (and the delay test's year after it) must be within the schedule
  const lastDiscountYear = discountYearOf(P, T - 1) + 1
  if (discountYearOf(P, 0) < 0) return { ok: false, error: `The start year (${fyWords(P.startYear)}) is before the price year (${fyWords(P.priceYear)}); discounting is not applied to earlier years (${ENGINE_CITATIONS.noRetrospective}). Nothing was computed.` }
  if (lastDiscountYear > STPR_LAST_YEAR) return { ok: false, error: `This period reaches year ${lastDiscountYear} of the discount schedule, which stops at year ${STPR_LAST_YEAR} (${ENGINE_CITATIONS.beyond125}): nothing is discounted beyond it. Nothing was computed.` }

  const gaps: Gap[] = []
  const gap = (kind: GapKind, text: string, lineIds: string[] = []) => gaps.push({ kind, text, lineIds })
  const assumptions: Assumption[] = []
  const idx = new Map(input.deflator.map((d) => [d.year, d.index]))
  const toIdx = idx.get(P.priceYear) ?? null
  const headingName = new Map(input.headings.map((h) => [h.id, h.name]))
  const flows: Flow[] = []
  const obRows: ObRow[] = []
  const lineName = (n: number | null, label: string) => `#${n ?? '?'} “${label}”`

  const convert = (v: Money, year: number | null, id: string, steps: string[], dy: number[]): Money => {
    if (year == null) { steps.push('no price year: summed as entered'); return v }
    if (year === P.priceYear) { steps.push(`already in ${fyWords(P.priceYear)} prices`); return v }
    const from = idx.get(year) ?? null
    if (from == null || toIdx == null) { steps.push(`not converted: the deflator series holds no index for ${from == null ? fyWords(year) : fyWords(P.priceYear)}; summed as entered`); void id; return v }
    const k = toIdx / from
    dy.push(year, P.priceYear)
    steps.push(`converted from ${fyWords(year)} to ${fyWords(P.priceYear)} prices × ${k.toFixed(4)} (deflator ${to2(toIdx)} / ${to2(from)})`)
    return mulM(v, k)
  }

  const noPriceYear: string[] = [], notConverted: Array<{ id: string; year: number }> = [], noFigure: string[] = [], oneSided: string[] = []
  const undatedIds: string[] = [], noDuration: string[] = [], beyond: string[] = [], payerless: string[] = [], employer: string[] = []
  const onCostWaiting: string[] = [], obUntyped: string[] = [], owners: Array<{ id: string; text: string }> = []

  // ── cost lines ──
  for (const l of input.costs) {
    const steps: string[] = []
    const out: LineOut = { id: l.id, side: 'cost', actionNumber: l.actionNumber, label: l.label, nominal: Z(), pv: Z(), included: false, whyNot: null, steps, payer: partyWords(l.appraisal.payer) }
    const b = bounds(l.low, l.high)
    const group = l.headingId && headingName.has(l.headingId) ? l.headingId : ''
    const party = l.appraisal.payer?.kind ?? 'NOT_STATED'
    if (!l.appraisal.payer) payerless.push(l.id)
    const isCapital = l.costType === 'CAPITAL'
    // 342 — every line gets its optimism-bias row: its band (never in the headline), or why it has none
    if (!b) {
      noFigure.push(l.id); out.whyNot = 'no figure'
      obRows.push({ lineId: l.id, actionNumber: l.actionNumber, label: l.label, kind: 'none', band: null, why: 'No figure, so nothing to band.', source: '' })
      flows.push({ id: l.id, side: 'cost', perYear: [], undated: null, health: false, group, party, partyWords: out.payer, out, deflatorYears: [], tableRows: [] }); continue
    }
    if (b.oneSided) oneSided.push(l.id)
    const dy: number[] = [], tableRows: string[] = []
    let v = convert(b.m, l.priceYear, l.id, steps, dy)
    if (l.priceYear == null) noPriceYear.push(l.id)
    else if (l.priceYear !== P.priceYear && (idx.get(l.priceYear) == null || toIdx == null)) notConverted.push({ id: l.id, year: l.priceYear })
    // 340 — staffing: the on-cost only when accepted
    if (l.costType === 'STAFF') {
      const oc = l.appraisal.onCost
      if (oc && oc.status === 'ACCEPTED') {
        v = mulM(v, 1 + oc.rate)
        steps.push(`employer on-cost uplift ${pct(oc.rate)} (${oc.by === 'OWNER' ? 'the owner’s' : 'Lex’s, accepted by the owner'}; source: ${oc.source})`)
        assumptions.push({ text: `${lineName(l.actionNumber, l.label)}: employer on-costs add ${pct(oc.rate)}.`, source: oc.source, owners: oc.by === 'OWNER' })
        if (oc.by === 'OWNER') owners.push({ id: l.id, text: `the on-cost uplift on ${lineName(l.actionNumber, l.label)}` })
      } else {
        employer.push(l.id)
        steps.push('excludes employer costs (no on-cost uplift set): a floor')
        if (oc && oc.status === 'PROPOSED') onCostWaiting.push(l.id)
      }
    }
    // 342 — optimism bias: a BAND, never the headline. The figure `v` is not changed here.
    let obBand: { lower: number; upper: number } | null = null
    if (isCapital) {
      const ob = l.appraisal.ob
      if (!ob) {
        obUntyped.push(l.id)
        obRows.push({ lineId: l.id, actionNumber: l.actionNumber, label: l.label, kind: 'none', band: null, why: 'A capital line with no project type chosen: it is in no band until one is. Table 1 needs the type.', source: ENGINE_CITATIONS.obUpperBound })
      } else {
        const t1 = OPTIMISM_BIAS_TABLE_1.value[ob.type].capex!
        obBand = ob.lowered ? { lower: Math.min(t1.lower, ob.lowered.rate), upper: ob.lowered.rate } : { lower: t1.lower, upper: t1.upper }
        tableRows.push(`Table 1 · ${OB_TYPE_WORD[ob.type]} · Capital Expenditure › Lower ${pct(t1.lower)}, Upper ${pct(t1.upper)}`)
        steps.push(`optimism bias band ${pct(obBand.lower)}–${pct(obBand.upper)} (${ob.lowered ? `the upper end lowered by the owner from ${pct(t1.upper)}: ${ob.lowered.reason}` : `Table 1, ${OB_TYPE_WORD[ob.type]}`}) — beside the headline, not in it`)
        obRows.push({ lineId: l.id, actionNumber: l.actionNumber, label: l.label, kind: 'capital', band: obBand, why: ob.lowered ? `${OB_TYPE_WORD[ob.type]}: Table 1’s lower bound to the owner’s lowered rate (from ${pct(t1.upper)}): ${ob.lowered.reason}` : `${OB_TYPE_WORD[ob.type]}: Table 1’s lower to upper bound.`, source: ob.lowered ? `${ENGINE_CITATIONS.obReduce}; the owner` : `${ENGINE_CITATIONS.obUpperBound}; Table 1, PDF p.2` })
        if (ob.lowered) owners.push({ id: l.id, text: `the lowered optimism-bias rate on ${lineName(l.actionNumber, l.label)}` })
      }
    } else {
      const op = OPTIMISM_BIAS_TABLE_1.value.outsourcing.opex!
      obBand = { lower: op.lower, upper: op.upper }
      tableRows.push(`Table 1 · outsourcing (operating expenditure) · Lower ${pct(op.lower)}, Upper ${pct(op.upper)} — nearest analogue, not a rule`)
      steps.push(`optimism bias band ${pct(op.lower)}–${pct(op.upper)} (Table 1’s outsourcing row, the nearest analogue, not a rule) — beside the headline, not in it`)
      obRows.push({ lineId: l.id, actionNumber: l.actionNumber, label: l.label, kind: 'opex-analogue', band: obBand, why: OPEX_OB_WHY, source: `${ENGINE_CITATIONS.optimismBias}; Table 1, PDF p.2` })
    }
    if (l.basis?.trim()) assumptions.push({ text: `${lineName(l.actionNumber, l.label)}: ${l.basis.trim()}`, source: l.citationKey ? l.citationKey : l.benchmarkId ? 'a held unit-cost row' : 'the owner’s', owners: !l.citationKey && !l.benchmarkId })
    const f = place(l, v, T, steps, undatedIds, noDuration, beyond)
    out.included = f.undated == null
    if (f.undated) out.whyNot = 'no recurrence: counted, placed in no year'
    flows.push({ id: l.id, side: 'cost', perYear: f.perYear, undated: f.undated, health: false, group, party, partyWords: out.payer, out, deflatorYears: dy, tableRows, ob: obBand })
  }

  // ── benefit lines ──
  const notValued: EngineBenefitLine[] = []
  for (const l of input.benefits) {
    const steps: string[] = []
    const ben = l.beneficiary
    const words = l.beneficiaryName ? `${PARTY_WORD[ben]} (${l.beneficiaryName})` : PARTY_WORD[ben]
    const out: LineOut = { id: l.id, side: 'benefit', actionNumber: l.actionNumber, label: l.label, nominal: Z(), pv: Z(), included: false, whyNot: null, steps, payer: words }
    const group = l.headingId && headingName.has(l.headingId) ? l.headingId : ''
    const b = bounds(l.low, l.high)
    // 334 — the rule that matters most: only VALUED with a source enters a total
    if (l.valuation !== 'VALUED' || !l.sourceWords || !b) {
      notValued.push(l)
      out.whyNot = l.valuation !== 'VALUED' ? `not valued${l.notValuedWhy ? `: ${l.notValuedWhy}` : ''}` : !l.sourceWords ? 'not valued: no source' : 'not valued: no figure'
      flows.push({ id: l.id, side: 'benefit', perYear: [], undated: null, health: l.isHealth, group, party: ben, partyWords: words, out, deflatorYears: [], tableRows: [] }); continue
    }
    if (b.oneSided) oneSided.push(l.id)
    const dy: number[] = []
    const v = convert(b.m, l.priceYear, l.id, steps, dy)
    if (l.priceYear == null) noPriceYear.push(l.id)
    else if (l.priceYear !== P.priceYear && (idx.get(l.priceYear) == null || toIdx == null)) notConverted.push({ id: l.id, year: l.priceYear })
    assumptions.push({ text: `${lineName(l.actionNumber, l.label)}: ${l.measure?.trim() ? `measured by ${l.measure.trim()}; ` : ''}valued from ${l.sourceWords}.`, source: l.sourceWords, owners: l.ownerEstimate })
    if (l.ownerEstimate) owners.push({ id: l.id, text: `the valuation of ${lineName(l.actionNumber, l.label)} (the owner’s estimate)` })
    if (l.isHealth) steps.push(`a health effect: its real value uprated ${pct(HEALTH_VALUE_UPRATE.value)} a year before discounting (${ENGINE_CITATIONS.healthUprate})`)
    const f = place(l, v, T, steps, undatedIds, noDuration, beyond)
    out.included = f.undated == null
    if (f.undated) out.whyNot = 'no recurrence: counted, placed in no year'
    flows.push({ id: l.id, side: 'benefit', perYear: f.perYear, undated: f.undated, health: l.isHealth, group, party: ben, partyWords: words, out, deflatorYears: dy, tableRows: [] })
  }
  const benefitsValued = flows.some((f) => f.side === 'benefit' && f.perYear.length > 0)

  // ── the core sum, parameterised for the sensitivity rows ──
  const scheduleYears = Array.from({ length: T }, (_, t) => discountYearOf(P, t))
  const sum = (o: { costMult?: number; benMult?: number; delay?: number; delta?: number; ob?: 'lower' | 'upper' } = {}) => {
    const costMult = o.costMult ?? 1, benMult = o.benMult ?? 1, delay = o.delay ?? 0, delta = o.delta ?? 0
    const pvc = Z(), pvb = Z(); const lost = { c: Z(), b: Z() }
    for (const f of flows) {
      if (!f.perYear.length) continue
      for (let t = 0; t < T; t++) {
        const at = t + delay
        let flow = mulM(f.perYear[t], f.side === 'cost' ? costMult * (o.ob && f.ob ? 1 + f.ob[o.ob] : 1) : benMult)
        if (isZero(flow)) continue
        if (at >= T) { if (f.side === 'cost') Object.assign(lost.c, addM(lost.c, flow)); else Object.assign(lost.b, addM(lost.b, flow)); continue }
        const n = discountYearOf(P, at)
        if (f.health) flow = mulM(flow, Math.pow(1 + HEALTH_VALUE_UPRATE.value, n))
        const df = factorAt(n, delta) as number
        if (f.side === 'cost') Object.assign(pvc, addM(pvc, mulM(flow, df))); else Object.assign(pvb, addM(pvb, mulM(flow, df)))
      }
    }
    return { pvc, pvb, lost }
  }

  // ── per year, per line PV, totals ──
  const years: YearRow[] = Array.from({ length: T }, (_, t) => {
    const n = discountYearOf(P, t)
    return { t, fy: P.startYear + t, discountYear: n, factor: factorAt(n) as number, costs: Z(), benefits: Z(), pvCosts: Z(), pvBenefits: Z() }
  })
  const group = (key: string, words: string): GroupRow => ({ key, words, costs: Z(), benefits: Z(), pvCosts: Z(), pvBenefits: Z(), costYears: Array.from({ length: T }, Z), benefitYears: Array.from({ length: T }, Z) })
  const byHeading = new Map<string, GroupRow>(), byPayer = new Map<string, GroupRow>(), byBen = new Map<string, GroupRow>()
  for (const f of flows) {
    if (!f.perYear.length) continue
    const g = byHeading.get(f.group) ?? group(f.group, f.group ? headingName.get(f.group)! : 'Not under a heading'); byHeading.set(f.group, g)
    const pmap = f.side === 'cost' ? byPayer : byBen
    const pk = f.side === 'cost' ? f.party : `${f.party}:${f.partyWords}`
    const p = pmap.get(pk) ?? group(pk, f.side === 'cost' && f.party === 'NOT_STATED' ? 'payer not stated' : f.partyWords); pmap.set(pk, p)
    for (let t = 0; t < T; t++) {
      const flow = f.perYear[t]
      if (isZero(flow)) continue
      const y = years[t]
      const valued = f.health ? mulM(flow, Math.pow(1 + HEALTH_VALUE_UPRATE.value, y.discountYear)) : flow
      const pv = mulM(valued, y.factor)
      f.out.nominal = addM(f.out.nominal, flow); f.out.pv = addM(f.out.pv, pv)
      if (f.side === 'cost') {
        y.costs = addM(y.costs, flow); y.pvCosts = addM(y.pvCosts, pv)
        g.costs = addM(g.costs, flow); g.pvCosts = addM(g.pvCosts, pv); g.costYears[t] = addM(g.costYears[t], flow)
        p.costs = addM(p.costs, flow); p.pvCosts = addM(p.pvCosts, pv); p.costYears[t] = addM(p.costYears[t], flow)
      } else {
        y.benefits = addM(y.benefits, flow); y.pvBenefits = addM(y.pvBenefits, pv)
        g.benefits = addM(g.benefits, flow); g.pvBenefits = addM(g.pvBenefits, pv); g.benefitYears[t] = addM(g.benefitYears[t], flow)
        p.benefits = addM(p.benefits, flow); p.pvBenefits = addM(p.pvBenefits, pv); p.benefitYears[t] = addM(p.benefitYears[t], flow)
      }
    }
  }
  const totals = years.reduce((a, y) => ({ costs: addM(a.costs, y.costs), benefits: addM(a.benefits, y.benefits), pvCosts: addM(a.pvCosts, y.pvCosts), pvBenefits: addM(a.pvBenefits, y.pvBenefits) }), { costs: Z(), benefits: Z(), pvCosts: Z(), pvBenefits: Z() })
  const npvOf = (pvb: Money, pvc: Money): Money | null => (benefitsValued ? { low: pvb.low - pvc.high, high: pvb.high - pvc.low } : null)
  const bcrOf = (pvb: Money, pvc: Money): Money | null => (benefitsValued && pvc.low > 0 ? { low: pvb.low / pvc.high, high: pvb.high / pvc.low } : null)
  const npv = npvOf(totals.pvBenefits, totals.pvCosts)
  const bcr = bcrOf(totals.pvBenefits, totals.pvCosts)

  // ── sensitivity: rows, not paragraphs ──
  const sensRow = (key: SensitivityRow['key'], label: string, o: Parameters<typeof sum>[0]): SensitivityRow => {
    const s = sum(o)
    const lost = !isZero(s.lost.c) || !isZero(s.lost.b) ? { costs: s.lost.c, benefits: s.lost.b } : null
    return { key, label, pvCosts: s.pvc, pvBenefits: s.pvb, npv: npvOf(s.pvb, s.pvc), bcr: bcrOf(s.pvb, s.pvc), note: lost ? 'flows moved past the end of the period fall out and are not counted' : null, lost }
  }
  const sensitivity: SensitivityRow[] = [
    sensRow('costs+20', 'Costs 20% higher', { costMult: 1.2 }),
    sensRow('benefits-50', 'Valued benefits 50% lower', { benMult: 0.5 }),
    sensRow('delay-1', 'Delivery delayed one year', { delay: 1 }),
    sensRow('rate+0.5', 'Discount schedule 0.5 points higher', { delta: 0.005 }),
    sensRow('rate-0.5', 'Discount schedule 0.5 points lower', { delta: -0.005 }),
  ]

  // ── 342 — the optimism-bias band beside the headline (never in it) ──
  const banded = flows.filter((f) => f.side === 'cost' && f.ob && f.perYear.length)
  let obBandOut: ObBand | null = null
  if (banded.length) {
    const lo = sum({ ob: 'lower' }), hi = sum({ ob: 'upper' })
    obBandOut = {
      pvCosts: { low: lo.pvc.low, high: hi.pvc.high },
      npv: benefitsValued ? { low: totals.pvBenefits.low - hi.pvc.high, high: totals.pvBenefits.high - lo.pvc.low } : null,
      lines: banded.length, capital: obRows.filter((o) => o.kind === 'capital').length, opex: obRows.filter((o) => o.kind === 'opex-analogue' && o.band).length,
    }
  }

  // ── undated lines (counted, never placed) ──
  const undated = flows.filter((f) => f.side === 'cost' && f.undated).reduce((a, f) => ({ costs: addM(a.costs, f.undated!), lines: a.lines + 1 }), { costs: Z(), lines: 0 })

  // ── Gaps (341) — before the totals in every report ──
  const name = (id: string) => { const f = flows.find((x) => x.id === id); return f ? lineName(f.out.actionNumber, f.out.label) : id }
  const names = (ids: string[]) => ids.map(name).join('; ')
  for (const l of notValued) gap('not-valued', `${lineName(l.actionNumber, l.label)} — for ${l.beneficiaryName ? `${PARTY_WORD[l.beneficiary]} (${l.beneficiaryName})` : PARTY_WORD[l.beneficiary]}: not valued${l.notValuedWhy ? ` (${l.notValuedWhy})` : !l.sourceWords && (l.low != null || l.high != null) ? ' (a figure was given with no source, so it is not counted)' : ''}. It is in no total.`, [l.id])
  if (!benefitsValued) gap('no-benefit-valued', `No benefit is valued${input.benefits.length ? '' : ' (no benefit line is recorded)'}, so there is no net present value and no benefit–cost ratio: ${NOT_VALUED_WORDS}.`)
  if (noFigure.length) gap('no-figure', `${plural(noFigure.length, 'cost line has', 'cost lines have')} no figure and add nothing: ${names(noFigure)}.`, noFigure)
  if (undatedIds.length) gap('undated', `${plural(undatedIds.length, 'line says', 'lines say')} neither one-off nor per year, so ${undatedIds.length === 1 ? 'it is' : 'they are'} counted but placed in no year and not discounted: ${names(undatedIds)}.`, undatedIds)
  if (noDuration.length) gap('no-duration', `${plural(noDuration.length, 'per-year line has', 'per-year lines have')} no duration and ${noDuration.length === 1 ? 'is' : 'are'} taken to run every year of the ${T}-year period: ${names(noDuration)}.`, noDuration)
  if (beyond.length) gap('beyond-period', `${plural(beyond.length, 'line runs', 'lines run')} past the end of the ${T}-year period; only the years inside it are counted: ${names(beyond)}.`, beyond)
  if (noPriceYear.length) gap('no-price-year', `${plural(noPriceYear.length, 'line carries', 'lines carry')} no price year and ${noPriceYear.length === 1 ? 'is' : 'are'} summed as entered, not converted to ${fyWords(P.priceYear)} prices: ${names(noPriceYear)}.`, noPriceYear)
  if (notConverted.length) gap('not-converted', `The deflator series holds no index for ${[...new Set([...(toIdx == null ? [P.priceYear] : []), ...notConverted.map((x) => x.year).filter((y) => idx.get(y) == null)])].sort().map(fyWords).join(', ')}, so ${plural(notConverted.length, 'line is', 'lines are')} summed as entered, not converted: ${names(notConverted.map((x) => x.id))}.`, notConverted.map((x) => x.id))
  if (oneSided.length) gap('floor', `${plural(oneSided.length, 'line is', 'lines are')} given as one number, read as a floor: ${names(oneSided)}.`, oneSided)
  if (employer.length) gap('excludes-employer-costs', `${plural(employer.length, 'staffing line excludes', 'staffing lines exclude')} employer costs (National Insurance, pension) — no on-cost uplift is set — so ${employer.length === 1 ? 'it is a floor' : 'they are floors'}: ${names(employer)}.`, employer)
  if (onCostWaiting.length) gap('on-cost-waiting', `Lex has proposed an on-cost uplift that is not yet accepted, so it is not applied: ${names(onCostWaiting)}.`, onCostWaiting)
  if (payerless.length) gap('payer', `${plural(payerless.length, 'cost line does', 'cost lines do')} not say who pays: ${names(payerless)}.`, payerless)
  if (obUntyped.length) gap('ob-type', `${plural(obUntyped.length, 'capital line has', 'capital lines have')} no Table 1 project type, so ${obUntyped.length === 1 ? 'it is' : 'they are'} in no optimism-bias band: ${names(obUntyped)}.`, obUntyped)
  const ownersList = [
    ...(P.set.years ? [`the appraisal period (${T} years)`] : []), ...(P.set.startYear ? [`the start year (${fyWords(P.startYear)})`] : []), ...(P.set.priceYear ? [`the price year (${fyWords(P.priceYear)})`] : []),
    ...owners.map((o) => o.text),
  ]
  if (ownersList.length) gap('owners', `These are the owner’s own assumptions, not drawn from a source: ${ownersList.join('; ')}.`, owners.map((o) => o.id))
  if (input.uncostedActions) gap('uncosted', `${plural(input.uncostedActions, 'live action has', 'live actions have')} neither a cost line nor a “no cost” answer, so ${input.uncostedActions === 1 ? 'its' : 'their'} costs are not in these totals.`)
  const notHeld = [
    ...(input.held.civilServiceStatistics ? [] : ['Civil Service Statistics (the salary floor for a staffing line is not checked against them)']),
    ...(input.held.deflatorReleaseDates ? [] : [`the deflator series’ release date and price basis (the index is used as held, without its release named${input.held.deflatorWhy ? `: ${input.held.deflatorWhy}` : ''})`]),
    ...(input.held.manifest === 'file' ? [] : [input.held.manifest === 'none' ? 'the citation manifest (no Green Book paragraph can be cited)' : 'Ingest’s citation manifest file (citations are checked against the paragraphs held instead)']),
  ]
  if (notHeld.length) gap('not-held', `Not yet held by the platform: ${notHeld.join('; ')}.`)
  // 26-AA item 9(c): the statistics ARE held now; what is not decided is which responsibility level a staffing line's junior / mid / senior
  // is, so the floor is held and NOT applied, and the gap says exactly that — never "not available"
  const staffLines = input.costs.filter((l) => l.costType === 'STAFF').map((l) => l.id)
  if (input.held.civilServiceStatistics && staffLines.length) {
    gap('not-held', `Civil Service Statistics 2026 are held (gross median salary by responsibility level, as at 31 March 2026${input.held.css?.releaseDate ? `, ${releaseWords(input.held.css.releaseDate)}` : ''}), but a staffing line says junior, mid or senior, which is not yet matched to a responsibility level, so ${plural(staffLines.length, 'staffing line is', 'staffing lines are')} not checked against them: ${names(staffLines)}.`, staffLines)
  }

  // ── Assumptions — the standing ones first, with their sources ──
  assumptions.unshift(
    { text: `The appraisal period is ${T} years, ${fyWords(P.startYear)} to ${fyWords(P.startYear + T - 1)}${P.set.years ? ' (set by the owner)' : ' (the default: the Green Book’s usual period for policy)'}.`, source: P.set.years ? 'the owner' : 'BRIEF_26Y decision 335', owners: P.set.years },
    { text: `Figures are in ${fyWords(P.priceYear)} prices, and present values are at ${fyWords(P.priceYear)} (the PV base year)${P.set.priceYear ? ' (set by the owner)' : P.priceYearFrom === 'current-year' ? ' (the default: the current financial year, as no deflator series is held)' : ' (the default: the latest deflator release held)'}.`, source: P.set.priceYear ? 'the owner' : 'CCh-Lex 18 Nov (GO, decision 335 default)', owners: P.set.priceYear },
    { text: 'Discounted at the Social Time Preference Rate: 3.00% a year to year 30, 2.50% from 31 to 75, 2.25% from 76 to 125, as forward rates; nothing is discounted beyond year 125.', source: `${ENGINE_CITATIONS.stpr}; ${ENGINE_CITATIONS.schedule}; ${ENGINE_CITATIONS.forwardRates}; ${ENGINE_CITATIONS.beyond125}`, owners: false },
    { text: 'Optimism bias never adjusts the headline figures: it is shown as a band beside them, at Table 1’s lower and upper bounds (a capital line by its project type; a running cost by the outsourcing row, the nearest analogue, not a rule). ' + OB_INDICATIVE, source: `${ENGINE_CITATIONS.obIndicative}; ${ENGINE_CITATIONS.obUpperBound}; Table 1, PDF p.2`, owners: false },
    // 26-AA item 9(c): the deflator's release, named, once the series held is matched to it year by year
    ...(input.held.deflatorRelease ? [{ text: `Prices are converted to ${fyWords(P.priceYear)} with HM Treasury’s GDP deflator at market prices, ${input.held.deflatorRelease.vintage}${input.held.deflatorRelease.releaseDate ? `, ${releaseWords(input.held.deflatorRelease.releaseDate)}` : ''}${input.held.deflatorRelease.priceBasis ? ` (${input.held.deflatorRelease.priceBasis})` : ''}.`, source: 'HM Treasury GDP deflators (the series held, matched to this release year by year)', owners: false }] : []),
    ...(input.benefits.some((b) => b.isHealth && b.valuation === 'VALUED') ? [{ text: `Health effects are discounted at the same rate; their real value is uprated by ${pct(HEALTH_VALUE_UPRATE.value)} a year first.`, source: ENGINE_CITATIONS.healthUprate, owners: false }] : []),
  )

  // ── the trace: every printed figure ──
  const trace: Record<string, Trace> = {}
  const T_ = (id: string, label: string, value: string, fl: Flow[], how: string, sched: number[] = scheduleYears) => {
    trace[id] = { id, label, value, lines: fl.map((f) => f.id), deflatorYears: [...new Set(fl.flatMap((f) => f.deflatorYears))].sort(), scheduleYears: sched, tableRows: [...new Set(fl.flatMap((f) => f.tableRows))], how }
  }
  const costFlows = flows.filter((f) => f.side === 'cost' && f.perYear.length), benFlows = flows.filter((f) => f.side === 'benefit' && f.perYear.length)
  T_('pv-costs', 'Present value of costs', rangeWords(totals.pvCosts), costFlows, 'Each cost line in the price year, placed in its years, times each year’s discount factor, summed.')
  T_('pv-benefits', 'Present value of benefits', benefitsValued ? rangeWords(totals.pvBenefits) : NOT_VALUED_WORDS, benFlows, 'Each valued benefit line in the price year (health effects uprated), placed in its years, times each year’s discount factor, summed.')
  T_('costs', 'Costs over the period, in the price year, undiscounted', rangeWords(totals.costs), costFlows, 'Each cost line in the price year, placed in its years, summed.', [])
  T_('benefits', 'Valued benefits over the period, in the price year, undiscounted', benefitsValued ? rangeWords(totals.benefits) : NOT_VALUED_WORDS, benFlows, 'Each valued benefit line in the price year, placed in its years, summed.', [])
  T_('npv', 'Net present value', npv ? rangeWords(npv) : NOT_VALUED_WORDS, [...costFlows, ...benFlows], 'Present value of benefits minus present value of costs; the low end pairs low benefits with high costs.')
  T_('bcr', 'Benefit–cost ratio', bcr ? ratioWords(bcr) : NOT_VALUED_WORDS, [...costFlows, ...benFlows], 'Present value of benefits divided by present value of costs; the low end pairs low benefits with high costs.')
  for (const y of years) {
    const inYear = (side: 'cost' | 'benefit') => flows.filter((f) => f.side === side && f.perYear.length && !isZero(f.perYear[y.t]))
    T_(`y${y.t}.costs`, `Costs in ${fyWords(y.fy)}`, rangeWords(y.costs), inYear('cost'), 'The cost lines falling in this year, in the price year.', [])
    T_(`y${y.t}.pv-costs`, `Present value of costs in ${fyWords(y.fy)}`, rangeWords(y.pvCosts), inYear('cost'), `This year’s costs × the discount factor for year ${y.discountYear} (${y.factor.toFixed(4)}).`, [y.discountYear])
    T_(`y${y.t}.benefits`, `Valued benefits in ${fyWords(y.fy)}`, benefitsValued ? rangeWords(y.benefits) : NOT_VALUED_WORDS, inYear('benefit'), 'The valued benefit lines falling in this year, in the price year.', [])
    T_(`y${y.t}.pv-benefits`, `Present value of benefits in ${fyWords(y.fy)}`, benefitsValued ? rangeWords(y.pvBenefits) : NOT_VALUED_WORDS, inYear('benefit'), `This year’s benefits (health effects uprated) × the discount factor for year ${y.discountYear} (${y.factor.toFixed(4)}).`, [y.discountYear])
  }
  for (const [k, g] of byHeading) {
    const fl = flows.filter((f) => f.group === k && f.perYear.length)
    T_(`heading:${k || 'none'}.pv-costs`, `Present value of costs under ${g.words}`, rangeWords(g.pvCosts), fl.filter((f) => f.side === 'cost'), 'This heading’s cost lines, discounted and summed.')
    T_(`heading:${k || 'none'}.pv-benefits`, `Present value of benefits under ${g.words}`, benefitsValued ? rangeWords(g.pvBenefits) : NOT_VALUED_WORDS, fl.filter((f) => f.side === 'benefit'), 'This heading’s valued benefit lines, discounted and summed.')
    for (let t = 0; t < T; t++) T_(`heading:${k || 'none'}.y${t}.costs`, `Costs under ${g.words} in ${fyWords(P.startYear + t)}`, rangeWords(g.costYears[t]), fl.filter((f) => f.side === 'cost' && !isZero(f.perYear[t])), 'This heading’s cost lines falling in this year, in the price year.', [])
  }
  for (const [k, g] of byPayer) T_(`payer:${k}.pv-costs`, `Present value of costs paid by ${g.words}`, rangeWords(g.pvCosts), costFlows.filter((f) => f.party === k), 'The cost lines this party pays, discounted and summed.')
  for (const [k, g] of byBen) T_(`beneficiary:${k}.pv-benefits`, `Present value of benefits to ${g.words}`, rangeWords(g.pvBenefits), benFlows.filter((f) => `${f.party}:${f.partyWords}` === k), 'The valued benefit lines for this party, discounted and summed.')
  for (const s of sensitivity) {
    const how = s.key === 'costs+20' ? 'Every cost flow × 1.2, then discounted as the main case.' : s.key === 'benefits-50' ? 'Every valued benefit flow × 0.5, then discounted as the main case.' : s.key === 'delay-1' ? 'Every flow moved one year later; a flow moved past the period falls out.' : `Every year’s forward rate ${s.key === 'rate+0.5' ? 'raised' : 'lowered'} by 0.5 points.`
    T_(`sens:${s.key}.pv-costs`, `${s.label}: present value of costs`, rangeWords(s.pvCosts), costFlows, how)
    T_(`sens:${s.key}.pv-benefits`, `${s.label}: present value of benefits`, benefitsValued ? rangeWords(s.pvBenefits) : NOT_VALUED_WORDS, benFlows, how)
    T_(`sens:${s.key}.npv`, `${s.label}: net present value`, s.npv ? rangeWords(s.npv) : NOT_VALUED_WORDS, [...costFlows, ...benFlows], how)
    T_(`sens:${s.key}.bcr`, `${s.label}: benefit–cost ratio`, s.bcr ? ratioWords(s.bcr) : NOT_VALUED_WORDS, [...costFlows, ...benFlows], how)
    if (s.lost) T_(`sens:${s.key}.lost`, `${s.label}: undiscounted amounts falling after the period`, `${rangeWords(s.lost.costs)} of costs and ${rangeWords(s.lost.benefits)} of benefits`, [...costFlows, ...benFlows], 'The flows of the last year of the period, moved one year later, so past its end.', [])
  }
  for (const f of flows) T_(`line:${f.id}`, `${f.side === 'cost' ? 'Cost' : 'Benefit'} line ${lineName(f.out.actionNumber, f.out.label)}`, f.perYear.length ? `${rangeWords(f.out.nominal)} in the price year; present value ${rangeWords(f.out.pv)}` : f.undated ? `${rangeWords(f.undated)} (no recurrence: in no year)` : f.out.whyNot ?? '—', [f], f.out.steps.join('; ') || 'as entered')
  if (obBandOut) T_('ob-band', 'With optimism bias at Table 1’s indicative starting values (never in the headline)', obBandWords(obBandOut), banded, 'The analysis recomputed with every banded cost line at Table 1’s lower bound, then at its upper bound (a capital line by its project type; a running cost by the outsourcing row, the nearest analogue).')
  if (undated.lines) T_('undated.costs', 'Cost lines with no recurrence, counted and placed in no year', rangeWords(undated.costs), flows.filter((f) => f.undated), 'Summed as converted; not discounted, because no year is known.', [])

  const citations = [...new Set([ENGINE_CITATIONS.stpr, ENGINE_CITATIONS.schedule, ENGINE_CITATIONS.forwardRates, ENGINE_CITATIONS.beyond125, ENGINE_CITATIONS.optimismBias,
    ENGINE_CITATIONS.obUpperBound, ENGINE_CITATIONS.obIndicative,
    ...(obRows.some((o) => o.source.includes(ENGINE_CITATIONS.obReduce)) ? [ENGINE_CITATIONS.obReduce] : []),
    ...(input.benefits.some((b) => b.isHealth) ? [ENGINE_CITATIONS.healthUprate] : []),
    ...input.costs.map((c) => c.citationKey).filter((k): k is string => !!k)])]

  return {
    ok: true, period: P, years, totals, benefitsValued, npv, bcr,
    byHeading: input.headings.filter((h) => byHeading.has(h.id)).map((h) => byHeading.get(h.id)!).concat(byHeading.has('') ? [byHeading.get('')!] : []),
    byPayer: [...byPayer.values()], byBeneficiary: [...byBen.values()],
    sensitivity, lines: flows.map((f) => f.out), optimismBias: obRows, obBand: obBandOut, undated, gaps, assumptions, trace, citations,
    attributions: [...new Set([...input.costs.map((c) => c.attribution), ...input.benefits.filter((b) => b.valuation === 'VALUED' && b.sourceWords).map((b) => b.attribution)].filter((x): x is string => !!x))],
  }
}

/** Place one line's (converted) figure into the period's years. One-off → year 0; per year → each year of its duration; neither → undated. */
function place(l: { id: string; recurrence: 'ONE_OFF' | 'PER_YEAR' | null; durationMonths: number | null }, v: Money, T: number, steps: string[], undatedIds: string[], noDuration: string[], beyond: string[]): { perYear: Money[]; undated: Money | null } {
  if (l.recurrence === 'ONE_OFF') {
    steps.push('one-off: in the first year of the period')
    return { perYear: Array.from({ length: T }, (_, t) => (t === 0 ? v : Z())), undated: null }
  }
  if (l.recurrence === 'PER_YEAR') {
    if (l.durationMonths == null || !(l.durationMonths > 0)) { noDuration.push(l.id); steps.push(`per year, no duration: every year of the ${T}-year period`) }
    else {
      steps.push(`per year for ${l.durationMonths} months`)
      if (l.durationMonths > T * 12) { beyond.push(l.id); steps.push(`only the first ${T} years fall inside the period`) }
    }
    return { perYear: Array.from({ length: T }, (_, t) => mulM(v, shareOfYear(t, l.durationMonths))), undated: null }
  }
  undatedIds.push(l.id)
  steps.push('no recurrence: counted, placed in no year')
  return { perYear: [], undated: v }
}

const to2 = (n: number) => (Math.round(n * 100) / 100).toString()
function plural(n: number, one: string, many: string) { return `${n} ${n === 1 ? one : many}` }

/** Every trace id a printed figure may name — the report and Lex both resolve through this. */
export function traceIds(r: CbaResult): string[] { return r.ok ? Object.keys(r.trace) : [] }
