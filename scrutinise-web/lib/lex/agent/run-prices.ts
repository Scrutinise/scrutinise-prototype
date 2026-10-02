// 26-P §3 — WHAT A RUN COSTS, STATED BEFORE IT IS RUN.
//
// ⚠⚠ THESE ARE THE BRIEF'S FIGURES, NOT MEASURED PRE-RUN ESTIMATORS. Only `build-estimate.ts` holds a
// measured estimate (for builds). The comparison, the gap check and the consolidation report what they
// cost AFTER they ran. The `source` is carried to the confirmation card so a figure the brief supplied
// cannot be presented as one the platform measured (CLAUDE.md §19: a measured fact and an inferred one
// must not look identical on the page).

export type RunKind = 'run_comparison' | 'run_gap_check' | 'run_consolidation' | 'rerun_build'

export interface RunPrice {
  /** Pence, as the brief states it. For `rerun_build` this is a FLOOR ("30p+"). */
  pence: number
  isFloor: boolean
  source: 'BRIEF_26P §3 — not measured'
  label: string
}

export const RUN_PRICES: Record<RunKind, RunPrice> = {
  run_comparison: { pence: 2, isFloor: false, source: 'BRIEF_26P §3 — not measured', label: 'the material comparison' },
  run_gap_check: { pence: 14, isFloor: false, source: 'BRIEF_26P §3 — not measured', label: 'the gap check' },
  run_consolidation: { pence: 11, isFloor: false, source: 'BRIEF_26P §3 — not measured', label: 'the consolidation' },
  rerun_build: { pence: 30, isFloor: true, source: 'BRIEF_26P §3 — not measured', label: 'a re-run of the build' },
}

/** §3: "asks first above ~5p". Anything at or below this runs without a button. */
export const ASK_ABOVE_PENCE = 5

export function runNeedsConfirmation(kind: RunKind): boolean {
  return RUN_PRICES[kind].pence > ASK_ABOVE_PENCE
}

export function priceSentence(kind: RunKind): string {
  const p = RUN_PRICES[kind]
  return `${p.label} costs ${p.isFloor ? 'at least ' : 'about '}${p.pence}p`
}
