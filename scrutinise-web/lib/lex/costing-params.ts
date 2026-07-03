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

/** Health discount rate (risk-to-life/health values). NOT verified — do not use yet. */
export const HEALTH_DISCOUNT_RATE: CostingParam<number> = {
  value: 0.015,
  unit: 'real, per year (risk-to-life/health values)',
  source: 'Green Book',
  status: 'TRAINING_RECALL',
  verified: false,
  note: 'VERIFY in Phase 2b before use.',
}

/** Optimism-bias uplifts by project class (applied to implementationCost — COSTING_SCOPE
 *  §4.3). NOT verified — do not apply until Phase 2b pins them against the guidance. */
export const OPTIMISM_BIAS_UPLIFTS: CostingParam<Record<string, number>> = {
  value: {
    'standard-buildings': 0.24,
    'non-standard-buildings': 0.51,
    'standard-civil': 0.44,
    'non-standard-civil': 0.66,
    'equipment-and-development': 2.0,
  },
  unit: 'fraction uplift on upper-bound capex',
  source: 'Green Book supplementary guidance on optimism bias',
  status: 'TRAINING_RECALL',
  verified: false,
  note: 'VERIFY in Phase 2b before use; apply to implementationCost.',
}
