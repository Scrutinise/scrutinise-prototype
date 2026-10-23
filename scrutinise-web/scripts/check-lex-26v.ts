// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26v — BRIEF_26V §8 for 26-V1 (items 1–5; 6–7 come with 26-V2). Counts what RAN (§23.2).
//
//   A · the cold read (§26): 452c5ade as it stands, read with the plain client, nothing written — 26-U's drafts are documents, the record
//       carries none, the frozen copy is kept, #203 holds the schedule.
//   B · on a scratch copy, through the real functions (§25.3): the move (1), the cascade (2), "needs a document" (3), D-numbers in the pack
//       and in Lex's honesty check (4).
//   C · the browser (5): the REAL DocumentsTree in Chromium, answered by the REAL route handlers on the scratch copy.
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26v.ts
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import { EMPTY_INSTRUCTION, CLAUSE_CAVEAT } from '../lib/lex/action-draft-pure'
import * as DR from '../lib/lex/action-draft'
import * as D from '../lib/lex/action-documents'
import { checkReply, citesDNumberAsAuthority } from '../lib/lex/agent/honesty'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const CRAG = 'ukpga/2010/25'

// ── A · the cold read ──────────────────────────────────────────────────────────────────────────────────────────
async function partA() {
  section('A · cold read — 452c5ade as it stands (plain client, nothing written)')
  const idea = (await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Idea" WHERE id LIKE '452c5ade%'`)[0]
  if (!idea) { skip('the cold read', '452c5ade not found'); return }
  for (const n of [38, 202]) {
    const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: idea.id, number: n }, select: { id: true, record: true } })
    const docs = a ? await prisma.actionDocument.findMany({ where: { actionId: a.id }, include: { versions: true } }) : []
    const clause = docs.find((d) => d.kind === 'DRAFT_CLAUSE')
    const rec = (a?.record ?? {}) as { draft?: unknown; draftBefore26V?: { proposal?: { clause?: string } } }
    ok(`#${n}: 26-U's draft is document ${n}.1 (D.${n}.1), a draft clause`, !!clause && clause.number === 1, JSON.stringify(docs.map((d) => [d.kind, d.number])))
    ok(`#${n}: …holding Lex's proposal, unanswered, and no version (nothing was ever accepted)`, !!clause && clause.versions.filter((v) => v.role === 'PROPOSAL' && !v.answer).length === 1 && clause.versions.filter((v) => v.role === 'VERSION').length === 0)
    ok(`#${n}: the record carries no draft; the copy from before the move is kept, frozen, with the same clause`, !rec.draft && !!rec.draftBefore26V?.proposal?.clause && clause?.versions[0]?.body === rec.draftBefore26V.proposal.clause)
    control(`#${n}: a second live copy of the draft in the record (must be FALSE)`, !!rec.draft)
  }
  const holder = await prisma.lexCoherentAction.findFirst({ where: { ideaId: idea.id, number: 203 }, select: { id: true, record: true } })
  const needs = holder ? D.needsOverrideOf(holder.record) : null
  ok('#203 is set to hold the consequential schedule, with its reason recorded (233)', !!needs && needs.mode === 'set' && !!needs.kinds?.includes('CONSEQUENTIAL_SCHEDULE') && /233/.test(needs.reason))
  const sched = holder ? await prisma.actionDocument.findMany({ where: { actionId: holder.id, kind: 'CONSEQUENTIAL_SCHEDULE' } }) : []
  ok('…and holds exactly one schedule document', sched.length === 1)
}

// ── B · scratch: the real functions ────────────────────────────────────────────────────────────────────────────
function cascade(extraDepth4 = 0): D.EffectRow[] {
  // Charlie's case (§2c): 10 effects; two of them knock on to 10 more each; three of THOSE to 5 each = 10 + 20 + 15 = 45, at three depths.
  const rows: D.EffectRow[] = []
  const add = (depth: number, parent: number | null, k: number) => { const i = rows.length; rows.push({ i, depth, parent, relation: 'amends', docUri: `ukpga/2000/${depth}${k}`, provisionPath: `section/${k}`, actTitle: `Fixture Act ${depth}`, state: 'held', note: '', effects: [] }); return i }
  const d1 = Array.from({ length: 10 }, (_, k) => add(1, null, k))
  const d2 = [d1[0], d1[1]].flatMap((p) => Array.from({ length: 10 }, (_, k) => add(2, p, k)))
  const d3 = [d2[0], d2[1], d2[2]].flatMap((p) => Array.from({ length: 5 }, (_, k) => add(3, p, k)))
  for (let k = 0; k < extraDepth4; k++) add(4, d3[0], k)
  return rows
}

async function partB(): Promise<{ copyId: string; userId: string; cleanup: () => Promise<void> } | null> {
  section('B · on a scratch copy of 452c5ade — the real functions')
  const copy = await scratchCopy('452c5ade', '26v')
  const owner = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, number: 59, status: 'LIVE' }, select: { id: true } })
  const other = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, number: 38, status: 'LIVE' }, select: { id: true } })
  await prisma.lexCoherentAction.updateMany({ where: { id: { in: [owner.id, other.id] } }, data: { avenue: 'LEGISLATIVE' } })

  section('B1 · the move: the instruction + clause is document 59.1; what it touches is document 59.2')
  const ins = { ...EMPTY_INSTRUCTION, instrument: 'AMENDING_ACT' as const, dutyOnWhom: 'a fixture duty', clause: '(1) A fixture subsection.\n(2) A second fixture subsection.', provisions: [{ docUri: CRAG, provisionPath: 'section/5', relation: 'amends' as const, note: 'fixture' }] }
  const s1 = await DR.saveVersion(copy.id, owner.id, ins, { userId: copy.userId, author: 'OWNER' })
  const docs1 = await prisma.actionDocument.findMany({ where: { actionId: owner.id }, include: { versions: true } })
  const clause = docs1.find((d) => d.kind === 'DRAFT_CLAUSE')
  ok('saving the instruction writes document 1 of the action, a draft clause, version 1 by the owner, the caveat first', s1.ok && !!clause && clause.number === 1 && clause.versions.length === 1 && clause.versions[0].author === 'OWNER' && clause.versions[0].body.startsWith(CLAUSE_CAVEAT))
  const rec1 = (await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } })).record as { draft?: unknown } | null
  ok('…and nothing is written into the action’s record', !rec1?.draft)
  ok('…its parts are its numbered subsections: 59.1.1 and 59.1.2', D.partsOf('DRAFT_CLAUSE', clause!.versions[0].body).map((p) => p.title).join('|') === 'subsection (1)|subsection (2)')
  const g1 = await D.generateCollisionReport(copy.id, owner.id)
  ok('the collision report is generated as document 2 (D.59.2), from the clause’s own lines, at depth 1', g1.ok && g1.data.d === 'D.59.2' && g1.data.rows === 1 && !g1.data.unchanged, JSON.stringify(g1))
  const rep = await prisma.actionDocument.findFirstOrThrow({ where: { actionId: owner.id, kind: 'COLLISION_REPORT' }, include: { versions: true } })
  const rows1 = (rep.versions[0].payload as unknown as { rows: D.EffectRow[] }).rows
  ok('…its row is CRaG s.5, depth 1, with GRAPH 6’s split as the reader returned it, and the version is GENERATED (no model)', rows1[0]?.docUri === CRAG && rows1[0].depth === 1 && rows1[0].effects.length > 0 && rep.versions[0].author === 'GENERATED')
  ok('…and it says depths 2 and 3 are not yet supplied (252)', rep.versions[0].body.includes(D.DEPTH_NOTE))
  const g1b = await D.generateCollisionReport(copy.id, owner.id)
  ok('generating again with nothing changed writes nothing ("unchanged")', g1b.ok && g1b.data.unchanged && (await prisma.actionDocumentVersion.count({ where: { documentId: rep.id } })) === 1)

  const accepted = await D.acceptDocument(copy.id, clause!.id)
  ok('Accept marks D.59.1 accepted at version 1', accepted.ok && (await prisma.actionDocument.findUniqueOrThrow({ where: { id: clause!.id } })).status === 'ACCEPTED')
  const s2 = await DR.saveVersion(copy.id, owner.id, { ...ins, dutyOnWhom: 'a fixture duty, revised' }, { userId: copy.userId, author: 'OWNER' })
  const c2 = await prisma.actionDocument.findUniqueOrThrow({ where: { id: clause!.id }, include: { versions: true } })
  ok('a new version takes it back to "drafted, not accepted", and BOTH versions are kept', s2.ok && c2.status === 'DRAFTED' && c2.acceptedV === null && c2.versions.filter((v) => v.role === 'VERSION').length === 2)
  const tree1 = await D.documentTree(copy.id, { recordStale: true })
  const repRow = tree1.headings.flatMap((h) => h.actions).find((a) => a.id === owner.id)?.documents.find((d) => d.kind === 'COLLISION_REPORT')
  ok('the collision report is now out of date, and says why in words (251)', !!repRow?.stale && /the clause now has version 2/.test(repRow.stale), repRow?.stale ?? 'not stale')
  ok('…the mark is recorded on the document', !!(await prisma.actionDocument.findUniqueOrThrow({ where: { id: rep.id } })).staleAt)
  const draftNow = await DR.draftOfAction(owner.id)
  ok('26-U’s readers see the same draft through the store (2 versions, the latest the revised one)', draftNow?.versions.length === 2 && draftNow.versions[1].dutyOnWhom === 'a fixture duty, revised')

  section('B2 · the cascade: rows with a depth, never nested documents (245, 246)')
  const fx = cascade()
  ok('the fixture is 10 + 20 + 15 = 45 rows at three depths', fx.length === 45 && [1, 2, 3].map((d) => fx.filter((r) => r.depth === d).length).join(',') === '10,20,15')
  const shown = D.displayRows(fx)
  ok('all 45 print, each depth beneath its parent, with no "further" line', shown.shown.length === 45 && !shown.furtherLine && shown.shown.findIndex((r) => r.parent === 0) === 1)
  const deeper = D.displayRows(cascade(4))
  ok('a fourth depth is NOT printed: "and 4 further effects — see the schedule"', deeper.shown.length === 45 && deeper.furtherLine === 'and 4 further effects — see the schedule')
  control('a depth-4 row printed in the report (must be FALSE)', deeper.shown.some((r) => r.depth > 3))
  const g2 = await D.generateCollisionReport(copy.id, other.id, { rows: cascade(4) }).catch((e) => ({ ok: false as const, error: String(e) }))
  if (!g2.ok) {
    // #38 on the scratch copy has no accepted version: give it one, so the report has an instruction to stand on.
    await DR.saveVersion(copy.id, other.id, { ...ins, provisions: [] }, { userId: copy.userId, author: 'OWNER' })
  }
  const g2b = g2.ok ? g2 : await D.generateCollisionReport(copy.id, other.id, { rows: cascade(4) })
  const reports38 = await prisma.actionDocument.findMany({ where: { actionId: other.id, kind: 'COLLISION_REPORT' }, include: { versions: true } })
  ok('ONE collision report for the action, holding all 49 rows — no document nested inside it', g2b.ok && reports38.length === 1 && ((reports38[0].versions.at(-1)!.payload as { rows: unknown[] }).rows.length === 49))
  ok('…its text stops at depth three with the "see the schedule" line', reports38[0].versions.at(-1)!.body.includes('and 4 further effects — see the schedule'))
  const sched = await D.generateSchedule(copy.id)
  const schedAgain = await D.generateSchedule(copy.id)
  ok('generating the schedule again with nothing changed writes nothing ("unchanged")', schedAgain.ok && schedAgain.data.unchanged)
  const sDoc = await prisma.actionDocument.findMany({ where: { ideaId: copy.id, kind: 'CONSEQUENTIAL_SCHEDULE' }, include: { versions: { orderBy: { v: 'desc' }, take: 1 } } })
  const sRows = (sDoc[0]?.versions[0]?.payload as { rows?: Array<{ depth: number; from: string }> } | null)?.rows ?? []
  ok('the schedule (on #203) holds every row FLATTENED: 49 from #38’s report and 1 from #59’s, depth 4 included', sched.ok && sDoc.length === 1 && sRows.length === 50 && sRows.some((r) => r.depth === 4) && sRows.some((r) => r.from === 'D.59.2'), JSON.stringify(sched))
  ok('…as one document, counted per Act', sDoc.length === 1 && /effects? across \d+ Acts?/.test(sDoc[0].versions[0].body))

  section('B3 · "needs a document": derived from avenue and instrument; overridden only with a reason')
  const needs = (avenue: string | null, instrument: string | null) => D.needsDocuments({ avenue, instrument: instrument as never }).kinds.join('+')
  ok('legislative → draft clause + collision report', needs('LEGISLATIVE', 'AMENDING_ACT') === 'DRAFT_CLAUSE+COLLISION_REPORT')
  ok('a code (statutory or management) → code text', needs('LEGISLATIVE', 'STATUTORY_CODE') === 'CODE_TEXT' && needs('ORGANISATIONAL', 'MANAGEMENT_CODE') === 'CODE_TEXT')
  ok('financial → costing; organisational → operating text', needs('FINANCIAL', null) === 'COSTING' && needs('ORGANISATIONAL', null) === 'OPERATING_TEXT')
  ok('no avenue → nothing derived, and the line says so (not "needs nothing")', needs(null, null) === '' && /no avenue chosen/.test(D.needsDocuments({ avenue: null, instrument: null }).why))
  const noReason = await D.setNeeds(copy.id, owner.id, { mode: 'nothing', reason: ' ' }, copy.userId)
  ok('"needs nothing" without a reason is refused, in words', !noReason.ok && /Say why/.test((noReason as { error: string }).error))
  const withReason = await D.setNeeds(copy.id, owner.id, { mode: 'nothing', reason: 'a fixture reason' }, copy.userId)
  const o = D.needsOverrideOf((await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } })).record)
  ok('…with one, it is recorded with the reason, who and when', withReason.ok && o?.mode === 'nothing' && o.reason === 'a fixture reason' && o.by === copy.userId && !!o.at)
  await D.setNeeds(copy.id, owner.id, { mode: 'derived' }, copy.userId)
  ok('…and "work it out" again removes the override', D.needsOverrideOf((await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } })).record) === null)

  section('B4 · D-numbers: never a source; printed with their status; refused as authority')
  const { buildProposalSnapshot } = await import('../lib/documents/proposal-snapshot')
  const { buildFor } = await import('../lib/documents/proposal-export')
  const snap = await buildProposalSnapshot(copy.id)
  const model = buildFor('ACTIONS_PACK', snap, null, { selection: { actionIds: [owner.id, other.id] } }).model
  const blocks = model.blocks as Array<{ kind: string; title?: string; refs?: Array<{ title: string; citation: string }> }>
  const iS = blocks.findIndex((b) => b.kind === 'section' && b.title === 'SOURCES'), iD = blocks.findIndex((b) => b.kind === 'section' && b.title === 'DOCUMENTS')
  ok('the pack prints Sources and Documents as two separate lists, Documents after Sources', iS >= 0 && iD > iS)
  const sourcesText = JSON.stringify(blocks.slice(iS, iD))
  ok('…no D-number appears in the Sources list', !/\bD\.\d+\.\d+/.test(sourcesText))
  const docsText = JSON.stringify(blocks.slice(iD))
  ok('…the Documents list names D.59.1 with its status in words', /D\.59\.1, drafted, not accepted/.test(docsText) && /D\.59\.2, drafted, not accepted, out of date/.test(docsText), docsText.slice(0, 300))
  const all = JSON.stringify(blocks)
  ok('each action’s documents print after its record (section 14 "Documents")', /14 Documents|\.14[^"]{0,4}"?[^"]{0,20}Documents/.test(all) || all.includes('Documents:'))
  const known = new Set<string>()
  const bad1 = checkReply({ reply: 'Under D.59.1, every body must publish its goals.', outcomes: [], knownLabels: known })
  const bad2 = checkReply({ reply: 'Every body must publish its goals [Ref: D.59.1].', outcomes: [], knownLabels: known })
  const bad3 = checkReply({ reply: 'D.59.1 requires every body to publish its goals.', outcomes: [], knownLabels: known })
  ok('Lex’s honesty check refuses a D-number cited as authority ("under D.59.1", "[Ref: D.59.1]", "D.59.1 requires")', [bad1, bad2, bad3].every((v) => v.some((x) => x.kind === 'dnumber-as-authority')))
  const fine = checkReply({ reply: 'D.59.1, drafted, not accepted, is under the action’s Draft text; the duty itself comes from CRaG 2010 s.5 [Ref: 4].', outcomes: [], knownLabels: known })
  control('naming a D-number with its status (not as authority) refused (must be FALSE)', fine.some((x) => x.kind === 'dnumber-as-authority'))
  ok('the pure test agrees', citesDNumberAsAuthority('According to D.38.2 the Act is amended.') && !citesDNumberAsAuthority('D.38.2 is the collision report.'))

  const cleanup = async () => {
    await prisma.ideaLawLink.updateMany({ where: { ideaId: copy.id }, data: { supersededById: null } })
    await prisma.ideaLawLink.deleteMany({ where: { ideaId: copy.id } })
    await deleteScratch(copy.id)
  }
  return { copyId: copy.id, userId: copy.userId, cleanup }
}

// ── C · the browser ───────────────────────────────────────────────────────────────────────────────────────────
async function partC(copyId: string, userId: string) {
  section('C · the browser — the real DocumentsTree, answered by the real route on the scratch copy')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/docs-tree-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
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
      const params = { params: Promise.resolve({ id: copyId }) }
      const res = req.method() === 'GET'
        ? await route.GET(new Request('http://internal.invalid/'), params)
        : await route.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: req.postData() ?? '' }), params)
      await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
    })
    await page.goto('http://harness.test/')
    await page.evaluate((id) => { (window as unknown as { __tree: unknown }).__tree = { ideaId: id, readOnly: false } }, copyId)
    await page.addScriptTag({ content: bundle })
    await page.waitForSelector('[data-tree-counts]', { timeout: 30_000 })
    const tree = await D.documentTree(copyId)
    const expected = D.treeCounts(tree.headings.flatMap((h) => h.actions).map((a) => ({ needs: a.needs, documents: a.documents.map((d) => ({ kind: d.kind, status: d.status })) }))).line
    const shownCounts = await page.locator('[data-tree-counts]').innerText()
    ok('the counts at the top are the store’s own ("N actions · N need documents · N drafted · N accepted · N missing")', shownCounts === expected, `${shownCounts} vs ${expected}`)
    ok('D.59.1 and D.59.2 are in the tree with their status in words', (await page.locator('[data-tree-document="D.59.1"] [data-doc-status]').innerText()) === 'drafted, not accepted' && (await page.locator('[data-tree-document="D.59.2"]').count()) === 1)
    await page.locator('[data-tree-filter="missing"]').click()
    const missingRows = await page.locator('[data-tree-action]').count()
    const expectMissing = tree.headings.flatMap((h) => h.actions).filter((a) => a.missing.length).length
    ok('the "Missing" filter shows exactly the actions with a needed document missing', missingRows === expectMissing, `${missingRows} vs ${expectMissing}`)
    await page.locator('[data-tree-filter="all"]').click()
    await page.locator('input[aria-label="Find in the documents"]').fill('D.59.2')
    ok('the find box finds by D-number: one action', (await page.locator('[data-tree-action]').count()) === 1)
    await page.locator('input[aria-label="Find in the documents"]').fill('')
    await page.locator('[data-tree-document="D.59.1"] button').first().click()
    await page.waitForSelector('[data-document-view="D.59.1"]')
    const view = await page.locator('[data-document-view="D.59.1"]').innerText()
    ok('clicking D.59.1 opens it in place: its version, its parts 59.1.1 and 59.1.2, its versions list', /Version 2, by the owner/.test(view) && (await page.locator('[data-document-part="59.1.1"]').count()) === 1 && (await page.locator('[data-document-part="59.1.2"]').count()) === 1 && /Versions: 1 .* 2 /.test(view), view.slice(0, 300))
    await page.locator('[data-document-view="D.59.1"] button:has-text("Ask Lex to redraft")').click()
    ok('"Ask Lex to redraft" asks first, with the measured price, before any call', /costs about [\d.]+p \(measured, n=\d+\)/.test(await page.locator('[data-redraft-ask]').innerText()))
    await page.locator('[data-redraft-ask] button:has-text("Not now")').click()
    await page.locator('[data-document-view="D.59.1"] button:has-text("Accept version 2")').click()
    await page.waitForFunction(() => document.querySelector('[data-tree-document="D.59.1"] [data-doc-status]')?.textContent === 'accepted', null, { timeout: 15_000 }).catch(() => {})
    ok('Accept in the browser marks it "accepted" (word, not colour)', (await page.locator('[data-tree-document="D.59.1"] [data-doc-status]').innerText()) === 'accepted')
    const vs = await prisma.actionDocumentVersion.count({ where: { document: { ideaId: copyId, kind: 'DRAFT_CLAUSE', number: 1, actionId: (await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copyId, number: 59 } })).id } } })
    ok('…and every version is kept', vs === 2)
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  await partA()
  const b = await partB().catch((e) => { fail++; ran++; console.log(`  ✗ part B threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
  if (b) { try { await partC(b.copyId, b.userId) } finally { await b.cleanup() } }
  console.log(`\ncheck:lex-26v — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead || !ran ? 1 : 0)
}
main()
