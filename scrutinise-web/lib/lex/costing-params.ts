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

export type ParamStatus = 'VERIFIED' | 'TRAINING_RECALL'

export interface CostingParam<T> {
  value: T
  unit: string
  source: string
  status: ParamStatus
  /** Convenience gate: only VERIFIED params may produce user-facing figures. */
  verified: boolean
  note?: string
}

/** Social Time Preference Rate — converts future costs/benefits to today's values. */
export const STPR_DISCOUNT_RATE: CostingParam<number> = {
  value: 0.035,
  unit: 'real, per year, first 30 years',
  source: 'HM Treasury Green Book',
  status: 'VERIFIED',
  verified: true,
  note: 'Under formal HMT review announced 2026 — re-check on review conclusion. v1 presents undiscounted figures with the STPR noted (COSTING_SCOPE §4.6); NPV discounting is a v2 refinement.',
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

/** Health discount rate (health/life effects). VERIFIED against the Green Book 2026,
 *  §6.58: "These health and life effects should be discounted at a lower rate of 1.5%,
 *  rather than the standard STPR" (wealth-effect component excluded). */
export const HEALTH_DISCOUNT_RATE: CostingParam<number> = {
  value: 0.015,
  unit: 'real, per year (health and life effects)',
  source: 'HM Treasury Green Book 2026, §6.58',
  status: 'VERIFIED',
  verified: true,
  note: 'Verified 2026-07-04 against The_Green_Book_2026.pdf. Applies alongside the 3.5% STPR for non-health effects.',
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
