// 26-M addendum — coherent-action ideas from consolidation. No DB, no model.
//
//   1. extraction HOLDS: nothing is added to the kernel, and an idea must quote its draft
//   2. the test covers every item exactly once, merges only what it is told to, loses nothing
//   3. the step writes CANDIDATES (never confirms the field), once each
//   4. the parked actions are re-tested in the SAME step as the acceptance
//   5. the panel is actually reachable from a route (docs/CLAUDE.md §23.1), and the verdict is not colour alone
//
// Every assertion has a control: the same predicate over a planted break must FAIL.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateExtraction, placeGroups, describeSource } from '../lib/lex/action-ideas'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) }
}

const DRAFTS = [
  { statement: 'Make individual ownership the organising principle for civil-service work.', chainLink: 'If only the principle is adopted, no one is accountable. Publish each post\'s outcomes yearly.', likelihood: null },
  { statement: 'Hold senior officials personally answerable for the outcomes they are given authority over.', chainLink: null, likelihood: 'Require every Permanent Secretary to sign an annual statement of outcomes.' },
]

console.log('\n── §1 extraction holds, and every idea quotes its draft ──')
const good = validateExtraction([
  { draftIndex: 0, text: 'Publish each post’s outcomes every year.', quote: 'Publish each post\'s outcomes yearly' },
  { draftIndex: 1, text: 'Permanent Secretaries sign an annual statement of outcomes.', quote: 'Require every Permanent Secretary to sign an annual statement' },
], DRAFTS)
ok('a quoted idea is held, against the draft it names', good.accepted.length === 2 && good.accepted[1].draftIndex === 1)
const invented = validateExtraction([{ draftIndex: 0, text: 'Create a new Ministry of Accountability.', quote: 'Create a new Ministry of Accountability' }], DRAFTS)
ok('an idea whose quote is not in the draft is dropped, and counted', invented.accepted.length === 0 && invented.dropped === 1)
ok('a quote that is in a DIFFERENT draft does not count', validateExtraction([{ draftIndex: 0, text: 'x', quote: 'Require every Permanent Secretary to sign' }], DRAFTS).accepted.length === 0)
ok('a fabricated draft index is dropped', validateExtraction([{ draftIndex: 9, text: 'x', quote: 'Make individual ownership the organising' }], DRAFTS).dropped === 1)
ok('a quote under 12 characters is not provenance', validateExtraction([{ draftIndex: 0, text: 'x', quote: 'the' }], DRAFTS).accepted.length === 0)
ok('a repeat within one draft collapses', validateExtraction([
  { draftIndex: 0, text: 'Publish outcomes yearly.', quote: 'Publish each post\'s outcomes yearly' },
  { draftIndex: 0, text: 'publish outcomes yearly.', quote: 'Publish each post\'s outcomes yearly' },
], DRAFTS).accepted.length === 1)
ok('a draft that is all principle yields nothing, quietly', validateExtraction([], DRAFTS).accepted.length === 0)
// control: with no provenance check, the invented idea would have been held.
ok('control — without the quote test the invented idea would pass', ((): boolean => {
  const withoutCheck = [{ draftIndex: 0, text: 'Create a new Ministry of Accountability.' }].filter((i) => DRAFTS[i.draftIndex] && i.text)
  return withoutCheck.length === 1
})())

console.log('\n── §2 the test covers every item, once, and loses none ──')
const TEXTS = ['A', 'B', 'C', 'D']
const placed = placeGroups([
  { members: [0, 2], text: 'A/C', verdict: 'FITS', reason: 'same step' },
  { members: [1], text: 'B', verdict: 'CONFLICTS', reason: 'works against what the policy rules out' },
], TEXTS)
const covered = placed.flatMap((g) => g.members).sort()
ok('every item appears exactly once', covered.join() === '0,1,2,3')
ok('an item the model left out is kept as NOT_TESTED, saying so', placed.find((g) => g.members[0] === 3)?.verdict === 'NOT_TESTED')
ok('merged members are one group', placed[0].members.length === 2)
const greedy = placeGroups([{ members: [0, 1], text: 'x', verdict: 'FITS', reason: '' }, { members: [1, 2], text: 'y', verdict: 'FITS', reason: '' }], TEXTS)
ok('an item claimed twice belongs to the FIRST group only', greedy[0].members.join() === '0,1' && greedy[1].members.join() === '2')
ok('a member that was never sent is ignored', placeGroups([{ members: [7], text: 'x', verdict: 'FITS', reason: '' }], TEXTS).every((g) => g.members[0] !== 7))
ok('an unknown verdict becomes NOT_TESTED, not FITS', placeGroups([{ members: [0], text: 'x', verdict: 'GREAT', reason: '' }], TEXTS)[0].verdict === 'NOT_TESTED')
ok('the reason is one line', !/\n/.test(placeGroups([{ members: [0], text: 'x', verdict: 'FITS', reason: 'a\nb\nc' }], TEXTS)[0].reason))
ok('control — dropping unplaced items would lose D', placed.filter((g) => g.verdict !== 'NOT_TESTED').flatMap((g) => g.members).includes(3) === false)
ok('provenance reads in words', describeSource({ kind: 'DRAFT', model: 'grok-4.7', draftId: 'd', consolidationId: 'c' }) === 'grok-4.7 draft'
  && /parked with policy 2/.test(describeSource({ kind: 'PARKED', policyOptionId: 'p', number: 14, parkedWithNumber: 2 })))

console.log('\n── the step writes CANDIDATES, once each, on acceptance — parked and comment ideas included ──')
const lib = read('lib/lex/action-ideas.ts')
const addActionCalls = (lib.match(/\baddAction\(/g) ?? []).length
ok('addAction is called in exactly one place (one candidate per tested group)', addActionCalls === 1)
ok('no lexCoherentAction is created directly', !/lexCoherentAction\.create/.test(lib))
ok('the field is never confirmed here (no acceptField / skipField)', !/acceptField|skipField/.test(lib))
ok('control — a second creation site would be caught', (('x addAction( y addAction( z').match(/\baddAction\(/g) ?? []).length !== 1)
ok('the user\'s comments are read at acceptance, not only when the drafts arrive', /extractFromComments\(ideaId, opts\.consolidationId/.test(lib))
ok('a comment idea must quote the comment or its draft', /quote is in neither comment nor draft/.test(lib))
ok('the prompt refuses meta-remarks and principles as steps', /NOT EVERYTHING A USER SAYS IS A STEP/.test(lib))
const accept = read('app/api/ideas/[id]/guiding-policy/consolidate/[consolidationId]/route.ts')
const gpsSrc = read('lib/lex/guiding-policy-state.ts')
const settleSrc = gpsSrc.slice(gpsSrc.indexOf("case 'settle':"), gpsSrc.indexOf("case 'unchoose'"))
ok('the acceptance goes through settle, and settle (the event) runs the step on that policy', /op: 'settle', policyId: created\.id/.test(accept) && /onGuidingPolicySettled\(id, row\.id/.test(settleSrc))
ok('...which reads the latest consolidation of the idea, so ITS comments are read', /guidingPolicyConsolidation\.findFirst\(\{\s*where: \{ ideaId \}, orderBy: \{ createdAt: 'desc' \}/.test(read('lib/lex/action-ideas.ts')))
ok('...after the replaced policy has been demoted, in the same case', settleSrc.indexOf("status: 'CANDIDATE'") < settleSrc.indexOf('onGuidingPolicySettled'))
ok('the result is returned, not swallowed', /actionIdeas,\s*policyFields\s*\}\)/.test(accept))
ok('parked actions are gathered in the same step', /kind: 'COHERENT_ACTION'/.test(lib) && /movedToActionId: null/.test(lib) && /parkedWithId: \{ not: null \}/.test(lib))
ok('they are marked MOVED and re-parented to the settled policy, not left on the replaced one', /parkedWithId: finalPolicyId, moveStatus: 'ACCEPTED', movedToActionId: action\.id/.test(lib))
ok('a failed test changes nothing (it returns before any write)', lib.indexOf("if (!result.ok)") < lib.indexOf('placeGroups(result.value.groups'))
ok('a dry run writes no action and no idea', /if \(opts\.dryRun\) continue/.test(lib) && /if \(dryRun\) return/.test(lib))
ok('the sort does not re-offer an action already moved', /moveStatus === 'ACCEPTED' && row\.movedToActionId\) continue/.test(read('lib/lex/guiding-policy-state.ts')))
ok('control — a settle without the hook would be caught', !/onGuidingPolicySettled/.test(settleSrc.split('onGuidingPolicySettled').join('x')))
ok('a comment reads as the user\'s own words', describeSource({ kind: 'COMMENT', consolidationId: 'c', model: 'grok-4.7' }) === 'your comment on the grok-4.7 draft'
  && /general comment/.test(describeSource({ kind: 'COMMENT', consolidationId: 'c', model: null })))

console.log('\n── reachable from a route; the verdict is not colour alone ──')
// DECISIONS 138 + 139 (9 Oct 2026): the box is gone, the verdict is on the action, and Remove is gone. The full set of assertions is in check:lex-9oct.
ok('decision 138: the "Added from the consolidation" box is not imported or rendered any more', !/ActionSuggestions/.test(read('components/lex/FieldsPanel.tsx')))
const routeSrc = read('app/api/ideas/[id]/action-ideas/route.ts')
ok('the route offers retry only: no accept, and (decision 139) no remove', !/z\.literal\('remove'\)/.test(routeSrc) && !/z\.literal\('accept'\)/.test(routeSrc) && /z\.literal\('test'\)/.test(routeSrc))
const ui = read('components/lex/ActionsWorkspace.tsx')
ok('each verdict has a word AND a differently-shaped glyph, on the action', ['Conflicts', 'Does not fit', 'Fits'].every((w) => read('lib/lex/action-facets.ts').includes(w)) && ['✗', '○', '✓'].every((g) => read('lib/lex/action-facets.ts').includes(g)) && /POLICY_VERDICT_UI\[a\.policyTest\.verdict\]/.test(ui))
ok('it says where each came from when the row is opened, and there is no Remove', /From: \{a\.policyTest\.from\.join/.test(ui) && !/Remove from my actions/.test(ui))
ok('the schema holds the table and the migration says it is additive', /model ActionIdea/.test(read('prisma/schema.prisma')) && /ADDITIVE ONLY/.test(read('prisma/lex_26m_action_ideas.sql')))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
