// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §2 — what a build cost, "with the spend recorded on the row and shown
// to the user".
//
// ⚠ THE ONE RULE THIS FILE EXISTS TO HOLD: A MODEL WE CANNOT PRICE COSTS `null`, NOT
// ZERO. Zero is a claim, and it is the claim most likely to be believed — a build that
// ran four LLM calls and reports "£0.00" tells the user something false and tells the
// cost ceiling nothing at all, so the ceiling silently stops holding. `priceBuild`
// therefore returns `{ pence: null, unpriced: [models] }` and every caller must decide
// what to do about it rather than inheriting a comfortable default.
//
// ⚠ THE RATES ARE LIST PRICES RECORDED FROM GOOGLE'S PUBLISHED PRICING, NOT FIGURES
// RECONCILED AGAINST A BILL. That is why the column is `estCostPence` and why the UI
// says "estimated". Treat a large discrepancy as a rate-card problem first.
//
// Rates are overridable without a deploy: LEX_BUILD_RATES is a JSON object of
//   { "<model>": { "inPerM": <USD per 1M input tokens>, "outPerM": <USD per 1M output> } }
// which is merged over the defaults. A model absent from both is UNPRICED, by design.
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmUsage } from './build-llm'

export interface ModelRate {
  /** USD per 1,000,000 input tokens. */
  inPerM: number
  /** USD per 1,000,000 output tokens (thinking tokens included — see build-llm.ts). */
  outPerM: number
}

/**
 * List prices as published by Google for the paid tier, recorded 2026-08-17.
 * NOT verified against an invoice in this sprint — see the header.
 */
const DEFAULT_RATES: Record<string, ModelRate> = {
  'gemini-2.5-flash': { inPerM: 0.30, outPerM: 2.50 },
  'gemini-2.5-flash-lite': { inPerM: 0.10, outPerM: 0.40 },
  'gemini-2.5-pro': { inPerM: 1.25, outPerM: 10.00 },
}

/** USD → GBP. Overridable; a rate that moves is not worth a deploy. */
const USD_TO_GBP = Number(process.env.LEX_BUILD_USD_GBP ?? '0.79')

export function rates(): Record<string, ModelRate> {
  const raw = process.env.LEX_BUILD_RATES
  if (!raw) return DEFAULT_RATES
  try {
    const parsed = JSON.parse(raw) as Record<string, ModelRate>
    return { ...DEFAULT_RATES, ...parsed }
  } catch {
    // A malformed override must not silently revert to the defaults as though it had
    // been applied — say so, then use the defaults.
    console.error('[build-cost] LEX_BUILD_RATES is not valid JSON — using the built-in rates')
    return DEFAULT_RATES
  }
}

export interface BuildPrice {
  tokensIn: number
  tokensOut: number
  /** Estimated pence. NULL when any model in the run has no rate — never 0 as a stand-in. */
  pence: number | null
  /** Models we could not price. Non-empty ⇒ `pence` is null and the reason is nameable. */
  unpriced: string[]
}

/** Price a set of calls. Usage from failed calls counts: a failure that burned tokens cost money. */
export function priceBuild(usages: LlmUsage[]): BuildPrice {
  const table = rates()
  let tokensIn = 0
  let tokensOut = 0
  let usd = 0
  const unpriced = new Set<string>()

  for (const u of usages) {
    tokensIn += u.tokensIn
    tokensOut += u.tokensOut
    const rate = table[u.model]
    if (!rate) {
      // Only counts as unpriced if it actually spent something. A model that was
      // configured but never called should not blank out an otherwise good estimate.
      if (u.tokensIn || u.tokensOut) unpriced.add(u.model)
      continue
    }
    usd += (u.tokensIn / 1_000_000) * rate.inPerM + (u.tokensOut / 1_000_000) * rate.outPerM
  }

  return {
    tokensIn,
    tokensOut,
    pence: unpriced.size ? null : Math.round(usd * USD_TO_GBP * 100 * 10_000) / 10_000,
    unpriced: [...unpriced],
  }
}

/** What the user reads. Never invents a number it does not have. */
export function formatSpend(price: BuildPrice): string {
  const tokens = `${price.tokensIn.toLocaleString()} in / ${price.tokensOut.toLocaleString()} out`
  if (price.pence == null) {
    return `${tokens} — cost not estimated (no rate on file for ${price.unpriced.join(', ')})`
  }
  if (price.pence < 1) return `${tokens} — estimated cost under 1p`
  return `${tokens} — estimated cost ${price.pence.toFixed(1)}p`
}
