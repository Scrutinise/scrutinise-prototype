/**
 * measure-context-budget.ts — what does a bigger answer context COST?
 *
 * §1 of the Stage 2A brief asks for one number for Charlie, not a decision made here: the
 * answer-call input token count and the end-to-end latency at context budgets of 16, 24 and 32,
 * on three representative queries. THE BUDGET IS NOT CHANGED BY THIS SPRINT — the default stays
 * 16. This script exists so the trade is priced rather than argued.
 *
 * It runs the REAL `runGeneralCorpusChat`, so what is measured is what a user gets: routing,
 * retrieval, interleaving, and one Gemini answer call over the first N interleaved documents.
 * Token counts come from the API's own `usageMetadata`, not from an estimate over a reconstructed
 * prompt — a reconstruction would drift from the real prompt and the drift would be invisible.
 *
 * Budgets are run FORWARD then REVERSED on the second query set pass, because the working rule is
 * to reverse the order of any A/B run: without it a warm-cache effect on the last budget measured
 * looks like that budget being cheap.
 *
 * Env: `--env-file=.env` for DATABASE_URL and GEMINI_API_KEY; pass FTS_SEARCH_URL and
 * LEX_QUERY_ROUTER=true inline.
 */
import { runGeneralCorpusChat } from '../lib/lex/general-chat'

const BUDGETS = [16, 24, 32]

/** Three questions that plainly span several streams — a single-stream question would understate
 *  the cost, because the whole point of the budget is that it is now shared between streams. */
const QUERIES = [
  'what have select committees said about the regulation of buy now pay later lending',
  'what does the law and the case law say about landlord possession under section 21',
  'what is the current legal and regulatory position on water company sewage discharges',
]

interface Row { q: string; budget: number; promptTokens?: number; outputTokens?: number; searchMs: number; answerMs?: number; totalMs: number; context: number; streams: string; failed: boolean }

async function runOne(q: string, budget: number): Promise<Row> {
  process.env.LEX_GENERAL_CONTEXT_LIMIT = String(budget)
  const t0 = Date.now()
  const out = await runGeneralCorpusChat({ question: q })
  const totalMs = Date.now() - t0
  const d = out.diagnostics
  return {
    q, budget,
    promptTokens: d.promptTokens, outputTokens: d.outputTokens,
    searchMs: d.searchMs, answerMs: d.answerMs, totalMs,
    context: d.contextCount,
    streams: (d.contextStreams ?? []).map((s) => `${s.stream}:${s.inContext}`).join(' '),
    failed: d.searchFailed || !out.answer,
  }
}

async function main() {
  for (const v of ['FTS_SEARCH_URL', 'GEMINI_API_KEY']) {
    if (!process.env[v]) { console.error(`${v} is not set — this measures the live path.`); process.exit(1) }
  }
  console.log(`answer-context budget: input tokens and latency at ${BUDGETS.join(', ')}`)
  console.log(`router=${process.env.LEX_QUERY_ROUTER ?? '(unset)'}  queries=${QUERIES.length}  (forward pass, then reversed)\n`)

  const rows: Row[] = []
  for (const order of [BUDGETS, [...BUDGETS].reverse()]) {
    console.log(`── budgets ${order.join(' → ')} ──`)
    for (const q of QUERIES) {
      for (const b of order) {
        const r = await runOne(q, b)
        rows.push(r)
        console.log(
          `  budget ${String(r.budget).padStart(2)}  ctx ${String(r.context).padStart(2)}  ` +
          `in ${String(r.promptTokens ?? -1).padStart(6)} tok  out ${String(r.outputTokens ?? -1).padStart(4)} tok  ` +
          `search ${String(r.searchMs).padStart(5)}ms  answer ${String(r.answerMs ?? -1).padStart(5)}ms  ` +
          `total ${String(r.totalMs).padStart(5)}ms  ${r.failed ? 'FAILED' : r.streams}`,
        )
      }
    }
  }

  console.log('\n════ PER BUDGET (mean over both orders, failures excluded) ════')
  const ok = rows.filter((r) => !r.failed && r.promptTokens)
  const base = { tok: 0, total: 0 }
  for (const b of BUDGETS) {
    const rs = ok.filter((r) => r.budget === b)
    if (!rs.length) { console.log(`  budget ${b}: no successful runs`); continue }
    const mean = (f: (r: Row) => number) => rs.reduce((n, r) => n + f(r), 0) / rs.length
    const tok = mean((r) => r.promptTokens ?? 0)
    const ans = mean((r) => r.answerMs ?? 0)
    const total = mean((r) => r.totalMs)
    if (b === BUDGETS[0]) { base.tok = tok; base.total = total }
    const d = (v: number, b0: number) => (b0 ? ` (${v >= b0 ? '+' : ''}${(((v - b0) / b0) * 100).toFixed(0)}%)` : '')
    console.log(
      `  budget ${String(b).padStart(2)}  n=${rs.length}  input ${tok.toFixed(0)} tok${d(tok, base.tok)}  ` +
      `answer ${ans.toFixed(0)}ms  end-to-end ${total.toFixed(0)}ms${d(total, base.total)}`,
    )
  }
  console.log('\n  The budget is UNCHANGED at 16 by this sprint. These are the numbers the decision needs.')
  console.log('  Input tokens are the recurring cost; latency is the user-visible one. Both are per query.')
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
