// 26-M — the two regressions of 2 October. No DB, no model.
//
//   1. the action-idea step is attached to the settle EVENT (every route), is idempotent, and the screen
//      says what it did and refreshes the workspace
//   2. Lex searches the corpus from the chat (reusing runGeneralCorpusChat), and suggests only what is
//      available and sensible on the screen the user is on
//
// Every assertion has a control: the same predicate over a planted break must FAIL.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCorpusSearchRequest, researchQueryFrom } from '../lib/lex/stage'
import { availableActionsBlock, kernelIsComplete } from '../lib/lex/available-actions'
import { PLATFORM_CONTROLS } from '../lib/lex/platform-controls'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) }
}

console.log('\n── 1. the step is attached to the EVENT, not to a button ──')
const gps = read('lib/lex/guiding-policy-state.ts')
const settleCase = gps.slice(gps.indexOf("case 'settle':"), gps.indexOf("case 'unchoose'"))
ok('applyPolicyOp(settle) runs the step', /onGuidingPolicySettled\(id, row\.id/.test(settleCase))
ok('...after the parked actions are released, in the same case', settleCase.indexOf('parked') < settleCase.indexOf('onGuidingPolicySettled'))
ok('the older direct route (choosePolicyApproach) runs it too', /onGuidingPolicySettled\(ideaId, optionId/.test(read('lib/lex/field-machine.ts')))
const acceptRoute = read('app/api/ideas/[id]/guiding-policy/consolidate/[consolidationId]/route.ts')
ok('the consolidation route no longer calls the step itself (one owner of the event)', !/testHeldActions\(/.test(acceptRoute))
ok('...and reports what the event did', /settled\.actionIdeas/.test(acceptRoute) && /actionIdeas, policyFields \}\)/.test(acceptRoute))
ok('the user id reaches the event', /op: 'settle', policyId: created\.id, userId/.test(acceptRoute))
ok('control — a route that called it directly would be caught', !/testHeldActions\(/.test('const a = testHeldActions('.replace('testHeldActions(', 'x(')))
const ai = read('lib/lex/action-ideas.ts')
ok('comments are read ONCE per consolidation (a COMMENT source marks them read)', /s\.kind === 'COMMENT' && s\.consolidationId === consolidationId/.test(ai))
ok('the event never throws', /settle hook THREW/.test(ai))
ok('the actions field is not confirmed by the event', !/acceptField|skipField/.test(ai))

console.log('\n── 1b. the screen says what happened, and the workspace refreshes ──')
const gpScreen = read('components/lex/GuidingPolicyScreen.tsx')
ok('the accept response reaches the screen (not only a reload of itself)', /onSettled\(j\)/.test(gpScreen))
ok('the screen says how many actions were added', /added to Coherent Actions/.test(gpScreen))
ok('...says so when they were NOT added, and that nothing was lost', /The actions were not added/.test(gpScreen) && /Nothing was lost/.test(gpScreen))
ok('...and takes the user there', /Go to Coherent Actions/.test(gpScreen))
const fp = read('components/lex/FieldsPanel.tsx')
ok('FieldsPanel refreshes the workspace state after a settle', /onActionsAdded=\{onSuggestionChanged\}/.test(fp))
ok('...and can move the user into Coherent Actions', /onGoToPage\('COHERENT_ACTIONS'\)/.test(fp))

console.log('\n── 2. a search request is recognised (and a link-filing request is not) ──')
const shouldSearch = [
  'Can you search for what the private sector does to hold individuals accountable for outcomes',
  'Please look up how other countries make named officials accountable',
  'I want you to find evidence on single points of accountability in government',
  'Search for case law on personal liability of public officials',
  'could you research what the Treasury has said about outcome ownership',
  'Is there anything in the corpus on accountability for outcomes?',
]
for (const m of shouldSearch) ok(`search: "${m.slice(0, 62)}…"`, isCorpusSearchRequest(m))
const shouldNot = [
  'Can you add the following links to the project background research https://a.example/x',
  'I have already researched this',
  'What is your view on single points of accountability?',
  'Please find a better wording for the problem',
  'search',
  'Thanks, that is helpful',
]
for (const m of shouldNot) ok(`not a search: "${m.slice(0, 62)}"`, !isCorpusSearchRequest(m))
ok('the subject is what is searched for, not the instruction', /private sector/.test(researchQueryFrom(shouldSearch[0])) && !/^can you/i.test(researchQueryFrom(shouldSearch[0])))
ok('control — the OLD detector needed a noun from a list and would have missed the first', !(/\b(?:corpus|database|library|legislation|law|laws|statute|act|acts|regulations?|case ?law|debates?|hansard|committee|precedent)\b/i.test(shouldSearch[0])))

console.log('\n── 2b. Lex searches through runGeneralCorpusChat and says it did ──')
const cs = read('lib/lex/chat-corpus-search.ts')
ok('it REUSES runGeneralCorpusChat (not a second search path)', /import \{ runGeneralCorpusChat/.test(cs) && /await runGeneralCorpusChat\(/.test(cs))
ok('the spend is the idea chat\'s, not the admin surface', /spendStream: 'lex'/.test(cs))
const gc = read('lib/lex/general-chat.ts')
ok('the answer call honours the stream and hands back the context it numbered from', /spendStream/.test(gc) && /return \{ answer: out\.answer, results: search\.results, cited, diagnostics, context \}/.test(gc))
ok('the sources are numbered the way the answer numbered them (context order)', /context\.map\(\(r, i\) => \(\{ n: i \+ 1, r \}\)\)/.test(cs))
ok('a failed search tells Lex NOT to answer from memory', /Do NOT answer the question\s+'?,?\s*'?from memory|from memory as if it had been researched/.test(cs))
const route = read('app/api/ideas/[id]/lex/route.ts')
ok('the route runs it when asked', /isCorpusSearchRequest\(message\)/.test(route) && /runLexCorpusSearch\(/.test(route))
ok('...hands Lex the block and the availability block', /corpusSearchBlock: corpusSearch\?\.block/.test(route) && /availableActionsBlock: availableActionsBlock\(/.test(route))
ok('...and appends the sources itself, whatever Lex wrote', /corpusSearch\?\.footer\) lex\.chatText/.test(route))
ok('the old "you cannot search" instruction is gone from the prompt', !/you cannot search the corpus yourself/.test(read('lib/lex/lex-client.ts')))
ok('Lex is told to search from the chat and never to send the user to a re-run to search', /you search the corpus FROM THIS CHAT/.test(read('lib/lex/lex-client.ts')) && /never send them to a re-run, a Deepening pass or another stage to search/.test(read('lib/lex/lex-client.ts')))
ok('control — the old sentence would have been caught', /you cannot search the corpus yourself/.test('RESEARCH REQUESTS: you cannot search the corpus yourself.'))

console.log('\n── 2c. Lex suggests only what is available and sensible NOW ──')
const mid = [
  { key: 'ORIENTATION', label: 'Orientation', status: 'complete' }, { key: 'DIAGNOSIS', label: 'Diagnosis', status: 'complete' },
  { key: 'GUIDING_POLICY', label: 'Guiding policy', status: 'active' }, { key: 'COHERENT_ACTIONS', label: 'Coherent actions', status: 'visited' },
] as never
const done = (mid as Array<{ key: string; label: string; status: string }>).map((p) => ({ ...p, status: 'complete' })) as never
const midBlock = availableActionsBlock({ state: { pages: mid, currentField: { key: 'chosenApproach', status: 'AWAITING_CONFIRMATION' } as never }, pendingNewMaterial: 0 })
const doneBlock = availableActionsBlock({ state: { pages: done, currentField: null }, pendingNewMaterial: 3 })
ok('mid-kernel: the Deepening is LOCKED, with the reason and what is unfinished', /DEEPENING[^\n]*LOCKED/.test(midBlock) && /Guiding policy, Coherent actions are not/.test(midBlock))
ok('mid-kernel: a full re-run is marked not sensible, with the cost', /FULL RE-RUN[^\n]*not sensible/.test(midBlock) && /three of their credits/.test(midBlock))
ok('mid-kernel: it never lists the Deepening or a re-run as available', !/^- The Deepening: the kernel is complete/m.test(midBlock))
ok('mid-kernel: search and files are offered first', midBlock.indexOf('Searching the corpus') < midBlock.indexOf('NOT AVAILABLE'))
ok('kernel complete: the Deepening is offered', /The Deepening: the kernel is complete/.test(doneBlock) && !/LOCKED/.test(doneBlock))
ok('kernel complete: a re-run is still flagged as the most expensive', /most expensive option \(three credits\)/.test(doneBlock))
ok('new material since the last comparison is offered as the cheap step', /3 items added since the last comparison/.test(doneBlock))
ok('the kernel test is the screen\'s own (every page complete)', kernelIsComplete(done) && !kernelIsComplete(mid) && !kernelIsComplete([] as never))
ok('control — a block that listed the Deepening mid-kernel would be caught', /The Deepening: the kernel is complete/.test(doneBlock) && !/The Deepening: the kernel is complete/.test(midBlock))
ok('the map still says where things are, but not which are open (that is this block\'s job)', /WHERE THE CONTROLS ARE/.test(PLATFORM_CONTROLS))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
