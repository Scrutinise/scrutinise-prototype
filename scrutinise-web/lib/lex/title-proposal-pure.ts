// 26-X addendum 323 — "N actions have no title · Title them with Lex": the count is in the label, and so is the price (170: measured,
// never a guess). PURE: no imports, client-safe (CLAUDE.md §28).
//
// The price is the mean of every `actions.titles` call in the spend ledger, read on 4 Nov 2026 (LlmSpend, pass = 'actions.titles'):
// 0.93p, 1.59p, 2.31p, 2.08p — gemini-2.5-pro, one call per batch of up to 45 untitled actions (action-structure.ts BATCH).

export const TITLE_RUNS_PENCE = [0.93, 1.59, 2.31, 2.08] as const
export const TITLE_BATCH = 45

/** About what titling `n` actions costs: the measured mean per call, times the calls `n` needs. Null when nothing needs a call. */
export function titleProposalPrice(n: number): { pence: number | null; runs: number } {
  if (n <= 0 || !TITLE_RUNS_PENCE.length) return { pence: null, runs: TITLE_RUNS_PENCE.length }
  const per = TITLE_RUNS_PENCE.reduce((a, p) => a + p, 0) / TITLE_RUNS_PENCE.length
  return { pence: Math.round(per * Math.ceil(n / TITLE_BATCH) * 10) / 10, runs: TITLE_RUNS_PENCE.length }
}

/** 323 — the counted button says what its count is. */
export function untitledWords(n: number): string {
  return `${n} action${n === 1 ? ' has' : 's have'} no title`
}
