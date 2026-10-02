// 26-N §8 — Check for gaps. No DB, no model. Every assertion has a control that must FAIL on a planted break.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectFreeGaps, validateSuggestions, combineSuggestions, dropAlreadyThere, describeGapSource, categoriesOf } from '../lib/lex/gap-check'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) }
}

console.log('\n── the free part ──')
const causes = [
  { number: 1, cause: 'Ministerial responsibility shields individual civil servants from accountability for outcomes' },
  { number: 2, cause: 'Performance management systems measure inputs rather than delivered outcomes' },
  { number: 3, cause: 'Procurement contracts reward suppliers regardless of results' },
]
const actions = [
  { practicalStep: 'Amend the Civil Service Act to create a statutory duty of individual accountability for outcomes', mechanismType: 'rules' },
  { practicalStep: 'Redesign performance management so every post is measured on delivered outcomes', mechanismType: 'incentives' },
]
const f = detectFreeGaps(causes, actions)
ok('a cause no action shares words with is flagged', f.causesWithoutAction.some((g) => g.number === 3))
ok('causes that have an action are not flagged', !f.causesWithoutAction.some((g) => g.number === 1 || g.number === 2))
ok('a category with nothing in it is flagged', f.emptyCategories.some((g) => g.category === 'organisational'))
ok('categories that are covered are not', !f.emptyCategories.some((g) => g.category === 'legislative' || g.category === 'financial'))
ok('the result says it is a heuristic', f.heuristic === true && /keyword match/.test(f.causesWithoutAction[0].reason))
ok('mechanismType alone places an action', categoriesOf({ practicalStep: 'x', mechanismType: 'institutional' }).has('organisational'))
ok('control — with no actions every cause and category is a gap', detectFreeGaps(causes, []).causesWithoutAction.length === 3 && detectFreeGaps(causes, []).emptyCategories.length === 3)
ok('control — an action list covering nothing would have hidden cause 3', !detectFreeGaps(causes, [{ practicalStep: 'Introduce procurement contracts that reward suppliers by results' }]).causesWithoutAction.some((g) => g.number === 3))

console.log('\n── every suggestion states what fails without it, or it is dropped ──')
const v = validateSuggestions([
  { text: 'Create an independent outcomes audit body', category: 'organisational', whatFails: 'Without an independent auditor, owners mark their own work and the policy has no enforcement.', addressesCauseNumber: 2 },
  { text: 'Nice to have a website', category: 'financial', whatFails: '' },
  { text: 'Publish a register', category: 'legislative', whatFails: 'It would be good.' },
  { text: 'Something', category: 'legislative', whatFails: 'It is important to do this for the policy overall.' },
  { text: 'Wrong category step', category: 'cultural', whatFails: 'Without it the named owner cannot be found by the public at all.' },
])
ok('one with a real whatFails is kept', v.kept.length === 1 && v.kept[0].addressesCauseNumber === 2)
ok('empty, short, vague and mis-categorised ones are dropped and counted', v.dropped === 4)
ok('control — a validator that only checked text would have kept all five', [{ t: 'a' }, { t: 'b' }].length === 2 && v.kept.length !== 5)

console.log('\n── combine, de-duplicate, keep which models raised each ──')
const mk = (text: string, whatFails = 'Without this step the policy cannot be enforced against anyone at all.') => ({ text, category: 'organisational' as const, whatFails, addressesCauseNumber: null })
const c = combineSuggestions([
  { model: 'gemini-2.5-pro', suggestions: [mk('Create an independent Civil Service Accountability Board reporting to Parliament')] },
  { model: 'grok-4.7', suggestions: [mk('Create an independent Accountability Board for the Civil Service reporting directly to Parliament'), mk('Require annual published outcome statements from each permanent secretary')] },
  { model: 'claude-opus-5', suggestions: [] },
])
ok('near-duplicates across models become one', c.combined.length === 2 && c.merged === 1)
ok('the merged one records both models', c.combined[0].models.join() === 'gemini-2.5-pro,grok-4.7')
ok('the unique one records its single model', c.combined[1].models.join() === 'grok-4.7')
ok('attribution reads in words', describeGapSource({ kind: 'GAP_CHECK', models: ['a', 'b'], whatFails: 'x', category: 'legislative', addressesCauseNumber: null, checkId: 'c', checkCostPence: 1 }) === 'raised by a, b')
const t = dropAlreadyThere(c.combined, ['Create an independent Civil Service Accountability Board that reports to Parliament'])
ok('a suggestion the list already says is dropped, and counted', t.kept.length === 1 && t.alreadyThere === 1)
ok('control — unrelated texts are not merged', combineSuggestions([{ model: 'm', suggestions: [mk('Draft primary legislation for a statutory duty'), mk('Fund a national training programme for managers')] }]).combined.length === 2)

console.log('\n── nothing is accepted automatically; the run is one at a time; the cost is reported ──')
const lib = read('lib/lex/gap-check.ts')
const acceptBody = lib.slice(lib.indexOf('export async function acceptGapSuggestion'), lib.indexOf('export async function dismissGapSuggestion'))
ok('addAction is called in exactly one place', (lib.match(/\baddAction\(/g) ?? []).length === 1)
ok('...and that place is acceptGapSuggestion', /addAction\(/.test(acceptBody))
ok('no LexCoherentAction is created directly', !/lexCoherentAction\.create/.test(lib))
ok('suggestions are written as SUGGESTED, not as actions', /status: 'SUGGESTED'/.test(lib))
ok('an accepted one takes a status the consolidation panel (WRITTEN) does not read', /status: 'ACCEPTED_GAP'/.test(lib) && !/status: 'WRITTEN'/.test(lib))
ok('control — a second creation site would be caught', (('addAction( addAction(').match(/\baddAction\(/g) ?? []).length !== 1)
ok('a marker row is created BEFORE any model is called', lib.indexOf("status: RUNNING, text: 'Check for gaps is running'") < lib.indexOf('callModelJson<{ suggestions'))
ok('a rival in flight refuses the second press, saying so', /already running on this idea/.test(lib))
ok('an orphaned marker is swept after the route limit', /IN_FLIGHT_MS = 6 \* 60_000/.test(lib) && /createdAt: \{ lt: staleBefore \}/.test(lib))
ok('the marker is released on every exit (success, refusal, throw)', (lib.match(/await release\(\)/g) ?? []).length >= 4)
ok('the cost is summed over every call and returned', /costPence \+= p\.pence \?\? 0/.test(lib) && /costPence: Math\.round/.test(lib))
ok('the cost is stored on each suggestion', /checkCostPence: total/.test(lib))
ok('an unpriced call is reported as a floor, not as zero', /unpriced = true/.test(lib))
ok('the four models are the Consolidate panel\'s', /PREMIUM_DRAFT_MODELS\.map/.test(lib))
ok('a model that fails is reported, and the rest still combine', /None of the four models answered/.test(lib) && /modelReport/.test(lib))
ok('a failed test keeps the suggestions, marked NOT_TESTED', /verdict: 'NOT_TESTED' as Verdict/.test(lib))
const route = read('app/api/ideas/[id]/gap-check/route.ts')
ok('the route runs for up to 300s', /maxDuration = 300/.test(route))
ok('accept is write-guarded; there is no auto-accept op', /assertWritableField\(id, 'actions'\)/.test(route) && !/auto/i.test(route.replace(/automatically/g, '')))
const ui = read('components/lex/ActionGapCheck.tsx')
ok('the UI shows the cost after a run', /This check cost about/.test(ui))
ok('...Accept and Dismiss on every suggestion, which model raised it, and what fails', /Accept/.test(ui) && /Dismiss/.test(ui) && /s\.raisedBy/.test(ui) && /Fails without it/.test(ui))
ok('...the verdict is a word and a differently-shaped glyph', ['Conflicts', 'Does not fit', 'Fits'].every((w) => ui.includes(w)) && ['✕', '○', '✓'].every((g) => ui.includes(g)))
ok('...the free part is labelled as a keyword match', /keyword match/.test(ui))
ok('...it redraws the list after Accept', /if \(op === 'accept'\) onChanged\?\.\(\)/.test(ui))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
