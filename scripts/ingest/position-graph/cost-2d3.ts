/**
 * cost-2d3.ts — the price list and the token arithmetic, in one importable place.
 *
 * BRIEF_GRAPH_2D3 §1: "This is the graph's first real LLM spend. Predict the cost in CHANGE_LOG
 * before running anything, run a bounded pilot first, and score the prediction after."
 *
 * The prediction and the meter therefore have to use the SAME constants, or the score afterwards
 * measures the difference between two spreadsheets rather than between a forecast and a bill.
 */

/** gemini-2.5-flash list price, USD per 1M tokens. Same source as web-orientation.ts. */
export const FLASH_IN_PER_M = 0.3
export const FLASH_OUT_PER_M = 2.5

/**
 * Words → tokens. 1.33 is the ratio web-orientation and vector-common already assume for English
 * prose; it is an estimate and is labelled as one. The meter reports the API's OWN usage counts,
 * so the prediction can be scored against something measured rather than against itself.
 */
export const TOKENS_PER_WORD = 1.33
export const wordsToTokens = (words: number) => words * TOKENS_PER_WORD

/** Instruction + proposition list carried on every extraction call. Measured in the pilot. */
export const PROMPT_OVERHEAD_TOKENS = 1500
/**
 * Output tokens per extraction call. The model emits ONLY the propositions a submission actually
 * addresses (a no-position is recorded from the ask, not emitted), which is what keeps the output
 * bill — the dominant half at $2.50/M — down to single figures.
 */
export const OUT_TOKENS_PER_CALL = 400

export interface Meter { inTokens: number; outTokens: number; thoughtTokens: number; calls: number; errors: number }
export const newMeter = (): Meter => ({ inTokens: 0, outTokens: 0, thoughtTokens: 0, calls: 0, errors: 0 })

/** ⚠ Thought tokens are billed at the OUTPUT rate. Counting them in is the only honest total. */
export function meterUsd(m: Meter): number {
  return (m.inTokens / 1e6) * FLASH_IN_PER_M + ((m.outTokens + m.thoughtTokens) / 1e6) * FLASH_OUT_PER_M
}

export function meterLine(m: Meter): string {
  return `${m.calls.toLocaleString('en-GB')} calls · in ${m.inTokens.toLocaleString('en-GB')} tok · out ${m.outTokens.toLocaleString('en-GB')} tok`
    + (m.thoughtTokens ? ` · thought ${m.thoughtTokens.toLocaleString('en-GB')} tok` : '')
    + ` · $${meterUsd(m).toFixed(4)}${m.errors ? ` · ${m.errors} errors` : ''}`
}
