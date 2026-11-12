// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26x3b — LEX 26-X part X3b, §6a.6 (decision 315; CCh-Lex 7 Nov (2), 1): "Who delivers and who resists" on the Deepening, open
// WHATEVER THE LOCK SAYS; the record section and its band entry gone. Counts what RAN (§23.2). Spends nothing: no model is called.
//
//   A · pure — the count's reader on fixtures (against + nothing changes it; against + a linked action; against + words only); the record's
//       sections and band no longer name "who"
//   B · RENDERED — the lock LOCKED: its count and list, AND section 6, and NOT sections 1–5; OPEN: both; section 6 holds the count with its
//       action numbers, seven slots per action, the three filters with their counts, and the "By who" map
//   C · the page — section 6 mounted outside `open &&`, everything else inside it (source, comments stripped)
//   D · the record — an opened Drafting record has no seven slots and no "Who" band entry
//   E · Lex and the guide — every new label has an entry; the slot controls and the system prompt say the Deepening
//   F · COLD READ of 452c5ade (§26): the count from the reader against a plain query of the stored directions
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26x3b.ts
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import * as IM from '../lib/lex/incentive-map'
import * as RL from '../lib/lex/record-layout-pure'
import * as SL from '../lib/lex/screen-labels'
import { parseRecord } from '../lib/lex/action-record'
import { guideEntries, normLabel } from '../lib/lex/field-guide'
import { CONTROLS } from '../lib/lex/agent/controls'
import DeepeningGate, { type Lock } from '../components/lex/DeepeningGate'
import DeepeningWho from '../components/lex/DeepeningWho'
import ActionsWorkspace from '../components/lex/ActionsWorkspace'
import * as PP from '../lib/lex/action-progress-pure'

const SOURCE = '452c5ade'
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ')

const AT = '2026-11-11T00:00:00.000Z'
const slot = (text: string, extra: Record<string, unknown> = {}) => ({ text, by: 'USER', at: AT, ...extra })
const mk = (n: number, who: string | null, record: Record<string, unknown>) => ({
  id: `a${n}`, number: n, title: `Action ${n}`, practicalStep: `The body of action ${n}.`, whoImplements: who, wording: null, headingId: 'h1', targetCauseIds: [], avenue: 'ORGANISATIONAL', link: null, sequence: null, beforeIds: [], parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null,
  facetProposal: null, titleProposal: null, source: 'LEX', mechanismType: null, targetOrganisation: null, benefits: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null, policyTest: null, conflictNote: null, conditionIds: [], supportOnly: false, commentary: 'd', acceptedDraft: null,
  record: who ? { who: { by: 'USER', at: AT }, ...record } : record,
})
// #1 against, nothing changes it (specific: Who + Against) · #2 against, turned by #3 · #3 no Who (not specific) · #4 against, words only
const ROWS = [
  mk(1, 'Cabinet Office (inside government)', { incentiveNow: slot('They lose control of appointments.', { direction: 'AGAINST' }), against: slot('Permanent secretaries; the counter is the duty.') }),
  mk(2, 'HM Treasury', { incentiveNow: slot('A cost to them.', { direction: 'AGAINST' }), whatChangesIt: slot('The budget line in #3.', { linkActionId: 'a3' }), against: slot('Spending teams.') }),
  mk(3, null, {}),
  mk(4, 'Department for Education', { incentiveNow: slot('Their workload rises.', { direction: 'AGAINST' }), whatChangesIt: slot('Ministers will insist.'), against: slot('Unions.') }),
]
const LOCK = (open: boolean): Lock => ({ counts: { toGo: open ? 0 : 3 } as never, parked: 0, deepeningOpen: open, toGo: open ? [] : [{ id: 'a3', number: 3, title: 'Action 3', statement: 's', stage: 'toBrief' as never }], overrideLine: null })

// ── A · pure ──────────────────────────────────────────────────────────────────────────────────────────────────
function partA() {
  section('A · pure — the count, and the record without "who"')
  const nothing = IM.actionsWithNothingChangingIt(ROWS as never)
  ok('the count reads only #1: against with nothing changing it (#2 is turned by #3; #4 is turned in words)', nothing.join() === '1', nothing.join())
  const line = IM.incentiveChecklistLine(ROWS as never)
  ok('…in the brief\'s words: "1 action relies on an implementer whose incentive is against and nothing changes it"', line?.text === '1 action relies on an implementer whose incentive is against and nothing changes it' && line.done === false, line?.text)
  control('a linked action that has left the list still counts (LINK_GONE): drop #3 and #2 must join the count', IM.actionsWithNothingChangingIt(ROWS.filter((r) => r.id !== 'a3') as never).join() === '1')
  ok('the record\'s sections no longer include "who"; the band states have no "who" key', !RL.RECORD_SECTIONS.some((s) => (s.key as string) === 'who') && !('who' in RL.bandStates({ detail: null, documents: null, lawRows: null, costs: 'not answered', after: [], comments: 0 })))
}

// ── B · rendered: the lock, and section 6 ────────────────────────────────────────────────────────────────────
function partB() {
  section('B · RENDERED — section 6 opens whatever the lock says')
  const page = (open: boolean, child: 'fn' | 'node' = 'fn') => renderToStaticMarkup(React.createElement(DeepeningGate, {
    ideaId: 'idea-x', initial: LOCK(open),
    children: child === 'fn'
      ? (o: boolean) => React.createElement(React.Fragment, null, o ? React.createElement('div', { 'data-deepening-sections': '' }, 'SECTIONS 1-5') : null,
        React.createElement(DeepeningWho, { ideaId: 'idea-x', actions: ROWS as never, onChanged: () => {}, open: o }), o ? React.createElement('div', { 'data-deepening': 'law' }, 'LAW') : null)
      : React.createElement('div', { 'data-deepening-sections': '' }, React.createElement(DeepeningWho, { ideaId: 'idea-x', actions: ROWS as never, onChanged: () => {}, open: true })),
  } as never))
  const locked = page(false), open = page(true)
  ok('LOCKED: the lock\'s count and list show, AND section 6, and NOT sections 1–5 nor the law table', /data-deepening-locked/.test(locked) && /data-lock-action="3"/.test(locked) && /data-deepening-section="who"/.test(locked) && !/data-deepening-sections/.test(locked) && !/data-deepening="law"/.test(locked))
  ok('…section 6 says, in words, that it is open while the rest is locked', textOf(locked).includes('Open while the rest of the Deepening is locked'))
  ok('…and below the lock, not above it', locked.indexOf('data-deepening-locked') < locked.indexOf('data-deepening-section="who"'))
  ok('OPEN: sections 1–5, then section 6, then the law table; no lock; no "open while locked" line', /data-deepening-sections/.test(open) && open.indexOf('data-deepening-sections') < open.indexOf('data-deepening-section="who"') && open.indexOf('data-deepening-section="who"') < open.indexOf('data-deepening="law"') && !/data-deepening-locked/.test(open) && !textOf(open).includes('Open while the rest'))
  control('a plain-node child (the old contract) shows section 6 when locked', /data-deepening-section="who"/.test(page(false, 'node')))

  const t = textOf(locked)
  ok(`section 6 is headed "${SL.DEEPENING_UI.who}"`, t.includes(SL.DEEPENING_UI.who))
  ok('the count, with its action: "1 action relies on an implementer whose incentive is against and nothing changes it: #1"', /data-who-count="1"/.test(locked) && t.includes('1 action relies on an implementer whose incentive is against and nothing changes it: #1.'))
  const lis = [...locked.matchAll(/data-who-action="(\d+)"/g)].map((m) => m[1])
  ok('every live action is listed, in number order', lis.join() === '1,2,3,4', lis.join())
  ok('each holds its seven slots, editable (ActionSlots, one per action)', (locked.match(/data-slots-for="/g) ?? []).length === 4 && (locked.match(/data-slot="/g) ?? []).length === 28)
  ok('each line says where it stands in words: specific or what is missing, answered of 7, and "against, nothing changes it" on #1 only', /#1 Action 1 · ✓ specific enough · 3 of 7 answered · ▼ against, nothing changes it/.test(t) && /#3 Action 3 · ○ not yet specific[^·]*· 0 of 7 answered/.test(t) && (t.match(/against, nothing changes it/g) ?? []).length === 1, t.slice(t.indexOf('#1 Action 1'), t.indexOf('#1 Action 1') + 200))
  ok('the three filters, with their counts: every action (4) · not yet specific (1) · against, nothing changes it (1)', t.includes(`${SL.DEEPENING_UI.whoShowAll} (4)`) && t.includes(`${SL.DEEPENING_UI.whoShowNotSpecific} (1)`) && t.includes(`${SL.DEEPENING_UI.whoShowNothingChanges} (1)`) && /aria-pressed="true"[^>]*data-who-show="all"/.test(locked))
  ok('the "By who" map is here, one row per implementer and the unnamed row', /data-who-map/.test(locked) && /data-incentive-map/.test(locked) && /data-map-row="__none"/.test(locked) && (locked.match(/data-map-row="/g) ?? []).length === 4)
  const empty = textOf(renderToStaticMarkup(React.createElement(DeepeningWho, { ideaId: 'idea-x', actions: [] as never, onChanged: () => {}, open: true })))
  ok('with no live actions it says so', empty.includes('No live actions yet.'))
}

// ── C · the page ─────────────────────────────────────────────────────────────────────────────────────────────
function partC() {
  section('C · the page mounts section 6 outside the lock, everything else inside')
  const page = readFileSync('app/ideas/create/CreateIdeaClient.tsx', 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')
  const gate = page.slice(page.indexOf('<DeepeningGate'), page.indexOf('</DeepeningGate>'))
  ok('the gate\'s child is a function of the lock', /<DeepeningGate ideaId=\{state\.ideaId\}>\{\(open\) =>/.test(gate))
  ok('sections 1–5 mount only when open', /\{open && <DeepeningSections /.test(gate))
  ok('section 6 is NOT behind `open &&`, and is told the lock', /\n\s*<DeepeningWho [^>]*open=\{open\}/.test(gate) && !/open && <DeepeningWho/.test(gate))
  ok('the law table, documents tree, update pass and research passes stay behind `open`', (() => { const i = gate.indexOf('{open && (<>'); return i > gate.indexOf('<DeepeningWho') && ['<DeepeningLawTable', '<DocumentsTree', '<UpdatePassPanel', '<DeepeningPanel'].every((x) => gate.indexOf(x) > i) })())
}

// ── D · the record ───────────────────────────────────────────────────────────────────────────────────────────
function partD() {
  section('D · the record has no "Who" section and no band entry')
  const prog: PP.Progress = { stage: 'toBrief', noDraft: null, draftKinds: ['OPERATING_TEXT'], marks: { defined: 'done', briefed: 'none', drafted: 'none', reviewed: 'none', accepted: 'none' } }
  const html = renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: 'idea-x', actions: ROWS as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Operations', colourKey: 'blue', hidden: false, orderIndex: 0, kind: 'OTHER' }] as never,
    causes: [] as never, busy: false, onChanged: () => {}, initiallyOpen: ['a1'], page: 'drafting', onPage: () => {},
    initialDevelopment: { rows: ROWS.map((r) => ({ id: r.id, progress: prog })), counts: PP.draftingCounts(ROWS.map(() => prog)), parked: 0 },
    renderFull: (a: { number: number }, _s: number, between?: React.ReactNode) => React.createElement('div', null, `STATEMENT ${a.number}`, between, `ACTION DETAILS ${a.number}`),
  } as never))
  ok('an opened Drafting record renders (its Costs section is there)', /data-record-section="costs"/.test(html))
  ok('…with no "who" section, no seven slots, no "who" band button', !/data-record-section="who"/.test(html) && !/data-slots-for=/.test(html) && !/data-band="who"/.test(html))
}

// ── E · Lex and the guide ────────────────────────────────────────────────────────────────────────────────────
function partE() {
  section('E · Lex and the guide follow')
  const g = guideEntries()
  const labels = new Set(g.map((e) => normLabel(e.label)))
  const missing = Object.values(SL.DEEPENING_UI).map((l) => (typeof l === 'function' ? l('N') : l)).filter((l) => !labels.has(normLabel(l)))
  ok('every Deepening label has a guide entry', missing.length === 0, missing.join(' | '))
  const who = g.find((e) => e.key === 'deepening.who')
  ok('section 6\'s entry says it opens whatever the lock says, and that it left the record', !!who && /opens whatever the lock says/.test(who.fits) && /moved here from each action's record/.test(who.fits), who?.fits)
  ok('no guide entry still says the slots are "a section of the record until"', !g.some((e) => /section of the record until it moves/.test(`${e.purpose} ${e.fits}`)))
  const slots = CONTROLS.filter((c) => c.file === 'components/lex/ActionSlots.tsx')
  ok(`Lex's ${slots.length} slot controls say they are on the Deepening, in section 6, and name no Coherent Actions page`, slots.length === 3 && slots.every((c) => /Who delivers and who resists/.test(c.where) && /Deepening/.test(c.where) && !c.page))
  const prompt = readFileSync('lib/lex/agent/system-prompt.ts', 'utf8')
  ok('the system prompt says the seven are edited on the Deepening, and no longer lists Who among the record\'s sections', prompt.includes('edited on the Deepening page in section 6') && !prompt.includes('a section of every action’s record') && !/Law, Who, how and against, Costs/.test(prompt))
}

// ── F · cold read ────────────────────────────────────────────────────────────────────────────────────────────
async function partF() {
  section('F · COLD READ of 452c5ade (§26)')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE }, deletedAt: null }, select: { id: true } })
  if (!idea) { skip('part F', `no idea ${SOURCE}`); return }
  const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id, status: 'LIVE', parked: false }, select: { id: true, number: true, title: true, practicalStep: true, whoImplements: true, record: true } })
  const reader = IM.actionsWithNothingChangingIt(live)
  // plain: stored direction AGAINST with text, and a What-changes-it with neither a live link nor words
  const ids = new Set(live.map((a) => a.id))
  const plain = live.filter((a) => {
    const r = (a.record ?? {}) as Record<string, { text?: string; direction?: string; linkActionId?: string | null } | undefined>
    if (!(r.incentiveNow?.text?.trim() && r.incentiveNow.direction === 'AGAINST')) return false
    const w = r.whatChangesIt
    if (w?.linkActionId) return !ids.has(w.linkActionId)
    return !w?.text?.trim()
  }).map((a) => a.number)
  const against = live.filter((a) => parseRecord(a.record).incentiveNow?.direction === 'AGAINST').length
  ok(`the count the screen shows (${reader.length}${reader.length ? `: ${reader.map((n) => `#${n}`).join(', ')}` : ''}) equals a plain query of the stored slots (${plain.length}); ${against} of ${live.length} live actions are recorded against`, reader.length === plain.length && reader.every((n) => plain.includes(n)))
}

// ── G · §7 renames: "document" → "draft" where it means what we write ─────────────────────────────────────────
const OLD_ON_SCREEN = [
  'Add a document', 'Review this document', 'Save the document', 'Needs no document', 'By document', 'On an action, not on one of its documents',
  'no document yet', 'Find in the documents', 'The kind of document to add', 'Each document', 'Reading the documents', 'Reading this action’s documents',
  'Opening the document', 'the document as a whole', 'documents not read', 'reading documents…', 'The document counts', 'one document at a time',
  'The documents on this idea’s actions', '>The documents<',
]
const DRAFT_FILES = ['components/lex/DocumentView.tsx', 'components/lex/ActionRecordSections.tsx', 'components/lex/DocumentsTree.tsx', 'components/lex/RisksView.tsx',
  'components/lex/DraftNeedsPanel.tsx', 'components/lex/ActionsBoard.tsx', 'app/ideas/[id]/IdeaDetailClient.tsx', 'app/ideas/create/CreateIdeaClient.tsx', 'lib/lex/screen-labels.ts', 'lib/lex/record-layout-pure.ts']
function partG() {
  section('G · §7 — "document" → "draft" wherever it means what we write')
  const src = DRAFT_FILES.map((f) => [f, readFileSync(f, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')] as const)
  const left = src.flatMap(([f, s]) => OLD_ON_SCREEN.filter((w) => s.includes(w)).map((w) => `${f}: “${w}”`))
  ok(`none of the ${OLD_ON_SCREEN.length} old draft-sense phrases is left in the ${DRAFT_FILES.length} files that drew them`, left.length === 0, left.join(' | '))
  control('the scan finds an old phrase when one is planted', !['x “Review this document” y'].some((s) => OLD_ON_SCREEN.some((w) => s.includes(w))))
  ok('the four labels in the tables read "draft": Add a draft · Review this draft · Save the draft · Needs no draft', SL.RECORD_UI.addDocument === 'Add a draft' && SL.DOCUMENT_UI.reviewThisDocument === 'Review this draft' && SL.DOCUMENT_UI.saveTheDocument === 'Save the draft' && SL.TREE_UI.needsNothing === 'Needs no draft')
  ok('the record\'s section and band say "Drafts" ("N drafts" when none is needed)', RL.sectionLabel('documents') === 'Drafts' && RL.bandStates({ detail: null, documents: { needed: 0, drafted: 0, accepted: 0, total: 2 }, lawRows: 0, costs: 'not answered', after: [], comments: 0 }).documents === '2 drafts')
  const idea = readFileSync('app/ideas/[id]/IdeaDetailClient.tsx', 'utf8'), create = readFileSync('app/ideas/create/CreateIdeaClient.tsx', 'utf8')
  ok('the idea page\'s tab is "Drafts" and the Deepening\'s tree is "Drafts on actions", both from DRAFTS_UI', /\{ key: 'documents', label: DRAFTS_UI\.ideaTab \}/.test(idea) && /\{DRAFTS_UI\.deepeningTree\}/.test(create) && SL.DRAFTS_UI.ideaTab === 'Drafts' && SL.DRAFTS_UI.deepeningTree === 'Drafts on actions')
  ok('"Documents" stays where it means uploaded files: "Import actions from a document" and the idea page\'s inbound Documents heading', SL.ORGANISING_TOOLBAR_UI.importActions === 'Import actions from a document' && /<h2 className="text-lg font-semibold text-zinc-900">Documents<\/h2>/.test(idea))
  const pack = readFileSync('lib/documents/build-actions-pack.ts', 'utf8')
  ok('the Actions Pack: paragraph 14 is "Drafts", the key line says "14 Drafts" and "a draft on an action", the list is headed DRAFTS', /'Drafts',\s*\] as const/.test(pack) && pack.includes('14 Drafts)') && pack.includes('A draft on an action has a D-number') && pack.includes("title: 'DRAFTS'"))
  const g = guideEntries(), labels = new Set(g.map((e) => normLabel(e.label)))
  const missing = Object.values(SL.DRAFTS_UI).filter((l) => !labels.has(normLabel(l)))
  ok('every DRAFTS_UI label has a guide entry', missing.length === 0, missing.join(' | '))
  const wrong = g.filter((e) => /"(Add a document|Review this document|Save the document|Needs no document)"/.test(`${e.purpose} ${e.fits}`)).map((e) => e.key)
  ok('no guide entry quotes an old label', wrong.length === 0, wrong.join(', '))
  const tools = readFileSync('lib/lex/agent/tools.ts', 'utf8')
  ok('Lex\'s tools quote the new labels ("Review this draft") and keep their names (review_document, list_documents)', tools.includes('The same as "Review this draft" on a draft') && !tools.includes('"Review this document"') && /name: 'review_document'/.test(tools) && /name: 'list_documents'/.test(tools))
}

async function main() {
  partA()
  partG()
  partB()
  partC()
  partD()
  partE()
  await partF()
  console.log(`\ncheck:lex-26x3b — ${pass} passed, ${fail} failed, of ${ran} run · ${controls} controls, ${dead} dead · ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
