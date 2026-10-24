// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26v2c — LEX 26-V2c: a heading's KIND (268, revised: "no name match") and the open issues RE-ATTACHED to the action, document
// and part they concern (BRIEF_26V §7 / §8 item 7: "counts before/after; none lost"). Counts what RAN (§23.2). Spends NOTHING: every model
// call is a fixture.
//
//   A · pure: Charlie's eight kinds (and the DDL's CHECK lists the same, with no name-seeding UPDATE); the specification rule reads the kind,
//       never the name; the two prompts carry no specimen (§27); a proposal is checked; a placement that names what does not exist falls
//       back one level and is counted.
//   B · on a scratch copy of 452c5ade, through the real functions (§25.3): Lex's proposed kinds wait beside the headings and set nothing;
//       Accept sets the kind and only then is a specification needed; the owner's own choice answers a proposal. Issues: placed on a
//       document part, an action, or left on the proposal; counts before and after; none lost, none re-worded; the owner's placement never
//       overwritten; Undo takes Lex's placements off. The tree counts and the document's Issues tab read them back.
//   C · the browser: the REAL DocumentsTree in Chromium, answered by the REAL route: the heading's kind in words, the issue counts on the
//       action and the document, and the document's Issues tab listing its issue by part.
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26v2c.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import type { callModelJson } from '../lib/lex/model-call'
import * as D from '../lib/lex/action-documents'
import * as HK from '../lib/lex/heading-kind'
import * as IA from '../lib/lex/issue-attach'
import { updateHeading } from '../lib/lex/action-structure'
import { ActionStructureBody } from '../lib/lex/action-structure-schema'
import { documentView } from '../lib/lex/document-view'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

// ── A · pure ────────────────────────────────────────────────────────────────────────────────────────────────
function partA() {
  section('A · pure — the kinds, the rule, the prompts, the checks on what comes back')
  ok('Charlie’s eight kinds, in his order, in words', D.HEADING_KINDS.map((k) => D.HEADING_KIND_WORD[k]).join(' · ') === 'primary legislation · code · management code · platform · budget · transparency · guidance or pilot · other')
  const sql = readFileSync(join(ROOT, 'prisma/lex_26v2c_heading_kind_issue_attach.sql'), 'utf8')
  const inCheck = [...(sql.match(/"ActionHeading_kind_check" CHECK \(([\s\S]*?)\n\);/)?.[1] ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
  ok('the DDL’s CHECK lists exactly the same kinds, for kind and for proposedKind', [...new Set(inCheck)].sort().join() === [...D.HEADING_KINDS].sort().join() && inCheck.length === 2 * D.HEADING_KINDS.length, inCheck.join())
  ok('"no name match": the DDL seeds no kind from a heading’s name (no UPDATE of ActionHeading)', !/UPDATE\s+"ActionHeading"/i.test(sql))
  const needs = (kind: string | null, name: string | null) => D.needsDocuments({ avenue: null, instrument: null, headingKind: kind, headingName: name }).kinds
  ok('PLATFORM derives a specification; no other kind does', needs('PLATFORM', 'x').join() === 'SPECIFICATION' && D.HEADING_KINDS.filter((k) => k !== 'PLATFORM').every((k) => !needs(k, 'The platform').includes('SPECIFICATION')))
  ok('a heading NAMED “The platform” with no kind derives nothing (the rule never reads the name)', needs(null, 'The platform').length === 0)
  control('a name-matching rule would have derived one there', !/\bplatform\b/i.test('The platform'))

  ok('the kinds prompt describes every kind, and carries no specimen from 452c5ade (§27)', D.HEADING_KINDS.every((k) => HK.KIND_PROPOSAL_SYSTEM.includes(k)) && !/Civil Service|Minister|Treasury|accountab|Oversight|Rules & Standards/i.test(HK.KIND_PROPOSAL_SYSTEM))
  ok('the re-attach prompt carries no specimen either, and says an issue on several actions stays on the proposal', !/Civil Service|Minister|Treasury|accountab|\[Ref:\s*\d|D\.\d+\.\d+/i.test(IA.ATTACH_SYSTEM) && /several actions equally, or none of them/.test(IA.ATTACH_SYSTEM))

  const heads = [{ n: 1, id: 'h1', name: 'One', purpose: null, actions: [], more: 0 }, { n: 2, id: 'h2', name: 'Two', purpose: null, actions: [], more: 0 }, { n: 3, id: 'h3', name: 'Three', purpose: null, actions: [], more: 0 }]
  const k = HK.acceptedProposals(heads, { headings: [{ n: 1, kind: 'PLATFORM', reason: 'r' }, { n: 1, kind: 'BUDGET', reason: 'again' }, { n: 2, kind: 'SOFTWARE', reason: 'r' }, { n: 9, kind: 'OTHER', reason: 'r' }] })
  ok('a proposal is kept only for a heading asked about, once, with a known kind; the rest are said', k.kept.length === 1 && k.kept[0].kind === 'PLATFORM' && k.dropped.length === 4 && k.dropped.some((d) => /“Two”: “SOFTWARE” is not one of the kinds/.test(d)) && k.dropped.some((d) => /“Three”: no answer came back/.test(d)), k.dropped.join(' | '))

  const actions = [{ id: 'a7', number: 7, title: 't', heading: null, headingKind: null }, { id: 'a8', number: 8, title: 't', heading: null, headingKind: null }]
  const docs = [{ id: 'd71', actionId: 'a7', action: 7, number: 1, kind: 'SPECIFICATION', title: 'x', parts: [{ n: 1, title: 'p1' }, { n: 2, title: 'p2' }] }]
  const issues = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'].map((key) => ({ key, id: `id-${key}`, title: null, text: 't', passKey: 'P' }))
  const c = IA.checkPlacements(issues, { placements: [
    { key: 'i1', place: 'DOCUMENT', action: 7, document: '7.1', part: 2, reason: 'part two' },
    { key: 'i2', place: 'DOCUMENT', action: 8, document: '7.1', part: null, reason: 'wrong action' },
    { key: 'i3', place: 'DOCUMENT', action: 7, document: 'D.7.1', part: 9, reason: 'no part 9' },
    { key: 'i4', place: 'ACTION', action: 99, document: null, part: null, reason: 'no such action' },
    { key: 'i5', place: 'PROPOSAL', action: null, document: null, part: null, reason: 'whole' },
    { key: 'i5', place: 'ACTION', action: 7, document: null, part: null, reason: 'dup' },
    { key: 'zz', place: 'ACTION', action: 7, document: null, part: null, reason: 'not asked' },
    { key: 'i6', place: 'ACTION', action: 8, document: null, part: null, reason: 'eight' },
  ] }, actions, docs)
  const at = (k: string) => c.placements.find((p) => p.issueId === `id-${k}`)!
  ok('a document and part that exist are kept: on 7.1, part 2', at('i1').place === 'DOCUMENT' && (at('i1') as { partN: number }).partN === 2)
  ok('a document that is not that action’s falls back to the action', at('i2').place === 'ACTION' && (at('i2') as { actionId: string }).actionId === 'a8')
  ok('a part the document does not have falls back to the document ("D.7.1" read as 7.1)', at('i3').place === 'DOCUMENT' && (at('i3') as { partN: number | null }).partN === null)
  ok('an action that is not live falls back to the proposal, and says so', at('i4').place === 'PROPOSAL' && /#99, which is not a live action/.test(at('i4').reason))
  ok('an issue with no answer stays on the proposal; one placement per issue, never two', at('i7').place === 'PROPOSAL' && c.placements.length === issues.length && at('i5').place === 'PROPOSAL')
  ok('every fall is counted, in words', c.falls.documentNotOfAction === 1 && c.falls.partOutOfRange === 1 && c.falls.unknownAction === 1 && c.falls.noAnswer === 1 && c.falls.duplicate === 1 && c.falls.unknownKey === 1 && IA.fallsWords(c.falls).length === 6)
  ok('the before/after line reads as the brief asks', IA.countsLine({ open: 176, onDocument: 3, onAction: 100, onProposal: 73 }) === '176 open issues: 3 on a document, 100 on an action, 73 on the proposal as a whole')
}

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────
let calls = 0
/** Kinds: PLATFORM for a heading named "The platform", OTHER for the rest, and one invented kind (dropped). Placements: as set per test. */
let placements: IA.AttachAnswer['placements'] = []
const fixture = (async (opts: { model: string; label: string; user: string }) => {
  calls++
  const value = opts.label === 'heading-kind'
    ? { headings: [...opts.user.matchAll(/<heading n="(\d+)">\nName: ([^\n]+)/g)].map((m, i) => ({ n: Number(m[1]), kind: m[2] === 'The platform' ? 'PLATFORM' : i === 0 ? 'SOFTWARE' : 'OTHER', reason: `fixture reason for ${m[2]}` })) }
    : { placements }
  return { ok: true, value, usage: { model: opts.model, tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } } }
}) as unknown as typeof callModelJson

// ── B · scratch ──────────────────────────────────────────────────────────────────────────────────────────────
async function partB() {
  section('B · scratch copy — kinds proposed and accepted; issues placed, counted, none lost')
  const copy = await scratchCopy('452c5ade', '26v2c-check')
  const cleanup = () => deleteScratch(copy.id)
  try {
    // The check owns its data (§25.4): 452c5ade's headings have had kinds since CCh 274 (25 Oct), so the COPY's are cleared here to give
    // the proposal section headings with no kind to ask about. Only the scratch copy is touched.
    await prisma.actionHeading.updateMany({ where: { ideaId: copy.id }, data: { kind: null, proposedKind: null, proposedKindReason: null } })
    // ── kinds ──
    const platform = await prisma.actionHeading.findFirst({ where: { ideaId: copy.id, name: 'The platform' } })
    if (!platform) { skip('the kinds section', 'the copy has no heading named "The platform"') } else {
      const treeOf = async () => (await D.documentTree(copy.id)).headings.find((h) => h.id === platform.id)
      const t0 = await treeOf()
      ok('before any kind is set, actions under “The platform” need no specification (no name match)', !!t0 && t0.kind === null && t0.actions.every((a) => !a.needs.kinds.includes('SPECIFICATION')))
      const live = await prisma.actionHeading.count({ where: { ideaId: copy.id, archivedAt: null } })
      const r = await HK.proposeHeadingKinds(copy.id, copy.userId, { call: fixture })
      const after = await prisma.actionHeading.findMany({ where: { ideaId: copy.id, archivedAt: null } })
      ok(`Lex proposes a kind for each live heading with none (${live}), and the invented one is dropped and said`, r.ok && r.data.headings === live && r.data.proposals.length === live - 1 && r.data.dropped.length === 1 && /is not one of the kinds/.test(r.data.dropped[0]), JSON.stringify(r.ok ? r.data.dropped : r))
      ok('…each proposal waits beside its heading with its reason; NO kind was set by Lex', after.filter((h) => h.proposedKind).length === live - 1 && after.every((h) => h.kind === null) && after.find((h) => h.id === platform.id)?.proposedKind === 'PLATFORM' && /fixture reason/.test(after.find((h) => h.id === platform.id)?.proposedKindReason ?? ''))
      ok('…so the specification is still not needed while the proposal waits', ((await treeOf())?.actions ?? []).every((a) => !a.needs.kinds.includes('SPECIFICATION')))
      const again = await HK.proposeHeadingKinds(copy.id, copy.userId, { call: fixture })
      ok('asking again asks only about headings with no kind and no proposal waiting', again.ok ? again.data.headings === 1 : /Nothing was asked/.test((again as { error: string }).error))
      const acc = await HK.answerKindProposal(copy.id, platform.id, true)
      const t1 = await treeOf()
      ok('Accept sets the kind and clears the proposal', acc.ok && (await prisma.actionHeading.findUniqueOrThrow({ where: { id: platform.id } })).kind === 'PLATFORM' && !(await prisma.actionHeading.findUniqueOrThrow({ where: { id: platform.id } })).proposedKind)
      ok('…and now every action under it needs a specification, and the tree says the kind', !!t1 && t1.kind === 'PLATFORM' && t1.actions.length > 0 && t1.actions.every((a) => a.needs.kinds.includes('SPECIFICATION') && /“The platform”, a platform heading/.test(a.needs.why)), t1?.actions[0]?.needs.why)
      const other = after.find((h) => h.id !== platform.id && h.proposedKind)!
      const no = await HK.answerKindProposal(copy.id, other.id, false)
      const o2 = await prisma.actionHeading.findUniqueOrThrow({ where: { id: other.id } })
      ok('"Not this" clears the proposal and leaves the kind as it was', no.ok && o2.kind === null && !o2.proposedKind)
      const third = after.find((h) => h.id !== platform.id && h.id !== other.id && h.proposedKind)
      if (third) {
        await updateHeading(copy.id, third.id, { kind: 'BUDGET' })
        const t3 = await prisma.actionHeading.findUniqueOrThrow({ where: { id: third.id } })
        ok('the owner’s own choice on the row sets the kind and answers the proposal waiting there', t3.kind === 'BUDGET' && !t3.proposedKind)
      } else skip('the owner’s choice', 'no third heading with a proposal')
      const bad = await updateHeading(copy.id, platform.id, { kind: 'SOFTWARE' })
      ok('a kind that is not one of the eight is refused in words, and nothing changes', !bad.ok && /not one of the heading kinds/.test((bad as { error: string }).error) && (await prisma.actionHeading.findUniqueOrThrow({ where: { id: platform.id } })).kind === 'PLATFORM')
      ok('the route’s schema refuses it too, before the server is reached', !ActionStructureBody.safeParse({ op: 'updateHeading', headingId: platform.id, kind: 'SOFTWARE' }).success && ActionStructureBody.safeParse({ op: 'updateHeading', headingId: platform.id, kind: null }).success)
    }

    // ── issues ──
    const acts = await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id, status: 'LIVE', number: { not: null } }, orderBy: { number: 'asc' }, take: 2, select: { id: true, number: true } })
    if (acts.length < 2) { skip('the issues section', 'the copy has fewer than two numbered actions'); return { copyId: copy.id, userId: copy.userId, cleanup } }
    const [a1, a2] = acts
    const doc = await D.addDocumentByHand(copy.id, a1.id, { kind: 'OPERATING_TEXT', title: 'Check document', body: '## 1. First\nOne.\n\n## 2. Second\nTwo.' }, { userId: copy.userId, author: 'OWNER' })
    if (!doc.ok) { skip('the issues section', `could not add a document: ${(doc as { error: string }).error}`); return { copyId: copy.id, userId: copy.userId, cleanup } }
    const docNum = (await prisma.actionDocument.findFirstOrThrow({ where: { actionId: a1.id, title: 'Check document' } }))
    const mk = (text: string) => prisma.deepeningIssue.create({ data: { ideaId: copy.id, passKey: 'CHECK', text, status: 'OPEN', title: `T ${text}` } })
    const made = [] as Array<{ id: string }>
    for (const t of ['on the part', 'on the action', 'on the whole', 'on a ghost']) { made.push(await mk(t)); await new Promise((r) => setTimeout(r, 5)) }
    const mine = await prisma.deepeningIssue.create({ data: { ideaId: copy.id, passKey: 'CHECK', text: 'placed by the owner', status: 'OPEN', actionId: a2.id, attachedBy: 'OWNER', attachedAt: new Date() } })
    const textsBefore = (await prisma.deepeningIssue.findMany({ where: { ideaId: copy.id }, select: { id: true, text: true, status: true }, orderBy: { id: 'asc' } }))
    placements = [
      { key: 'i1', place: 'DOCUMENT', action: a1.number!, document: `${a1.number}.${docNum.number}`, part: 2, reason: 'it is about the second part' },
      { key: 'i2', place: 'ACTION', action: a2.number!, document: null, part: null, reason: 'it is about this action' },
      { key: 'i3', place: 'PROPOSAL', action: null, document: null, part: null, reason: 'it is about the whole' },
      { key: 'i4', place: 'ACTION', action: 99999, document: null, part: null, reason: 'a ghost' },
    ]
    const ctx = await IA.attachContext(copy.id)
    ok('the context asks only about open issues not yet placed (the owner’s is not in it)', ctx.issues.length === 4 && !ctx.issues.some((i) => i.id === mine.id) && ctx.issues.map((i) => i.id).join() === made.map((m) => m.id).join())
    const r = await IA.reattachIssues(copy.id, copy.userId, { call: fixture })
    ok('counts before: 5 open — 1 on an action (the owner’s), 4 on the proposal', r.ok && r.data.before.open === 5 && r.data.before.onAction === 1 && r.data.before.onProposal === 4, JSON.stringify(r.ok ? r.data.before : r))
    ok('counts after: 5 open — 1 on a document, 2 on an action, 2 on the proposal (the ghost fell back, counted)', r.ok && r.data.after.open === 5 && r.data.after.onDocument === 1 && r.data.after.onAction === 2 && r.data.after.onProposal === 2 && r.data.falls.unknownAction === 1, JSON.stringify(r.ok ? [r.data.after, r.data.falls] : r))
    const i1 = await prisma.deepeningIssue.findUniqueOrThrow({ where: { id: made[0].id } })
    ok('the part placement is written with who and why: action, document, part 2, by Lex', i1.actionId === a1.id && i1.documentId === docNum.id && i1.partN === 2 && i1.attachedBy === 'LEX' && i1.attachReason === 'it is about the second part' && !!i1.attachedAt)
    const textsAfter = (await prisma.deepeningIssue.findMany({ where: { ideaId: copy.id }, select: { id: true, text: true, status: true }, orderBy: { id: 'asc' } }))
    ok('none lost, none re-worded, none re-stated: the same rows with the same text and status', JSON.stringify(textsAfter) === JSON.stringify(textsBefore))
    const o = await prisma.deepeningIssue.findUniqueOrThrow({ where: { id: mine.id } })
    ok('the owner’s placement is never overwritten', o.actionId === a2.id && o.attachedBy === 'OWNER')
    // a second run places nothing twice (the fixture answers by key, so this run's two unplaced issues are left on the proposal)
    const first = placements
    placements = [{ key: 'i1', place: 'PROPOSAL', action: null, document: null, part: null, reason: 'still the whole' }, { key: 'i2', place: 'PROPOSAL', action: null, document: null, part: null, reason: 'still the whole' }]
    const again = await IA.reattachIssues(copy.id, copy.userId, { call: fixture })
    ok('a second run asks only about what is still unplaced (2), and moves nothing already placed', again.ok && again.data.placements.length === 2 && (await prisma.deepeningIssue.findUniqueOrThrow({ where: { id: made[0].id } })).partN === 2)

    const tree = await D.documentTree(copy.id)
    const t1 = tree.headings.flatMap((h) => h.actions).find((a) => a.id === a1.id)
    const t2 = tree.headings.flatMap((h) => h.actions).find((a) => a.id === a2.id)
    ok('the tree counts it on the document, not twice on the action', t1?.documents.find((d) => d.id === docNum.id)?.issues === 1 && t1?.issues === 0)
    ok('…and the action’s own issues on the action (Lex’s and the owner’s)', t2?.issues === 2, String(t2?.issues))
    const v = await documentView(copy.id, docNum.id)
    ok('the document’s Issues tab data carries its issue, with its part and Lex’s reason', v.ok && v.data.issues.length === 1 && v.data.issues[0].partN === 2 && v.data.issues[0].attachReason === 'it is about the second part')
    const undone = await IA.undoLexAttachments(copy.id)
    const c = await IA.attachmentCounts(copy.id)
    ok('Undo takes Lex’s placements off (and only Lex’s): back to 1 on an action, 4 on the proposal', undone === 2 && c.onAction === 1 && c.onProposal === 4 && c.onDocument === 0)
    // what was attached to is deleted: the issue stays, and what hung off the cleared key goes with it (the detach trigger)
    const gone = await D.addDocumentByHand(copy.id, a1.id, { kind: 'OPERATING_TEXT', title: 'Doomed document', body: '## 1. Only\nOne.' }, { userId: copy.userId, author: 'OWNER' })
    const goneDoc = gone.ok ? await prisma.actionDocument.findFirst({ where: { actionId: a1.id, title: 'Doomed document' } }) : null
    if (!goneDoc) skip('the delete trigger', 'could not add a second document')
    else {
      await prisma.deepeningIssue.update({ where: { id: made[2].id }, data: { actionId: a1.id, documentId: goneDoc.id, partN: 1, attachedBy: 'OWNER', attachedAt: new Date() } })
      await prisma.actionDocumentVersion.deleteMany({ where: { documentId: goneDoc.id } })   // RESTRICT keys, as deleteScratch does
      await prisma.actionDocument.delete({ where: { id: goneDoc.id } })
      const d1 = await prisma.deepeningIssue.findUniqueOrThrow({ where: { id: made[2].id } })
      ok('a deleted document leaves its issue on the action, with no part (not refused, not lost)', d1.actionId === a1.id && d1.documentId === null && d1.partN === null && d1.attachedBy === 'OWNER' && d1.text === 'on the whole')
      await prisma.deepeningIssue.update({ where: { id: made[2].id }, data: { actionId: null } })
      const d2 = await prisma.deepeningIssue.findUniqueOrThrow({ where: { id: made[2].id } })
      ok('…and with no action it is back on the proposal, every placement field cleared', d2.actionId === null && d2.attachedBy === null && d2.attachReason === null && d2.attachedAt === null && d2.status === 'OPEN')
    }
    // put them back for the browser
    placements = first.slice(0, 2)
    await IA.reattachIssues(copy.id, copy.userId, { call: fixture })
    return { copyId: copy.id, userId: copy.userId, cleanup, a1: a1.number!, docD: D.dNumber(a1.number, docNum.number) }
  } catch (e) { await cleanup(); throw e }
}

// ── C · the browser ────────────────────────────────────────────────────────────────────────────────────────
async function partC(b: { copyId: string; userId: string; a1?: number; docD?: string }) {
  section('C · the browser — kinds and issue counts in the real DocumentsTree, the Issues tab in the real DocumentView')
  if (!b.docD) { skip('the browser section', 'part B placed no issue'); return }
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/docs-tree-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: b.userId } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const route = await import('../app/api/ideas/[id]/action-documents/route')
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    await page.route('**/api/ideas/*/action-documents', async (r) => {
      const req = r.request()
      const params = { params: Promise.resolve({ id: b.copyId }) }
      const res = req.method() === 'GET'
        ? await route.GET(new Request('http://internal.invalid/'), params)
        : await route.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: req.postData() ?? '' }), params)
      await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
    })
    await page.goto('http://harness.test/')
    await page.evaluate((id) => { (window as unknown as { __tree: unknown }).__tree = { ideaId: id, readOnly: false } }, b.copyId)
    await page.addScriptTag({ content: bundle })
    await page.waitForSelector('[data-tree-counts]', { timeout: 30_000 })
    const kindText = await page.locator('section', { hasText: 'The platform' }).first().locator('[data-tree-heading-kind]').innerText().catch(() => '')
    ok('the heading row says its kind in words (“platform”)', /· platform$/.test(kindText.trim()), kindText)
    const none = await page.locator('[data-tree-heading-kind="none"]').first().innerText().catch(() => '')
    ok('…and a heading with no kind says “kind not yet said”', /kind not yet said/.test(none), none)
    const docRow = page.locator(`[data-tree-document="${b.docD}"]`)
    ok('the document carries its open-issue count in words, with a shape (⚑), not colour alone', /⚑ 1 open issue\b/.test(await docRow.innerText()))
    await docRow.locator('button').first().click()
    await page.locator('[data-document-tab="issues"]').click()
    await page.waitForSelector('[data-document-issue]', { timeout: 15_000 })
    const tab = await page.locator('[data-document-issues]').innerText()
    ok(`the Issues tab lists it on its part (${b.docD}.2), with Lex’s reason`, tab.includes(`part ${b.docD.replace(/^D\./, '')}.2`) && /Placed here by Lex: it is about the second part/.test(tab), tab.slice(0, 300))
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  partA()
  const b = await partB().catch((e) => { fail++; ran++; console.log(`  ✗ part B threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
  if (b) { try { await partC(b) } finally { await b.cleanup() } }
  console.log(`\ncheck:lex-26v2c — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead || !ran ? 1 : 0)
}
main()
