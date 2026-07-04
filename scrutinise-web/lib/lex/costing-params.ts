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
 *  Adjustment Ranges", Mott MacDonald 2002 evidence base): the values below are the
 *  CAPITAL EXPENDITURE UPPER bounds (starting point at outline business case);
 *  lower bounds are 2% / 4% / 3% / 6% / 10%. Outsourcing = 41% on OPEX. */
export const OPTIMISM_BIAS_UPLIFTS: CostingParam<Record<string, number>> = {
  value: {
    'standard-buildings': 0.24,
    'non-standard-buildings': 0.51,
    'standard-civil': 0.44,
    'non-standard-civil': 0.66,
    'equipment-and-development': 2.0,
  },
  unit: 'fraction uplift on capex (upper bound, outline business case)',
  source: 'HMT Supplementary Green Book Guidance — Optimism Bias, Table 1',
  status: 'VERIFIED',
  verified: true,
  note: 'Verified 2026-07-04 against Optimism_bias.pdf (Table 1). Uplift reduces as risks are actively managed; lower bounds 0.02/0.04/0.03/0.06/0.10. Apply to implementationCost.',
}
