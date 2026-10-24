// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26v2d — LEX 26-V2d: the five review passes read DOCUMENTS and their parts (BRIEF_26V §7, 239); an issue carries action, document
// and part; shown in the tree and the Issues tab; the Risks view (225) groups by document. Counts what RAN (§23.2). Spends NOTHING: every
// model call is a fixture.
//
//   A · pure: each pass's instructions carry its own method and questions, name the other four, forbid outside facts, and carry no specimen
//       (§27); what comes back is checked (a part that does not exist → the document as a whole, empty dropped, over the cap cut — each
//       counted); the measured price scales with length; the DDL's pass list is the config's; no issue producer is shown as a bare key.
//   B · on a scratch copy of 452c5ade, through the real functions (§25.3): a review writes one row per pass (RUN, or FAILED in words) and
//       its issues on action + document + part + review, keyed "review:<PASS>" at runVersion 0 — so no kernel pass card and no build reader
//       takes one up; a pass that read this version is not run again unless asked; a new version is reviewed afresh and the older issues say
//       which version they read; a document with no version and an empty generated one are refused in words; Undo of Lex's placements leaves
//       review issues where they were raised; the tree, the Issues tab data and the Risks view read them back.
//   C · the browser: the REAL DocumentsTree and RisksView in Chromium, answered by the REAL routes: "Review this document" asks first at the
//       measured price, runs, and the Issues tab counts by pass; the Risks view lists the issue on its part under its document; dismissing it
//       there with a reason moves it under "Answered" and the tree's count falls — on one screen.
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26v2d.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import type { callModelJson } from '../lib/lex/model-call'
import * as D from '../lib/lex/action-documents'
import * as R from '../lib/lex/document-review'
import * as IA from '../lib/lex/issue-attach'
import { PASSES, PASS_KEYS, type PassKey } from '../lib/lex/deepening-config'
import { deepeningState, triageIssue } from '../lib/lex/deepening'
import { documentView } from '../lib/lex/document-view'
import { partsOf } from '../lib/lex/action-documents-pure'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

// ── A · pure ────────────────────────────────────────────────────────────────────────────────────────────────
function partA() {
  section('A · pure — the instructions, the checks on what comes back, the price, the words')
  for (const p of PASSES) {
    const s = R.reviewSystem(p)
    const others = PASSES.filter((x) => x.key !== p.key)
    ok(`${p.label}: its own method and every standing question, and the other four lenses named`, s.includes(p.method) && p.mustAnswer.every((q) => s.includes(q)) && others.every((o) => s.includes(`- ${o.label}:`)))
  }
  const s0 = R.reviewSystem(PASSES[0])
  ok('the instructions forbid any outside fact, and say what a generated document is', /Never state a fact about the law, a figure, a date, a body or a source/.test(s0) && /never raise an issue about how it was generated/.test(s0))
  ok('§27: no specimen — no part number, D-number or quoted sentence in any pass’s instructions', PASSES.every((p) => !/\b\d+\.\d+\.\d+\b|\bD\.\d+\.\d+/.test(R.reviewSystem(p)) && !/“[^”]{25,}”/.test(R.reviewSystem(p))))
  control('the specimen test finds a planted part number', !/\b\d+\.\d+\.\d+\b/.test(`${s0} as in 38.2.1`))

  const parts = [{ n: 1, title: 'one', text: '(1) One.' }, { n: 2, title: 'two', text: '(2) Two.' }]
  const many = Array.from({ length: 11 }, (_, k) => ({ title: `T${k}`, text: `Issue ${k}.`, part: 1 }))
  const c = R.checkReview({ issues: [{ title: 'Part two', text: 'About two.', part: 2 }, { title: 'Ghost', text: 'About nine.', part: 9 }, { title: '', text: '   ', part: null }, ...many], heldUp: ' Sound. ' }, parts)
  ok('a part that exists is kept; one that does not falls to the document as a whole', c.issues[0].partN === 2 && c.issues[1].partN === null)
  ok(`at most ${R.MAX_REVIEW_ISSUES} kept; the empty one dropped; every correction counted, in words`, c.issues.length === R.MAX_REVIEW_ISSUES && c.falls.partOutOfRange === 1 && c.falls.empty === 1 && c.falls.overCap === 5 && R.reviewFallsWords(c.falls).length === 3, JSON.stringify(c.falls))
  ok('held up is kept, trimmed', c.heldUp === 'Sound.')
  control('a check that kept every part as given would keep part 9', c.issues.some((i) => i.partN === 9))

  const target: R.ReviewTarget = {
    documentId: 'd', actionId: 'a', ideaId: 'i', actionNumber: 38, docNumber: 2, kind: 'OPERATING_TEXT', title: 'Rules', status: 'DRAFTED', v: 3, author: 'OWNER',
    body: 'Opening line.\n## 1. First\nOne.\n## 2. Second\nTwo.', parts: partsOf('OPERATING_TEXT', 'Opening line.\n## 1. First\nOne.\n## 2. Second\nTwo.'),
    action: { title: 'An action', statement: 'Do it.', commentary: 'x'.repeat(R.REVIEW_LIMITS.commentary + 50), heading: 'H', headingKind: 'PLATFORM' }, policy: 'The policy.',
  }
  const u = R.reviewUser(target)
  ok('the document reaches the model numbered: each part with its full number, the version, the opening text', /<part n="1" number="38\.2\.1" title="1\. First">/.test(u) && /<part n="2" number="38\.2\.2"/.test(u) && /version 3/.test(u) && /Above the first part:\nOpening line\./.test(u), u.slice(0, 400))
  ok('a cut is said, with how much (the commentary over its limit)', /the commentary is cut: 50 more characters not shown/.test(u))
  ok('only a generated document is called one', !/GENERATED document/.test(u) && /GENERATED document/.test(R.reviewUser({ ...target, kind: 'CONSEQUENTIAL_SCHEDULE', parts: [{ n: 1, title: 'the whole document', text: 'x' }] })))

  const all = PASSES.map((p) => p.key)
  const small = R.reviewPrice(all, 300), big = R.reviewPrice(all, 6000), none = R.reviewPrice([], 6000)
  ok('every pass has a measured price', all.every((k) => (R.REVIEW_RUNS[k]?.length ?? 0) >= 2) && small.pence != null && small.n >= 2)
  const measured = all.reduce((a, k) => a + R.REVIEW_RUNS[k]!.filter((r) => r.chars === 5542).reduce((x, r) => x + r.pence, 0) / R.REVIEW_RUNS[k]!.filter((r) => r.chars === 5542).length, 0)
  const at5542 = R.reviewPrice(all, 5542).pence!
  ok(`the price scales with length, and at the measured size it is within 15% of what was measured (${at5542}p vs ${measured.toFixed(2)}p)`, big.pence! > small.pence! && Math.abs(at5542 - measured) / measured < 0.15)
  ok('no passes, no price', none.pence === 0)

  ok('a review issue’s key names its pass, and only a review key does', R.passOfReviewKey(R.reviewPassKey('LEGAL'))?.key === 'LEGAL' && R.passOfReviewKey('LEGAL') === null && R.passOfReviewKey('review:NOPE') === null)
  const producers = ['review:LEGAL', 'LEGAL', 'ADVERSARIAL', 'SMART', 'KERNEL_CHECK', 'LOGIC_CHECK', 'REVISE', 'MATERIAL_UPDATE', 'question:LEGAL_LANDSCAPE', 'SOMETHING_NEW']
  ok('every issue producer is said in words, never as its key', producers.every((k) => { const w = R.producerWords(k); return !!w && !/[A-Z]{3,}|_/.test(w) }), producers.map(R.producerWords).join(' | '))
  ok('the raised-by line names the pass, the D-number and the version', R.raisedByWords('Legal', 'D.38.1', 2) === 'Raised by Lex’s legal review of D.38.1, version 2')

  const sql = readFileSync(join(ROOT, 'prisma/lex_26v2d_document_review.sql'), 'utf8')
  const listed = /pass_key IN \(([^)]+)\)/.exec(sql)?.[1].match(/'([A-Z_]+)'/g)?.map((x) => x.slice(1, -1)) ?? []
  ok('the DDL’s pass list is exactly the five configured passes', listed.length === PASS_KEYS.length && PASS_KEYS.every((k) => listed.includes(k)), listed.join(','))
  ok('the snapshot’s exclusion spells the same prefix as REVIEW_PREFIX', R.REVIEW_PREFIX === 'review:' && readFileSync(join(ROOT, 'lib/documents/proposal-snapshot.ts'), 'utf8').includes(`startsWith: '${R.REVIEW_PREFIX}'`))
  ok('the DDL only adds (no DROP, no UPDATE, no DELETE)', !/\b(DROP|UPDATE|DELETE)\b/i.test(sql.replace(/--.*$/gm, '').replace(/ON DELETE (CASCADE|SET NULL)/g, '')))
}

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────
let calls = 0
type Answer = { issues: Array<{ title: string; text: string; part: number | null }>; heldUp: string } | 'FAIL'
let answers: Partial<Record<PassKey, Answer>> = {}
const fixture = (async (opts: { model: string; label: string }) => {
  calls++
  const key = PASSES.find((p) => opts.label === `document-review-${p.key.toLowerCase()}`)?.key
  const a = key ? answers[key] : undefined
  const usage = { model: opts.model, tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } }
  if (!a || a === 'FAIL') return { ok: false, reason: 'error', detail: 'fixture refusal', usage }
  return { ok: true, value: a, usage }
}) as unknown as typeof callModelJson
const FULL: Partial<Record<PassKey, Answer>> = {
  LEGAL: { issues: [{ title: 'Second part unclear', text: 'Part two says too little.', part: 2 }, { title: 'Ghost part', text: 'A part that is not there.', part: 9 }], heldUp: 'Clear in the first part.' },
  FINANCIAL: { issues: [], heldUp: 'Nothing here costs anything.' },
  EVIDENCE_PRECEDENT: { issues: Array.from({ length: 10 }, (_, k) => ({ title: `Evidence ${k}`, text: `Evidence point ${k}.`, part: 1 })), heldUp: 'Some.' },
  POLITICAL_RISK: { issues: [{ title: '', text: ' ', part: 1 }, { title: 'Who loses', text: 'Someone loses.', part: null }], heldUp: 'Mostly.' },
  STATUTORY_CONSEQUENCES: 'FAIL',
}

// ── B · scratch ──────────────────────────────────────────────────────────────────────────────────────────────
async function partB() {
  section('B · scratch copy — a review writes its rows and issues; reread through the tree, the view and the Risks view')
  const copy = await scratchCopy('452c5ade', '26v2d-check')
  const cleanup = () => deleteScratch(copy.id)
  try {
    const a1 = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, status: 'LIVE', number: { not: null } }, orderBy: { number: 'asc' }, select: { id: true, number: true } })
    if (!a1) { skip('part B', 'the copy has no numbered live action'); return null }
    const made = await D.addDocumentByHand(copy.id, a1.id, { kind: 'OPERATING_TEXT', title: 'Check rules', body: '## 1. First\nOne rule.\n\n## 2. Second\nAnother rule.' }, { userId: copy.userId, author: 'OWNER' })
    if (!made.ok) { skip('part B', `could not add a document: ${(made as { error: string }).error}`); return null }
    const doc = await prisma.actionDocument.findFirstOrThrow({ where: { actionId: a1.id, title: 'Check rules' } })
    const d = D.dNumber(a1.number, doc.number)

    // refusals, in words
    const empty = await prisma.actionDocument.create({ data: { ideaId: copy.id, actionId: a1.id, number: doc.number + 1, kind: 'CODE_TEXT', title: 'No version yet' } })
    const gen = await prisma.actionDocument.create({ data: { ideaId: copy.id, actionId: a1.id, number: doc.number + 2, kind: 'CONSEQUENTIAL_SCHEDULE', title: 'Empty schedule', versions: { create: { role: 'VERSION', v: 1, author: 'GENERATED', body: 'Nothing accepted yet.', payload: { from: 'accepted-instructions', rows: [] } } } } })
    const callsBefore = calls
    const r0 = await R.reviewDocument(copy.id, empty.id, { userId: copy.userId, call: fixture })
    ok('a document with no version is refused in words, and nothing is written', !r0.ok && /has no version yet/.test((r0 as { error: string }).error) && (await prisma.documentReview.count({ where: { documentId: empty.id } })) === 0)
    const r1 = await R.reviewDocument(copy.id, gen.id, { userId: copy.userId, call: fixture })
    ok('an empty generated document is refused in words — there is nothing of the proposal in it', !r1.ok && /holds no rows yet/.test((r1 as { error: string }).error) && (await prisma.documentReview.count({ where: { documentId: gen.id } })) === 0)
    const other = await prisma.actionDocument.findFirst({ where: { ideaId: { not: copy.id } }, select: { id: true } })
    if (other) { const r2 = await R.reviewDocument(copy.id, other.id, { userId: copy.userId, call: fixture }); ok('another idea’s document is refused', !r2.ok && /not on this idea/.test((r2 as { error: string }).error)) } else skip('another idea’s document', 'none exists')
    ok('a refusal makes no model call', calls === callsBefore)

    // the review
    answers = { ...FULL }
    const plan0 = await R.reviewPlan(copy.id, doc.id)
    ok('the plan, before any review: all five will read version 1, at a measured price', plan0.ok && plan0.data.notReviewable === null && plan0.data.price.forPasses.length === 5 && (plan0.data.price.pence ?? 0) > 0 && plan0.data.passes.every((p) => !p.readThisVersion))
    const run = await R.reviewDocument(copy.id, doc.id, { userId: copy.userId, call: fixture })
    const out = run.ok ? run.data.outcomes : []
    const by = (k: PassKey) => out.find((o) => o.passKey === k)
    ok('five passes ran in one call: four RUN, the failing one FAILED in words', run.ok && out.length === 5 && out.filter((o) => o.status === 'RUN').length === 4 && by('STATUTORY_CONSEQUENCES')?.status === 'FAILED' && /fixture refusal/.test(by('STATUTORY_CONSEQUENCES')!.words), JSON.stringify(out.map((o) => o.words)))
    const rows = await prisma.documentReview.findMany({ where: { documentId: doc.id } })
    ok('one review row per pass, each recording the version read; the failure has its reason and no issues', rows.length === 5 && rows.every((r) => r.v === 1) && rows.filter((r) => r.status === 'FAILED').length === 1 && !!rows.find((r) => r.status === 'FAILED')!.failureReason && rows.find((r) => r.status === 'FAILED')!.issues === 0)
    ok('a review that raised nothing still leaves its row, with what held up', rows.some((r) => r.passKey === 'FINANCIAL' && r.status === 'RUN' && r.issues === 0 && r.heldUp === 'Nothing here costs anything.'))
    const issues = await prisma.deepeningIssue.findMany({ where: { ideaId: copy.id, reviewId: { not: null } } })
    ok(`the issues written: 2 legal + 8 evidence (cap) + 1 political (empty dropped) = 11 (got ${issues.length})`, issues.length === 11)
    ok('every one carries the action, the document, Lex, the review, the review key and runVersion 0', issues.every((i) => i.actionId === a1.id && i.documentId === doc.id && i.attachedBy === 'LEX' && !!i.reviewId && i.passKey.startsWith('review:') && i.runVersion === 0 && i.status === 'OPEN'))
    const legal = issues.filter((i) => i.passKey === 'review:LEGAL')
    ok('the part it concerns is kept; a part the document lacks falls to the document as a whole', legal.some((i) => i.partN === 2) && legal.some((i) => i.title === 'Ghost part' && i.partN === null))
    ok('each says which review raised it: pass, D-number, version', legal.every((i) => i.attachReason === `Raised by Lex’s legal review of ${d}, version 1`))
    ok('the corrections are recorded on the review row, in words', /named a part the document does not have/.test(rows.find((r) => r.passKey === 'LEGAL')?.falls ?? '') && /over the limit of 8/.test(rows.find((r) => r.passKey === 'EVIDENCE_PRECEDENT')?.falls ?? ''))
    const st = await deepeningState(copy.id)
    ok('no kernel pass card takes up a review issue (they list by exact pass key)', st.passes.every((p) => p.issues.every((i) => !issues.some((x) => x.id === i.id))))
    control('the same issues under the plain pass key WOULD appear in the card', !PASSES.some((p) => issues.map((i) => i.passKey.replace('review:', '')).includes(p.key)))
    // a build's own challenge beside them (the copy carries none), so the snapshot has a current set to keep them out of
    await prisma.deepeningIssue.create({ data: { ideaId: copy.id, passKey: 'ADVERSARIAL', runVersion: 3, title: 'A build challenge', text: 'Raised by a build.', status: 'OPEN' } })
    const snap = await buildProposalSnapshot(copy.id)
    ok('the printed proposal’s challenge set takes none of them (they are the document’s, not an earlier draft’s)', snap.issues.length > 0 && snap.issues.every((i) => !i.passKey.startsWith(R.REVIEW_PREFIX)) && snap.issues.length === (await prisma.deepeningIssue.count({ where: { ideaId: copy.id, reviewId: null } })))
    control('without the exclusion, every review issue would be read as an earlier draft’s (runVersion 0 is never current)', issues.every((i) => i.runVersion === Math.max(...snap.issues.map((x) => x.runVersion), 0)))
    const buildV = (await prisma.deepeningIssue.findFirst({ where: { ideaId: copy.id, reviewId: null, runVersion: { gt: 0 } }, select: { runVersion: true } }))?.runVersion ?? 1
    ok(`no build reader selecting runVersion = ${buildV} can pick one up`, (await prisma.deepeningIssue.count({ where: { ideaId: copy.id, runVersion: buildV, reviewId: { not: null } } })) === 0)

    // again / not again
    answers = { ...FULL, STATUTORY_CONSEQUENCES: { issues: [{ title: 'Consequence', text: 'Something refers to this.', part: 1 }], heldUp: 'Fine.' } }
    const n0 = calls
    const rerun = await R.reviewDocument(copy.id, doc.id, { userId: copy.userId, call: fixture })
    ok('a second press runs only the pass that has not read this version (the failed one); the four are said, not re-run', rerun.ok && calls - n0 === 1 && rerun.data.outcomes.filter((o) => o.status === 'NOT_RUN').length === 4 && rerun.data.outcomes.find((o) => o.passKey === 'STATUTORY_CONSEQUENCES')?.status === 'RUN' && /already reviewed version 1/.test(rerun.data.outcomes.find((o) => o.passKey === 'LEGAL')!.words))
    const again = await R.reviewDocument(copy.id, doc.id, { userId: copy.userId, call: fixture, passes: ['LEGAL'], again: true })
    ok('“again” on one pass adds a second set, and the first is kept', again.ok && (await prisma.deepeningIssue.count({ where: { documentId: doc.id, passKey: 'review:LEGAL' } })) === 4 && (await prisma.documentReview.count({ where: { documentId: doc.id, passKey: 'LEGAL' } })) === 2)

    // the tree, the Issues tab data, the Risks view
    const tree = await D.documentTree(copy.id)
    const node = tree.headings.flatMap((h) => h.actions).flatMap((a) => a.documents).find((x) => x.id === doc.id)!
    const openOnDoc = await prisma.deepeningIssue.count({ where: { documentId: doc.id, status: 'OPEN' } })
    const onPart2 = await prisma.deepeningIssue.count({ where: { documentId: doc.id, status: 'OPEN', partN: 2 } })
    ok(`the tree counts the document’s open issues (${openOnDoc}) and part 2’s (${onPart2}), and all five passes as having read it`, node.issues === openOnDoc && node.parts.find((p) => p.n === 2)?.issues === onPart2 && node.reviewed === 5, JSON.stringify({ issues: node.issues, parts: node.parts, reviewed: node.reviewed }))
    const v = await documentView(copy.id, doc.id)
    ok('the Issues tab data has a latest review per pass and every open issue with its review', v.ok && v.data.reviews.length === 5 && v.data.issues.length === openOnDoc && v.data.issues.every((i) => !!i.reviewId))
    const risks = await R.risksView(copy.id)
    const g = risks.documents.find((x) => x.id === doc.id)
    ok('the Risks view groups them under the document, each on its part, raised by its review in words', !!g && g.d === d && g.issues.length === openOnDoc && g.issues.some((i) => i.part === `${a1.number}.${doc.number}.2` && i.by === 'Lex’s legal review') && g.reviews.length === 5)
    ok('…lists the documents with no issue too (so “not reviewed” is visible)', risks.documents.some((x) => x.id === empty.id && x.issues.length === 0 && x.reviews.length === 0))
    ok('…and its counts agree with the database', risks.counts.onDocument === (await prisma.deepeningIssue.count({ where: { ideaId: copy.id, status: 'OPEN', documentId: { not: null } } })) && risks.counts.open === (await prisma.deepeningIssue.count({ where: { ideaId: copy.id, status: 'OPEN' } })))

    // a dismissed one stays, under its document
    const victim = legal.find((i) => i.partN === 2)!
    await triageIssue(copy.id, victim.id, 'dismiss', { reason: 'Covered elsewhere.' })
    const g2 = (await R.risksView(copy.id)).documents.find((x) => x.id === doc.id)!
    ok('a dismissed issue stays listed under its document, with its reason', g2.issues.some((i) => i.id === victim.id && i.status === 'DISMISSED' && i.dismissReason === 'Covered elsewhere.'))
    await triageIssue(copy.id, victim.id, 'reopen', {})

    // Undo of Lex's placements leaves review issues alone
    const reviewIssues = await prisma.deepeningIssue.count({ where: { documentId: doc.id, reviewId: { not: null } } })
    await IA.undoLexAttachments(copy.id)
    ok('Undo of Lex’s placements leaves every review issue on its document', (await prisma.deepeningIssue.count({ where: { documentId: doc.id, reviewId: { not: null } } })) === reviewIssues)

    // a new version
    const saved = await D.saveDocumentText(copy.id, doc.id, '## 1. First\nOne rule, changed.\n\n## 2. Second\nAnother rule.\n\n## 3. Third\nA third.', { userId: copy.userId, author: 'OWNER' })
    const plan1 = await R.reviewPlan(copy.id, doc.id)
    ok('after a new version, all five would read it again, at a price', saved.ok && plan1.ok && plan1.data.v === 2 && plan1.data.price.forPasses.length === 5 && plan1.data.passes.every((p) => !p.readThisVersion && p.latest?.v === 1))
    const tree2 = await D.documentTree(copy.id)
    ok('…the tree says no pass has read the current version', tree2.headings.flatMap((h) => h.actions).flatMap((a) => a.documents).find((x) => x.id === doc.id)?.reviewed === 0)
    const risks2 = await R.risksView(copy.id)
    ok('…and the older issues stay open, each saying the version it read', risks2.documents.find((x) => x.id === doc.id)!.issues.filter((i) => i.status === 'OPEN').every((i) => i.olderVersion === 'raised against version 1; the document is now at version 2'))
    answers = { ...FULL, STATUTORY_CONSEQUENCES: { issues: [], heldUp: 'Nothing refers to this.' } }
    return { copyId: copy.id, userId: copy.userId, cleanup, docId: doc.id, d }
  } catch (e) { await cleanup(); throw e }
}

// ── C · the browser ────────────────────────────────────────────────────────────────────────────────────────
async function partC(b: { copyId: string; userId: string; docId: string; d: string }) {
  section('C · the browser — review, Issues tab, Risks view and the tree on one screen')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/deepening-risks-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: b.userId } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const route = await import('../app/api/ideas/[id]/action-documents/route')
  const triage = await import('../app/api/ideas/[id]/deepening/issues/[issueId]/route')
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  let reviewRequests = 0
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    await page.route('**/api/ideas/*/action-documents', async (r) => {
      const req = r.request()
      const params = { params: Promise.resolve({ id: b.copyId }) }
      const body = req.postData() ?? ''
      // "Review it" is answered by the real reviewDocument with the fixture model (the route would spend); everything else by the real route
      if (req.method() === 'POST' && /"op":"review"/.test(body)) {
        reviewRequests++
        const p = JSON.parse(body) as { documentId: string; again?: boolean }
        const res = await R.reviewDocument(b.copyId, p.documentId, { userId: b.userId, call: fixture, again: p.again })
        return r.fulfill({ status: res.ok ? 200 : 422, contentType: 'application/json', body: JSON.stringify(res.ok ? { ok: true, data: res.data } : { error: (res as { error: string }).error }) })
      }
      const res = req.method() === 'GET'
        ? await route.GET(new Request('http://internal.invalid/'), params)
        : await route.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body }), params)
      await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
    })
    await page.route('**/api/ideas/*/deepening/issues/*', async (r) => {
      const issueId = r.request().url().split('/').pop()!
      const res = await triage.PATCH(new Request('http://internal.invalid/', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: r.request().postData() ?? '' }), { params: Promise.resolve({ id: b.copyId, issueId }) })
      await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
    })
    await page.goto('http://harness.test/')
    await page.evaluate((id) => { (window as unknown as { __tree: unknown }).__tree = { ideaId: id, readOnly: false } }, b.copyId)
    await page.addScriptTag({ content: bundle })
    await page.waitForSelector('[data-tree-counts]', { timeout: 30_000 })
    await page.waitForSelector('[data-risks-view]', { timeout: 30_000 })

    const docRow = page.locator(`[data-tree-document="${b.d}"]`)
    ok('the tree says the current version is not yet reviewed', /not yet reviewed/.test(await docRow.innerText()))
    await docRow.locator('button').first().click()
    await page.locator('[data-review-open]').click()
    await page.waitForSelector('[data-review-ask="todo"]', { timeout: 15_000 })
    const ask = await page.locator('[data-review-ask]').innerText()
    ok('“Review this document” asks first, naming the five passes and the measured price', /All five: about [\d.]+p \(measured on a copy of a real idea, n=\d+/.test(ask) && PASSES.every((p) => ask.includes(p.label)) && reviewRequests === 0, ask.slice(0, 400))
    await page.locator('[data-review-run]').click()
    await page.waitForSelector('[data-document-said]', { timeout: 30_000 })
    const said = await page.locator('[data-document-said]').innerText()
    ok('after it runs, it says what each pass did, in words', /Reviewed D\.\d+\.\d+, version 2/.test(said) && /Legal: 2 issues raised/.test(said) && /Financial: 0 issues raised/.test(said), said.slice(0, 400))
    await page.waitForSelector('[data-document-reviews]', { timeout: 15_000 })
    const tab = await page.locator('[data-document-panel="issues"]').innerText()
    ok('the Issues tab counts by pass: each read version 2, with what it raised and held up', PASSES.every((p) => new RegExp(`${p.label} — read version 2`).test(tab)) && /held up: Nothing here costs anything\./.test(tab), tab.slice(0, 500))
    ok('…and lists each issue on its part, saying which review raised it', tab.includes(`part ${b.d.replace(/^D\./, '')}.2`) && /Raised by Lex’s legal review of D\.\d+\.\d+, version 2/.test(tab))
    await page.waitForFunction((d) => /reviewed by 5 of 5 passes at this version/.test(document.querySelector(`[data-tree-document="${d}"]`)?.textContent ?? ''), b.d, { timeout: 15_000 })
    ok('the tree now says all five have read this version', /reviewed by 5 of 5 passes at this version/.test(await docRow.innerText()))

    // the Risks view on the same screen
    const group = page.locator(`[data-risks-document="${b.d}"]`)
    await page.waitForFunction((d) => /Legal \(version 2/.test(document.querySelector(`[data-risks-document="${d}"]`)?.textContent ?? ''), b.d, { timeout: 15_000 })
    const gText = await group.innerText()
    ok('the Risks view lists the document with what each pass read, and its issues on their parts', /Reviewed by:/.test(gText) && /Legal \(version 2/.test(gText) && gText.includes(`on part ${b.d.replace(/^D\./, '')}.2`), gText.slice(0, 400))
    ok('…the older version’s issues say so, with a shape and words', /⚠ raised against version 1; the document is now at version 2/.test(gText))
    const before = Number(await docRow.locator('[data-tree-doc-issues]').getAttribute('data-tree-doc-issues'))
    const row = group.locator('[data-risk-issue="OPEN"]', { hasText: 'Second part unclear' }).first()
    await row.locator('[data-risk-dismiss]').click()
    await row.locator('textarea').fill('Covered by the third part.')
    await row.getByRole('button', { name: 'Dismiss it' }).click()
    await page.waitForSelector('[data-risks-said]', { timeout: 15_000 })
    ok('dismissing there, with a reason, says so in words', /Saved: “Second part unclear” is now dismissed\./.test(await page.locator('[data-risks-said]').innerText()))
    await page.waitForFunction(([d, n]) => Number(document.querySelector(`[data-tree-document="${d}"] [data-tree-doc-issues]`)?.getAttribute('data-tree-doc-issues')) === n, [b.d, before - 1] as const, { timeout: 15_000 }).catch(() => {})
    const after = Number(await docRow.locator('[data-tree-doc-issues]').getAttribute('data-tree-doc-issues'))
    ok(`…the tree’s count on the same screen falls by one (${before} → ${after})`, after === before - 1)
    await group.locator('summary', { hasText: 'Answered' }).click()
    ok('…and the issue stays listed, under Answered, with its reason and a shape', /✕ Second part unclear/.test(await group.innerText()) && /Dismissed: Covered by the third part\./.test(await group.innerText()))
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  partA()
  const b = await partB().catch((e) => { fail++; ran++; console.log(`  ✗ part B threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
  if (b) { try { await partC(b) } finally { await b.cleanup() } }
  else skip('the browser section', 'part B did not finish')
  console.log(`\ncheck:lex-26v2d — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead || !ran ? 1 : 0)
}
main()
