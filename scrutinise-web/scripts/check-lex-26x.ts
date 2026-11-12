// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26x — LEX 26-X (BRIEF_26X §8). Part X1: the lifecycle bar, the Development checklist and the lock, the Organising page, the
// Drafting page and the flip, the progress strip, the stage renames on banners and the FAQ. Counts what RAN (§23.2). Spends NOTHING: no model
// is called (the one route it calls refuses before anything is claimed).
//
//   A · pure — the strip's five states on fixtures for every kind of draft and for "needs no draft"; the counts and their words
//   B · COLD READ of 452c5ade (§26): the bar and the checklist through `stageContext` — what the page calls — against plain reads
//   C · the lock, on a scratch copy of 452c5ade through the real functions and the real route: "N to go"; the pass route refuses (423); the
//       override is recorded (appended), printed on the page's line and on the banner of a generated document; the lock opens at 0
//   D · the screens, RENDERED: Organising shows only §4a's tools and no step tabs; Drafting shows the counts, the filters, the strips, and a
//       record with "← Back to Organising" and its Drafts open at the top; the deep link redirects to the Drafting page
//   E · the renames (316): the seven names on the bar, the banner and the FAQ; no "The First Pass" / "The First Draft" as a stage name on
//       screen; the guide has an entry for every new control (26-W-b)
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26x.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '../lib/prisma'
import * as PP from '../lib/lex/action-progress-pure'
import * as DV from '../lib/lex/development'
import * as SL from '../lib/lex/screen-labels'
import { stageContext } from '../lib/lex/stage-context'
import { LEX_STAGES, LIFECYCLE_KEYS } from '../lib/lex/stages'
import { SEVEN_STAGES, stageSentence, withStageBanner, stageFromProgress } from '../lib/documents/stage-banner'
import { readDeepenedEarly } from '../lib/documents/stage-facts'
import { FAQ_MARKDOWN } from '../lib/faq-content'
import { guideEntries, normLabel } from '../lib/lex/field-guide'
import * as D from '../lib/lex/action-documents'
import StageBar from '../components/lex/StageBar'
import ActionsWorkspace from '../components/lex/ActionsWorkspace'
import ActionsPages from '../components/lex/ActionsPages'
import ProgressStrip from '../components/lex/ProgressStrip'
import { PASS_KEYS } from '../lib/lex/deepening-config'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import * as AS from '../lib/lex/action-structure'
import { execute, toolByName } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'

const SOURCE = '452c5ade'
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const P = DV.REVIEW_PASS_COUNT

// ── A · pure ────────────────────────────────────────────────────────────────────────────────────────────────
type Doc = PP.ProgressInput['documents'][number]
const doc = (kind: Doc['kind'], o: Partial<Doc> = {}): Doc => ({ kind, status: 'DRAFTED', acceptedV: null, current: { v: 1 }, reviewed: 0, ...o })
const input = (kinds: Doc['kind'][], documents: Doc[], o: Partial<PP.ProgressInput> = {}): PP.ProgressInput => ({
  statement: 'An action.', headingId: 'h1', headingKind: 'CODE', needs: { kinds, why: 'derived', overridden: false }, documents, ...o,
})

function partA() {
  section('A · pure — the strip on fixtures for every kind, and for "needs no draft"')
  const kinds: Array<[Doc['kind'], Doc['kind'][]]> = [
    ['DRAFT_CLAUSE', ['DRAFT_CLAUSE', 'COLLISION_REPORT']], ['CODE_TEXT', ['CODE_TEXT']], ['SPECIFICATION', ['SPECIFICATION']],
    ['OPERATING_TEXT', ['OPERATING_TEXT']], ['BACKGROUND_NOTE', ['BACKGROUND_NOTE']], ['COSTING', ['COSTING']],
  ]
  for (const [k, needs] of kinds) {
    const none = PP.progressOf(input(needs, []), P)
    const drafted = PP.progressOf(input(needs, [doc(k)]), P)
    const reviewed = PP.progressOf(input(needs, [doc(k, { reviewed: P })]), P)
    const accepted = PP.progressOf(input(needs, [doc(k, { status: 'ACCEPTED', acceptedV: 1, reviewed: P })]), P)
    const changed = PP.progressOf(input(needs, [doc(k, { status: 'DRAFTED', acceptedV: 1, current: { v: 2 } })]), P)
    const clause = k === 'DRAFT_CLAUSE'
    ok(`${k}: nothing yet → ${clause ? 'to brief' : 'to brief'}; drafted ○; the draft is ${k}`, none.stage === 'toBrief' && none.marks.drafted === 'none' && none.draftKinds.join() === k, JSON.stringify(none))
    ok(`${k}: a version → Drafted ●, Reviewed ○, "to review"; Briefed ${clause ? '● (the drafting instruction is its Brief)' : '○ (the Brief on every draft is X2)'}`,
      drafted.marks.drafted === 'done' && drafted.marks.reviewed === 'none' && drafted.stage === 'toReview' && drafted.marks.briefed === (clause ? 'done' : 'none'), JSON.stringify(drafted.marks))
    ok(`${k}: all ${P} passes read the current version → Reviewed ●, "to accept"`, reviewed.marks.reviewed === 'done' && reviewed.stage === 'toAccept')
    ok(`${k}: accepted at the current version → Accepted ●, "accepted"`, accepted.marks.accepted === 'done' && accepted.stage === 'accepted' && PP.isDone(accepted))
    ok(`${k}: accepted at v1, then changed to v2 → Accepted ◐ (in progress), not done`, changed.marks.accepted === 'part' && changed.stage === 'toReview' && !PP.isDone(changed))
  }
  const partReview = PP.progressOf(input(['CODE_TEXT'], [doc('CODE_TEXT', { reviewed: 2 })]), P)
  ok('two of five passes → Reviewed ◐', partReview.marks.reviewed === 'part')
  control('two of five passes read as Reviewed ● (must be FALSE)', partReview.marks.reviewed === 'done')
  const companionOnly = PP.progressOf(input(['DRAFT_CLAUSE', 'COLLISION_REPORT'], [doc('COLLISION_REPORT', { status: 'ACCEPTED', acceptedV: 1 })]), P)
  ok('313: a companion (the collision report) is never the draft — accepted alone, the action is still to brief', companionOnly.stage === 'toBrief' && companionOnly.marks.accepted === 'none')
  ok('313: a costing beside an instrument is a companion; on its own it IS the draft', PP.draftKindsOf(['OPERATING_TEXT', 'COSTING']).join() === 'OPERATING_TEXT' && PP.draftKindsOf(['COSTING']).join() === 'COSTING')
  const nd = PP.progressOf(input([], [], { needs: { kinds: [], why: 'needs nothing: done under an existing power', overridden: true } }), P)
  ok('"needs no draft" is a stated state with its reason, and counts as done', nd.stage === 'noDraft' && nd.noDraft?.reason === 'done under an existing power' && PP.isDone(nd))
  ok('…and reads "Defined ● · needs no draft ✓"', PP.stripWords(nd) === 'Defined ● · needs no draft ✓', PP.stripWords(nd))
  const noAvenue = PP.progressOf(input([], [], { needs: { kinds: [], why: 'no avenue chosen yet, so nothing is derived', overridden: false } }), P)
  ok('no avenue yet (nothing derived, not set by hand) is NOT "needs no draft" — it is still to go', noAvenue.stage === 'toBrief' && !PP.isDone(noAvenue))
  control('no avenue read as "needs no draft" (must be FALSE)', noAvenue.stage === 'noDraft')
  // ⚠ MOVED BY 26-X addendum 322 ("Defined ◐ until the statement and heading are both set"): was "a statement alone ○". Begun at all is ◐ now —
  // a statement alone, a title alone (an action just added by the form), or a heading with no statement; only nothing at all is ○.
  ok('Defined: statement + heading + the heading’s kind ●; a heading with no kind ◐; a statement alone ◐; a title alone ◐; nothing ○',
    PP.progressOf(input(['CODE_TEXT'], []), P).marks.defined === 'done' && PP.progressOf(input(['CODE_TEXT'], [], { headingKind: null }), P).marks.defined === 'part'
    && PP.progressOf(input(['CODE_TEXT'], [], { headingId: null, headingKind: null }), P).marks.defined === 'part'
    && PP.progressOf(input(['CODE_TEXT'], [], { statement: '', title: 'A new action', headingId: null, headingKind: null }), P).marks.defined === 'part'
    && PP.progressOf(input(['CODE_TEXT'], [], { statement: '', title: null, headingId: null, headingKind: null }), P).marks.defined === 'none')
  const all = [PP.progressOf(input(['CODE_TEXT'], [doc('CODE_TEXT', { status: 'ACCEPTED', acceptedV: 1 })]), P), nd, noAvenue]
  const c = PP.draftingCounts(all)
  ok('the counts and their words: "3 actions: 1 accepted · 1 needs no draft · 1 to go"', PP.draftingLine(c) === '3 actions: 1 accepted · 1 needs no draft · 1 to go', PP.draftingLine(c))
  ok('every action is in exactly one Drafting filter', Object.values(c.byStage).reduce((a, b) => a + b, 0) === all.length)
  const html = renderToStaticMarkup(React.createElement(ProgressStrip, { p: all[0] }))
  ok('the strip RENDERED: five states, each a word AND a shape (●/◐/○), in order', textOf(html).includes('Defined') && /Defined.*Briefed.*Drafted.*Reviewed.*Accepted/.test(textOf(html)) && (html.match(/data-progress="/g) ?? []).length === 5 && /●/.test(html) && /○/.test(html))
  ok('…and "needs no draft" renders as a word and ✓', /needs no draft/.test(textOf(renderToStaticMarkup(React.createElement(ProgressStrip, { p: nd })))) && /✓/.test(renderToStaticMarkup(React.createElement(ProgressStrip, { p: nd }))))
}

// ── B · cold read ──────────────────────────────────────────────────────────────────────────────────────────────
async function partB() {
  section(`B · cold read of ${SOURCE} — the lifecycle bar and the checklist, through what the page calls`)
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE } }, select: { id: true } })
  if (!idea) { skip('the cold read', `no idea starting ${SOURCE}`); return }
  const ctx = await stageContext(idea.id, 'strategy', 'drafting')
  ok('the bar shows the seven lifecycle stages, in order, by name', ctx.lifecycle.map((s) => s.name).join(' · ') === 'Creation · Development · Private Scrutiny · Public Scrutiny · Promotion · Submission · In Force', ctx.lifecycle.map((s) => s.name).join(' · '))
  ok('the workspace is in Development', ctx.current === 'development')
  const runs = await prisma.ideaBuild.count({ where: { ideaId: idea.id } })
  const live = await prisma.lexCoherentAction.count({ where: { ideaId: idea.id, status: 'LIVE', parked: false } })
  const creation = ctx.lifecycle.find((s) => s.key === 'creation')!.state
  const devLine = ctx.lifecycle.find((s) => s.key === 'development')!.state
  ok(`Creation's state is counted: "Lex’s first pass · ${runs} runs" (a plain count of builds)`, creation === `Lex’s first pass · ${runs} run${runs === 1 ? '' : 's'}`, creation)
  ok(`Development's state counts the live, un-parked actions (${live}, a plain count)`, devLine.startsWith(`Organising ${live} action`), devLine)
  ok('the stages with nothing built behind them say so in words', ['privateScrutiny', 'publicScrutiny', 'promotion'].every((k) => ctx.lifecycle.find((s) => s.key === k)!.state === 'not yet open') && ctx.lifecycle.find((s) => s.key === 'submission')!.state === 'not submitted' && ctx.lifecycle.find((s) => s.key === 'inForce')!.state === 'not yet available')
  const bar = renderToStaticMarkup(React.createElement(StageBar, { context: ctx }))
  ok('RENDERED: seven tiles; "You are here" once, on Development, with the filled disc', (bar.match(/data-lifecycle-stage="/g) ?? []).length === 7 && (bar.match(/data-you-are-here/g) ?? []).length === 1 && /data-lifecycle-stage="development"[\s\S]*?●[\s\S]*?You are here/.test(bar))
  control('a second "You are here" in the bar (must be FALSE)', (bar.match(/data-you-are-here/g) ?? []).length > 1)
  const cl = ctx.checklist ?? []
  ok('the checklist: seven lines in §3a’s order', cl.map((l) => l.key).join() === 'problem,causes,policy,organising,drafting,deepening,promotion')
  const dev = await DV.developmentState(idea.id)
  ok('line 5 (Drafting) is the counts’ own words', cl.find((l) => l.key === 'drafting')?.state === PP.draftingLine(dev.counts), cl.find((l) => l.key === 'drafting')?.state)
  ok(`…over the same live, un-parked actions (${dev.counts.total} = the plain count ${live})`, dev.counts.total === live)
  const deep = cl.find((l) => l.key === 'deepening')!
  ok(`line 6 (the Deepening) is ${dev.deepeningOpen ? 'open' : `locked, saying "${dev.counts.toGo} to go"`}`, dev.deepeningOpen ? deep.mark !== '🔒' : deep.mark === '🔒' && deep.state.includes(`${dev.counts.toGo} to go`) && deep.state.includes('locked'), deep.state)
  ok('line 7 (Promotional plan) says it is not yet available, and opens nothing', cl.find((l) => l.key === 'promotion')?.state === 'not yet available' && cl.find((l) => l.key === 'promotion')?.href === null)
  ok('the checklist RENDERS, the Drafting line marked "you are here" (the page is in the link)', /data-checklist-line="drafting"[^>]*aria-current="step"/.test(bar) && (bar.match(/aria-current="step"/g) ?? []).length === 2)
  console.log(`    (${SOURCE}: ${PP.draftingLine(dev.counts)}; ${dev.parked} parked; Deepening ${dev.deepeningOpen ? 'open' : 'locked'})`)
}

// ── C · the lock, on a scratch copy ────────────────────────────────────────────────────────────────────────────
async function partC() {
  section('C · the lock and the override — a scratch copy, the real functions and the real route')
  const scratch = await scratchCopy(SOURCE, '26x-lock')
  try {
    const user = await prisma.user.findUnique({ where: { id: scratch.userId } })
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = user
    const s0 = await DV.developmentState(scratch.id)
    ok(`the copy starts with no drafts: every live action is to go (${s0.counts.toGo} of ${s0.counts.total}, the parked not counted) — unless it needs no draft`, s0.counts.accepted === 0 && s0.counts.toGo === s0.counts.total - s0.counts.noDraft && s0.counts.toGo > 0, PP.draftingLine(s0.counts))
    ok('…and the Deepening is locked', !s0.deepeningOpen)
    const { POST: runPass } = await import('../app/api/ideas/[id]/deepening/[passKey]/run/route')
    const res = await runPass(new Request('http://x/run', { method: 'POST' }), { params: Promise.resolve({ id: scratch.id, passKey: PASS_KEYS[0] }) })
    const body = await res.json() as { error?: string; locked?: boolean; toGo?: number }
    ok('the pass route REFUSES while locked: 423, in words, with the count — before anything is claimed or spent', res.status === 423 && body.locked === true && body.toGo === s0.counts.toGo && /still to go/.test(body.error ?? '') && /Nothing was run or spent/.test(body.error ?? ''), `${res.status} ${body.error}`)
    ok('…and no pass row was claimed for it', (await prisma.deepeningPass.count({ where: { ideaId: scratch.id, passKey: PASS_KEYS[0], status: 'RUNNING' } })) === 0)

    // the override, through the real route (owner)
    const { POST: dev } = await import('../app/api/ideas/[id]/development/route')
    const bad = await dev(new Request('http://x', { method: 'POST', body: JSON.stringify({ op: 'override', reason: '' }) }), { params: Promise.resolve({ id: scratch.id }) })
    ok('an override with no reason is refused, in words, naming the reason', bad.status === 422 && /the reason/.test(((await bad.json()) as { error: string }).error))
    const reason = 'check:lex-26x — the remaining actions are minor'
    const good = await dev(new Request('http://x', { method: 'POST', body: JSON.stringify({ op: 'override', reason }) }), { params: Promise.resolve({ id: scratch.id }) })
    const g = await good.json() as { ok?: boolean; result?: { overrideLine: string } }
    const s1 = await DV.developmentState(scratch.id)
    const want = `Deepened with ${s1.counts.toGo} action${s1.counts.toGo === 1 ? '' : 's'} undrafted — reason: ${reason}`
    ok('the owner’s override is recorded and opens the Deepening; its line reads as the brief writes it', good.status === 200 && s1.deepeningOpen && g.result?.overrideLine === want, `${good.status} ${g.result?.overrideLine}`)
    const second = await dev(new Request('http://x', { method: 'POST', body: JSON.stringify({ op: 'override', reason: `${reason}, again` }) }), { params: Promise.resolve({ id: scratch.id }) })
    const stored = DV.deepenOverridesOf((await prisma.idea.findUnique({ where: { id: scratch.id }, select: { deepenOverride: true } }))?.deepenOverride)
    ok('a second override is APPENDED, never replacing the first (both kept, the last in force)', second.status === 200 && stored.length === 2 && stored[0].reason === reason && stored[1].reason.endsWith('again') && stored[0].toGo === s0.counts.toGo)
    // printed on every output: the banner of a generated document carries the line
    const printed = await readDeepenedEarly(scratch.id)
    const model = withStageBanner({ title: 't', blocks: [], generatedAt: new Date() } as never, 2, undefined, { deepenedEarly: printed })
    const bannerText = JSON.stringify(model.blocks)
    ok('the banner of a generated document prints "Deepened with N actions undrafted — reason: …"', !!printed && bannerText.includes(printed) && printed.startsWith(`Deepened with ${s1.counts.toGo} action`))
    const { buildFor } = await import('../lib/documents/proposal-export')
    const { buildProposalSnapshot } = await import('../lib/documents/proposal-snapshot')
    const snap = await buildProposalSnapshot(scratch.id)
    const withLine = JSON.stringify(buildFor('PROPOSAL', snap, null, { deepenedEarly: printed }).model.blocks)
    const without = JSON.stringify(buildFor('PROPOSAL', snap, null, {}).model.blocks)
    ok('…on the real Proposal builder, the working copy carries the line', withLine.includes(printed ?? '∅'))
    control('MUTATION: the Proposal built without the line still prints it (must be FALSE)', without.includes(printed ?? '∅'))

    // the lock opens at 0: every live action needs no draft, through the real function
    const rows = s1.rows.filter((r) => !r.parked)
    for (const r of rows) await D.setNeeds(scratch.id, r.id, { mode: 'nothing', reason: 'check:lex-26x — the lock at zero' }, scratch.userId)
    const s2 = await DV.developmentState(scratch.id)
    ok('when every live action needs no draft, Drafting reads "0 to go" and the lock is open by itself — the override line is no longer printed', s2.counts.toGo === 0 && s2.deepeningOpen && DV.overrideLine(s2) === null && PP.draftingLine(s2.counts).endsWith('0 to go'), PP.draftingLine(s2.counts))
  } finally {
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = undefined
    await deleteScratch(scratch.id)
  }
}

// ── D · the screens, rendered ──────────────────────────────────────────────────────────────────────────────────
function mkAction(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `a${n}`, number: n, title: `Action ${n}`, practicalStep: `The body of action ${n}, written out in full.`, whoImplements: null, wording: null, headingId: 'h1',
    targetCauseIds: [], avenue: null, link: null, sequence: null, beforeIds: [], parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null,
    facetProposal: null, titleProposal: null, source: 'LEX', mechanismType: null, targetOrganisation: null, benefits: null, implementationCost: null, enforcementCost: null,
    regulatoryFriction: null, policyTest: null, conflictNote: null, conditionIds: [], supportOnly: false, ...extra,
  }
}
const progressFor = (stage: PP.DraftingStage): PP.Progress => {
  const done = stage === 'accepted'
  return { stage, noDraft: stage === 'noDraft' ? { reason: 'r' } : null, draftKinds: ['CODE_TEXT'], marks: { defined: 'done', briefed: done ? 'done' : 'none', drafted: done ? 'done' : 'none', reviewed: done ? 'done' : 'none', accepted: done ? 'done' : 'none' } }
}
function partD() {
  section('D · the screens, RENDERED — Organising, Drafting, the flip')
  const rows = [mkAction(1), mkAction(2), mkAction(3)]
  const prog = [progressFor('accepted'), progressFor('noDraft'), progressFor('toBrief')]
  const initialDevelopment = { rows: rows.map((r, i) => ({ id: r.id, progress: prog[i] })), counts: PP.draftingCounts(prog), parked: 0 }
  const ws = (page: 'organising' | 'drafting', open: string[] = []) => renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: 'idea-x', actions: rows as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Legislation', colourKey: 'blue', hidden: false, orderIndex: 0, kind: 'CODE' }] as never,
    causes: [{ id: 'c1', number: 1, cause: 'A cause', whyPersisted: null }] as never, busy: false, onChanged: () => {},
    renderFull: (a: { number: number }, _s: number, between?: React.ReactNode) => React.createElement('div', null, `FULL CARD ${a.number}`, between),
    initiallyOpen: open, page, onPage: () => {}, initialDevelopment,
  }))
  const org = ws('organising'), o = textOf(org)
  const TOOLS_4A = ['List', 'Board', 'Coverage grid', 'Classify with Lex', 'Find duplicates', 'Print all', 'Add heading', 'Suggest headings from my guiding policy', 'Add action'] // addendum 321: 'Title these for me' became the counted 'Title them with Lex' (shown when an action has no title)
  ok('ORGANISING offers §4a’s tools: views, Classify, Find duplicates, Print all, headings, titles, the find box', TOOLS_4A.every((w) => o.includes(w)) && /data-find-box/.test(org), TOOLS_4A.filter((w) => !o.includes(w)).join(', '))
  ok('…and NO step tabs, no step intro, and no drafting control (no "Draft all legislative actions", no record opened in place)', !/data-step-bar|data-step-intro/.test(org) && !/1 Sort and prune|2 Who, how and against|3 Costs|4 Order/.test(o) && !/Draft all legislative actions/.test(o) && !/data-record-order/.test(org))
  control('a step tab rendered on Organising (must be FALSE)', /data-step=/.test(org))
  ok('§4b: every Organising row carries its progress strip', (org.match(/data-progress-strip="/g) ?? []).length === rows.length && /data-progress-strip="accepted"/.test(org) && /data-progress-strip="noDraft"/.test(org))
  ok('318: an Organising title flips to Drafting (it names the page) and every row has "Open"', (org.match(/data-open-in-drafting/g) ?? []).length === rows.length && /Open → Drafting/.test(o))
  ok('…the tick box and the drag handle are Organising’s', /Select action 1/.test(org) && /Reorder action 1/.test(org))

  const dr = ws('drafting'), d = textOf(dr)
  ok('DRAFTING: the counts at the top, in the brief’s words', d.includes('3 actions: 1 accepted · 1 needs no draft · 1 to go'))
  ok('…the filters, each with its count: all · to brief · to draft · to review · to accept · needs no draft · accepted', ['all (3)', 'to brief (1)', 'to draft (0)', 'to review (0)', 'to accept (0)', 'needs no draft (1)', 'accepted (1)'].every((w) => d.includes(w)), d.slice(0, 400))
  ok('…every row its strip; no Organising tools (no tick box, no drag, no Find duplicates, no Classify)', (dr.match(/data-progress-strip="/g) ?? []).length === rows.length && !/Select action|Reorder action/.test(dr) && !/Find duplicates|Classify with Lex|Title them with Lex|Add action/.test(d))
  control('Drafting showing the Organising toolbar (must be FALSE)', /Find duplicates/.test(d))
  const opened = ws('drafting', ['a3'])
  // MOVED BY 26-X X2 (§5c): X1 drew the Drafts OPEN *above* the statement (§5a); X2 puts the statement first, then the Brief, then the
  // Drafts — both open (check:lex-26x2 part D asserts the whole order). What stays true here: Back is at the top, and the Drafts are open.
  ok('a Drafting record opens with "← Back to Organising" at its top and the Drafts section OPEN (X2: under the statement and the Brief)', /data-back-to-organising/.test(opened) && /<details data-record-section="documents"[^>]*open=""/.test(opened) && opened.indexOf('data-back-to-organising') < opened.indexOf('FULL CARD 3') && opened.indexOf('data-record-section="brief"') < opened.indexOf('data-record-section="documents"'))
  // ⚠ MOVED BY 26-X X3b (§6a.6): CCh-Lex 4 Nov (2) item 1 kept "Who, how and against" on the record UNTIL X3; X3b moved it to the Deepening.
  ok('X3b: "Who, how and against" is no longer a section of the record; no line says "this step" or "from step N"', !/data-record-section="who"/.test(opened) && !/this step|from step \d/.test(textOf(opened)))
  // an action opened on Drafting (flip, deep link, a new "Add action") under a HIDDEN heading is still drawn (found by 26v1b: #202 on 452c5ade)
  const hid = (page: 'organising' | 'drafting') => renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: 'idea-x', actions: rows as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Legislation', colourKey: 'blue', hidden: true, orderIndex: 0, kind: 'CODE' }] as never,
    causes: [] as never, busy: false, onChanged: () => {}, renderFull: (a: { number: number }) => React.createElement('div', null, `FULL CARD ${a.number}`),
    initiallyOpen: ['a2'], page, onPage: () => {}, initialDevelopment,
  }))
  const hd = hid('drafting')
  ok('an action OPENED on Drafting under a hidden heading is drawn, open; the others stay hidden and are counted ("2 more actions not shown")', /data-open-under-hidden/.test(hd) && hd.includes('FULL CARD 2') && !/data-action-id="a1"/.test(hd) && textOf(hd).includes('Hidden — 2 more actions not shown'))
  control('on Organising a hidden heading draws a row (must be FALSE)', /data-action-id="a2"/.test(hid('organising')))
  const pages = renderToStaticMarkup(React.createElement(ActionsPages, { ideaId: 'x', initialPage: 'drafting', children: () => null }))
  ok('the page bar: Organising · Drafting, the current one by shape, weight and "You are here" — never colour alone', /data-page="organising"/.test(pages) && /data-page="drafting"[^>]*>|aria-current="page"[^>]*data-page="drafting"/.test(pages) && (pages.match(/aria-current="page"/g) ?? []).length === 1 && /●/.test(pages) && /○/.test(pages) && /border-2/.test(pages) && /You are here/.test(pages))
}

async function partD2() {
  section('D2 · the deep link — /ideas/[id]/drafting#38 lands on the Drafting page')
  const { default: page } = await import('../app/ideas/[id]/drafting/page')
  let to = ''
  try { await page({ params: Promise.resolve({ id: 'abc' }) }) } catch (e) { to = String((e as { digest?: string }).digest ?? e) }
  ok('it redirects to the workspace with view=drafting (the fragment is carried by the browser)', /\/ideas\/create\?ideaId=abc&view=drafting/.test(to), to)
}

// ── E · the renames and the guide ──────────────────────────────────────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p, out) } else if (/\.(ts|tsx)$/.test(f)) out.push(p) }
  return out
}
function partE() {
  section('E · the renames (316) and the guide')
  const seven = 'Creation · Development · Private Scrutiny · Public Scrutiny · Promotion · Submission · In Force'
  ok('the banners’ seven stages are the lifecycle’s, in order', SEVEN_STAGES.map((s) => s.name).join(' · ') === seven, SEVEN_STAGES.map((s) => s.name).join(' · '))
  ok('…and the bar’s (one table: screen-labels)', LIFECYCLE_KEYS.map((k) => SL.LIFECYCLE_STAGE_WORD[k]).join(' · ') === seven)
  ok('a built idea’s documents are Stage 2, Development (135 amended): "This is a Stage 2 document: Development."', stageFromProgress({ built: true, kernelComplete: true, enteredDeepening: true }) === 2 && stageSentence(2) === 'This is a Stage 2 document: Development.')
  ok('the FAQ carries the seven names, in order', SEVEN_STAGES.every((s) => FAQ_MARKDOWN.includes(`**${s.name}**`)) && FAQ_MARKDOWN.indexOf('**Creation**') < FAQ_MARKDOWN.indexOf('**In Force**'))
  ok('"The First Pass" and "The First Draft" are no stage name — not in the bar’s screens, the banner, or the FAQ', !LEX_STAGES.some((s) => /First (Pass|Draft)/.test(s.name)) && !SEVEN_STAGES.some((s) => /First (Pass|Draft)/.test(s.name)) && !/The First (Pass|Draft)/.test(FAQ_MARKDOWN))
  // on screen: no string literal outside comments names them as a stage
  const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'lib'))]
  const hits: string[] = []
  for (const f of files) {
    // ⚠ split on \r?\n: in a CRLF file `.` stops at \r, so a `^\s*\/\/.*$` comment strip silently fails (the first run read my own comments)
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, '')).join('\n')
    for (const m of src.matchAll(/['"`][^'"`\n]*The First (?:Pass|Draft)[^'"`\n]*['"`]/g)) hits.push(`${f.slice(ROOT.length + 1)}: ${m[0].slice(0, 80)}`)
  }
  ok('no string on screen names "The First Pass" or "The First Draft"', hits.length === 0, hits.join(' | '))
  skip('historic documents keep the banner they were printed with', 'by construction: rendered files are stored in R2 and served until regenerated (export.ts / proposal-export.ts); a regeneration is a new render — reading a stored file back is not done here')

  const labels = new Set(guideEntries().map((e) => normLabel(e.label)))
  const tables: Record<string, Record<string, string>> = { PAGE_UI: SL.PAGE_UI, DRAFTING_FILTER_WORD: SL.DRAFTING_FILTER_WORD, PROGRESS_WORD: SL.PROGRESS_WORD, CHECKLIST_WORD: SL.CHECKLIST_WORD, DEEPENING_LOCK_UI: SL.DEEPENING_LOCK_UI, LIFECYCLE_STAGE_WORD: SL.LIFECYCLE_STAGE_WORD, LIFECYCLE_UI: SL.LIFECYCLE_UI, ORGANISING_TOOLBAR_UI: SL.ORGANISING_TOOLBAR_UI, ADD_ACTION_UI: SL.ADD_ACTION_UI }
  const missing = Object.entries(tables).flatMap(([t, tbl]) => Object.values(tbl).filter((l) => !labels.has(normLabel(l))).map((l) => `${t}: ${l}`))
  ok('26-W-b: the field guide has an entry for every new label', missing.length === 0, missing.join(' | '))
}

// ── F · addendum 322/323 on a scratch copy — "Add action" through the real route; Lex's add_action stores the same; a title is never replaced ──
const ctxFor = (ideaId: string, userId: string, userMessages: string[]): ToolCtx => ({
  ideaId, userId, confirmed: true, agreedPence: null,
  turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages, pastedText: null },
})
async function partF() {
  section('F · addendum 322/323 — "Add action" (the route) and Lex’s add_action (parity, as 26-W); a title the owner wrote is never replaced')
  const scratch = await scratchCopy(SOURCE, '26x-add')
  try {
    const user = await prisma.user.findUnique({ where: { id: scratch.userId } })
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = user
    const heads = await prisma.actionHeading.findMany({ where: { ideaId: scratch.id, archivedAt: null }, orderBy: { orderIndex: 'asc' } })
    const H = heads.find((h) => h.kind) ?? heads[0]
    if (!H) { skip('F (Add action)', 'the copy has no live heading'); return }
    const before = await AS.liveRows(scratch.id)
    const topNumber = (await prisma.lexCoherentAction.aggregate({ where: { ideaId: scratch.id }, _max: { number: true } }))._max.number ?? 0
    const { POST } = await import('../app/api/ideas/[id]/action-structure/route')
    const post = async (b: unknown) => { const r = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(b) }), { params: Promise.resolve({ id: scratch.id }) }); return { status: r.status, json: await r.json() as { ok?: boolean; error?: string; result?: { id: string; number: number } } } }
    const bad = await post({ op: 'addAction', title: '', headingId: H.id })
    ok('13: a form with no title is refused, in words, naming the title — nothing added', bad.status === 422 && /the title/.test(bad.json.error ?? '') && (await AS.liveRows(scratch.id)).length === before.length, `${bad.status} ${bad.json.error}`)
    const retired = await post({ op: 'addAction', title: 'check:lex-26x — under a heading not on this idea', headingId: '00000000-0000-0000-0000-000000000000' })
    ok('…and a heading not on the idea is refused, in words', retired.status === 422 && /not one of this idea’s headings/.test(retired.json.error ?? ''), `${retired.status} ${retired.json.error}`)
    const formTitle = 'check:lex-26x — the owner’s own action'
    const made = await post({ op: 'addAction', title: formTitle, practicalStep: '', headingId: H.id })
    const after = await AS.liveRows(scratch.id)
    const row = after.find((r) => r.id === made.json.result?.id)
    ok('13: "Add action" stores a USER action with its title, under its heading, numbered by the trigger (one past the highest)', made.status === 200 && !!row && row.source === 'USER' && row.title === formTitle && row.headingId === H.id && row.number === topNumber + 1, `${made.status} ${JSON.stringify(row && { s: row.source, n: row.number, top: topNumber })}`)
    const under = (rows: typeof after) => rows.filter((r) => r.headingId === H.id && !r.parked)
    ok('…FIRST under its heading', under(after)[0]?.id === row?.id, under(after).slice(0, 3).map((r) => `#${r.number}`).join(' '))
    const sameOrder = (a: typeof before, b: typeof after) => a.map((r) => r.id).join() === b.filter((r) => a.some((x) => x.id === r.id)).map((r) => r.id).join()
    ok('…and every other action keeps its place in the list (the rows below moved down one, nothing else)', sameOrder(before, after))
    const dev = await DV.developmentState(scratch.id)
    const p = dev.rows.find((r) => r.id === row?.id)?.progress
    ok('…its strip reads "Defined ◐" (a title and a heading, no statement yet), and it counts as to go', p?.marks.defined === 'part' && dev.toGo.some((t) => t.id === row?.id), JSON.stringify(p?.marks))
    // Lex's add_action — the same function, the same placement
    const words = 'The regulator publishes every owner’s measure once a year, check 26x parity.'
    const t = await execute(toolByName('add_action')!, ctxFor(scratch.id, scratch.userId, [words]), { practicalStep: words, dictated: true, title: 'check:lex-26x — the same, through Lex', heading: H.name, provenance: { kind: 'user_words', refs: [], quote: words } })
    const after2 = await AS.liveRows(scratch.id)
    const row2 = after2.find((r) => r.number === (t.data as { number?: number } | undefined)?.number)
    ok('13 parity: Lex’s add_action stores the same — USER (dictated), its title, under the named heading, first under it, the next number', t.ok && !!row2 && row2.source === 'USER' && row2.title === 'check:lex-26x — the same, through Lex' && row2.headingId === H.id && under(after2)[0]?.id === row2.id && row2.number === topNumber + 2, JSON.stringify(t.ok ? t.data : t.error))
    const t2 = await execute(toolByName('add_action')!, ctxFor(scratch.id, scratch.userId, [words]), { practicalStep: words, dictated: true, heading: 'No such heading 26x', provenance: { kind: 'user_words', refs: [], quote: words } })
    ok('…and Lex naming a heading the idea does not have is refused, listing the real ones — never a heading invented', !t2.ok && /no heading called “No such heading 26x”/.test(String(t2.error)) && (await AS.liveRows(scratch.id)).length === after2.length, String(t2.error).slice(0, 160))

    // 323 — a title the owner wrote is never replaced
    const titled = after2.find((r) => r.title?.trim() && r.id !== row?.id && r.id !== row2?.id)!
    const bare = after2.find((r) => r.id !== titled.id && r.id !== row?.id && r.id !== row2?.id)!
    await prisma.lexCoherentAction.update({ where: { id: titled.id }, data: { titleProposal: 'A proposal over the owner’s title' } })
    await prisma.lexCoherentAction.update({ where: { id: bare.id }, data: { title: null, titleProposal: 'A proposal for the untitled one' } })
    const acc = await AS.acceptTitleProposals(scratch.id, [titled.id, bare.id])
    const [t1, b1] = await Promise.all([titled.id, bare.id].map((id) => prisma.lexCoherentAction.findUnique({ where: { id }, select: { title: true, titleProposal: true } })))
    const kept = (was: string | null, now: { title: string | null } | null) => now?.title === was
    ok('14: accepting proposals takes the untitled row’s and KEEPS the owner’s title on the titled one (the stale proposal is cleared), and says so', acc.ok && acc.data.accepted === 1 && acc.data.keptYours === 1 && kept(titled.title, t1) && !t1?.titleProposal && b1?.title === 'A proposal for the untitled one', JSON.stringify({ acc, t1, b1 }))
    control('MUTATION: a replace (the owner’s title became the proposal) passes the "kept" test (must be FALSE)', kept(titled.title, { title: 'A proposal over the owner’s title' }))
  } finally {
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = undefined
    await deleteScratch(scratch.id)
  }
}

// ── F2 · addendum 321–323 in a real browser — the real workspace (and the real Import / Check for gaps on its rows) on the 26-S harness ──
async function partF2() {
  section('F2 · addendum 321–323 in Chromium — the three rows, "Add action", the counted title button')
  const fp = readFileSync(join(ROOT, 'components/lex/FieldsPanel.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  ok('12 (source, comments stripped): FieldsPanel renders Import and Check for gaps ONLY as the toolbar’s slots — not above the list', (fp.match(/<ActionGapCheck\b/g) ?? []).length === 1 && (fp.match(/<ActionImport\b/g) ?? []).length === 1 && /gapSlot=\{[^}]*<ActionGapCheck[^>]*inline/.test(fp) && /importSlot=\{[^}]*<ActionImport[^>]*inline/.test(fp))
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('F2 (browser)', `playwright is not loadable: ${(e as Error).message}`); return }
  const { build } = await import('esbuild')
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/actions-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { ran++; fail++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 400)}`); return }
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('F2 (browser)', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: bundle })
    // two untitled actions (one with a proposal waiting), and a titled one carrying a stale proposal
    await page.evaluate(() => {
      const h = (window as never as { __h: { slots: boolean; store: { actions: Array<Record<string, unknown>> } } }).__h
      h.slots = true
      const a = h.store.actions
      a[4].title = null; a[5].title = null; a[5].titleProposal = 'Proposed six'; a[6].titleProposal = 'A stale proposal over a title'
      ;(window as never as { __mount: (w: string) => void }).__mount('workspace')
    })
    await page.waitForSelector('[data-organising-toolbar]')
    const rowText = (k: string) => page.locator(`[data-toolbar-row="${k}"]`).innerText().then((s) => s.replace(/\s+/g, ' '))
    const order = await page.evaluate(() => Array.from(document.querySelectorAll('[data-toolbar-row]')).map((e) => (e as HTMLElement).dataset.toolbarRow).join(','))
    const [rv, ra, rl] = [await rowText('view'), await rowText('add'), await rowText('lex')]
    ok('12: the toolbar is three labelled rows, in order: View · Add · Lex and checks', order === 'view,add,lex' && /^View\b/i.test(rv) && /^Add\b/i.test(ra) && /^Lex and checks\b/i.test(rl), `${order} | ${rv.slice(0, 30)} | ${ra.slice(0, 30)} | ${rl.slice(0, 30)}`)
    ok('…View: List · Board · Coverage grid · Group · Hide all headings · the find box · Show', ['List', 'Board', 'Coverage grid', 'Group', 'Hide all headings', 'Show'].every((w) => rv.includes(w)) && (await page.locator('[data-toolbar-row="view"] [data-find-box]').count()) === 1, rv.slice(0, 300))
    ok('…Add: Add action · Add heading · Suggest headings · Import actions from a document', ['Add action', 'Add heading', 'Suggest headings from my guiding policy', 'Import actions from a document'].every((w) => ra.includes(w)), ra)
    // MOVED BY X3 (§6a.2, CCh-Lex 7 Nov (2)): "Ask four models about the whole set" left this row for the Deepening page (check:lex-26x3 C)
    ok('…Lex and checks: Title them with Lex · Classify · Find duplicates · Test against the policy · Check for gaps · Print all (the whole-set digest moved to the Deepening, X3)', ['Title them with Lex', 'Classify with Lex', 'Find duplicates', 'Test against the policy', 'Check for gaps', 'Print all'].every((w) => rl.includes(w)) && !rl.includes('Ask four models about the whole set'), rl)
    control('Check for gaps on the Add row (must be FALSE)', ra.includes('Check for gaps'))
    ok('…"Add action" and "Add heading" are filled (primary); "Suggest headings" is not', (await page.locator('[data-add-action]').getAttribute('class'))!.includes('bg-zinc-900') && (await page.locator('[data-add-heading]').getAttribute('class'))!.includes('bg-zinc-900') && !(await page.locator('[data-toolbar-row="add"] button', { hasText: 'Suggest headings' }).getAttribute('class'))!.includes('bg-zinc-900'))
    ok('…and the heading name box is not shown until "Add heading" is pressed', (await page.locator('[aria-label="New heading name"]').count()) === 0)
    await page.locator('[data-add-heading]').click()
    ok('…pressing it opens the box, with its counter', (await page.locator('[data-add-heading-box] [aria-label="New heading name"]').count()) === 1 && /60 left/.test(await page.locator('[data-add-heading-box]').innerText()))
    await page.locator('[data-add-heading-box] button', { hasText: 'Cancel' }).click()

    // 323 — the count is the untitled actions; pressing shows them; the proposal is on its row; "Accept all" only while they wait
    const btn = (await page.locator('[data-title-them]').innerText()).replace(/\s+/g, ' ')
    ok('14: the button says what its count is — "2 actions have no title · Title them with Lex" (and its price)', /^2 actions have no title · Title them with Lex — about [\d.]+p$/.test(btn), btn)
    ok('…the row with a proposal waiting shows it under the statement: "Lex proposes: … — Accept · Not this"', /Lex proposes: Proposed six — Accept · Not this/.test((await page.locator('li[data-action-id="a6"] [data-title-proposal]').innerText()).replace(/\s+/g, ' ')))
    ok('…a stale proposal on a row the owner titled is NOT offered (it would replace their title)', (await page.locator('li[data-action-id="a7"] [data-title-proposal]').count()) === 0)
    ok('…"Accept all 1 proposed titles" is offered while one waits', (await page.locator('[data-accept-all-titles]').innerText()).trim() === 'Accept all 1 proposed titles')
    await page.locator('[data-title-them]').click()
    await page.waitForFunction(() => (document.querySelector('select[aria-label="Filter the list"]') as HTMLSelectElement | null)?.value === 'untitled')
    const shownRows = await page.locator('li[data-action-id]').count()
    ok('…pressing it applies the Untitled filter: the rows on screen are exactly the untitled ones', shownRows === 2 && (await page.locator('li[data-action-id="a5"]').count()) === 1 && (await page.locator('li[data-action-id="a6"]').count()) === 1, `${shownRows} rows`)
    await page.locator('li[data-action-id="a6"] [data-title-accept]').click()
    await page.locator('li[data-action-id="a5"] [data-title-not-this]').click()
    await page.waitForFunction(() => !document.querySelector('[data-title-proposal]'))
    ok('…once none wait, "Accept all" is absent', (await page.locator('[data-accept-all-titles]').count()) === 0)
    control('"Accept all" still drawn with nothing waiting (must be FALSE)', (await page.locator('[data-accept-all-titles]').count()) > 0)

    // 322 — "Add action": the form, then the row first under its heading, opened, on Drafting
    await page.locator('select[aria-label="Filter the list"]').selectOption('all')
    await page.locator('[data-add-action]').click()
    ok('13: "Add action" opens the form: Title (required, counter) · Statement (1,000, counter) · Heading (Unsorted by default) · the kind from the heading', (await page.locator('[data-focus-dialog] [data-add-action-form]').count()) === 1 && /left/.test(await page.locator('[data-add-action-form]').innerText()) && (await page.locator('[data-add-action-heading]').inputValue()) === '' && /Unsorted/.test(await page.locator('[data-add-action-heading]').innerText()))
    ok('…Save is not offered without a title', await page.locator('[data-add-action-save]').isDisabled())
    await page.locator('[data-add-action-form] [aria-label="Title"]').fill('A new action of the owner')
    await page.locator('[data-add-action-heading]').selectOption('h1')
    await page.locator('[data-add-action-save]').click()
    await page.waitForFunction(() => document.getElementById('page-now')?.textContent === 'drafting')
    const added = await page.evaluate(() => (window as never as { __h: { added: { id: string } | null } }).__h.added)
    const firstUnderH1 = await page.evaluate(() => { const s = Array.from(document.querySelectorAll('section')).find((x) => x.getAttribute('aria-label')?.includes('Legislation')); return s?.querySelector('li[data-action-id]')?.getAttribute('data-action-id') ?? null })
    ok('…after Save the page is Drafting, the new row is FIRST under its heading, and it is OPEN', !!added && firstUnderH1 === added.id && (await page.locator(`li[data-action-id="${added.id}"]`).getAttribute('data-open')) === 'true', `${JSON.stringify(added)} first=${firstUnderH1}`)
    ok('no page errors', errors.length === 0, errors.join(' | '))
  } finally { await browser.close() }
}

async function main() {
  console.log('check:lex-26x — X1 (decisions 308, 310, 316, 317, 318; addendum 321–323)')
  partA()
  await partB()
  await partC()
  partD()
  await partD2()
  partE()
  await partF()
  await partF2()
  console.log(`\n${ran} ran: ${pass} passed, ${fail} failed · ${controls} controls, ${dead} dead · ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
