/**
 * measure-s18-appraisal.ts — BRIEF_SEARCH_S18 §1.3. Does the appraisal sentence fix stream
 * selection, and what does it cost the questions that were already working?
 *
 * §1.3: *"Fix it, flag-gated, default off, and measure the effect on the collections already in
 * the receiving stream — not by analogy."*
 *
 * ⚠⚠ WHAT THIS MEASURES, AND WHAT IT DELIBERATELY DOES NOT. It measures ROUTING ONLY — which
 * streams the router names. It does NOT report a recall figure, and that is not an omission:
 * `audit-s18-keys.ts` measured section-level recall@20 at **0 of 9** with the collection scoped to
 * itself and every other collection removed from the race, because 9 of the 18 answer keys are
 * cover sheets or appraisal tables whose figures did not survive extraction. Routing cannot move a
 * number that a broken key holds at zero, and running a recall arm here would produce two
 * identical numbers and invite the reading that the fix does nothing — when what it does is
 * measurable and is measured below.
 *
 * ⚠ THE REGRESSION GATE IS THE POINT OF THE SECOND ARM. `legislation` is the RECEIVING stream, so
 * the collections that can be hurt are the ones already routed to it, plus any question that loses
 * a stream to make room. Every accepted gold question is rolled in both arms and the per-question
 * stream sets are diffed. §1.3 forbids reasoning about this by analogy, so nothing here is
 * inferred from the impact-assessment result.
 *
 * ⚠ ROLLS, PLURAL. Routing is measurably intermittent (measure-routing.ts §2.3); one roll measures
 * the sample, not the system. `--repeat` defaults to 3 and the denominator is always the ROLL
 * count, never the question count.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-s18-appraisal.ts
 *   …                                                --repeat 3   --scope impact|all
 */
import fs from 'node:fs'
import path from 'node:path'
import { routeQueryDetailed } from '../lib/lex/query-expansion'
import { capabilityLine } from '../lib/env-flags'
import { GOLD_CORPUS, type GoldQuestion } from './gold/s10-gold-set'

export {}

const argv = process.argv.slice(2)
const arg = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  const eq = argv.find((x) => x.startsWith(`--${n}=`))
  return eq ? eq.split('=').slice(1).join('=') : null
}
const REPEAT = parseInt(arg('repeat') ?? '3', 10)
const SCOPE = arg('scope') ?? 'all'
const OUT = path.join(__dirname, '../../docs/census/s18-appraisal.json')
const OUT_CONTROL = path.join(__dirname, '../../docs/census/s18-appraisal-control.json')

const QUESTIONS: GoldQuestion[] = GOLD_CORPUS.filter(
  (q) => q.verdict === 'ACCEPT' && (SCOPE === 'all' || q.collection === 'impact-assessments'),
)

async function rollStreams(question: string): Promise<string[] | null> {
  const decision = await routeQueryDetailed(question.trim().split(/\s+/).filter(Boolean), '')
  return decision?.route ? Object.keys(decision.route) : null
}

/** How often, out of REPEAT rolls, the router named this stream. */
/**
 * ⚠⚠ `--control` RUNS BOTH ARMS WITH THE FLAG OFF, AND IT IS NOT OPTIONAL READING.
 *
 * The first full run reported that 7 of 36 other questions (19.4%) LOST a routed stream with the
 * flag on, which reads as a regression. It is only a regression if the same diff, taken between two
 * runs of the SAME arm, is smaller. An LLM sits between the question and the route, and this
 * harness diffs the FIRST SUCCESSFUL ROLL of each arm — so ordinary roll-to-roll variance appears
 * in the diff as a loss and is indistinguishable from an effect of the flag.
 *
 * The control makes them distinguishable: OFF vs OFF has, by construction, no effect to measure, so
 * whatever it reports IS the noise floor. Any claim about the flag's cost is the difference between
 * the two, and a claim made without this number would be a guess wearing a percentage.
 */
const CONTROL = argv.includes('--control')

async function arm(question: string, on: boolean): Promise<{ rolls: Array<string[] | null>; legRate: number }> {
  process.env.LEX_ROUTER_APPRAISAL = on && !CONTROL ? 'true' : 'false'
  const rolls: Array<string[] | null> = []
  for (let r = 0; r < REPEAT; r++) rolls.push(await rollStreams(question))
  const legRate = rolls.filter((s) => s?.includes('legislation')).length / REPEAT
  return { rolls, legRate }
}

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`)

async function main() {
  // ⚠ The flag is forced OFF before the capability line is taken, so the printed configuration
  // describes the BASELINE arm rather than whatever the shell happened to export.
  process.env.LEX_ROUTER_APPRAISAL = 'false'
  const CONFIG = `${capabilityLine()} | GEMINI_API_KEY=${process.env.GEMINI_API_KEY ? 'set' : 'UNSET'}`
  if (!process.env.GEMINI_API_KEY) {
    console.error('⛔ GEMINI_API_KEY is not set. This harness measures the ROUTER, which is an LLM call.')
    console.error('   Refusing rather than reporting zeros that would read as "the flag does nothing".')
    process.exit(2)
  }

  console.log(CONTROL
    ? '── S18 §1.3 · CONTROL: BOTH ARMS OFF. Whatever this reports is the NOISE FLOOR. ──'
    : '── S18 §1.3 · THE APPRAISAL SENTENCE, MEASURED ──')
  console.log(`  config  : ${CONFIG}`)
  console.log(`  scope   : ${SCOPE}   questions ${QUESTIONS.length}   rolls ${REPEAT} per question per arm`)
  console.log('  ⚠ ROUTING ONLY. No recall figure is produced or implied — see the header.\n')

  interface Row {
    code: string; collection: string; question: string
    offRate: number; onRate: number
    offStreams: string[]; onStreams: string[]
    gained: string[]; lost: string[]
  }
  const rows: Row[] = []

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i]
    // ⚠ ALTERNATE THE ARM ORDER, so neither arm systematically gets whatever server-side cache
    // state the previous call left behind.
    const onFirst = i % 2 === 1
    const a = onFirst ? await arm(q.question, true) : await arm(q.question, false)
    const b = onFirst ? await arm(q.question, false) : await arm(q.question, true)
    const off = onFirst ? b : a
    const on = onFirst ? a : b

    // The stream set of the FIRST successful roll in each arm, for the diff. A fail-open (null)
    // is reported as such and never counted as "named no streams".
    const first = (rolls: Array<string[] | null>) => rolls.find((s) => s !== null) ?? []
    const offStreams = first(off.rolls)
    const onStreams = first(on.rolls)
    const gained = onStreams.filter((s) => !offStreams.includes(s))
    const lost = offStreams.filter((s) => !onStreams.includes(s))
    rows.push({
      code: q.code, collection: q.collection, question: q.question,
      offRate: off.legRate, onRate: on.legRate, offStreams, onStreams, gained, lost,
    })
    const flag = q.collection === 'impact-assessments' ? '▶' : ' '
    console.log(`${flag} ${pad(q.code, 5)} ${pad(q.collection, 19)} legislation ${Math.round(off.legRate * REPEAT)}/${REPEAT} → ${Math.round(on.legRate * REPEAT)}/${REPEAT}` +
      `${gained.length ? `   +[${gained.join(',')}]` : ''}${lost.length ? `   ⚠ -[${lost.join(',')}]` : ''}`)
  }

  // ── the two numbers that decide it ────────────────────────────────────────────────────────────
  const impact = rows.filter((r) => r.collection === 'impact-assessments')
  const others = rows.filter((r) => r.collection !== 'impact-assessments')
  const gainedLeg = (rs: Row[]) => rs.filter((r) => r.offRate < 0.5 && r.onRate >= 0.5).length
  const lostLeg = (rs: Row[]) => rs.filter((r) => r.offRate >= 0.5 && r.onRate < 0.5).length
  const lostAny = (rs: Row[]) => rs.filter((r) => r.lost.length > 0)

  console.log('\n── DID IT FIX SELECTION? (impact assessments) ──')
  console.log(`  questions                         ${impact.length}`)
  console.log(`  named legislation on a majority of rolls, OFF → ON   ${impact.filter((r) => r.offRate >= 0.5).length} → ${impact.filter((r) => r.onRate >= 0.5).length}`)
  console.log(`  ⚠ gained legislation              ${gainedLeg(impact)}`)
  console.log(`  ⚠ lost legislation                ${lostLeg(impact)}`)

  console.log('\n── WHAT DID IT COST THE REST? (the regression gate — measured, not reasoned) ──')
  console.log(`  other accepted questions          ${others.length}`)
  console.log(`  ⚠ gained legislation              ${gainedLeg(others)}   (over-firing shows up here)`)
  console.log(`  ⚠ lost legislation                ${lostLeg(others)}`)
  console.log(`  ⚠ lost ANY stream                 ${lostAny(others).length}   ${pct(lostAny(others).length, others.length)}`)
  for (const r of lostAny(others)) {
    console.log(`      ${pad(r.code, 5)} ${pad(r.collection, 16)} lost [${r.lost.join(',')}] — ${pad(r.question, 60)}`)
  }

  console.log('\n⚠ NO RECALL FIGURE IS PUBLISHED HERE AND NONE IS SUPERSEDED. Section-level recall@20 on')
  console.log('  these nine questions is 0/9 with the collection scoped to ITSELF (audit-s18-keys.ts),')
  console.log('  because 9 of 18 keys are cover sheets or stripped appraisal tables. Routing is a real')
  console.log('  defect and this fixes part of it; it cannot move a number a broken key pins at zero.')

  const target = CONTROL ? OUT_CONTROL : OUT
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify({
    takenAt: new Date().toISOString(), config: CONFIG, repeat: REPEAT, scope: SCOPE, control: CONTROL,
    summary: {
      impact: { n: impact.length, gainedLegislation: gainedLeg(impact), lostLegislation: lostLeg(impact) },
      others: { n: others.length, gainedLegislation: gainedLeg(others), lostLegislation: lostLeg(others), lostAnyStream: lostAny(others).length },
    },
    rows,
  }, null, 2))
  // ⚠ `target`, not `OUT`. The control run wrote to the control path and PRINTED the other one —
  // a report line naming a file it did not write is how a reader compares two arms and unknowingly
  // reads the same one twice.
  console.log(`\n  → ${path.relative(process.cwd(), target)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
