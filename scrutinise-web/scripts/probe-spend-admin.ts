/**
 * probe-spend-admin.ts — run the admin spend aggregates against the real ledger.
 *
 * ⚠ "Built inert" has hidden a write-path bug in this project before: the stats layer was
 * tsc-clean and reported SUCCESS while three of six paths were broken. This calls the exact
 * function the route calls, against the real database, and prints what the page would render.
 */
import path from 'path'
import { spendOverview, averagePerIdea, fmtPence } from '../lib/lex/spend-admin'
export {}
async function main() {
  const until = new Date()
  const since = new Date(until.getTime() - 90 * 864e5)
  const o = await spendOverview(since, until)
  console.log(`\n════ what /admin → Spend would show, ${o.since} → ${o.until} ════`)
  console.log(`  total            ${fmtPence(o.totals.pence)}  (${o.totals.calls} calls, ${o.totals.unpricedCalls} unpriced)`)
  console.log(`  tokens           ${o.totals.tokensIn} in / ${o.totals.tokensOut} out`)
  console.log(`  avg per idea     ${fmtPence(o.averagePencePerIdea)}  — ${o.averageNote}`)
  console.log(`  ideas with spend ${o.ideasCounted}`)
  console.log(`  ⚠ unclassified   ${o.unclassifiedPasses.join(', ') || '(none)'}`)
  console.log('\n  daily rows:')
  for (const d of o.daily) console.log(`    ${d.day} ${d.kind.padEnd(16)} ${String(d.tokensIn + d.tokensOut).padStart(8)} tok  ${fmtPence(d.pence)}`)
  console.log('\n  ideas, most to least expensive:')
  for (const i of o.ideas.slice(0, 10)) console.log(`    ${fmtPence(i.pence).padStart(10)}  ${i.calls} calls  ${(i.title ?? '(untitled)').slice(0, 50)}`)
  // ⚠ the average rule, exercised on synthetic input rather than trusted
  const a = averagePerIdea([{ ideaId: 'a', title: null, calls: 1, tokensIn: 0, tokensOut: 0, pence: 100, unpricedCalls: 0 },
                            { ideaId: 'b', title: null, calls: 1, tokensIn: 0, tokensOut: 0, pence: null, unpricedCalls: 1 }])
  console.log(`\n  ⚠ average with one unpriced idea = ${a.average === null ? 'null (correct)' : 'A NUMBER — WRONG'} — ${a.note}`)
  const b = averagePerIdea([{ ideaId: 'a', title: null, calls: 1, tokensIn: 0, tokensOut: 0, pence: 100, unpricedCalls: 0 },
                            { ideaId: 'b', title: null, calls: 1, tokensIn: 0, tokensOut: 0, pence: 300, unpricedCalls: 0 }])
  console.log(`  average of 100p and 300p = ${b.average}p ${b.average === 200 ? '(correct)' : '(WRONG)'}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
