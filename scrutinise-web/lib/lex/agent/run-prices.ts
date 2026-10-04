// 26-P §3 — WHAT A RUN COSTS, STATED BEFORE IT IS RUN.
//
// ⚠⚠ EACH FIGURE CARRIES WHERE IT CAME FROM (CLAUDE.md §19: a measured fact and an inferred one must not look identical on
// the page). 26-P shipped the BRIEF's figures, labelled "not measured". 4 Oct (CCh follow-up, item 4): each process was run
// FOR REAL on a scratch copy of a real idea (`scripts/verify-lex-26p-run.ts`, `scripts/measure-26o-builds.ts`) and the cost
// read off the spend ledger — and the brief's figures were wrong in BOTH directions:
//
//     run_gap_check       14p  →  18.4p   (5 calls: four panel models + the test pass on gemini-2.5-pro, 5.5p of it)
//     run_consolidation   11p  →   9.0p   (four drafts + the Opus 5.5 judge; ≈ the 11.0p MODEL_REVIEW modelled, less cached input)
//     run_comparison       2p  →   1.5p   (one gemini-2.5-pro call)
//
// A `measured` entry says on how many real runs, and when. ONE run is a sample, not a mean: the card says "n=1" in so many
// words. The next real run should be added to `runs` (and `pence` recomputed) — the verifier prints the line to paste. A kind
// with no measurement keeps the brief's figure and the "not measured" label.

export type RunKind = 'run_comparison' | 'run_gap_check' | 'run_consolidation' | 'rerun_build'

export interface RunMeasurement {
  /** Every measured total, in pence, oldest first. */
  runs: number[]
  /** UTC date of the most recent. */
  on: string
  /** What was run, and what the figure includes. */
  what: string
}

export interface RunPrice {
  /** Pence. Measured where `measured` is present (the mean of its runs), otherwise the brief's figure. For `rerun_build` a FLOOR. */
  pence: number
  isFloor: boolean
  /** Starts with `measured` when it is one. The card keys its wording on this. */
  source: string
  label: string
  measured?: RunMeasurement
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const round1 = (n: number) => Math.round(n * 10) / 10

function measuredPrice(label: string, m: RunMeasurement, isFloor = false): RunPrice {
  return { pence: round1(mean(m.runs)), isFloor, label, measured: m, source: `measured, ${m.runs.length === 1 ? 'n=1' : `mean of n=${m.runs.length}`} real run${m.runs.length === 1 ? '' : 's'}, ${m.on}` }
}
/** The brief's own figure, kept for any kind not yet measured. Every kind is measured today; this is the fallback shape. */
export const briefPrice = (pence: number, isFloor: boolean, label: string): RunPrice => ({ pence, isFloor, label, source: 'BRIEF_26P §3 — not measured' })

export const RUN_PRICES: Record<RunKind, RunPrice> = {
  run_comparison: measuredPrice('the material comparison', { runs: [1.5], on: '2026-10-04', what: 'one gemini-2.5-pro comparison of one filed note against the strategy' }),
  run_gap_check: measuredPrice('the gap check', { runs: [18.4], on: '2026-10-04', what: 'four panel models plus the gemini-2.5-pro test pass, 12 suggestions written' }),
  run_consolidation: measuredPrice('the consolidation', { runs: [9], on: '2026-10-04', what: 'four drafts (Opus 5.5, gpt-6.1-sol, Gemini 3.1 Pro, Grok 4.7) plus the Opus 5.5 judge' }),
  // Three FULL builds on scratch copies of three real ideas (452c5ade, a6473880, 5c7287d2), the worker's retrieval stack,
  // this working tree's code, the current build models: 32.2p, 28.8p, 36.2p (`scripts/measure-26o-builds.ts`). A REUSE
  // re-run (research kept) is cheaper and has NOT been measured, so this is the FULL price, which the card's mode says.
  rerun_build: measuredPrice('a re-run of the build', { runs: [32.2, 28.8, 36.2], on: '2026-10-04', what: 'three FULL builds on scratch copies of three real ideas, current build models, worker retrieval stack' }),
}

/** §3: "asks first above ~5p". Anything at or below this runs without a button. */
export const ASK_ABOVE_PENCE = 5

export function runNeedsConfirmation(kind: RunKind): boolean {
  return RUN_PRICES[kind].pence > ASK_ABOVE_PENCE
}

export const isMeasured = (p: RunPrice) => !!p.measured

export function priceSentence(kind: RunKind): string {
  const p = RUN_PRICES[kind]
  return `${p.label} costs ${p.isFloor ? 'at least ' : 'about '}${p.pence}p${isMeasured(p) ? ` (measured on ${p.measured!.runs.length === 1 ? 'one real run' : `${p.measured!.runs.length} real runs`})` : ' (an estimate, not measured)'}`
}
