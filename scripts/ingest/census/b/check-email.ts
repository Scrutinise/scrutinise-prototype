/**
 * check-email.ts — CENSUS C1 §C VERIFICATION. Prove the renderer cannot print the old lie.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The brief's test, in its words: "run the renderer against a fixture where est == compiled for
 * every collection and confirm it prints UNMEASURED everywhere and 100% nowhere — WATCH IT FAIL
 * FIRST, paste the failing output, then the passing one."
 *
 * So this file carries the OLD renderer as a negative control. The fixture is exactly the corpus
 * of 22 August: every collection's est_sections equal to its own compiled count. The old rule
 * (`compiled >= est → complete`) must print 100% for all of them, and the new one must print it
 * for none — with the SAME fixture through both. A check whose control has never been seen to fail
 * is not evidence, and this project has now shipped nine of those.
 *
 * It also asserts the positive direction, so the new renderer cannot pass by refusing everything:
 * a MEASURED row genuinely at 100% MUST print the tick, and one at 224% must NOT.
 *
 * Usage: tsx census/b/check-email.ts
 */
import { coverageLine, type CorpusCensusRow, type CensusState } from '../../shared/progress-reporter'

let failures = 0
const ok = (cond: boolean, what: string, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${what}${detail ? `   ${detail}` : ''}`)
  if (!cond) failures++
}

function row(p: Partial<CorpusCensusRow> & { corpus_key: string; state: CensusState }): CorpusCensusRow {
  return {
    unit: 'document', method: 'fixture', walked_at: new Date(),
    published_units: null, held_units: 0, hollow_units: 0, absent_total: 0,
    notes: null, walk_artifact_path: 'docs/census/fixture.json', ...p,
  } as CorpusCensusRow
}

/** THE NEGATIVE CONTROL — the rule that shipped until 27 Aug 2026, kept verbatim in behaviour.
 *  It takes a target equal to the compiled count and calls it complete. */
function oldRenderer(compiled: number, est: number | null): string {
  if (est == null) return `${compiled.toLocaleString()} sections [no denominator]`
  const pct = (compiled / est) * 100
  return compiled >= est
    ? `${compiled.toLocaleString()} / ${est.toLocaleString()} sections [100% complete]`
    : `${compiled.toLocaleString()} / ${est.toLocaleString()} sections [${pct.toFixed(1)}%]`
}

/** The 22 August fixture: est_sections set from the compiled count, for every collection. */
const FIXTURE: { key: string; compiled: number }[] = [
  { key: 'historic-hansard', compiled: 4641085 },
  { key: 'niassembly-hansard', compiled: 196348 },
  { key: 'tna-caselaw', compiled: 74896 },
  { key: 'impact-assessments', compiled: 18759 },
  { key: 'scottish-courts', compiled: 13070 },
  { key: 'building-regs', compiled: 21 },
  { key: 'an-empty-corpus', compiled: 0 },
]

console.log('══ CENSUS C1 §C — the renderer, against the fixture that produced the lie ══\n')

console.log('── NEGATIVE CONTROL: the rule that shipped until 27 Aug, same fixture ──')
let oldTicks = 0
for (const f of FIXTURE) {
  const line = oldRenderer(f.compiled, f.compiled)      // est == compiled, as it was in the database
  if (line.includes('100% complete')) oldTicks++
  console.log(`   ${f.key.padEnd(22)} ${line}`)
}
console.log('')
ok(oldTicks === FIXTURE.length,
  `the old rule ticks ALL ${FIXTURE.length} fixture collections`,
  `— ${oldTicks}/${FIXTURE.length}, including the one holding ZERO sections. This is the failing output.`)

console.log('\n── THE NEW RENDERER, SAME FIXTURE ──')
let newTicks = 0, unmeasured = 0
for (const f of FIXTURE) {
  // A self-referential target produces NO census denominator at all: the sweep records these
  // UNMEASURED, with the old est_sections quoted in notes and used for nothing.
  const line = coverageLine(row({ corpus_key: f.key, state: 'UNMEASURED', held_units: f.compiled }))
  if (line.includes('100% complete')) newTicks++
  if (line.includes('UNMEASURED')) unmeasured++
  console.log(`   ${f.key.padEnd(22)} ${line}`)
}
console.log('')
ok(newTicks === 0, 'the new renderer prints "100% complete" NOWHERE on this fixture', `— ${newTicks} ticks`)
ok(unmeasured === FIXTURE.length, 'it prints UNMEASURED everywhere on this fixture', `— ${unmeasured}/${FIXTURE.length}`)
ok(!FIXTURE.some(f => coverageLine(row({ corpus_key: f.key, state: 'UNMEASURED', held_units: f.compiled })).includes('%')),
  'and no percentage of any kind appears on an UNMEASURED row')

console.log('\n── AND IT MUST STILL BE ABLE TO SAY YES ──')
const cases: [string, CorpusCensusRow, (s: string) => boolean, string][] = [
  ['genuinely complete, walked',
   row({ corpus_key: 'pwdata-debates', state: 'MEASURED', held_units: 16039, published_units: 16039 }),
   s => s.includes('100% complete'), 'must tick'],
  ['walked, 58.1% held',
   row({ corpus_key: 'committees-reports', state: 'MEASURED', held_units: 30149, published_units: 51866 }),
   s => s.includes('58.1%') && !s.includes('100% complete'), 'must print the real figure, no tick'],
  ['held above 102% of published',
   row({ corpus_key: 'ots-reports', state: 'MEASURED', held_units: 497, published_units: 222 }),
   s => s.includes('denominator suspect') && !s.includes('100% complete'), 'must warn, never tick'],
  ['exactly at 102%, the clamp boundary',
   row({ corpus_key: 'boundary', state: 'MEASURED', held_units: 102, published_units: 100 }),
   s => s.includes('100% complete'), 'inside the clamp — ticks'],
  ['just past 102%',
   row({ corpus_key: 'boundary2', state: 'MEASURED', held_units: 103, published_units: 100 }),
   s => s.includes('denominator suspect'), 'outside the clamp — warns'],
  ['complete units but every one hollow',
   row({ corpus_key: 'building-regs', state: 'MEASURED', held_units: 21, published_units: 21, hollow_units: 21 }),
   s => !s.includes('100% complete') && s.includes('hollow'), 'holding 21 landing pages is not holding 21 documents'],
  ['CLAIMED never claims a walk',
   row({ corpus_key: 'impact-assessments', state: 'CLAIMED', held_units: 1090, published_units: 1932 }),
   s => s.includes('CLAIMED') && !s.includes('100% complete'), 'labelled'],
  ['DECLARED says whose scope it is',
   row({ corpus_key: 'white-papers', state: 'DECLARED', held_units: 40, published_units: 50 }),
   s => s.includes("DECLARED") && s.includes("our scope"), 'labelled'],
  ['BLOCKED prints no number',
   row({ corpus_key: 'ssrn', state: 'BLOCKED' }),
   s => !/\d+%/.test(s), 'no percentage'],
  // ⚠ The real case that prompted this assertion: 4,681 of 4,682 rounds to "100.0%" at one decimal
  // place. Without the shortfall in words, a reader sees 100.0%, no tick, and has to do the
  // subtraction themselves to learn a sitting day is missing.
  ['a shortfall that ROUNDS to 100.0%',
   row({ corpus_key: 'pwdata-lordswrans', state: 'MEASURED', unit: 'Lords written-answers day',
         held_units: 4681, published_units: 4682 }),
   s => s.includes('not held') && !s.includes('100% complete'),
   'must say a day is missing, in words, beside the rounded percentage'],
]
for (const [what, r, pred, why] of cases) {
  const line = coverageLine(r)
  ok(pred(line), `${what} — ${why}`, `\n        → ${line}`)
}

console.log('')
if (failures) { console.error(`⛔ ${failures} assertion(s) failed.`); process.exit(1) }
console.log(`✓ all assertions passed, and the negative control was watched printing the tick first.`)
