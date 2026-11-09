// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X X3 — A PRICE FROM MEASURED RUNS: a fixed part per call plus a part per character read. PURE; CLIENT-SAFE (imports nothing).
// Shared by the digest's price (action-digest-pure.ts) and the policy test's (policy-test-pure.ts), so the two fit the same way.
//
// Why two parts: most of a model call's cost is its own output (the answer, the reasoning), which hardly moves with the input; the rest scales
// with what it reads. A price per character alone underprices a short read (a heading of eight statements); a price per action is wrong by the
// length of whatever drafts are accepted. With fewer than two runs, or a fit whose parts come out negative (noise between two runs), the price
// falls back to per character alone — never a negative fixed cost.
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceRun { calls: number; chars: number; pence: number }
export interface PriceFit { fixed: number; perChar: number; how: 'fixed + per character' | 'per character' }

export function fitPrice(runs: readonly PriceRun[]): PriceFit {
  const perCharOnly = (): PriceFit => ({ fixed: 0, perChar: runs.reduce((n, r) => n + r.pence, 0) / Math.max(1, runs.reduce((n, r) => n + r.chars, 0)), how: 'per character' })
  if (runs.length < 2) return perCharOnly()
  // least squares on pence = fixed * calls + perChar * chars
  let a = 0, b = 0, c = 0, d = 0, e = 0
  for (const r of runs) { a += r.calls * r.calls; b += r.calls * r.chars; c += r.chars * r.chars; d += r.calls * r.pence; e += r.chars * r.pence }
  const det = a * c - b * b
  if (Math.abs(det) < 1e-9) return perCharOnly()
  const fixed = (d * c - b * e) / det, perChar = (a * e - b * d) / det
  if (fixed < 0 || perChar < 0) return perCharOnly()
  return { fixed, perChar, how: 'fixed + per character' }
}

export const priceOf = (f: PriceFit, calls: number, chars: number): number => Math.max(0, f.fixed * calls + f.perChar * chars)
