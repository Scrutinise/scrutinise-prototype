/**
 * spend-ledger.ts (ingest side) — BRIEF_SEARCH_S6 §3, the writer for the scripts runtime.
 *
 * ⚠ THIS IS A TWIN OF `scrutinise-web/lib/lex/spend-ledger.ts`, AND THE DUPLICATION IS A BUILD
 * BOUNDARY RATHER THAN A CHOICE. `scripts/ingest/tsconfig.json` sets `rootDir: "."`, so nothing
 * under `scrutinise-web/` can be compiled into this project — the same boundary that put a second
 * copy of the §18 finishReason guard in `position-graph/llm-2d3.ts`.
 *
 * ⚠ WHAT IS *NOT* DUPLICATED, WHICH IS THE PART THAT WOULD ACTUALLY HURT: **the rate card.** This
 * side writes tokens and leaves the cost NULL with `unpriced = TRUE`; the web side prices rows when
 * it reads them. Two copies of a price list is how two components come to disagree about what
 * something cost — the class of defect this project spent a fortnight finding in other forms.
 * One writer per runtime, one pricer, one table.
 *
 * ⚠ AND `unpriced = TRUE` IS NOT A LIE ABOUT AN UNPRICEABLE MODEL. It means "this row has not been
 * priced yet", which is true, and it fails safe: a total containing it reports NULL rather than a
 * partial sum, so an ingest run cannot make a per-idea figure look smaller than it is.
 *
 * Usage:
 *   import { recordSpend } from '../shared/spend-ledger'
 *   await recordSpend({ stream: 'graph', pass: 'graph.position-extract', model: MODEL,
 *                       tokensIn: m.inTokens, tokensOut: m.outTokens, ref: runId })
 *
 *   npx tsx shared/spend-ledger.ts --self-test     # offline
 *   npx tsx shared/spend-ledger.ts --report        # what the platform has spent
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './neon-pool'

export type SpendStream = 'lex' | 'build' | 'deepening' | 'orientation' | 'graph' | 'ingest' | 'admin'

export interface SpendEntry {
  stream: SpendStream
  /** The pass name from scrutinise-web/lib/lex/model-registry.ts — the join between what was
   *  configured and what it cost. Without it a rising bill cannot be attributed to a change. */
  pass: string
  model: string
  tokensIn: number
  tokensOut: number
  /** Thinking tokens. Kept separate because they bill at the OUTPUT rate. */
  tokensThinking?: number
  userId?: string | null
  ideaId?: string | null
  /**
   * ⚠ On behalf of a group. Present before the feature that needs it, because a column added
   * after there is history leaves every earlier row NULL, and NULL then cannot be told apart
   * from "an individual spent this". Ingest spend will essentially always be null here; the
   * twin carries the field so the two writers cannot drift on the table's shape.
   */
  groupId?: string | null
  ref?: string | null
  /** ⚠ A failed call still costs money. Recording only successes understates the bill by exactly
   *  the calls you most want to know about. */
  failed?: boolean
}

const STREAMS: SpendStream[] = ['lex', 'build', 'deepening', 'orientation', 'graph', 'ingest', 'admin']

/** Reject a row that cannot be attributed, BEFORE it reaches the table. */
export function validateEntry(e: SpendEntry): string | null {
  if (!STREAMS.includes(e.stream)) return `unknown stream "${e.stream}"`
  if (!e.pass?.trim()) return 'pass is required — it is the join between what was configured and what it cost'
  if (!e.model?.trim()) return 'model is required'
  if (!Number.isFinite(e.tokensIn) || e.tokensIn < 0) return `tokensIn must be a non-negative number, got ${e.tokensIn}`
  if (!Number.isFinite(e.tokensOut) || e.tokensOut < 0) return `tokensOut must be a non-negative number, got ${e.tokensOut}`
  return null
}

/**
 * Append one row. ⚠ Never throws into the caller's path: a ledger failure must not take down the
 * work it was measuring. It warns loudly instead, because a silent one is worse.
 */
export async function recordSpend(e: SpendEntry): Promise<boolean> {
  const bad = validateEntry(e)
  if (bad) { console.warn(`[spend-ledger] REFUSED a row: ${bad}`); return false }
  try {
    const pool = getNeonPool()
    await pool.query(
      `INSERT INTO "LlmSpend" ("stream","pass","model","tokensIn","tokensOut","tokensThinking",
                               "estCostPence","unpriced","userId","ideaId","groupId","ref","failed")
       VALUES ($1,$2,$3,$4,$5,$6,NULL,TRUE,$7,$8,$9,$10,$11)`,
      [e.stream, e.pass, e.model, Math.round(e.tokensIn), Math.round(e.tokensOut),
        Math.round(e.tokensThinking ?? 0), e.userId ?? null, e.ideaId ?? null, e.groupId ?? null,
        e.ref ?? null, e.failed ?? false])
    return true
  } catch (err) {
    console.warn('[spend-ledger] could not record spend:', err instanceof Error ? err.message : err)
    return false
  }
}

/** Record a whole run's meter in one row — for a sweep, where per-call rows would be noise. */
export const recordMeter = (
  meter: { inTokens: number; outTokens: number; thoughtTokens?: number; calls: number; errors: number },
  ctx: Omit<SpendEntry, 'tokensIn' | 'tokensOut' | 'tokensThinking'>,
): Promise<boolean> => recordSpend({
  ...ctx, tokensIn: meter.inTokens, tokensOut: meter.outTokens,
  tokensThinking: meter.thoughtTokens ?? 0, failed: ctx.failed ?? meter.errors > 0,
})

async function report() {
  const pool = getNeonPool()
  const { rows } = await pool.query<{ stream: string; pass: string; model: string; calls: string; ti: string; tout: string; up: string; pence: string | null }>(`
    SELECT stream, pass, model, COUNT(*)::text calls, SUM("tokensIn")::text ti,
           SUM("tokensOut" + "tokensThinking")::text tout,
           COUNT(*) FILTER (WHERE unpriced)::text up,
           CASE WHEN COUNT(*) FILTER (WHERE unpriced) > 0 THEN NULL ELSE SUM("estCostPence")::text END pence
    FROM "LlmSpend" GROUP BY 1,2,3 ORDER BY SUM("tokensIn" + "tokensOut") DESC LIMIT 40`)
  console.log(`\n════ PLATFORM SPEND — every model call on record ════`)
  if (!rows.length) { console.log('  the ledger is empty'); return }
  console.log(`  stream       pass                          model                 calls    tok in   tok out  unpriced  pence`)
  for (const r of rows) {
    console.log(`  ${r.stream.padEnd(12)} ${r.pass.slice(0, 28).padEnd(28)} ${r.model.slice(0, 20).padEnd(20)} `
      + `${Number(r.calls).toLocaleString('en-GB').padStart(6)} ${Number(r.ti).toLocaleString('en-GB').padStart(9)} `
      + `${Number(r.tout).toLocaleString('en-GB').padStart(9)} ${r.up.padStart(8)}  ${r.pence == null ? '(unpriced)' : Number(r.pence).toFixed(2)}`)
  }
  const { rows: [t] } = await pool.query<{ calls: string; up: string }>(
    `SELECT COUNT(*)::text calls, COUNT(*) FILTER (WHERE unpriced)::text up FROM "LlmSpend"`)
  console.log(`\n  ${Number(t.calls).toLocaleString('en-GB')} calls on record · ${t.up} awaiting a price`)
  console.log(`  ⚠ An unpriced row is not a free one. Rates live in scrutinise-web/lib/lex/build-cost.ts,`)
  console.log(`    and Anthropic and xAI have none on file yet (docs/MODEL_CONTRACT.md §3).`)
}

function selftest() {
  const base: SpendEntry = { stream: 'graph', pass: 'graph.position-extract', model: 'gemini-2.5-flash', tokensIn: 10, tokensOut: 2 }
  const cases: Array<[string, boolean]> = [
    ['a valid entry passes', validateEntry(base) === null],
    ['an unknown stream is refused', !!validateEntry({ ...base, stream: 'marketing' as SpendStream })],
    ['a missing pass is refused', !!validateEntry({ ...base, pass: '' })],
    ['a missing model is refused', !!validateEntry({ ...base, model: '  ' })],
    ['negative tokens are refused', !!validateEntry({ ...base, tokensIn: -1 })],
    ['NaN tokens are refused', !!validateEntry({ ...base, tokensOut: Number.NaN })],
    ['zero tokens are ALLOWED — a failed call really did use none', validateEntry({ ...base, tokensIn: 0, tokensOut: 0 }) === null],
    ['a null user and idea are allowed — ingest belongs to neither',
      validateEntry({ ...base, userId: null, ideaId: null }) === null],
    // ⚠ THE RATE CARD MUST NOT APPEAR ON THIS SIDE OF THE BOUNDARY — the one duplication that would
    // actually hurt. Checked against the code ABOVE this test, not the whole file: the first version
    // read __filename and matched its own regex literal, which is a check that can only ever fail.
    // A self-referential assertion is not a guard. Watched failing with a planted `inPerM`.
    ['⚠ this file carries no rate card', (() => {
      const src: string = require('fs').readFileSync(__filename, 'utf8')
      const codeOnly = src.slice(0, src.indexOf('function selftest'))
      return !/\b(inPerM|outPerM|USD_TO_GBP)\b/.test(codeOnly)
    })()],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (process.argv.includes('--self-test')) { selftest(); return }
  try { if (process.argv.includes('--report')) await report() } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[spend-ledger] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
