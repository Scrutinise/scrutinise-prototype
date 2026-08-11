// ─────────────────────────────────────────────────────────────────────────────
// §19-D Task 1 — the problem gate.
//
// "Without a problem we can have no strategy and the whole logical structure
// breaks down. At the moment I can put anything in and it's accepted, and none of
// it makes sense." — Charlie, on entering "I want to change the amount charged for
// plastic bags in shops" as the problem and having it accepted.
//
// Three things are asserted, none of which needs a model or a database:
//   1a  the user never sees the word "Challenge" for this field;
//   1b  the gate is IN the prompt while the problem field is current, and OUT of it
//       otherwise — and it SPENDS itself after two presses, because Lex guides and
//       does not gatekeep;
//   ·   the deterministic solution-detector recognises the shape that got through,
//       and does not fire on statements that genuinely name a problem.
//
// No model call is made, so this cannot prove Lex asks a good question. It proves
// the instruction is present, is scoped, and stops — which is the part that can
// silently regress.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { methodForStage, methodBlocksFor, looksLikeASolution, MAX_PROBLEM_PRESSES, PROBLEM_FIELD_KEY } from '../lib/lex/method'
import { DIAGNOSIS_FIELDS } from '../lib/lex/page2-config'

const ROOT = path.join(__dirname, '..')
let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok   ${label}`)
  else { fail++; console.log(` FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

console.log('§19-D Task 1 — the problem gate\n')

// ── 1a. the label ───────────────────────────────────────────────────────────
console.log('1a — the user never reads "Challenge" for this field')
const problem = DIAGNOSIS_FIELDS.find((f) => f.key === PROBLEM_FIELD_KEY)!
ok('the stored key is unchanged (no migration)', problem.key === 'challenge')
ok('the label is "The problem"', problem.label === 'The problem', problem.label)
ok('the question asks for a problem, not a challenge',
  !/challenge/i.test(problem.question ?? ''), problem.question)
ok('the question asks what is wrong, for whom, and why it matters',
  /what is going wrong|what is the problem/i.test(problem.question ?? '') && /for whom/i.test(problem.question ?? ''),
  problem.question)

// The user-facing surfaces of the Lex create flow.
const SURFACES = [
  'lib/lex/page1-config.ts', 'lib/lex/page2-config.ts', 'lib/lex/page3-config.ts',
  'lib/lex/orchestrator.ts', 'lib/lexScripts.ts', 'app/ideas/create/CreateIdeaClient.tsx',
]
for (const f of SURFACES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
  // Only STRING LITERALS are read, not code: `challenge` is still the stored field key
  // and appears all over these files as an identifier, a property name and a switch
  // case, none of which the user ever sees. Scanning the whole source would just make
  // this check noisy enough to be turned off.
  const literals = (
    src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? []
  )
    // The stored key itself, and the two unrelated uses: `legalChallenge` (a Page-3
    // slot — whether the policy gets taken to court) and "challenge any of them" (an
    // invitation to argue with a figure, not a field name).
    .filter((s) => !/^(['"`])challenge\1$/.test(s))
    .map((s) => s.replace(/legalChallenge|[Ll]egal challenge/g, '')
      .replace(/challenge any of them|challenge any figure|challenge the evidence/g, ''))
  const offender = literals.find((s) => /challenge/i.test(s))
  ok(`${f} — no user-visible "challenge"`, !offender, offender?.slice(0, 100))
}

// ── 1b. the gate is scoped, and it stops ────────────────────────────────────
console.log('\n1b — the gate arms on the problem field and spends itself after two presses')
const off = methodForStage('DIAGNOSIS', { currentFieldKey: 'causes' })
const armed = methodForStage('DIAGNOSIS', { currentFieldKey: PROBLEM_FIELD_KEY, problemPresses: 0 })
const second = methodForStage('DIAGNOSIS', { currentFieldKey: PROBLEM_FIELD_KEY, problemPresses: 1 })
const spent = methodForStage('DIAGNOSIS', { currentFieldKey: PROBLEM_FIELD_KEY, problemPresses: MAX_PROBLEM_PRESSES })

ok('not armed on another field', !/THE PROBLEM GATE\./.test(off))
ok('armed on the problem field', /THE PROBLEM GATE\./.test(armed))
ok('still armed after one press', /THE PROBLEM GATE\./.test(second))
ok('spent after two presses', /THE PROBLEM GATE IS SPENT/.test(spent) && !/THE PROBLEM GATE\./.test(spent))
ok('the spent instruction tells Lex to accept and move on',
  /Take what the user has given you/.test(spent) && /allowed to proceed/.test(spent))
ok('the armed instruction refuses to reject the answer', /DO NOT REJECT IT/.test(armed))
ok('the armed instruction proposes the problem back', /propose the problem statement back/.test(armed))
ok('the cap is stated as two', /AT MOST TWO PRESSES/.test(armed) && MAX_PROBLEM_PRESSES === 2)
ok('M-GENERAL and the stage block are still there', /Good strategy is scarce/.test(armed) && /pivotal/.test(armed))
ok('the diagnostic label distinguishes armed from spent',
  methodBlocksFor('DIAGNOSIS', { currentFieldKey: PROBLEM_FIELD_KEY, problemPresses: 0 }).includes('M-PROBLEM-GATE') &&
  methodBlocksFor('DIAGNOSIS', { currentFieldKey: PROBLEM_FIELD_KEY, problemPresses: 2 }).includes('M-PROBLEM-GATE(spent)'))

// ── the detector ────────────────────────────────────────────────────────────
console.log('\nthe deterministic solution-detector')
const SOLUTIONS = [
  'I want to change the amount charged for plastic bags in shops',   // the actual input
  'We should ban single-use vapes',
  'Introduce a licensing scheme for short-term lets',
  "Let's raise the charge to 50p",
  'My idea is to create a national register of landlords',
]
const PROBLEMS = [
  'Too many single-use bags are still being used, and the current charge is too low to change behaviour',
  'Care homes cannot afford to renovate because VAT makes the work 20% more expensive',
  'The charge has not been raised since 2015, so it no longer costs enough to notice',
  'Nobody enforces the existing rules, so retailers ignore them',
  'We should ban single-use vapes because they are poisoning children and nobody is enforcing the age limit',
]
for (const s of SOLUTIONS) ok(`solution: "${s.slice(0, 52)}…"`, looksLikeASolution(s))
for (const p of PROBLEMS) ok(`problem:  "${p.slice(0, 52)}…"`, !looksLikeASolution(p))

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall checks passed')
process.exit(fail ? 1 : 0)
