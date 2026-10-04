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
  /**
   * 26-O §5a — USD per 1M input tokens SERVED FROM THE PROVIDER'S CACHE. Absent means "no cached rate on
   * file": cached tokens are then billed at `inPerM`, which OVERSTATES a call that did hit a cache — the
   * known direction, said here rather than hidden. Never a guess upward or downward.
   */
  cachedInPerM?: number
  /** 26-O §5a — USD per 1M input tokens WRITTEN to a cache (Anthropic bills 1.25× input for the 5-minute cache). */
  cacheWritePerM?: number
}

/** 26-O §5b — a rate carries the date it takes effect (UTC, inclusive). */
export interface DatedRate extends ModelRate {
  /** YYYY-MM-DD, UTC. `EARLIEST` means "in force when first recorded; its start date is not known". */
  from: string
}

/** The sentinel for a first row whose real start date we do not hold. Not a claim that the rate applied in 1970. */
export const EARLIEST = '1970-01-01'

/**
 * List prices, per 1,000,000 tokens, USD.
 *
 * ⚠ A PRICE IS A FACT ABOUT A DAY, so every figure carries its source and the date it was
 * checked (S8 §7). A rate table with no provenance cannot be audited or refreshed — the next
 * reader has no way to tell a current price from one that was right eighteen months ago.
 *
 * ⚠ NOT verified against an invoice — these are published list prices. See the header.
 */
const DEFAULT_RATES: Record<string, ModelRate> = {
  // ── Google ─────────────────────────────────────────────────────────────────────────────────
  // Source: Google's published Gemini API pricing. Checked 2026-08-17.
  // 26-O §5a — cached-read rates are from docs/MODEL_REVIEW_2026-09-30.md §3–§4 (each provider's own pricing page,
  // read 30 Sep 2026). Gemini's cache is EXPLICIT (`cachedContents`) — implicit caching was measured at 0 tokens on
  // 2.5 and 3.8 Flash — so `cachedInPerM` only ever applies if we start creating cachedContents objects.
  'gemini-2.5-flash': { inPerM: 0.30, outPerM: 2.50, cachedInPerM: 0.03 },
  'gemini-2.5-flash-lite': { inPerM: 0.10, outPerM: 0.40 },
  'gemini-2.5-pro': { inPerM: 1.25, outPerM: 10.00 },
  // 26-O §4a — the price-matched panel's Gemini, a PREVIEW (MODEL_REVIEW §1: $2 / $12 up to 200k tokens, cached $0.20).
  'gemini-3.1-pro-preview': { inPerM: 2.00, outPerM: 12.00, cachedInPerM: 0.20 },
  // 26-O §5b — Gemini 3.x Flash: the NEXT rows are in `RATE_CHANGES` below. MODEL_REVIEW §3, Google's pricing page,
  // 30 Sep 2026: 3.6/3.7/3.8 Flash are $0.75/$3.75 (cache $0.075) THROUGH 31 DEC 2026, $1.50/$7.50 (cache $0.15) FROM
  // 1 JAN 2027 — exactly double. 3.5 Flash is $1.50/$9.00 with no promotion.
  'gemini-3.5-flash': { inPerM: 1.50, outPerM: 9.00 },
  'gemini-3.6-flash': { inPerM: 0.75, outPerM: 3.75, cachedInPerM: 0.075 },
  'gemini-3.7-flash': { inPerM: 0.75, outPerM: 3.75, cachedInPerM: 0.075 },
  'gemini-3.8-flash': { inPerM: 0.75, outPerM: 3.75, cachedInPerM: 0.075 },

  // ── Anthropic ──────────────────────────────────────────────────────────────────────────────
  // S8 §7 item 1. Source: https://platform.claude.com/docs/en/about-claude/models/overview
  // Checked 2026-08-19.
  // ⚠ Every model named in `model-registry.ts`'s REACHABLE.anthropic is priced here, so a pass
  // pointed at any of them reports a cost rather than "unpriced" — which is what made the cost
  // CEILING unenforceable, since `priceBuild` returns `pence: null` the moment one model in a
  // run has no rate.
  'claude-opus-5': { inPerM: 5.00, outPerM: 25.00 },
  'claude-opus-4-8': { inPerM: 5.00, outPerM: 25.00 },
  'claude-opus-4-7': { inPerM: 5.00, outPerM: 25.00 },
  // ⚠ Sonnet 5 carries an introductory rate of $2.00/$10.00 through 2026-08-31. The LIST price is
  // recorded rather than the promotion: an estimate that silently assumes a discount overstates
  // the ceiling's headroom the day the promotion ends, and this table has no expiry mechanism.
  'claude-sonnet-5': { inPerM: 3.00, outPerM: 15.00 },
  // 26-P — Sonnet 5.5, the model the tool-calling Lex runs on. Anthropic's published table, read from the
  // claude-api reference cached 2026-09-25: $2.00 in / $10.00 out (cache reads $0.20, which `agent/loop.ts`
  // prices itself via `actualUsd`). ⚠ NOT verified against an invoice.
  // `cacheWritePerM` is Anthropic's published 1.25× input for the 5-minute cache.
  'claude-sonnet-5-5': { inPerM: 2.00, outPerM: 10.00, cachedInPerM: 0.20, cacheWritePerM: 2.50 },
  // 26-O §4a — Opus 5.5 ($4 / $20, cache read $0.20) and Fable 5.1 ($10 / $50, read $0.25): MODEL_REVIEW §1, Anthropic's
  // own pricing page, 30 Sep 2026. Opus 5.5 is the new judge. Not verified against an invoice.
  'claude-opus-5-5': { inPerM: 4.00, outPerM: 20.00, cachedInPerM: 0.20, cacheWritePerM: 5.00 },
  'claude-fable-5-1': { inPerM: 10.00, outPerM: 50.00, cachedInPerM: 0.25, cacheWritePerM: 12.50 },
  'claude-fable-5': { inPerM: 10.00, outPerM: 50.00 },
  'claude-haiku-4-5': { inPerM: 1.00, outPerM: 5.00 },
  // The dated form of the Haiku id, which `scripts/legislation/compile.ts` names as its Gemini-429
  // fallback. Same model, same price — priced under both spellings so the fallback path cannot
  // report "unpriced" on the one run where it actually fires.
  'claude-haiku-4-5-20251001': { inPerM: 1.00, outPerM: 5.00 },

  // ── xAI ────────────────────────────────────────────────────────────────────────────────────
  // S8 §7 item 1. Source: https://docs.x.ai/docs/models. Checked 2026-08-19.
  // ⚠⚠ xAI PRICES ARE TIERED BY PROMPT LENGTH — each model has a low and a high band (grok-4.6 is
  // $2.00/$6.00 below the threshold and $4.00/$12.00 above it). This table has one rate per model
  // and no length input, so it records the LOW band and will UNDERSTATE a long-prompt call by up
  // to 2×. That is stated here rather than hidden because an estimate whose error direction is
  // known is usable and one whose isn't is not. Making it exact means threading prompt length
  // into `priceBuild`, which is a change to the meter, not to this table.
  'grok-4.6': { inPerM: 2.00, outPerM: 6.00 },
  'grok-4.5': { inPerM: 2.00, outPerM: 6.00 },
  'grok-4.3': { inPerM: 1.25, outPerM: 2.50 },
  'grok-4.20-0309-reasoning': { inPerM: 1.25, outPerM: 2.50 },
  'grok-4.20-0309-non-reasoning': { inPerM: 1.25, outPerM: 2.50 },
  'grok-4.20-multi-agent-0309': { inPerM: 1.25, outPerM: 2.50 },
  'grok-build-0.1': { inPerM: 1.00, outPerM: 2.00 },
  // 26-L addendum 3 §5 — `grok-4.7` WAS MISSING, so every Consolidate read "cost unknown" and
  // (worse) every consolidation total silently excluded it. Source: https://docs.x.ai/docs/models,
  // read 2026-09-29: $2.00 in / $6.00 out below a 200k-token prompt, $4.00/$12.00 at or above it,
  // the higher band applying to ALL tokens of that request. Consolidate prompts are ~2.5k tokens,
  // so the LOW band is the right one here; same known-direction caveat as the rows above.
  // Not verified against an invoice. (Cached-input $0.50/M is not modelled — no caching is used.)
  // 26-O §5a — cached input $0.50/M (MODEL_REVIEW §1). xAI also reports its OWN billed cost, which the ledger prefers.
  'grok-4.7': { inPerM: 2.00, outPerM: 6.00, cachedInPerM: 0.50 },

  // ── OpenAI ─────────────────────────────────────────────────────────────────────────────────
  // S25 — Source: https://developers.openai.com/api/docs/pricing. Checked 2026-09-25.
  // ⚠ SAME TIERING CAVEAT AS xAI, ABOVE: gpt-6-luna is priced in Standard/Batch/Flex/Fast-mode
  // tiers, each with short- and long-context bands. This records the Standard, SHORT-context
  // rate (the cheapest common case) — a long-context or Fast-mode call will be understated,
  // same known-direction tradeoff the xAI comment above accepts rather than threading context
  // length into `priceBuild`.
  // cached input $0.01/M — MEASURED 30 Sep (MODEL_REVIEW §4: 7,263 of 7,278 tokens cached on the second identical call).
  'gpt-6-luna': { inPerM: 0.10, outPerM: 0.50, cachedInPerM: 0.01 },
  // 26-O §4a — the price-matched panel's OpenAI model ($2 / $10, MODEL_REVIEW §1) and the flagship (astra, $10/$50,
  // cached $1.00). No cached rate on file for `gpt-6.1-sol`, so its cached tokens bill at the full input rate (overstated).
  'gpt-6.1-sol': { inPerM: 2.00, outPerM: 10.00 },
  'gpt-6-astra': { inPerM: 10.00, outPerM: 50.00, cachedInPerM: 1.00 },
}

/**
 * ══ 26-O §5b — EVERY RATE CARRIES AN EFFECTIVE DATE ═══════════════════════════════════════════
 *
 * `DEFAULT_RATES` above is the rate in force from the earliest date we hold (`EARLIEST`) until a LATER row here
 * replaces it. A rate is a fact about a day, so a change is a new dated row — never an edit in place, which would
 * re-price every historical call at a rate that did not yet exist.
 *
 * ⚠ Gemini 3.6/3.7/3.8 Flash DOUBLE on 1 JANUARY 2027. Before this, the table had no dates and would have kept the
 * introductory rate past midnight, quietly halving every estimate from that day on. `rateAt()` now picks the row by
 * the date of the call (or of the estimate), and `check:lex-26o` asserts the flip.
 */
const RATE_CHANGES: Record<string, DatedRate[]> = {
  'gemini-3.6-flash': [{ from: '2027-01-01', inPerM: 1.50, outPerM: 7.50, cachedInPerM: 0.15 }],
  'gemini-3.7-flash': [{ from: '2027-01-01', inPerM: 1.50, outPerM: 7.50, cachedInPerM: 0.15 }],
  'gemini-3.8-flash': [{ from: '2027-01-01', inPerM: 1.50, outPerM: 7.50, cachedInPerM: 0.15 }],
}

/** Every rate row for a model, oldest first. The first is `EARLIEST` from `DEFAULT_RATES`. */
export function rateHistory(model: string): DatedRate[] {
  const base = DEFAULT_RATES[model]
  const rows: DatedRate[] = [...(base ? [{ from: EARLIEST, ...base }] : []), ...(RATE_CHANGES[model] ?? [])]
  return rows.sort((a, b) => a.from.localeCompare(b.from))
}

const utcDay = (at: Date) => at.toISOString().slice(0, 10)

/** The rate in force for `model` on the UTC day of `at` (default: now). `undefined` = no rate on file → UNPRICED. */
export function rateAt(model: string, at: Date = new Date()): ModelRate | undefined {
  const day = utcDay(at)
  const override = overrides()[model]
  if (override) return override
  let hit: DatedRate | undefined
  for (const r of rateHistory(model)) if (r.from <= day) hit = r
  if (!hit) return undefined
  const { from: _from, ...rate } = hit
  return rate
}

/**
 * 26-O §5a — price one call's tokens: uncached input, cached input and cache-write input each at their own rate.
 * `tokensCached` and `tokensCacheWrite` are SUBSETS of `tokensIn`. Pure; shared by the ledger, the estimators and
 * the check so there is ONE definition of the arithmetic (CLAUDE.md §26.5).
 */
export function priceTokens(
  t: { tokensIn: number; tokensOut: number; tokensCached?: number; tokensCacheWrite?: number },
  rate: ModelRate,
): number {
  const cached = Math.min(Math.max(t.tokensCached ?? 0, 0), t.tokensIn)
  const write = Math.min(Math.max(t.tokensCacheWrite ?? 0, 0), Math.max(t.tokensIn - cached, 0))
  const uncached = t.tokensIn - cached - write
  return (uncached / 1_000_000) * rate.inPerM
    + (cached / 1_000_000) * (rate.cachedInPerM ?? rate.inPerM)
    + (write / 1_000_000) * (rate.cacheWritePerM ?? rate.inPerM)
    + (t.tokensOut / 1_000_000) * rate.outPerM
}

/** USD → GBP. Overridable; a rate that moves is not worth a deploy. */
const USD_TO_GBP = Number(process.env.LEX_BUILD_USD_GBP ?? '0.79')

/** The LEX_BUILD_RATES override — UNDATED by design: an operator override wins on every day until removed. */
function overrides(): Record<string, ModelRate> {
  const raw = process.env.LEX_BUILD_RATES
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, ModelRate>
  } catch {
    // A malformed override must not silently revert to the defaults as though it had
    // been applied — say so, then use the defaults.
    console.error('[build-cost] LEX_BUILD_RATES is not valid JSON — using the built-in rates')
    return {}
  }
}

/** The whole table as it stands on the UTC day of `at` (default: now). Callers that index it get the dated rate. */
export function rates(at: Date = new Date()): Record<string, ModelRate> {
  const out: Record<string, ModelRate> = {}
  for (const m of new Set([...Object.keys(DEFAULT_RATES), ...Object.keys(RATE_CHANGES), ...Object.keys(overrides())])) {
    const r = rateAt(m, at)
    if (r) out[m] = r
  }
  return out
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
export function priceBuild(usages: LlmUsage[], at: Date = new Date()): BuildPrice {
  let tokensIn = 0
  let tokensOut = 0
  let usd = 0
  const unpriced = new Set<string>()

  for (const u of usages) {
    tokensIn += u.tokensIn
    tokensOut += u.tokensOut
    const rate = rateAt(u.model, at)
    if (!rate) {
      // Only counts as unpriced if it actually spent something. A model that was
      // configured but never called should not blank out an otherwise good estimate.
      if (u.tokensIn || u.tokensOut) unpriced.add(u.model)
      continue
    }
    usd += priceTokens(u, rate)
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
