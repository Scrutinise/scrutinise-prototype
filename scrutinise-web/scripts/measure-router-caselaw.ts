/**
 * measure-router-caselaw.ts — S2C6 §2: the `caselaw` selection item, carried five times, answered.
 *
 * ⚠ FIRST, WHAT THE CARRIED ITEM ACTUALLY SAYS, BECAUSE IT IS NOT WHAT FOUR BRIEFS HAVE ASSUMED.
 *
 * S2C, S2C2, S2C4 and S2C6 all describe "`caselaw` selection 36/36 → 22/36" as something "the gold
 * set answers" over "that 36-query set". **There is no 36-query set.** The number comes from
 * S2B §2.3's exit-criterion run (CHANGE_LOG 2026-08-09 12:10): a production-budget sample of
 * routing calls, of which **36 were decided forward** — "36/36 decided forward, 24/24 reversed".
 * `caselaw` appeared in all 36 of those decisions before the few-shot examples landed and in 22
 * after. The denominator is a count of CALLS in one run, not a fixture that can be re-run.
 *
 * And the gold set cannot answer it either, for a reason nobody had checked: **`gold-queries.ts`
 * contains no caselaw archetype at all.** Its 43 queries declare the streams legislation,
 * legislation+guidance, citation graph, debates, bills+debates, codes/guidance,
 * investigations/inquiries, parliamentary evaluations, web+foreign, legislation(section-level) —
 * and not one answer key names a law report. So "answered by the gold set" was never available,
 * which is why five sprints in a row could truthfully report it as not done.
 *
 * WHAT THIS MEASURES INSTEAD, which is the question the item was standing in for: **does the
 * router select `caselaw` when case law is the right answer, and refrain when it is not?** A fall
 * from 36/36 to 22/36 is GOOD if the 14 it stopped selecting were queries with no case-law answer,
 * and a recall defect if they were not. Selection frequency alone cannot tell those apart, which
 * is precisely why the raw number could never settle anything.
 *
 * So: two labelled sets. WANTS — a competent lawyer would reach for a judgment. DOES-NOT — the
 * answer is statute, procedure or policy, and reaching for a judgment would be wrong. Both are
 * written to share vocabulary with the other side ("liability", "duty", "unlawful") so the router
 * cannot score well on surface words alone.
 *
 * ⚠ REPEATS ARE NOT OPTIONAL (S2A working rule, earned twice). Routing is an LLM call with a
 * measured ~3% runaway rate; one pass measures the sample, not the system. Each query is routed
 * `--repeats N` times (default 3) and both the majority verdict and the per-call spread are
 * reported, so an intermittent selection cannot read as a stable one.
 *
 * Usage:
 *   LEX_QUERY_ROUTER=true GEMINI_API_KEY=… npx tsx --env-file=.env --tsconfig tsconfig.json \
 *     scripts/measure-router-caselaw.ts [--repeats 3]
 */
import fs from 'fs'
import path from 'path'
import { routeQuery } from '../lib/lex/query-expansion'

const REPEATS = (() => { const i = process.argv.indexOf('--repeats'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 3 })()
const OUT = path.join(__dirname, '../../docs/router_caselaw_selection.json')

/** Queries where a judgment IS the right answer — selecting `caselaw` is correct. */
const WANTS: string[] = [
  'what have the courts held about the reasonableness of service charges under section 19',
  'case law on whether a gig economy driver is a worker or self-employed',
  'how have judges interpreted the public sector equality duty in judicial review',
  'court decisions on the scope of legal professional privilege in regulatory investigations',
  'what did the Supreme Court decide about prorogation of Parliament',
  'judicial interpretation of "reasonable adjustments" under the Equality Act',
  'leading authority on the duty of care owed by a local authority to children in care',
  'how have tribunals applied the test for unfair dismissal in redundancy cases',
]

/** Queries where reaching for a judgment would be WRONG — statute, procedure or policy answers. */
const DOES_NOT: string[] = [
  'what is the current rate of the plastic bag charge and which regulations set it',
  'how many MPs voted for the assisted dying bill at second reading',
  'what did the government estimate the Ivory Act would cost business',
  'what is the procedure for a private members bill to get a second reading',
  'which department is responsible for water quality regulation and what guidance has it issued',
  'what does the ICO say about the lawful basis for processing employee data',
  'how much does the UK spend on social protection each year',
  'what were the responses to the consultation on leasehold reform',
]

type Row = { query: string; wants: boolean; calls: Array<string[] | null>; caselawCount: number; failOpens: number }

async function routeOnce(q: string): Promise<string[] | null> {
  try {
    const r = await routeQuery(q.split(/\s+/).filter(Boolean), '')
    // A null decision is a FAIL-OPEN, not "no streams". They must not be averaged together:
    // a fail-open means the query got no scoping at all, which is a different (and worse)
    // outcome than a considered decision to skip caselaw. Counted separately below.
    return r ? Object.keys(r) : null
  } catch { return null }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is not set — this measures the LIVE router.'); process.exit(1) }
  if (process.env.LEX_QUERY_ROUTER !== 'true') {
    // ⚠ routeQuery returns null when the flag is off — indistinguishable from a fail-open at this
    // call site. Measuring with the flag off would report 0/16 caselaw selection and 100% fail-open
    // from a router that was never asked to run. §18's corollary, exactly.
    console.error('LEX_QUERY_ROUTER is not "true" — routeQuery returns null for OFF, which this')
    console.error('harness cannot tell from a fail-open. Refusing to run and report an artefact.')
    process.exit(1)
  }
  console.log(`router-caselaw selection — ${WANTS.length} wants + ${DOES_NOT.length} does-not, ${REPEATS} repeats each\n`)

  const rows: Row[] = []
  for (const [set, wants] of [[WANTS, true], [DOES_NOT, false]] as Array<[string[], boolean]>) {
    for (const q of set) {
      const calls: Array<string[] | null> = []
      for (let i = 0; i < REPEATS; i++) calls.push(await routeOnce(q))
      const failOpens = calls.filter((c) => c === null).length
      const caselawCount = calls.filter((c) => c?.includes('caselaw')).length
      rows.push({ query: q, wants, calls, caselawCount, failOpens })
      const decided = REPEATS - failOpens
      const mark = wants ? (caselawCount > decided / 2 ? '✓' : '✗') : (caselawCount === 0 ? '✓' : caselawCount > decided / 2 ? '✗' : '~')
      console.log(`  ${mark} [${wants ? 'WANTS   ' : 'does-not'}] caselaw ${caselawCount}/${REPEATS}` +
        `${failOpens ? ` (${failOpens} FAIL-OPEN)` : ''}  ${q.slice(0, 62)}`)
      console.log(`      streams: ${calls.map((c) => (c === null ? 'FAIL-OPEN' : c.join('+') || 'none')).join('   |   ')}`)
    }
  }

  // ── the verdict ────────────────────────────────────────────────────────────
  const w = rows.filter((r) => r.wants), d = rows.filter((r) => !r.wants)
  const majority = (r: Row) => r.caselawCount > (REPEATS - r.failOpens) / 2
  const recall = w.filter(majority).length
  const falsePos = d.filter(majority).length
  const flaky = rows.filter((r) => r.caselawCount > 0 && r.caselawCount < REPEATS - r.failOpens).length
  const totalFailOpen = rows.reduce((a, r) => a + r.failOpens, 0)

  console.log('\n════ VERDICT ════')
  console.log(`  caselaw SELECTED when it is the right answer   ${recall}/${w.length}   ← the number that matters`)
  console.log(`  caselaw selected when it is NOT               ${falsePos}/${d.length}   ← the cost of selecting it always`)
  console.log(`  queries with an UNSTABLE decision across repeats ${flaky}/${rows.length}`)
  console.log(`  fail-opens                                     ${totalFailOpen}/${rows.length * REPEATS}`)
  console.log('\n  Reading it: the S2B fall from 36/36 to 22/36 is CORRECT if and only if the queries it')
  console.log('  stopped selecting for look like the does-not set. A high left number with a low right')
  console.log('  number is a router discriminating; a high left number with a HIGH right number is the')
  console.log('  old select-everything behaviour wearing a smaller total.')

  fs.writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), repeats: REPEATS, recall, wants: w.length, falsePos, doesNot: d.length, flaky, totalFailOpen, rows }, null, 2))
  console.log(`\n  → ${OUT}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
