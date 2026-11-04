// ─────────────────────────────────────────────────────────────────────────────
// 26-Q — RENDER the coherent-actions workspace and read the markup (docs/CLAUDE.md §25: it renders, it does not grep).
//
//   tsx scripts/verify-lex-26q-ui.tsx
//
// What a user SEES: a titles-only line per action with its number; a heading as NAME + SHAPE + colour trim; a hidden heading
// that still shows its count; Later phase and ruled-out sections that are COLLAPSED; the coverage grid with an empty row
// labelled in words; the sequence view naming what to start with. A static render cannot press a button — the clicks are
// covered by `check:lex-26q`'s route and tool runs; this proves what the page puts in front of Charlie.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ActionsWorkspace, { CoverageView } from '../components/lex/ActionsWorkspace'
import { OrderView } from '../components/lex/ActionsOrder'
import type { CanonicalAction, CanonicalActionHeading, CanonicalCause } from '../lib/lex/page1-config'
import { HEADING_PALETTE } from '../lib/lex/action-headings'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, detail = '') { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }

const act = (n: number, over: Partial<CanonicalAction> = {}): CanonicalAction => ({
  id: `a${n}`, practicalStep: `Step number ${n} that does a particular thing`, mechanismType: null, whoImplements: null, targetOrganisation: null, wording: null, benefits: null,
  implementationCost: null, enforcementCost: null, regulatoryFriction: null, source: 'USER', number: n, title: null, titleProposal: null, headingId: null, parked: false, parkedReason: null,
  targetCauseIds: [], avenue: null, link: null, sequence: null, beforeIds: [], facetProposal: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null, policyTest: null, conflictNote: null, commentary: null,
  record: null, noCostReason: null, conditionIds: [], supportOnly: false, foldedIntoId: null, headingReason: null, ...over,
})
const heads: CanonicalActionHeading[] = [
  { id: 'h1', name: 'Legislation', colourKey: 'navy', hidden: false, orderIndex: 0, kind: null, proposedKind: null, proposedKindReason: null },
  { id: 'h2', name: 'Practical steps', colourKey: 'olive', hidden: true, orderIndex: 1, kind: null, proposedKind: null, proposedKindReason: null },
]
const causes = [
  { id: 'c1', number: 1, cause: 'Responsibility is spread across committees' }, { id: 'c2', number: 2, cause: 'Nobody measures delivery' },
] as unknown as CanonicalCause[]
const actions = [
  act(1, { title: 'Publish every named owner’s measure', headingId: 'h1', avenue: 'LEGISLATIVE', sequence: 'NOW', targetCauseIds: ['c1'], whoImplements: 'Cabinet Office', beforeIds: ['a3'] }),
  act(2, { headingId: 'h2', titleProposal: 'Name one owner for each target' }),
  act(3, { sequence: 'NEXT', link: 'duty and means', facetProposal: { avenue: 'FINANCIAL' } }),
  act(4, { parked: true, parkedReason: 'needs the Bill first' }),
]
const setAside = [act(5, { status: 'RULED_OUT', ruleOutReason: 'Overtaken by the audit unit' }), act(6, { status: 'ARCHIVED', mergedIntoId: 'a1', ruleOutReason: 'Merged into 1.' })]

console.log('── verify:lex-26q-ui ──')
const html = renderToStaticMarkup(
  <ActionsWorkspace ideaId="idea-1" actions={actions} setAside={setAside} headings={heads} causes={causes} busy={false} onChanged={() => {}} renderFull={(a) => <div>FULL CARD {a.number}</div>} />,
)
const navy = HEADING_PALETTE.find((c) => c.key === 'navy')!
const olive = HEADING_PALETTE.find((c) => c.key === 'olive')!

ok('a titled action leads with its title, and its number', html.includes('#1') && html.includes('Publish every named owner’s measure'))
ok('an untitled action shows the first words of the action instead', html.includes('Step number 3 that does a particular thing'))
ok('the heading is shown as NAME + SHAPE + a colour trim (never colour alone)', html.includes('Legislation') && html.includes(navy.glyph) && html.includes(`6px solid ${navy.hex}`))
ok('the heading\'s colour is NAMED in words beside the count', html.includes('navy blue'))
ok('a HIDDEN heading keeps its header and says how many are not shown', html.includes('Practical steps') && html.includes('Hidden — 1 action not shown'))
ok('the hidden heading\'s action is NOT drawn', !html.includes('Step number 2'))
ok('every DRAWN line has a heading dropdown (two: the third is under the hidden heading, the fourth is parked)', (html.match(/aria-label="Heading for action/g) ?? []).length === 2)
ok('every drawn line has a checkbox and a drag handle', (html.match(/aria-label="Select action/g) ?? []).length === 2 && (html.match(/aria-label="Reorder action/g) ?? []).length === 2)
// ⚠ MOVED BY 26-X addendum 323: was '"Title these for me (2)"' and "Lex suggests the title … Use it / Edit / No". The count's meaning is in the
// label now ("2 actions have no title · Title them with Lex"), and a proposal reads "Lex proposes: … — Accept · Not this".
ok('"Title them with Lex" says what its count is: "2 actions have no title"', html.includes('2 actions have no title') && html.includes('Title them with Lex'))
ok('a Lex-proposed title is offered with Accept / Not this — it is a proposal, not the title', !html.includes('Name one owner for each target') /* action 2 is hidden */ || (html.includes('Lex proposes:') && html.includes('Not this')))
// 26-S2 §3: the screen shows only the current step's tools, so the old single-screen assertions below are asserted PER STEP (html = step 1; h2/h4 = steps 2 and 4).
// ⚠ MOVED BY 26-X 308: there are no steps — step 1 is the Organising page, and steps 2–4 have no page (their tags left the rows; their data
// is on the record, opened on Drafting). Was: per-step rows (Who in step 2, "must come after" in step 4) and step 4's derived-order view.
const mount = (step: 1 | 2 | 3 | 4) => renderToStaticMarkup(<ActionsWorkspace ideaId="idea-1" actions={actions} setAside={setAside} headings={heads} causes={causes} busy={false} onChanged={() => {}} renderFull={(a) => <div>FULL CARD {a.number}</div>} page={step === 1 ? 'organising' : 'drafting'} />)
const h2 = mount(2), h4 = mount(4)
ok('a proposed classification is announced on the line (Organising: the causes or an avenue)', html.includes('Lex has proposed causes or an avenue'))
ok('the facets show as words on Organising (avenue); no row on either page carries Who, the order, Now / Next / Later, "link" or "specific enough"', html.includes('Legislative') && !html.includes('Now') && !h2.includes('Who: Cabinet Office') && !h4.includes('must come after #1') && !html.includes('link: duty and means') && !html.includes('specific enough') && !html.includes('not yet specific'))
ok('the group control offers step 1’s facets (heading, cause, avenue, policy test) — not the retired link, and not sequence', ['By heading', 'By cause', 'By avenue', 'By policy test'].every((l) => html.includes(l)) && !html.includes('By link') && !html.includes('By sequence') && !h4.includes('By sequence'))
ok('the views are Organising’s, the current one marked with a glyph AND aria-selected: List, Board and Coverage grid; Drafting has the list only', html.includes('Coverage grid') && html.includes('○ Board') && !html.includes('Sequence') && !h4.includes('The order, derived') && !h4.includes('Coverage grid') && html.includes('aria-selected="true"') && html.includes('● List'))
ok('Find duplicates and Classify with Lex are offered', html.includes('Find duplicates') && html.includes('Classify with Lex'))
ok('the Later phase section is COLLAPSED (its parked action is not in the markup) but counted', html.includes('Later phase') && !html.includes('needs the Bill first') && html.includes('aria-expanded="false"'))
ok('the ruled-out section is COLLAPSED but counted, and says nothing is deleted', html.includes('Ruled out and merged away') && html.includes('Nothing here is deleted') && !html.includes('Overtaken by the audit unit'))
ok('nothing in the closed list is drawn as an open card until a title is clicked', !html.includes('FULL CARD'))

const cov = renderToStaticMarkup(<CoverageView actions={actions.filter((a) => !a.parked)} causes={causes.map((c) => ({ id: c.id, number: c.number ?? null, cause: c.cause }))} headings={heads} />)
ok('coverage grid: an EMPTY ROW is labelled in words — "NO ACTION" — not only shaded', cov.includes('NO ACTION') && cov.includes('Nobody measures delivery'))
ok('coverage grid: the mark is a glyph with a label', cov.includes('aria-label="attacks this cause"'))
ok('coverage grid: says how many actions carry a recorded cause', cov.includes('1 of 3 actions have a recorded cause'))
ok('coverage grid: columns carry the heading name and shape', cov.includes('Legislation') && cov.includes(navy.glyph))
const seq = renderToStaticMarkup(<OrderView actions={actions.filter((a) => !a.parked)} />)
ok('the derived order (262): numbered, #1 before #3, and #3 says what it must come after — in words', /1\.<\/span> <span[^>]*>#1</.test(seq) && seq.indexOf('#1') < seq.indexOf('#3') && seq.includes('must come after #1'))
ok('the derived order shows no Now / Next / Later columns', !['Now', 'Next', 'Later', 'Not placed yet'].some((l) => seq.includes(l)))
ok('the olive heading (the lightest) is still drawn with its name', olive.hex.length === 7 && html.includes('Practical steps'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
