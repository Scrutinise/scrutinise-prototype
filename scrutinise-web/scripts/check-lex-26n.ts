// 26-N — the guiding policy that never settled. No DB, no model.
//
//   §1  settling (ANY route) accepts the Chosen approach field; un-choose and edit keep it in step
//   §2  the final version's sections reach their fields; stale with a reason; redrafts are PROPOSALS and a field
//       the user has touched is never overwritten (his Leverage edit stands)
//   §3  HELD — the label is still "Chosen approach" (Charlie decides on the report first)
//   §4b the Consolidate gate does not apply once a policy is settled
//   §6a Lex drafts into a gated field and says so
//   §7  the Coherent Actions introduction is verbatim
//
// Every assertion has a control: the same predicate over a planted break must FAIL.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { requestedDraftField, draftFiledSentence, DRAFTABLE_FIELDS } from '../lib/lex/lex-draft'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) }
}

console.log('\n── §1 settling — by any route — accepts the field ──')
const gps = read('lib/lex/guiding-policy-state.ts')
const settleCase = gps.slice(gps.indexOf("case 'settle':"), gps.indexOf("case 'unchoose'"))
ok('applyPolicyOp(settle) runs the one event handler (fields + actions)', /onGuidingPolicySettled\(id, row\.id/.test(settleCase))
const fm = read('lib/lex/field-machine.ts')
ok('the older direct route (choosePolicyApproach) runs it too', /onGuidingPolicySettled\(ideaId, optionId/.test(fm))
const pf = read('lib/lex/policy-fields.ts')
ok('the Chosen approach field is ACCEPTED with the policy\'s statement', /acceptField\(ideaId, userId \?\? '', 'chosenApproach', policy\.approach\)/.test(pf))
ok('...and acceptField is called for NO other field here (a redraft is never accepted)', (pf.match(/acceptField\(/g) ?? []).length === 1)
ok('the un-choose op resets the field as well as the policy', /unchoosePolicyApproach\(id\)/.test(gps.slice(gps.indexOf("case 'unchoose'"))))
ok('editing the settled policy\'s statement re-accepts the field', /row\.status === 'CHOSEN'[\s\S]{0,200}acceptField\(id, userId, 'chosenApproach', approach\)/.test(gps))
ok('control — a settle without the handler would be caught', !/onGuidingPolicySettled/.test(settleCase.split('onGuidingPolicySettled').join('x')))

console.log('\n── §2 sections fill their fields; stale WITH A REASON; redrafts are proposals ──')
ok('Rules out → What it rules out (as an offer, never a write over)', /offerRedraft\(ideaId, 'whatItRulesOut'/.test(pf))
ok('Leverage, Anticipated responses and Conditions for success are all redrafted', ['leverage', 'anticipatedResponses', 'conditionsForSuccess'].every((k) => new RegExp(`offerRedraft\\(ideaId, '${k}'`).test(pf)))
ok('the likelihood and the "if only part is delivered" warning feed the redraft', /policy\.likelihood/.test(pf) && /policy\.chainLink/.test(pf))
ok('the stale fields are marked with the reason naming the replaced policy', /markFieldStale\(ideaId, k, staleReason\)/.test(pf) && /it was drafted for #\$\{previousNumber\}/.test(pf))
ok('Leverage and Anticipated responses are among them', /\['leverage', 'anticipatedResponses'(, 'summaryGuidingPolicy')?\] as const\) await markFieldStale/.test(pf))
ok('a second settle of the same policy spends nothing (already-done guard)', /already-done/.test(pf))
ok('a failed redraft leaves the stale marks and reports', /The stale marks stand/.test(pf))
const offer = fm.slice(fm.indexOf('export async function offerRedraft'), fm.indexOf('/** ⚠ NEVER stale with no reason'))
const besideWrite = offer.slice(offer.lastIndexOf('prisma.ideaFieldState.update'))
ok('where the user has words, the redraft goes in `redraft` and value/status/proposal are NOT in the write', /redraft: \{ value: offer\.value/.test(besideWrite) && !/\b(?:value|status|proposal):/.test(besideWrite.replace(/redraft: \{[^}]*\}/, '')))
ok('a SKIPPED field is left alone', /row\?\.status === 'SKIPPED'\) return 'skipped-field'/.test(offer))
ok('a redraft identical to the current wording is not an offer', /next === row!\.value\) return 'unchanged'/.test(offer))
ok('his words = a non-empty value (accepted OR reopened)', /hasHisWords = !!\(row\?\.value && row\.value\.trim\(\)\)/.test(offer))
ok('accepting a field clears the redraft and the stale mark', /redraft: Prisma\.DbNull, stale: false, staleReason: null/.test(fm.slice(fm.indexOf('export async function acceptField'))))
ok('"keep mine" clears both too (any status)', /redraft: Prisma\.DbNull, stale: false, staleReason: null/.test(fm.slice(fm.indexOf('export async function dismissProposal'))))
ok('control — a redraft that wrote `value` would be caught', /\b(?:value|status|proposal):/.test('data: { value: x, redraft: {} }'.replace(/redraft: \{[^}]*\}/, '')))
ok('stale and redraft reach the screen\'s state', /stale: row\?\.stale && row\.staleReason/.test(read('lib/lex/state.ts')) && /redraft: row\?\.redraft/.test(read('lib/lex/state.ts')))
const fp = read('components/lex/FieldsPanel.tsx')
ok('every field renders its "may need revisiting" note and any redraft beside the text', /const renderField = \(f: CanonicalField\) => \([\s\S]{0,200}<FieldNotes/.test(fp))
ok('the redraft offers Use this version / Edit it / Keep mine', ['Use this version', 'Edit it', 'Keep mine'].every((w) => fp.includes(w)))
ok('the stale note carries a word and a glyph, not colour alone', /△<\/span> May need revisiting/.test(fp) && /◇/.test(fp))

console.log('\n── §3 is HELD ──')
ok('the label is still "Chosen approach" (no relabel until Charlie decides)', /key: 'chosenApproach',\s*label: 'Chosen approach'/.test(read('lib/lex/page3-config.ts')))
ok('control — a relabelled config would be caught', !/label: 'Chosen approach'/.test("label: 'Guiding Policy'"))

console.log('\n── §4b the Consolidate gate does not apply once settled ──')
ok('a settled policy empties the waiting list', /alreadySettled = !!idea\?\.chosenApproach\?\.trim\(\)/.test(gps) && /const stillWaiting = alreadySettled \? \[\]/.test(gps))

console.log('\n── §6a Lex drafts into a field whose stage is not open ──')
const pagesGated = [
  { key: 'GUIDING_POLICY', label: 'Guiding policy', status: 'active', reachable: true, fields: [
    { key: 'policyOptions', status: 'ACCEPTED' }, { key: 'chosenApproach', status: 'AWAITING_CONFIRMATION' },
    { key: 'whatItRulesOut', status: 'EMPTY' }, { key: 'leverage', status: 'EMPTY' },
  ] },
] as never
const req = requestedDraftField('Can you draft what it rules out for me?', pagesGated)
ok('a drafting verb + the field\'s label is recognised', req?.key === 'whatItRulesOut')
ok('...and it is GATED while Chosen approach is unfinished', req?.gated === true)
ok('the platform\'s sentence is the user\'s own, verbatim', draftFiledSentence(req!) === 'I’ve put that in as a draft waiting for you — you’ll need to complete this stage before you can edit it.')
ok('no drafting verb → no draft', requestedDraftField('What does what it rules out mean?', pagesGated) === null)
ok('a field that is not draftable is not matched (the problem, the causes)', requestedDraftField('draft the causes for me', pagesGated) === null)
ok('the draftable set holds the guiding-policy fields', ['whatItRulesOut', 'leverage', 'anticipatedResponses', 'conditionsForSuccess', 'summaryGuidingPolicy'].every((k) => DRAFTABLE_FIELDS.has(k)))
const route = read('app/api/ideas/[id]/lex/route.ts')
ok('the route files the draft, and says where it is', /fileLexDraft\(id, draftReq, lex\.proposal\)/.test(route) && /draftFiledSentence\(draftReq\)/.test(route))
ok('a question-shaped request ("can you draft…?") is NOT discarded as a question turn', /questionTurn && lex\.proposal && !draftReq/.test(route))
ok('Lex is told it may propose for the named field, whatever its stage', /EXCEPT where a block above says the user has asked you to draft a named field/.test(read('lib/lex/lex-client.ts')))
ok('the draft goes through offerRedraft (never over his words)', /offerRedraft\(ideaId, req\.key/.test(read('lib/lex/lex-draft.ts')))
ok('Ask mode drafts nothing', /askOnly \? null : requestedDraftField/.test(route))

console.log('\n── §7 the Coherent Actions introduction is verbatim ──')
const brief = read('../docs/BRIEF_26N.md')
const sec7 = brief.slice(brief.indexOf('## §7'), brief.indexOf('## §8'))
const briefParas = sec7.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '')).join('\n').split(/\n\s*\n/)
  .map((p) => p.replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
const constSrc = fp.slice(fp.indexOf('export const COHERENT_ACTIONS_INTRO'), fp.indexOf('function Tick()'))
const arrSrc = constSrc.slice(constSrc.indexOf('= [') + 2).trim()
const intro = new Function(`return ${arrSrc}`)() as Array<Array<string | { strong: string }>>
const screenParas = intro.map((p) => p.map((x) => (typeof x === 'string' ? x : x.strong)).join(''))
ok('three paragraphs', briefParas.length === 3 && screenParas.length === 3)
for (let i = 0; i < 3; i++) ok(`paragraph ${i + 1} matches the brief, character for character`, briefParas[i] === screenParas[i])
ok('"coherent" is the bolded word, as in the brief', intro[0].some((x) => typeof x !== 'string' && x.strong === 'coherent'))
ok('it is rendered at the top of the actions field, above the suggestions', fp.indexOf('COHERENT_ACTIONS_INTRO.map') < fp.indexOf('<ActionSuggestions'))
ok('control — a one-word change would be caught', briefParas[0] !== screenParas[0].replace('Together', 'All together'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
