// ─────────────────────────────────────────────────────────────────────────────
// Costing engine — appraisal PARAMETERS (not benchmarks). Mirrored from
// docs/cost-benchmarks-seed-v1.json `parameters` per its loader_note ("load
// parameters into config"). Edit the JSON first, mirror here — same single-source
// rule as method.ts.
//
// HARD RULE: a parameter whose status is TRAINING_RECALL is NOT verified against
// a primary source yet and MUST NOT drive a user-facing number until Phase 2b
// verifies it (the estimator must check `verified` before applying one).
// ─────────────────────────────────────────────────────────────────────────────

/** SUPERSEDED = was verified against an edition that has since been replaced; kept for history, never drives a figure. */
export type ParamStatus = 'VERIFIED' | 'TRAINING_RECALL' | 'SUPERSEDED'

export interface CostingParam<T> {
  value: T
  unit: string
  source: string
  status: ParamStatus
  /** Convenience gate: only VERIFIED params may produce user-facing figures. */
  verified: boolean
  note?: string
}

// ── 325 (7 Nov 2026) — the STPR after the 2026 Discount Rate Review ─────────────────────────────────────────────
// Re-anchored to HMT's October 2026 documents, read from their PDF text on 4 Nov 2026 by INGEST-CBA-1
// (docs/ingest_traces/cba1_pilot_readback.txt; report docs/INGEST_CBA_1_REPORT.md):
//   · Green Book supplementary guidance — Discounting (October 2026) ("GB discounting"): 2.1, 3.1–3.2, 3.8–3.10, Annex A
//   · The Green Book (October 2026, gov.uk path the-green-book--2): 6.54, 8.58
// The February 2026 Green Book's 3.5% and its "§6.58" health rate are gone. In the October edition 6.58 is a different
// sentence ("Discounting should not be applied retrospectively…"), so the old citation pointed at the wrong text.

/** Social Time Preference Rate for years 1–30 — the headline rate. For anything spanning more than 30 years use
 *  STPR_SCHEDULE / discountFactor(), never this number on its own (GB discounting 3.8–3.9). */
export const STPR_DISCOUNT_RATE: CostingParam<number> = {
  value: 0.03,
  unit: 'real, per year, years 1–30',
  source: 'HMT Green Book supplementary guidance — Discounting (October 2026), para 2.1; Green Book (October 2026), para 6.54',
  status: 'VERIFIED',
  verified: true,
  note: 'Verified 2026-11-07 (325) from the October 2026 PDF text. Was 0.035 (Green Book Feb 2026) until the 2026 Discount Rate Review concluded. Apply only to values in real terms (GB discounting 3.12). v1 presents undiscounted figures with the STPR noted (COSTING_SCOPE §4.6); NPV discounting is a v2 refinement.',
}

export interface StprBand { fromYear: number; toYear: number; rate: number }

/** The declining schedule. FORWARD rates (para 3.9): a 40-year appraisal uses 3.00% to year 30, then 2.50% for years
 *  31–40 — not 2.50% in every year. Nothing is discounted after year 125 (para 3.10: "not an analytically meaningful
 *  technique"; use other methods and discuss with HM Treasury). ODA proposals may differ (para 3.11; FCDO). */
export const STPR_SCHEDULE: CostingParam<readonly StprBand[]> = {
  value: [
    { fromYear: 1, toYear: 30, rate: 0.03 },
    { fromYear: 31, toYear: 75, rate: 0.025 },
    { fromYear: 76, toYear: 125, rate: 0.0225 },
  ],
  unit: 'real forward rate by appraisal year (year 0 = undiscounted)',
  source: 'HMT Green Book supplementary guidance — Discounting (October 2026), paras 3.8–3.10, Annex A',
  status: 'VERIFIED',
  verified: true,
  note: 'Verified 2026-11-07 (325): discountFactor() reproduces every Annex A factor, years 0–125, to 4 dp (npm run check:costing-params). Practitioners must not use different rates for different types of proposal (para 3.2).',
}

/** The last year the schedule covers. */
export const STPR_LAST_YEAR = 125

/** The forward rate for appraisal year `year` (1–125), or null outside the schedule. Pure. */
export function stprRateForYear(year: number): number | null {
  if (!Number.isInteger(year) || year < 1) return null
  return STPR_SCHEDULE.value.find((b) => year >= b.fromYear && year <= b.toYear)?.rate ?? null
}

/** The discount factor for appraisal year `year`: 1 at year 0, then the product of 1/(1+r) over each year's forward rate
 *  (GB discounting 2.16, 3.9). Null after year 125 (para 3.10) or for a year that is not a whole number ≥ 0 — a caller
 *  must say why it cannot discount, never substitute a number. Pure. */
export function discountFactor(year: number): number | null {
  if (!Number.isInteger(year) || year < 0 || year > STPR_LAST_YEAR) return null
  let f = 1
  for (let t = 1; t <= year; t++) f /= 1 + (stprRateForYear(t) as number)
  return f
}

/** EANDCB threshold triggering independent RPC scrutiny (±£/yr). The engine should
 *  flag when a proposal's regulatory friction crosses it (COSTING_SCOPE §4.5). */
export const EANDCB_RPC_SCRUTINY_THRESHOLD: CostingParam<number> = {
  value: 5_000_000,
  unit: 'GBP per year, +/-',
  source: 'Better Regulation Framework',
  status: 'VERIFIED',
  verified: true,
  note: 'Measures above ±£5m EANDCB require independent RPC scrutiny — surfacing this is a credibility feature.',
}

/** SUPERSEDED (325, 7 Nov 2026). The February 2026 Green Book, §6.58, said: "These health and life effects should be
 *  discounted at a lower rate of 1.5%, rather than the standard STPR". The October 2026 edition has no separate health
 *  rate: health effects are discounted at the STPR like everything else (GB discounting 3.1–3.2) and their real values
 *  are UPRATED by 2% a year instead (Green Book Oct 2026, 8.58 → HEALTH_VALUE_UPRATE). Kept for history; verified:false,
 *  so it cannot drive a figure. */
export const HEALTH_DISCOUNT_RATE: CostingParam<number> = {
  value: 0.015,
  unit: 'real, per year (health and life effects)',
  source: 'HM Treasury Green Book (February 2026), §6.58 — superseded by the October 2026 edition',
  status: 'SUPERSEDED',
  verified: false,
  note: 'Verified 2026-07-04 against The_Green_Book_2026.pdf (February edition). Superseded 2026-11-07: see HEALTH_VALUE_UPRATE.',
}

/** Uprating of future real health effects (VPF, QALY, SLY / VOLY values): "the value of future real health effects
 *  should be uprated by 2% per annum over time" (Green Book Oct 2026, 8.58), because the diminishing marginal utility of
 *  consumption does not apply to them. Applied to the VALUE before discounting at the STPR — it is not a discount rate. */
export const HEALTH_VALUE_UPRATE: CostingParam<number> = {
  value: 0.02,
  unit: 'real, per year — uprating of future real health-effect values, before discounting at the STPR',
  source: 'HMT Green Book (October 2026), para 8.58',
  status: 'VERIFIED',
  verified: true,
  note: 'Verified 2026-11-07 (325) from the October 2026 PDF text read back 2026-11-04. Further detail is in the Green Book supplementary guidance on health (not held; NOT CHECKED).',
}

/** Optimism-bias uplifts by project class (applied to implementationCost — COSTING_SCOPE
 *  §4.3). VERIFIED against Table 1 of the HMT supplementary guidance ("Recommended
 *  Adjustment Ranges", Mott MacDonald 2002 evidence base), PDF page 2 (printed "2/15").
 *  ⚠ Table 1 has FOUR columns per project type, under "Optimism Bias (%)":
 *      Works Duration › Upper | Works Duration › Lower | Capital Expenditure › Upper | Capital Expenditure › Lower
 *  This parameter is ONLY the third column, Capital Expenditure › Upper (the starting value,
 *  para 3.11). It is not a works-duration (time) figure. Renamed from OPTIMISM_BIAS_UPLIFTS on
 *  4 Nov 2026 so the name says which column it came from. Outsourcing (41* / 0*) is omitted:
 *  its footnote says it is measured on operating expenditure, not capex. */
export const OPTIMISM_BIAS_CAPEX_UPPER: CostingParam<Record<string, number>> = {
  value: {
    'standard-buildings': 0.24,
    'non-standard-buildings': 0.51,
    'standard-civil': 0.44,
    'non-standard-civil': 0.66,
    'equipment-and-development': 2.0,
  },
  unit: 'fraction uplift on capital expenditure (Table 1 column "Capital Expenditure — Upper")',
  source: 'HMT Supplementary Green Book Guidance — Optimism Bias (2013), Table 1, column Capital Expenditure › Upper, PDF p.2',
  status: 'VERIFIED',
  verified: true,
  note: 'Verified 2026-07-04 against Optimism_bias.pdf (Table 1); column headings re-read from the page image 2026-11-04. Capital Expenditure › Lower: 0.02/0.04/0.03/0.06/0.10. Works Duration (Upper/Lower, not used here): 4/1, 39/2, 20/1, 25/3, 54/10. Uplift reduces as risks are actively managed. Apply to implementationCost.',
}
