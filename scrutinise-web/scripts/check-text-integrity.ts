// ─────────────────────────────────────────────────────────────────────────────
// TEXT INTEGRITY (§19-E Task 1) — the guard on the compose path.
//
// The defect: `acceptedSummary()` rendered every accepted field as `value.slice(0,
// 80)`, that stump list was the only place the accepted values appeared in the
// prompt, and the guiding-policy field is instructed to ground itself strictly in
// what the user accepted. Lex duly reproduced three 80-character stumps as finished
// clauses. Nothing failed; nothing logged; the stored values were intact.
//
// A defect with no failure signal needs a check, and the check has to assert the
// PROPERTY ("no user-facing prose is cut mid-word") rather than the fix ("the number
// is now 600"), because the number can be changed back and the property cannot.
//
// Asserted here (no model, no browser, no database):
//   1. `abridge` never cuts inside a word, at ANY cap, over adversarial inputs.
//   2. Every abridgement is MARKED. Complete text is returned untouched and says so.
//   3. `endsMidWord` — the detector — is proven able to FIRE, on the three real
//      values from Charlie's 13 Aug run put through the OLD 80-character slice.
//   4. A composed field is handed its sources IN FULL: a 3,000-character value
//      survives the source-values block whole.
//   5. There is ONE acceptedSummary. The two copies that existed are gone.
//   6. No bare `.slice(0, N)` on a field VALUE survives on the compose path, with a
//      named allow-list for the search-steering context (which is never quoted).
//   7. The prompt tells the model what an ABRIDGED entry means and renders the
//      source-values block ahead of the field block.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { abridge, endsMidWord, cutsMidWord, ledgerEntry, sourceValuesBlock, ABRIDGED_MARK } from '../lib/lex/text-integrity'
import { acceptedSummary, sourceValuesFor, COMPOSED_FROM } from '../lib/lex/accepted-context'
import type { CanonicalState } from '../lib/lex/page1-config'

const ROOT = path.join(__dirname, '..')
let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok   ${label}`)
  else { fail++; console.log(` FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
/** Comments stripped, so a rule is never satisfied by prose describing it. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

console.log('TEXT INTEGRITY (§19-E Task 1) — never truncate user-facing prose silently\n')

// ── The three real values, verbatim from the production row that produced the bug ──
// Idea d90b880f-17a6-4888-8581-c3726d69d6a9, "Civil Service Decision Paralysis",
// read from Neon on 2026-08-15. Kept in full so the regression is reproducible
// rather than described.
const REAL = {
  whatItRulesOut:
    'By establishing a decision-making charter, you are ruling out a direct mandate for ministers to ' +
    'accept official advice, and ruling out a purely cultural fix pursued through training and ' +
    'exhortation. It also sets aside the option of leaving accountability to the existing appraisal ' +
    'system, which does not link career progression and pay to demonstrated accountability.',
  leverage:
    'It closes the gate on the pivotal point: where an individual in the bureaucracy takes a decision, ' +
    'they must now own the reasoning and the consequences of that to be justified - the resources they ' +
    'propose to use.',
  conditionsForSuccess:
    "For this to work, the 'decision-making charter' must be legally robust and clear enough that a " +
    'senior official can tell in advance whether a given decision falls inside it, and the sanctions ' +
    'for breach must be real enough that a risk-averse official fears them more than they fear the ' +
    'consequences of taking a decision at all. The private sector will always be the benchmark',
}

// The fourth clause, and the one that proves the diagnosis is complete rather than
// merely plausible. It came from the OTHER slice — `JSON.stringify(value).slice(0,
// 120)` — and `{"avoidance":"` is 14 characters, so 120 leaves exactly 106 characters
// of the avoidance slot. 106 is where "…or break th" stops, to the character.
const AVOIDANCE =
  "Departments and senior civil servants will seek to define 'major policy initiatives' narrowly, or " +
  "break them into smaller components, to fall below the charter's threshold and avoid the formal " +
  "sign-off process. They may also reclassify policy work as 'routine' or 'operational' to bypass the " +
  'new requirements.'

console.log('§1 — the OLD behaviour is reproduced, and shown to be exactly what shipped')
// If this does not reproduce, nothing below means anything: a check that cannot show
// the defect it was written for is a check that will pass forever.
ok('the 80-char slice of whatItRulesOut ends "…a direct mandate f"',
  REAL.whatItRulesOut.slice(0, 80).endsWith('a direct mandate f'), JSON.stringify(REAL.whatItRulesOut.slice(60, 80)))
ok('...and that IS a mid-word cut, by the exact test',
  cutsMidWord(REAL.whatItRulesOut, REAL.whatItRulesOut.slice(0, 80)))
ok('...and the standalone detector recognises its signature', endsMidWord(REAL.whatItRulesOut.slice(0, 80) + '.'))
ok('the 120-char JSON slice leaves exactly 106 characters of `avoidance`',
  JSON.stringify({ avoidance: AVOIDANCE }).slice(0, 120).length - '{"avoidance":"'.length === 106)
ok('...ending "…narrowly, or break th"', AVOIDANCE.slice(0, 106).endsWith('narrowly, or break th'),
  JSON.stringify(AVOIDANCE.slice(85, 106)))
// ⚠ The honest part. TWO of the five clauses were cut at a WORD boundary, not inside a
// word, and read as finished sentences. No detector can find those after the fact —
// which is why the fix is the marker plus the complete source block, and why the
// assertions that matter are §2/§5 rather than a cleverer regex.
for (const key of ['leverage', 'conditionsForSuccess'] as const) {
  ok(`${key}: cut at 80 lands on a WORD boundary — silent, and undetectable after the fact`,
    !cutsMidWord(REAL[key], REAL[key].slice(0, 80)))
}
ok('a properly finished sentence is NOT flagged', !endsMidWord('This is a whole sentence.'))
ok('a sentence ending on a real two-letter word is NOT flagged', !endsMidWord('That is what it is for.'))
ok('a complete value with no full stop is NOT flagged',
  !endsMidWord("Establish a 'decision-making charter' that clearly defines roles"))
ok('an abridgement marker is not a mid-word cut', !endsMidWord(`Something was cut here ${ABRIDGED_MARK}`))

console.log('\n§2 — abridge never cuts inside a word, at any cap')
const CORPUS = [
  ...Object.values(REAL),
  AVOIDANCE,
  'One.',
  'Supercalifragilisticexpialidocious antidisestablishmentarianism',
  'a b c d e f g h i j k l m n o p q r s t u v w x y z',
  'Dr. Smith reported £3.2m in 2019. The RPC disagreed. Nothing followed.',
  'No terminator anywhere in this string at all just words running on and on and on',
  'Ends on an abbreviation e.g.',
]
let midWordCuts = 0
let unmarked = 0
let checked = 0
for (const text of CORPUS) {
  for (let cap = 1; cap <= text.length + 5; cap++) {
    const r = abridge(text, cap)
    checked++
    const body = r.text.replace(new RegExp(`\\s*${ABRIDGED_MARK}$`), '').trimEnd()
    // The body must be a PREFIX of the original that does not stop inside a word.
    if (r.abridged && body && cutsMidWord(text, body)) {
      midWordCuts++
      if (midWordCuts === 1) console.log(`       first: cap=${cap} → ${JSON.stringify(body.slice(-30))}`)
    }
    if (r.abridged && !r.text.includes(ABRIDGED_MARK)) unmarked++
  }
}
ok(`no mid-word cut in ${checked} abridgements`, midWordCuts === 0, `${midWordCuts} cuts`)
ok('every abridgement carries the marker', unmarked === 0, `${unmarked} unmarked`)

console.log('\n§3 — complete text is returned complete, and says so')
const short = abridge('Two words.', 500)
ok('a value inside the cap is untouched', short.text === 'Two words.' && !short.abridged)
ok('...and carries no marker', !short.text.includes(ABRIDGED_MARK))
ok('an empty value is not an abridgement', !abridge('', 100).abridged && !abridge(null, 100).abridged)
const long = abridge(REAL.conditionsForSuccess, 120)
ok('a cut value is flagged abridged', long.abridged)
ok('...and reports the original length', long.originalLength === REAL.conditionsForSuccess.length)

console.log('\n§4 — the ledger announces an abridgement and forbids quoting it')
// Long enough to exceed LEDGER_VALUE_CAP — the real 1,282-character stored value, of
// which the shipped code showed 80.
const LONG_CONDITIONS = REAL.conditionsForSuccess + ' ' + REAL.conditionsForSuccess + ' ' + REAL.whatItRulesOut
const entry = ledgerEntry('Conditions for success', LONG_CONDITIONS)
ok('a long entry is marked ABRIDGED', /\[ABRIDGED/.test(entry))
ok('...names how much is missing', new RegExp(`${LONG_CONDITIONS.length} characters`).test(entry))
ok('...and says not to quote it', /do not quote/i.test(entry))
ok('a short entry carries no such note', !/ABRIDGED/.test(ledgerEntry('Title', 'Civil Service Decision Paralysis')))
ok('a structured value renders as prose, not JSON braces',
  !/[{}"]/.test(ledgerEntry('Anticipated responses', { gaming: 'Teams will comply formally', avoidance: 'Departments narrow the scope' })))

console.log('\n§5 — a composed field gets its sources IN FULL')
const HUGE = 'The quick brown fox jumps over the lazy dog. '.repeat(70) // ~3,080 chars
ok('the fixture is long enough to matter', HUGE.length > 3000, `${HUGE.length}`)
const block = sourceValuesBlock([{ label: 'Leverage', value: HUGE }])
ok('the whole value survives the source-values block', !!block && block.includes(HUGE.trim()))
ok('...and the block says it is complete', !!block && /complete text/i.test(block!))
ok('an empty source set produces no block, rather than an empty one',
  sourceValuesBlock([{ label: 'Leverage', value: '' }]) === null)

// The same, through the real selector, on a synthetic canonical state.
const state = fakeState([
  { key: 'chosenApproach', label: 'Chosen approach', value: 'A decision-making charter' },
  { key: 'leverage', label: 'Leverage', value: REAL.leverage },
  { key: 'whatItRulesOut', label: 'What it rules out', value: REAL.whatItRulesOut },
  { key: 'conditionsForSuccess', label: 'Conditions for success', value: REAL.conditionsForSuccess },
])
const composed = sourceValuesFor('summaryGuidingPolicy', state)
ok('summaryGuidingPolicy is a composed field', 'summaryGuidingPolicy' in COMPOSED_FROM)
ok('...and its sources arrive whole, not abridged',
  !!composed && Object.values(REAL).every((v) => composed!.includes(v)))
ok('...with no abridgement marker anywhere in the block', !!composed && !composed!.includes(ABRIDGED_MARK))
// The exact regression, both halves in one assertion: the OLD rendering of this value
// was a mid-word cut, and the NEW one carries it whole.
ok('...and whatItRulesOut, which the old path cut mid-word, arrives entire',
  cutsMidWord(REAL.whatItRulesOut, REAL.whatItRulesOut.slice(0, 80)) &&
  !!composed && composed.includes(REAL.whatItRulesOut))
ok('a NON-composed field gets no source block (the whole kernel is not in every prompt)',
  sourceValuesFor('title', state) === null && sourceValuesFor(null, state) === null)

console.log('\n§6 — the ledger still orients, and the long values in it are boundary-cut')
const ledger = acceptedSummary(state)
ok('every accepted field appears in the ledger',
  ['Chosen approach', 'Leverage', 'What it rules out', 'Conditions for success'].every((l) => ledger.includes(l)))
// The property, asserted against the ORIGINALS rather than by re-reading the rendered
// line: whatever the ledger shows of a value, it does not stop inside a word.
const LEDGER_SOURCES = [
  ['Chosen approach', "A decision-making charter"],
  ['Leverage', REAL.leverage],
  ['What it rules out', REAL.whatItRulesOut],
  ['Conditions for success', REAL.conditionsForSuccess],
] as const
let ledgerCuts: string[] = []
for (const [label, original] of LEDGER_SOURCES) {
  const rendered = ledgerEntry(label, original)
    .replace(`${label}: `, '')
    .replace(/\s*\[ABRIDGED[^\]]*\]$/, '')
    .replace(new RegExp(`\\s*${ABRIDGED_MARK}$`), '')
    .trimEnd()
  if (cutsMidWord(original, rendered)) ledgerCuts.push(label)
}
ok('no ledger entry stops inside a word', ledgerCuts.length === 0, ledgerCuts.join(', '))
ok('a ledger entry longer than the cap is visibly marked, so nothing is lost silently',
  /\[ABRIDGED/.test(ledgerEntry('Conditions for success', LONG_CONDITIONS)))

console.log('\n§7 — ONE copy of the compose path, and no bare slice on a field value')
const ORCH = 'lib/lex/orchestrator.ts'
const ROUTE = 'app/api/ideas/[id]/lex/route.ts'
const CTX = 'lib/lex/accepted-context.ts'
ok('accepted-context.ts is the only definition of acceptedSummary',
  /export function acceptedSummary/.test(code(CTX)) &&
  !/function acceptedSummary\(state/.test(code(ORCH).replace(/export \{[^}]*\} from '\.\/accepted-context'/g, '')) &&
  !/const acceptedSummary = allAcceptedFields/.test(code(ROUTE)))
ok('the conductor and the chat route both read it from there',
  /from '\.\/accepted-context'/.test(code(ORCH)) && /accepted-context'/.test(code(ROUTE)))
// The forbidden shape: slicing a FIELD VALUE. The allow-list is by expression, not by
// file — `ideaContext` steers retrieval and is never quoted back to the user, which is
// a different thing from the prose a summary is composed from.
const VALUE_SLICE = /(?:f\.value|field\.value|\.value)\s*(?:as [^)]+\))?\.slice\(0,\s*\d+\)/
for (const f of [CTX, ORCH, ROUTE, 'lib/lex/text-integrity.ts']) {
  ok(`${f}: no field value is sliced`, !VALUE_SLICE.test(code(f)), code(f).match(VALUE_SLICE)?.[0])
}
// The two shipped expressions, by shape. Narrow deliberately: `source.slice(0, 80)` in
// a `[lex-diag]` log line is a sample for a console, not prose shown to anyone, and a
// blanket ban on the number would push the next reader into disabling the check.
ok('the shipped `f.value.slice(0, 80)` rendering is gone from both former sites',
  !/f\.value\.slice\(0, 80\)/.test(code(ORCH) + code(ROUTE)))
ok('the shipped `JSON.stringify(f.value).slice(0, 120)` rendering is gone too',
  !/JSON\.stringify\(f\.value\)\.slice/.test(code(ORCH) + code(ROUTE)))

console.log('\n§8 — the prompt says what an abridged entry is, and shows the sources first')
const CLIENT = read('lib/lex/lex-client.ts')
ok('the prompt defines what ABRIDGED means for the model', /entry marked ABRIDGED/.test(CLIENT))
ok('...and forbids quoting one as a sentence', /never be quoted or copied as a sentence/.test(CLIENT))
ok('the source-values block is rendered before the field block',
  /ctx\.sourceValuesBlock \? `\$\{ctx\.sourceValuesBlock\}\\n\\n` : ''\}\$\{fieldBlock\}/.test(CLIENT))
ok('there is a standing rule against ending a sentence mid-word', /NEVER END A SENTENCE MID-WORD/.test(CLIENT))
for (const key of ['summaryDiagnosis', 'summaryGuidingPolicy', 'summaryCoherentActions']) {
  // The instruction is the template literal the case returns — matched as such, because
  // a lazy match to the first newline stops at the `case` line and asserts nothing.
  const instruction = CLIENT.match(new RegExp(`case '${key}':\\s*\\n\\s*return \`([^\`]*)\``))?.[1] ?? ''
  ok(`${key}: its instruction was found at all`, instruction.length > 80, `${instruction.length} chars`)
  ok(`${key} is told to compose from the SOURCE VALUES block`, /SOURCE VALUES block/.test(instruction))
  ok(`${key} no longer says "ground it strictly in what the user accepted" with nowhere to read it`,
    !/Ground it strictly in what the user accepted\./.test(instruction))
}

// ── helpers ──────────────────────────────────────────────────────────────────
function fakeState(fields: Array<{ key: string; label: string; value: unknown }>): CanonicalState {
  return {
    ideaId: 'test', stage: 'GUIDING_POLICY', nextPage: null, currentField: null,
    pages: [{
      key: 'GUIDING_POLICY', label: 'Guiding policy', status: 'active', reachable: true,
      fields: fields.map((f) => ({ key: f.key, label: f.label, type: 'text', status: 'ACCEPTED', value: f.value })),
    }],
    diagnosisCauses: [], policyOptions: [], actions: [], costLines: [], benchmarks: [],
    userProfile: { aboutYou: null, experienceLevel: null, slots: {} },
    legislationRefs: [], initialBackground: { status: 'idle' },
  } as unknown as CanonicalState
}

console.log(fail === 0 ? '\nAll checks pass.' : `\n${fail} check(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
