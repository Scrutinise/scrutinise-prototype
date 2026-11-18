// LEX 26-Y — the narrative's price, MEASURED on scratch (scripts/measure-26y.ts), never guessed. Pure; client-safe.
// Measured 18 Nov 2026 ~11:47 UTC on a scratch copy of 452c5ade with 3 cost and 3 benefit lines (a 1,104-character prompt), model
// claude-sonnet-5-5: 0.49p, 0.50p, 0.46p (n=3, mean 0.48p, max 0.50p). The prompt grows with the number of lines (about 180 characters
// each), so an idea with many more lines costs more than this; the screen says "about" and the ledger records each run's real price.
export const NARRATIVE_PRICE: { pence: number | null; note: string; n: number } = {
  pence: 0.5,
  n: 3,
  note: 'measured 18 Nov 2026 over 6 lines (0.46–0.50p, n=3); more lines cost a little more',
}
