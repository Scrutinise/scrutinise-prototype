// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26x3 — LEX 26-X part X3a (BRIEF_26X §6a 1–5, §6b, §8 item 9; CCh-Lex 7 Nov (2)): the Deepening page's sections, the four-model digest
// and the policy test OVER DRAFTS, the review runner, the costs by heading and year. Counts what RAN (§23.2). Spends NOTHING: no model is called
// (the two real measurements are scripts/measure-26x3.ts, and their numbers are in the price tables this check reads).
//
//   A · pure — what a review reads (the words; "current" for a verdict from before X3); the digest's data block over drafts (the draft in full,
//       the cut said, the reads); the price per character, never per action, and "not yet measured" without a run over drafts; the policy
//       test's calls (a long draft alone) and price; which actions are due a test; the costs by year (one-off / per year / duration / undated)
//   B · a scratch copy of 452c5ade with its live documents, through THE REAL READERS: acceptedDrafts; the digest's scope carries #207's Code in
//       full and every other action by its statement; the quote prices on the characters it would read; the canonical state says which verdicts
//       are out of date; the Deepening's overview (collision counts = the stored rows; the review runner lists the accepted draft and how many
//       passes read it = DocumentReview rows; the cost table = fixture cost lines summed by hand)
//   C · RENDERED — the Deepening's sections in the brief's order; the digest panel says what it read, per action; the record's verdict says what
//       it was tested against, and an out-of-date one says so; Organising no longer carries the whole-set digest; the page mounts the sections
//       inside the lock, before the law table
//   D · COLD READ of 452c5ade (§26): plain queries only, compared with the readers the screen calls
//   E · the guide has an entry for every new label; the moved control's entry says where it went
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26x3.ts
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import * as AD from '../lib/lex/accepted-drafts'
import * as DP from '../lib/lex/action-digest-pure'
import * as DG from '../lib/lex/action-digest'
import * as PT from '../lib/lex/policy-test-pure'
import * as CY from '../lib/lex/cost-years-pure'
import * as SL from '../lib/lex/screen-labels'
import { deepeningOverview } from '../lib/lex/deepening-overview'
import { computeCanonicalState } from '../lib/lex/state'
import { parseRecord } from '../lib/lex/action-record'
import { rowOf, type EffectRow } from '../lib/lex/action-documents-pure'
import { guideEntries, normLabel } from '../lib/lex/field-guide'
import { REVIEW_PASS_COUNT } from '../lib/lex/development'
import DeepeningSections from '../components/lex/DeepeningSections'
import { DigestPanel, type DigestState } from '../components/lex/ActionDigest'
import ActionsWorkspace from '../components/lex/ActionsWorkspace'
import * as PP from '../lib/lex/action-progress-pure'
import { scratchCopy, deleteScratch, copyDocuments } from './lib/scratch-copy'

const SOURCE = '452c5ade'
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ')

// ── A · pure ──────────────────────────────────────────────────────────────────────────────────────────────────
const CODE = Array.from({ length: 40 }, (_, i) => `${i + 1}. The body must publish a named owner for every task, numbered ${i + 1}, with its date.`).join('\n')
const mkDigestAction = (n: number, draft: boolean): DP.DigestAction => ({
  number: n, title: `Action ${n}`, statement: `Statement of action ${n}.`, headingName: 'H', avenue: 'LEGISLATIVE', causeNumbers: [], conditionNumbers: [], support: false,
  policyTest: null, slots: {}, commentary: null, parked: false,
  draft: draft ? { d: `D.${n}.2`, kind: 'CODE_TEXT', kindWord: 'code text', v: 3, newerV: null, text: CODE } : null,
})
const CTX: DP.DigestContext = { problem: 'P', pivotalObstacle: null, causes: [], policy: null, conditions: [], headings: [] }

function partA() {
  section('A · pure — what is read, the data block over drafts, the prices, the calls, the costs by year')
  const st: AD.ReadMark = { what: 'statement', chars: 20 }
  const d1: AD.ReadMark = { what: 'draft', d: 'D.7.2', kind: 'CODE_TEXT', v: 1, newerV: null, chars: 900 }
  const d2: AD.ReadMark = { ...d1, v: 2 }
  ok('readWords names the draft, its kind and version; a statement says there is no accepted draft', AD.readWords(d1) === 'the accepted draft D.7.2 (code text), version 1' && AD.readWords(st) === 'the statement (no accepted draft)')
  ok('the verdict line: "tested against the draft D.7.2, v1" / "tested against the statement"; a verdict from before X3 says so', AD.testedAgainstWords(d1) === 'tested against the draft D.7.2, v1' && AD.testedAgainstWords(st) === 'tested against the statement' && /before drafts were read/.test(AD.testedAgainstWords(null)))
  ok('a verdict from before X3 (no mark) is CURRENT while the action has no accepted draft — the button does not re-test all of them', AD.testIsCurrent(null, st) === true)
  ok('…and OUT OF DATE once a draft is accepted', AD.testIsCurrent(null, d1) === false)
  ok('a test of v1 is out of date once v2 is accepted; a test of v2 is current', AD.testIsCurrent(d1, d2) === false && AD.testIsCurrent(d2, d2) === true)
  ok('a test of the statement is out of date once a draft is accepted', AD.testIsCurrent(st, d1) === false)
  control('sameRead treats a missing mark as current (the reason testIsCurrent exists)', AD.sameRead(null, st))
  ok('a stored mark round-trips through JSON; junk parses to null', JSON.stringify(AD.parseReadMark(JSON.parse(JSON.stringify(d1)))) === JSON.stringify(d1) && AD.parseReadMark({ what: 'draft' }) === null && AD.parseReadMark('x') === null)

  // the data block
  const both = DP.dataBlock(CTX, [mkDigestAction(1, true), mkDigestAction(2, false)])
  ok('the data block carries the accepted draft IN FULL, named with its D-number and version', both.text.includes(CODE) && both.text.includes('THE ACCEPTED DRAFT D.1.2 (code text), version 3'))
  ok('…each action says first what to read: its accepted draft, or the statement', /#1 [^\n]*\nWhat to read for this action: its ACCEPTED DRAFT, D\.1\.2/.test(both.text) && /#2 [^\n]*\nWhat to read for this action: the statement\. No draft of this action is accepted yet\./.test(both.text))
  ok('…and the reads say it per action, uncut', both.reads.length === 2 && both.reads[0].read.what === 'draft' && both.reads[1].read.what === 'statement' && both.reads.every((r) => !r.cut) && both.trimmedDrafts === 0)
  control('a draft is not in the data block when the action has none', DP.dataBlock(CTX, [mkDigestAction(1, false)]).text.includes(CODE))
  const tight = DP.dataBlock(CTX, [mkDigestAction(1, true), mkDigestAction(2, false)], 2000)
  ok('over the budget the draft is CUT, and the cut is said inside the text and counted', tight.trimmedDrafts === 1 && tight.reads[0].cut && /The draft is cut here at \d+ characters to fit what you can read - it is \d+ characters in full/.test(tight.text) && tight.text.length <= 2000 + 400, `${tight.text.length} chars, ${tight.trimmedDrafts} cut`)
  ok('the models are told to judge an action by its accepted draft, and not the part they were not given', /judge the action by what the draft actually provides/.test(DP.DIGEST_SYSTEM) && /do not judge the part you were not given/.test(DP.DIGEST_SYSTEM))

  // the digest price: per character, from runs over drafts only
  const measured = DP.DIGEST_RUNS.filter((r) => r.scope === 'SET' && r.overDrafts)
  const p1 = DP.digestPrice('SET', 58, 100_000), p2 = DP.digestPrice('SET', 58, 200_000), p3 = DP.digestPrice('SET', 5, 200_000)
  if (measured.length) {
    ok(`the whole-set price is MEASURED over drafts (n=${DP.DIGEST_RUNS.filter((r) => r.scope === 'SET' && r.chars).length}) and moves with the characters read, not the actions`, p1.basis === 'measured' && p2.pence > p1.pence && Math.abs(p3.pence - p2.pence) < 1e-6 && /measured over drafts/.test(p1.words), `${p1.words} / ${p2.words}`)
    ok('…and says it is a floor where a measured run had a model time out', /a floor/.test(p1.words))
  } else skip('the whole-set price is measured over drafts', 'no SET run over drafts is recorded in DIGEST_RUNS')
  const hRuns = DP.DIGEST_RUNS.filter((r) => r.scope === 'HEADING' && r.chars)
  if (hRuns.some((r) => r.overDrafts)) {
    ok('a heading\'s price reproduces both its measured runs (statements only, and over a draft) to within 3p — a fixed part plus a part per character', hRuns.every((r) => Math.abs(DP.digestPrice('HEADING', r.actions, r.chars).pence - r.pence) < 3), hRuns.map((r) => `${r.pence}p vs ${DP.digestPrice('HEADING', r.actions, r.chars!).pence.toFixed(1)}p`).join('; '))
    control('a price per character alone would underprice an eight-statement heading by more than 10p', (() => { const per = hRuns.reduce((n, r) => n + r.pence, 0) / hRuns.reduce((n, r) => n + r.chars!, 0); return Math.abs(per * 22956 - 45.18) <= 10 })())
  } else skip('a heading\'s price over drafts', 'no HEADING run over drafts is recorded')
  ok('a scope with no run over drafts says "not yet measured over drafts" — an ESTIMATE, labelled — and never the old per-action price', ((): boolean => { const saved = DP.DIGEST_RUNS.splice(0); const p = DP.digestPrice('SET', 58, 100_000); DP.DIGEST_RUNS.push(...saved); return p.basis === 'estimate' && /not yet measured over drafts/.test(p.words) && /ESTIMATE/.test(p.words) })())

  // the policy test's calls and price
  const calls = PT.policyTestCalls([{ draftChars: 0 }, { draftChars: 15_606 }, ...Array.from({ length: 30 }, () => ({ draftChars: 0 }))])
  ok('a long draft is tested in a call of its own; 31 statements make two batches (25 + 6)', calls.length === 3 && calls.some((c) => c.length === 1 && c[0] === 1) && calls.filter((c) => c.length > 1).map((c) => c.length).sort((a, b) => b - a).join() === '25,6', JSON.stringify(calls.map((c) => c.length)))
  ok('every item is in exactly one call', calls.flat().sort((a, b) => a - b).join() === Array.from({ length: 32 }, (_, i) => i).join())
  ok('short drafts batch under the character line (12 drafts of 3,900 → 2 calls)', PT.policyTestCalls(Array.from({ length: 12 }, () => ({ draftChars: 3900 }))).length === 2)
  const pp = PT.policyTestPrice([{ draftChars: 15_606, statementChars: 300 }])
  ok(`the policy test's price is measured over drafts (n=${PT.POLICY_TEST_RUNS.length}), and a draft costs more than a statement`, PT.POLICY_TEST_RUNS.length >= 2 && pp.pence != null && pp.pence > (PT.policyTestPrice([{ draftChars: 0, statementChars: 300 }]).pence ?? Infinity) && /measured over drafts/.test(pp.words), pp.words)
  ok('…it reproduces its own measured runs to within a penny', PT.POLICY_TEST_RUNS.every((r) => { const items = [{ draftChars: Math.max(0, r.chars - PT.POLICY_TEST_ITEM_CHARS), statementChars: PT.POLICY_TEST_ITEM_CHARS }]; const p = PT.policyTestPrice(items).pence ?? -99; return Math.abs(p - r.pence) < 1.0 }), JSON.stringify(PT.POLICY_TEST_RUNS))
  ok('which actions are due a test: never tested, NOT_TESTED, or out of date — and not a current verdict', PT.policyTestDue(null, true) && PT.policyTestDue('NOT_TESTED', true) && PT.policyTestDue('FITS', false) && !PT.policyTestDue('FITS', true))

  // costs by year (CCh-Lex 7 Nov (2), 3)
  const L = (id: string, o: Partial<CY.CostLineIn>): CY.CostLineIn => ({ id, headingId: 'h1', low: 100, high: 200, recurrence: null, durationMonths: null, ...o })
  const t = CY.costTable([
    L('one', { recurrence: 'ONE_OFF' }),
    L('yr18', { recurrence: 'PER_YEAR', durationMonths: 18, low: 1200, high: 1200 }),
    L('yrAll', { recurrence: 'PER_YEAR', low: 10, high: 10, headingId: 'h2' }),
    L('undated', { recurrence: null, low: 7, high: 9 }),
    L('nofig', { recurrence: 'ONE_OFF', low: null, high: null }),
    L('floor', { recurrence: 'ONE_OFF', low: 50, high: null, headingId: null }),
  ], ['h2', 'h1'])
  const h1 = t.rows.find((r) => r.headingId === 'h1')!, h2 = t.rows.find((r) => r.headingId === 'h2')!, none = t.rows.find((r) => r.headingId === null)!
  ok('a one-off line is in year 1 only', h1.years[0].low === 100 + 1200 && h1.years.slice(2).every((y) => y.low === 0))
  ok('a per-year line of 18 months is year 1 in full and half of year 2, nothing after', h1.years[1].low === 600 && h1.years[2].low === 0)
  ok('a per-year line with no duration runs all five years', h2.years.every((y) => y.low === 10 && y.high === 10))
  ok('a line with no recurrence is in its own column, COUNTED, and in no year', h1.undatedLines === 1 && h1.undated.low === 7 && h1.undated.high === 9 && t.total.undatedLines === 1)
  ok('a line with no figure is counted and adds nothing; one number is counted as a floor', h1.noFigure === 1 && none.oneSided === 1 && none.years[0].low === 50 && none.years[0].high === 50)
  ok('rows follow the heading order, then "not under a heading"; the total is every row summed', t.rows.map((r) => r.headingId).join() === 'h2,h1,' && [0, 1, 2, 3, 4].every((i) => Math.abs(t.total.years[i].low - t.rows.reduce((n, r) => n + r.years[i].low, 0)) < 1e-9))
  control('an undated line is never guessed into year 1', h1.years[0].low === 100 + 1200 + 7)
  ok('money in words: a range, one figure, and "—" for nothing', CY.moneyWords({ low: 1200, high: 3400 }) === '£1,200–3,400' && CY.moneyWords({ low: 5, high: 5 }) === '£5' && CY.moneyWords({ low: 0, high: 0 }) === '—')
}

// ── B · the scratch copy, through the real readers ─────────────────────────────────────────────────────────────
async function partB(): Promise<void> {
  section('B · a scratch copy of 452c5ade with its live documents — the real readers, no model')
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE }, deletedAt: null }, select: { id: true } })
  if (!src) { skip('part B', `no idea ${SOURCE}`); return }
  const copy = await scratchCopy(SOURCE, 'x3-check')
  try {
    const n = await copyDocuments(src.id, copy.id)
    const plain = await prisma.actionDocument.findMany({ where: { ideaId: copy.id, acceptedV: { not: null }, status: { not: 'SUPERSEDED' } }, include: { versions: { where: { role: 'VERSION' } } } })
    const drafts = await AD.acceptedDrafts(copy.id)
    ok(`the copy carries the live documents (${n}) and acceptedDrafts finds every accepted instrument the plain query finds (${plain.filter((d) => !['COLLISION_REPORT', 'EXPLANATORY_NOTE', 'CONSEQUENTIAL_SCHEDULE'].includes(d.kind)).length})`, drafts.size > 0 && drafts.size === new Set(plain.filter((d) => !['COLLISION_REPORT', 'EXPLANATORY_NOTE', 'CONSEQUENTIAL_SCHEDULE'].includes(d.kind)).map((d) => d.actionId)).size)
    const [first] = [...drafts.values()]
    const raw = plain.find((d) => d.id === first.documentId)!
    ok(`…its text is the accepted version, in full (${first.d}, v${first.v}, ${first.body.length} characters)`, first.body === raw.versions.find((v) => v.v === raw.acceptedV)!.body && first.v === raw.acceptedV)

    // the digest's scope
    const scope = await DG.readScope(copy.id, 'SET', null)
    if (!scope.ok) { ok('the digest reads the set', false, (scope as { error: string }).error); return }
    const withDraft = scope.data.actions.filter((a) => a.draft)
    ok('the digest gives the models the accepted draft for exactly the actions that have one', withDraft.length === drafts.size && withDraft.every((a) => a.draft!.text === [...drafts.values()].find((d) => d.d === a.draft!.d)?.body))
    const block = DP.dataBlock(scope.data.ctx, scope.data.actions)
    ok(`…in full (no draft cut at ${block.text.length} characters), and every other action by its statement`, block.trimmedDrafts === 0 && block.text.includes(first.body) && block.reads.filter((r) => r.read.what === 'statement').length === scope.data.actions.length - drafts.size)
    const quote = await DG.digestQuote(copy.id)
    const expect = DP.digestPrice('SET', scope.data.actions.length, block.text.length)
    ok(`the button's price is on the characters it would read (${quote.set.price.words})`, Math.abs(quote.set.price.pence - expect.pence) < 1e-6 && quote.set.price.basis === expect.basis)

    // the canonical state: which verdicts are out of date
    const drafted = first.actionId
    const other = scope.data.ids.find((id) => !drafts.has(id))!
    const r0 = await prisma.lexCoherentAction.findUnique({ where: { id: drafted }, select: { record: true } })
    await prisma.lexCoherentAction.update({ where: { id: drafted }, data: { policyTestVerdict: 'FITS', policyTestReason: 'fixture', record: { ...parseRecord(r0?.record), policyTestRead: { what: 'statement', chars: 10 } } as never } })
    await prisma.lexCoherentAction.update({ where: { id: other }, data: { policyTestVerdict: 'FITS', policyTestReason: 'fixture' } })
    const cs = await computeCanonicalState(copy.id)
    const ca = cs?.actions.find((a) => a.id === drafted), co = cs?.actions.find((a) => a.id === other)
    ok('a verdict that tested the statement, on an action whose draft is now accepted, reads OUT OF DATE', ca?.policyTest?.current === false && ca.policyTest.read?.what === 'statement')
    ok('a verdict from before X3 on an action with no accepted draft reads CURRENT (it was a test of the statement)', co?.policyTest?.current === true && co.policyTest.read == null)
    ok('the canonical action carries its accepted draft (D-number, version, length) for the button\'s price', ca?.acceptedDraft?.d === first.d && ca.acceptedDraft.v === first.v && ca.acceptedDraft.chars === first.body.length)

    // the Deepening's overview
    const lines = [
      { recurrence: 'ONE_OFF', low: 1000, high: 2000 }, { recurrence: 'PER_YEAR', low: 120, high: 120, durationMonths: 24 }, { recurrence: null, low: 5, high: 5 },
    ]
    for (const [i, l] of lines.entries()) await prisma.costLine.create({ data: { actionId: drafted, label: `fixture ${i}`, costType: 'OTHER' as never, category: 'IMPLEMENTATION' as never, orderIndex: 900 + i, ...l } as never })
    const ov = await deepeningOverview(copy.id)
    const collisionDocs = await prisma.actionDocument.findMany({ where: { ideaId: copy.id, kind: 'COLLISION_REPORT', status: { not: 'SUPERSEDED' } }, include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' }, take: 1 } } })
    const depends = collisionDocs.reduce((n, d) => n + ((((d.versions[0]?.payload as { rows?: EffectRow[] } | null)?.rows) ?? []).filter((r) => rowOf(r) === 'depends').length), 0)
    ok(`collision: every report is listed (${collisionDocs.length}) and the "depends on it" total equals the stored rows (${depends})`, ov.collision.reports.length === collisionDocs.length && ov.collision.totals.depends === depends)
    const reviewed = new Set((await prisma.documentReview.findMany({ where: { documentId: first.documentId, v: first.v, status: 'RUN' }, select: { passKey: true } })).map((r) => r.passKey)).size
    const listed = ov.reviews.drafts.find((d) => d.documentId === first.documentId)
    ok(`reviews: the accepted draft is listed, with the passes that read it (${reviewed} of ${REVIEW_PASS_COUNT}) and the rest to run`, !!listed && listed.passesRead === reviewed && listed.toRun === REVIEW_PASS_COUNT - reviewed)
    const homeId = (await prisma.lexCoherentAction.findUnique({ where: { id: drafted }, select: { headingId: true } }))?.headingId ?? null
    const home = ov.costs.table.rows.find((r) => r.headingId === homeId)
    ok('costs: the fixture lines land as the rule says (one-off and per-year in year 1, per-year in year 2, nothing after, the undated line counted apart)', !!home && home.years[0].low === 1120 && home.years[1].low === 120 && home.years[2].low === 0 && home.undatedLines === 1 && home.undated.low === 5, JSON.stringify(home))
  } finally {
    await prisma.costLine.deleteMany({ where: { action: { ideaId: copy.id } } })
    const gone = await deleteScratch(copy.id)
    ok('the scratch copy is deleted', gone)
  }
}

// ── C · rendered ─────────────────────────────────────────────────────────────────────────────────────────────
function partC() {
  section('C · RENDERED — the sections in order; the digest says what it read; the verdict says what it tested; Organising without the set digest')
  const ov = {
    collision: { schedule: [], reports: [{ documentId: 'c1', d: 'D.7.2', kind: 'COLLISION_REPORT', actionNumber: 7, actionTitle: 'Seven', v: 2, at: null, stale: 'the law data has moved on', counts: { clause: 3, depends: 4, refers: 5 } }], missing: [{ number: 8, title: 'Eight' }], totals: { depends: 4, refers: 5 } },
    reviews: { drafts: [{ documentId: 'd1', d: 'D.7.1', kind: 'draft clause', actionNumber: 7, v: 2, passesRead: 2, toRun: 3, pence: 12.5, unmeasured: false }], movedOn: [], passes: REVIEW_PASS_COUNT, pence: 12.5, toRun: 3 },
    costs: { table: CY.costTable([{ id: 'x', headingId: 'h1', low: 100, high: 100, recurrence: 'ONE_OFF', durationMonths: null }, { id: 'y', headingId: 'h1', low: 9, high: 9, recurrence: null, durationMonths: null }], ['h1']), headings: { h1: 'Heading One' }, pricesOf: 2025, noPriceYear: 1, noCostActions: 0, uncosted: 3 },
  } as const
  const html = renderToStaticMarkup(React.createElement(DeepeningSections, { ideaId: 'idea-x', actions: [] as never, headings: [] as never, conditions: { items: [], proposals: [], source: null }, initial: ov as never }))
  const order = [...html.matchAll(/data-deepening-section="([a-z-]+)"/g)].map((m) => m[1])
  ok('the sections render in the brief\'s order: collision · four models · review passes · coherence and gaps · costs', order.join() === 'collision,four-models,reviews,coherence,costs', order.join())
  ok('…each headed by its label from screen-labels', [SL.DEEPENING_UI.collision, SL.DEEPENING_UI.fourModels, SL.DEEPENING_UI.reviews, SL.DEEPENING_UI.coherence, SL.DEEPENING_UI.costs].every((l) => textOf(html).includes(l)))
  const t = textOf(html)
  ok('collision: the report with its counts by part, its staleness in words, and the action that needs one', /D\.7\.2 #7 Seven — 3 lines of its own · 4 that depend on it · 5 for review · version 2 · ⚠ out of date: the law data has moved on/.test(t) && /Need a report, have none yet #8 Eight/.test(t), t.slice(t.indexOf('1 ·'), t.indexOf('1 ·') + 400))
  ok('reviews: the accepted draft with ◐ and "2 of N passes have read it", and the runner with its measured price', t.includes(`◐ 2 of ${REVIEW_PASS_COUNT} passes have read it`) && t.includes(`${SL.DEEPENING_UI.reviewAll} — about 12.5p`))
  ok('costs: the table by heading and year, the undated line in its own column and counted, the rule said, and "cost–benefit analysis: not yet available"', /Heading One 2 lines £100 — — — — £9 \(1 line\)/.test(t) && t.includes(SL.DEEPENING_UI.undated) && /no recurrence is under/.test(t) && t.includes(SL.DEEPENING_UI.cbaNotYet), t.slice(t.indexOf('5 ·'), t.indexOf('5 ·') + 400))
  control('a section left out would change the order', order.filter((x) => x !== 'reviews').join() === 'collision,four-models,reviews,coherence,costs')

  // the digest panel
  const view: DP.DigestView = {
    id: 'g', scope: 'SET', headingId: null, headingName: null, status: 'READY', createdAt: new Date().toISOString(), line: 'Digest', staleness: { stale: false, added: 0, removed: 0, then: 2, now: 2 }, staleSentence: null,
    spentPence: 90, unpriced: false, failure: null, models: [], judge: null, modelAnswers: [], table: null, conditions: [], labels: { 1: 'One', 2: 'Two' }, working: false,
    reads: [{ n: 1, read: { what: 'draft', d: 'D.1.2', kind: 'CODE_TEXT', v: 3, newerV: null, chars: 900 }, cut: false }, { n: 2, read: { what: 'statement', chars: 20 }, cut: false }],
    readsLine: `The models read ${AD.readsLine([{ n: 1, read: { what: 'draft', d: 'D.1.2', kind: 'CODE_TEXT', v: 3, newerV: null, chars: 900 } }, { n: 2, read: { what: 'statement', chars: 20 } }])}.`,
    readsDiffer: false, draftsCut: 0,
  }
  const state = { busy: null, stage: null } as unknown as DigestState
  const p = textOf(renderToStaticMarkup(React.createElement(DigestPanel, { d: view, state, disabled: false })))
  ok('the digest says what the models read: "1 accepted draft (#1 D.1.2 v3) and 1 statement"', p.includes('What they read: The models read 1 accepted draft (#1 D.1.2 v3) and 1 statement'), p.slice(0, 300))
  ok('…and per action: #1 the accepted draft D.1.2 (code text), version 3; #2 the statement', p.includes('#1 — the accepted draft D.1.2 (code text), version 3') && p.includes('#2 — the statement (no accepted draft)'))
  const old = textOf(renderToStaticMarkup(React.createElement(DigestPanel, { d: { ...view, reads: null, readsLine: 'This digest was run before drafts were read: every action was read by its statement.' }, state, disabled: false })))
  ok('a digest from before X3 says it read statements only', old.includes('run before drafts were read'))

  // the record's verdict, and Organising's toolbar
  const mk = (n: number, policyTest: unknown, acceptedDraft: unknown = null) => ({
    id: `a${n}`, number: n, title: `Action ${n}`, practicalStep: `The body of action ${n}.`, whoImplements: null, wording: null, headingId: 'h1', targetCauseIds: [], avenue: 'ORGANISATIONAL', link: null, sequence: null, beforeIds: [], parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null,
    facetProposal: null, titleProposal: null, source: 'LEX', mechanismType: null, targetOrganisation: null, benefits: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null, policyTest, conflictNote: null, conditionIds: [], supportOnly: false, commentary: 'd', acceptedDraft,
  })
  const rows = [
    mk(1, { verdict: 'FITS', reason: 'r1', from: [], read: { what: 'draft', d: 'D.1.2', kind: 'CODE_TEXT', v: 3, newerV: null, chars: 9 }, current: true }, { d: 'D.1.2', v: 3, chars: 9 }),
    mk(2, { verdict: 'FITS', reason: 'r2', from: [], read: { what: 'statement', chars: 9 }, current: false }, { d: 'D.2.1', v: 1, chars: 16000 }),
    mk(3, null),
  ]
  const prog: PP.Progress = { stage: 'toBrief', noDraft: null, draftKinds: ['OPERATING_TEXT'], marks: { defined: 'done', briefed: 'none', drafted: 'none', reviewed: 'none', accepted: 'none' } }
  const ws = (page: 'organising' | 'drafting') => renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: 'idea-x', actions: rows as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Operations', colourKey: 'blue', hidden: false, orderIndex: 0, kind: 'OTHER' }] as never,
    causes: [] as never, busy: false, onChanged: () => {}, initiallyOpen: ['a1', 'a2'], page, onPage: () => {},
    initialDevelopment: { rows: rows.map((r) => ({ id: r.id, progress: prog })), counts: PP.draftingCounts(rows.map(() => prog)), parked: 0 },
    renderFull: (a: { number: number }, _s: number, between?: React.ReactNode) => React.createElement('div', null, `STATEMENT ${a.number}`, between, `ACTION DETAILS ${a.number}`),
  } as never))
  const dr = ws('drafting'), drt = textOf(dr)
  ok('an opened record\'s verdict says what it was tested against: "tested against the draft D.1.2, v3"', drt.includes('tested against the draft D.1.2, v3.'), drt.slice(drt.indexOf('Policy test'), drt.indexOf('Policy test') + 200))
  ok('…and an out-of-date verdict says so, in words and with ⚠ (not by colour)', drt.includes('tested against the statement ⚠ Out of date: a different draft is accepted now. Test again to read it.') && /data-policy-current="no"/.test(dr))
  const org = ws('organising'), orgt = textOf(org)
  ok('Organising no longer carries "Ask four models about the whole set" (it moved to the Deepening)', !org.includes('data-ask-set-digest') && !orgt.includes(SL.WORKSPACE_UI.askFourSet))
  ok('…the policy test button counts the untested AND the out-of-date ("1 untested · 1 out of date")', orgt.includes(`${SL.ORGANISING_TOOLBAR_UI.testAgainstPolicy} (1 untested · 1 out of date)`), orgt.slice(orgt.indexOf(SL.ORGANISING_TOOLBAR_UI.testAgainstPolicy) - 10, orgt.indexOf(SL.ORGANISING_TOOLBAR_UI.testAgainstPolicy) + 80))
  const testButton = (org.match(/<button[^>]*data-test-policy[^>]*>/) ?? [''])[0]
  ok('…and its price is measured over drafts, on the characters the test would read (one statement + a 16,000-character draft = 2 calls)', /title="[^"]*Price: measured over drafts \(n=\d+\): about [\d.]+p, 2 calls/.test(testButton), testButton.slice(0, 500))

  // the page mounts the sections inside the lock, before the law table (§23.1: the component is reached)
  const page = readFileSync('app/ideas/create/CreateIdeaClient.tsx', 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')
  const gate = page.indexOf('<DeepeningGate'), secs = page.indexOf('<DeepeningSections'), law = page.indexOf('<DeepeningLawTable'), end = page.indexOf('</DeepeningGate>')
  ok('the Deepening page mounts the sections INSIDE the lock, first, before the law table', gate >= 0 && gate < secs && secs < law && law < end && /import DeepeningSections from '@\/components\/lex\/DeepeningSections'/.test(page))
}

// ── D · cold read of 452c5ade ─────────────────────────────────────────────────────────────────────────────────
async function partD() {
  section('D · COLD READ of 452c5ade (§26) — plain queries, against what the screen reads')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE }, deletedAt: null }, select: { id: true } })
  if (!idea) { skip('part D', `no idea ${SOURCE}`); return }
  const liveIds = (await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id, status: 'LIVE' }, select: { id: true } })).map((a) => a.id)
  const plain = await prisma.actionDocument.findMany({ where: { ideaId: idea.id, actionId: { in: liveIds }, acceptedV: { not: null }, status: { not: 'SUPERSEDED' }, kind: { notIn: ['COLLISION_REPORT', 'EXPLANATORY_NOTE', 'CONSEQUENTIAL_SCHEDULE'] } }, select: { id: true, actionId: true, kind: true, acceptedV: true } })
  const drafts = await AD.acceptedDrafts(idea.id)
  ok(`acceptedDrafts finds the accepted instruments a plain query finds (${plain.length}: ${[...drafts.values()].map((d) => `${d.d} ${d.kind} v${d.v}`).join(', ')})`, drafts.size === new Set(plain.map((d) => d.actionId)).size && [...drafts.values()].every((d) => plain.some((p) => p.id === d.documentId && p.acceptedV === d.v)))
  const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id, status: 'LIVE' }, select: { id: true, policyTestVerdict: true, record: true, practicalStep: true } })
  const due = live.filter((a) => PT.policyTestDue(a.policyTestVerdict, AD.testIsCurrent(AD.parseReadMark(parseRecord(a.record).policyTestRead), AD.markOf(drafts.get(a.id), a.practicalStep))))
  const untested = live.filter((a) => !a.policyTestVerdict || a.policyTestVerdict === 'NOT_TESTED')
  ok(`the policy button would test ${due.length}: the ${untested.length} untested and ${due.length - untested.length} out of date — not every old verdict`, due.length >= untested.length && due.length - untested.length <= drafts.size)
  const latest = await prisma.actionDigest.findFirst({ where: { ideaId: idea.id, scope: 'SET' }, orderBy: { createdAt: 'desc' } })
  if (latest) {
    const v = await DG.getDigest(idea.id, latest.id)
    const before = !((latest.modelOutputs as unknown as DP.StoredModelOutput[]).some((o) => o.read))
    ok(`the newest whole-set digest on the idea says what it read (${v?.readsLine})`, !!v && (before ? /before drafts were read/.test(v.readsLine) : /accepted draft|no accepted drafts/.test(v.readsLine)))
  } else skip('the newest whole-set digest says what it read', 'no whole-set digest on the idea')
  const ov = await deepeningOverview(idea.id)
  const rawReports = await prisma.actionDocument.count({ where: { ideaId: idea.id, actionId: { in: liveIds }, kind: 'COLLISION_REPORT', status: { not: 'SUPERSEDED' } } })
  const rawSchedules = await prisma.actionDocument.count({ where: { ideaId: idea.id, actionId: { in: liveIds }, kind: 'CONSEQUENTIAL_SCHEDULE', status: { not: 'SUPERSEDED' } } })
  ok(`the overview lists the collision reports (${rawReports}) and schedules (${rawSchedules}) a plain count finds`, ov.collision.reports.length === rawReports && ov.collision.schedule.length === rawSchedules)
  const rawLines = await prisma.costLine.count({ where: { action: { ideaId: idea.id, OR: [{ status: 'LIVE' }, { foldedIntoId: { not: null } }] } } })
  ok(`the cost table counts every cost line the cost summary counts (${rawLines})`, ov.costs.table.total.lines === rawLines)
}

// ── E · the guide ────────────────────────────────────────────────────────────────────────────────────────────
function partE() {
  section('E · the field guide follows')
  const g = guideEntries()
  const labels = new Set(g.map((e) => normLabel(e.label)))
  const missing = Object.values(SL.DEEPENING_UI).map((l) => (typeof l === 'function' ? l('N') : l)).filter((l) => !labels.has(normLabel(l)))
  ok('every Deepening label has a guide entry', missing.length === 0, missing.join(' | '))
  const set = g.find((e) => e.key === 'workspace.askFourSet')
  ok('the whole-set digest\'s entry says it is on the Deepening now, and reads drafts', !!set && /On the Deepening page, section 2/.test(set.fits) && /accepted draft/.test(set.purpose) && !set.fits.includes('Organising toolbar\'s "Lex and checks" row'))
  const tp = g.find((e) => e.key === 'toolbar.testAgainstPolicy')
  ok('the policy test\'s entry says it reads the whole draft and the verdict says which', !!tp && /reads the whole draft/.test(tp.fits) && /tested against the draft/.test(tp.fits))
}

async function main() {
  partA()
  await partB()
  partC()
  await partD()
  partE()
  console.log(`\ncheck:lex-26x3 — ${pass} passed, ${fail} failed, of ${ran} run · ${controls} controls, ${dead} dead · ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
