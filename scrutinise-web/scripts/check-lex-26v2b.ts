// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26v2b — BRIEF_26V §8 item 6 ("Draft what this heading needs" on scratch: proposals only, resumable, prices recorded) for 26-V2b.
// Counts what RAN (§23.2). Spends NOTHING: every model call here is a fixture.
//
//   A · pure: the five templates, the caveat, the body (refs kept only where cited, D-numbers out, numbers not repeated), measured prices,
//       the plan (order, what is left out and why).
//   B · on a scratch copy of 452c5ade, through the real functions (§25.3): asks first (a price above the agreed one queues nothing), one live
//       row per action and kind, the worker's turn (a PROPOSAL, never a version), resumable (a killed row is put back; failed after two),
//       not needed (already there), stop, the run in words — and the live worker never takes a scratch copy's row.
//   C · the browser: the REAL DocumentsTree in Chromium, answered by the REAL route: the heading button lists the documents with their measured
//       prices, "Draft these — about Np" queues them, and the run line follows them to "Finished".
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26v2b.ts
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import type { callModelJson } from '../lib/lex/model-call'
import * as D from '../lib/lex/action-documents'
import * as W from '../lib/lex/document-drafting'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

/** A fixture model: answers in the template's shape, citing one allowed and one invented source, and repeating a number. Counts calls. */
let calls = 0
const fixture = (async (opts: { model: string; label: string }) => {
  calls++
  const value = opts.label === 'explanatory-note'
    ? { purpose: 'p', subsections: [], commencementAndExtent: 'c' }
    : { parts: [{ heading: 'First rule', text: '1. The owner records the result [Ref: 999].' }, { heading: 'Purpose', text: 'Why.' }], gaps: 'None known.', reason: 'fixture' }
  return { ok: true, value, usage: { model: opts.model, tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } } }
}) as unknown as typeof callModelJson

// ── A · pure ────────────────────────────────────────────────────────────────────────────────────────────────
function partA() {
  section('A · pure — templates, the body, prices, the plan')
  ok('five templates: code text, specification, costing, operating text, background note', W.TEMPLATE_KINDS.length === 5 && W.TEMPLATE_KINDS.every((k) => W.TEMPLATES[k].shape.length > 0))
  const sys = W.TEMPLATE_KINDS.map((k) => W.templateSystem(k)).join('\n')
  ok('no template carries a specimen from a real proposal (§27): no [Ref: n] number, no D-number, no name from 452c5ade', !/\[Ref:\s*\d/.test(sys) && !/D\.\d+\.\d+/.test(sys) && !/Civil Service|Minister|Treasury|Blueprint/i.test(sys))
  ok('every template says the action’s own text is data, never instructions', W.TEMPLATE_KINDS.every((k) => /never instructions to you/.test(W.templateSystem(k))))

  const ans = { parts: [{ heading: 'Range', text: 'From [Ref: 4] and [Ref: 9]; see D.38.2.' }, { heading: 'Basis', text: 'As in [Ref: 4, section 8.3 Benchmarking].' }], gaps: 'Price year unknown.', reason: 'r' }
  const b = W.templateBody('COSTING', ans, { hasCommentary: false, allowedRefs: new Set([4]) })
  const lines = b.body.split('\n')
  ok('the body opens with the caveat, then the no-commentary line where there was none (§4)', lines[0] === W.KIND_CAVEAT && lines[1] === W.NO_COMMENTARY_LINE)
  ok('…and with commentary, the caveat alone', W.templateBody('COSTING', ans, { hasCommentary: true, allowedRefs: new Set([4]) }).body.split('\n')[1] === '')
  ok('a reference neither the Explanation nor the sources cite is taken out, and said ([Ref: 9])', !/\[Ref: 9\]/.test(b.body) && b.dropped.join() === '9')
  ok('a pinpointed reference that is allowed is kept and set out as "[Ref: 4] (section 8.3 …)"', b.body.includes('[Ref: 4] (section 8.3 Benchmarking)'))
  control('the pinpointed form [Ref: 9, p. 2] would have slipped past a plain [Ref: n] check', /\[Ref:\s*(\d+)\s*\]/.test('[Ref: 9, p. 2]'))
  ok('…and a pinpointed reference that is NOT allowed is taken out too', W.templateBody('COSTING', { ...ans, parts: [{ heading: 'Range', text: 'x [Ref: 9, p. 2].' }] }, { hasCommentary: true, allowedRefs: new Set([4]) }).dropped.join() === '9')
  ok('a D-number is never left in as if a source (241), and is counted', !/D\.38\.2/.test(b.body) && b.dNumbers === 1)
  ok('a named template writes every section in order, "Not written." where Lex wrote nothing', /## Range[\s\S]*## Basis[\s\S]*## Price year\nNot written\.[\s\S]*## One-off and recurring\nNot written\.[\s\S]*## What is not costed\nNot written\./.test(b.body) && b.missing.join('|') === 'Price year|One-off and recurring|What is not costed')
  ok('the gaps close the document under their own heading', /## Gaps Lex could not fill\nPrice year unknown\.$/.test(b.body))
  ok('its parts number from the "## " sections (38.4.1 …): five sections and the gaps = 6 parts', D.partsOf('COSTING', b.body).length === 6)
  const num = W.templateBody('OPERATING_TEXT', { parts: [{ heading: 'Who sets it', text: '1. The Minister sets it.' }, { heading: '2. Who records it', text: '(2) The head records it.' }], gaps: '', reason: '' }, { hasCommentary: true, allowedRefs: new Set() })
  ok('a numbered kind numbers its parts once: "## 1. Who sets it" then the text without a second "1."', num.body.includes('## 1. Who sets it\nThe Minister sets it.') && num.body.includes('## 2. Who records it\nThe head records it.'), num.body)

  for (const k of W.TEMPLATE_KINDS) { const p = W.kindPrice(k); ok(`${k}: a MEASURED price (n=${p.n}, about ${p.pence}p)`, p.n >= 2 && p.pence != null && p.pence > 0 && p.pence < 5) }
  ok('the clause and the note use their own measured prices; collision report and schedule are free', W.kindPrice('DRAFT_CLAUSE').n >= 5 && W.kindPrice('EXPLANATORY_NOTE').n >= 3 && W.kindPrice('COLLISION_REPORT').free && W.kindPrice('CONSEQUENTIAL_SCHEDULE').pence === 0)

  const plan = W.draftPlan([
    { id: 'a', number: 1, title: null, missing: ['COLLISION_REPORT', 'DRAFT_CLAUSE'], hasClauseVersion: true, hasSources: false },
    { id: 'b', number: 2, title: null, missing: ['COLLISION_REPORT', 'BACKGROUND_NOTE', 'OPERATING_TEXT'], hasClauseVersion: false, hasSources: false },
  ])
  ok('the plan puts the clause before the report that reads it', plan.items.filter((i) => i.actionId === 'a').map((i) => i.kind).join() === 'DRAFT_CLAUSE,COLLISION_REPORT')
  ok('a collision report with no clause version is left out, with why', plan.leftOut.some((l) => l.actionId === 'b' && l.kind === 'COLLISION_REPORT' && /no clause version/.test(l.why)))
  ok('a background note with no cited source is left out, with why', plan.leftOut.some((l) => l.kind === 'BACKGROUND_NOTE' && /cites no source/.test(l.why)))
  ok('the total is the sum of the measured prices; the generated report adds nothing', plan.pence === Math.round(((W.kindPrice('DRAFT_CLAUSE').pence ?? 0) + (W.kindPrice('OPERATING_TEXT').pence ?? 0)) * 10) / 10 && /1 generated free/.test(plan.line), plan.line)
  const saved = W.KIND_RUNS.CODE_TEXT.splice(0)
  const unmeasured = W.draftPlan([{ id: 'c', number: 3, title: null, missing: ['CODE_TEXT'], hasClauseVersion: false, hasSources: false }])
  W.KIND_RUNS.CODE_TEXT.push(...saved)
  ok('a kind with no measured runs is never offered (§5): "not offered yet"', !unmeasured.items.length && /not offered yet/.test(unmeasured.leftOut[0]?.why ?? ''))
}

// ── B · the queue on a scratch copy ───────────────────────────────────────────────────────────────────────
async function partB() {
  section('B · scratch copy — asks first, proposals only, resumable')
  const copy = await scratchCopy('452c5ade', '26v2b-check')
  const cleanup = () => deleteScratch(copy.id)
  try {
    const tree = await D.documentTree(copy.id)
    const heading = tree.headings.find((h) => h.name === 'Training') ?? tree.headings.find((h) => h.actions.some((a) => a.missing.includes('OPERATING_TEXT')))
    if (!heading) { skip('part B', 'no heading with a missing operating text on the copy'); return { copyId: copy.id, userId: copy.userId, cleanup } }
    const p = await W.planFor(copy.id, { headingId: heading.id })
    ok(`the plan for "${heading.name}" lists its missing documents with measured prices, spending nothing`, p.ok && p.data.items.length > 0 && p.data.items.every((i) => i.pence != null) && calls === 0, JSON.stringify(p.ok ? p.data.line : p))
    if (!p.ok) return { copyId: copy.id, userId: copy.userId, cleanup }
    const before = await prisma.documentDraftJob.count({ where: { ideaId: copy.id } })
    const low = await W.queueDrafting(copy.id, { headingId: heading.id }, copy.userId, Math.max(0, p.data.pence - 1))
    ok('asks first: agreeing less than the measured price queues nothing, and says the price', !low.ok && /The price is now about/.test((low as { error: string }).error) && (await prisma.documentDraftJob.count({ where: { ideaId: copy.id } })) === before)
    const q = await W.queueDrafting(copy.id, { headingId: heading.id }, copy.userId, p.data.pence)
    ok('agreeing the price queues one row per document, each with the price agreed', q.ok && q.data.queued === p.data.items.length && (await prisma.documentDraftJob.count({ where: { ideaId: copy.id, status: 'QUEUED', pricePence: { not: null } } })) === p.data.items.length)
    const again = await W.queueDrafting(copy.id, { headingId: heading.id }, copy.userId, p.data.pence)
    ok('pressing again queues nothing twice (one live row per action and kind)', again.ok && again.data.queued === 0 && again.data.alreadyWaiting === p.data.items.length)
    if (!q.ok) return { copyId: copy.id, userId: copy.userId, cleanup }

    // the live worker's claim (no idea given) never takes a scratch copy's row
    const sneaky = await W.runNextDraftJob('check', { call: fixture, ideaId: copy.id })
    ok('the worker’s own claim skips a scratch copy’s rows unless asked (the copy is flagged, 264): nothing taken', sneaky === null && (await prisma.documentDraftJob.count({ where: { ideaId: copy.id, status: 'QUEUED' } })) === p.data.items.length)

    // the worker's turn, with the fixture model
    const first = await W.runNextDraftJob('check', { call: fixture, ideaId: copy.id, includeScratch: true })
    const row1 = first ? await prisma.documentDraftJob.findUniqueOrThrow({ where: { id: first.id } }) : null
    const doc1 = row1 ? await prisma.actionDocument.findFirst({ where: { actionId: row1.actionId, kind: row1.kind }, include: { versions: true } }) : null
    ok('a turn drafts one row: DONE, with its D-number and outcome in words', !!first && first.settled.status === 'DONE' && /a proposal waiting to be used or set aside/.test(first.settled.outcome) && !!row1?.dNumber && !!row1.finishedAt, JSON.stringify(first?.settled))
    ok('…and what it wrote is a PROPOSAL beside the document — no version (§0)', !!doc1 && doc1.versions.length === 1 && doc1.versions[0].role === 'PROPOSAL' && doc1.versions[0].author === 'LEX' && !doc1.versions[0].answer)
    ok('…opening with the caveat, the invented [Ref: 999] taken out and said', !!doc1 && doc1.versions[0].body.startsWith(W.KIND_CAVEAT) && !/Ref: 999/.test(doc1.versions[0].body) && /\[Ref: 999\]/.test(doc1.versions[0].reason ?? ''))
    const after = await D.documentTree(copy.id)
    const act1 = after.headings.flatMap((h) => h.actions).find((a) => a.id === row1?.actionId)
    ok('the tree no longer lists it as missing, and says Lex’s proposal is waiting', !!act1 && !act1.missing.includes(row1!.kind as never) && act1.documents.some((d) => d.kind === row1!.kind && d.proposalWaiting))

    // RESUMABLE: a worker killed mid-row leaves it RUNNING; the sweep puts it back, and the next turn finishes it
    const victim = await prisma.documentDraftJob.findFirstOrThrow({ where: { ideaId: copy.id, status: 'QUEUED' }, orderBy: { seq: 'asc' } })
    await prisma.documentDraftJob.update({ where: { id: victim.id }, data: { status: 'RUNNING', claimedAt: new Date(Date.now() - W.JOB_STALL_MS - 60_000), attempts: 1 } })
    const fresh = await prisma.documentDraftJob.findFirstOrThrow({ where: { ideaId: copy.id, status: 'QUEUED' }, orderBy: { seq: 'asc' } })
    await prisma.documentDraftJob.update({ where: { id: fresh.id }, data: { status: 'RUNNING', claimedAt: new Date(), attempts: 1 } })
    const s1 = await W.sweepDraftJobs()
    const v1 = await prisma.documentDraftJob.findUniqueOrThrow({ where: { id: victim.id } })
    const f1 = await prisma.documentDraftJob.findUniqueOrThrow({ where: { id: fresh.id } })
    ok('resumable: a row left "drafting now" past the stall time goes back to waiting; one drafting now is left alone', v1.status === 'QUEUED' && f1.status === 'RUNNING' && s1.requeued >= 1)
    await prisma.documentDraftJob.update({ where: { id: fresh.id }, data: { status: 'QUEUED', claimedAt: null } })
    await prisma.documentDraftJob.update({ where: { id: victim.id }, data: { status: 'RUNNING', claimedAt: new Date(Date.now() - W.JOB_STALL_MS - 60_000), attempts: W.JOB_MAX_ATTEMPTS } })
    await W.sweepDraftJobs()
    const v2 = await prisma.documentDraftJob.findUniqueOrThrow({ where: { id: victim.id } })
    ok(`…and after ${W.JOB_MAX_ATTEMPTS} tries it is failed, in words, not tried again`, v2.status === 'FAILED' && /not tried again/.test(v2.outcome ?? ''))

    // not needed: a document that appeared while the row waited is not drafted again
    const waiting = await prisma.documentDraftJob.findFirstOrThrow({ where: { ideaId: copy.id, status: 'QUEUED' }, orderBy: { seq: 'asc' } })
    await D.addDocumentByHand(copy.id, waiting.actionId, { kind: waiting.kind as never, title: 'Written by hand meanwhile', body: '## 1. A rule\nText.' }, { userId: copy.userId, author: 'OWNER' })
    const callsBefore = calls
    const s = await W.runNextDraftJob('check', { call: fixture, ideaId: copy.id, includeScratch: true })
    ok('a document written by hand while its row waited is not drafted again: "not needed", no model call', s?.id === waiting.id && s.settled.status === 'SKIPPED' && /already has/.test(s.settled.outcome) && calls === callsBefore, JSON.stringify(s?.settled))

    // stop
    const run = await W.stopDraftRun(copy.id, q.data.runId)
    const view = await W.draftRunView(copy.id, q.data.runId)
    ok('stop takes out the waiting rows (kept, "stopped"), and the run says so in words', run.ok && run.data.stopped > 0 && !!view && view.finished && /stopped/.test(view.line) && /did not complete/.test(view.line) && /not needed/.test(view.line), view?.line)
    ok('the run line counts what was spent against what was agreed', !!view && /spent 0\.0p of about [\d.]+p agreed/.test(view.line))

    // a generated kind on the worker: free, and said when it cannot run
    const legis = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, avenue: 'LEGISLATIVE', status: 'LIVE' }, select: { id: true } })
    if (legis) {
      await prisma.documentDraftJob.create({ data: { runId: 'check-gen', ideaId: copy.id, actionId: legis.id, kind: 'COLLISION_REPORT', seq: 0, userId: copy.userId } })
      const g = await W.runNextDraftJob('check', { call: fixture, ideaId: copy.id, includeScratch: true })
      ok('a collision report row costs nothing and says why when there is no clause to read', !!g && g.settled.pence === 0 && g.settled.status === 'SKIPPED' && /no drafting instruction yet/.test(g.settled.outcome), JSON.stringify(g?.settled))
    } else skip('the generated row', 'no legislative action on the copy')

    const versions = await prisma.actionDocumentVersion.count({ where: { document: { ideaId: copy.id }, role: 'VERSION', author: 'LEX' } })
    ok('nothing Lex drafted in this run became a version on its own', versions === 0)
    return { copyId: copy.id, userId: copy.userId, cleanup }
  } catch (e) { await cleanup(); throw e }
}

// ── C · the browser ────────────────────────────────────────────────────────────────────────────────────────
async function partC(copyId: string, userId: string) {
  section('C · the browser — "Draft what this heading needs" in the real DocumentsTree, answered by the real route')
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
    const heads = await page.locator('[data-draft-heading]').count()
    ok('every heading with something missing carries "Draft what this heading needs"', heads > 0)
    const section = page.locator('section', { hasText: 'Training' }).first()
    await section.locator('[data-draft-heading]').click()
    await page.waitForSelector('[data-draft-plan] [data-draft-item], [data-draft-plan] [role="alert"]', { timeout: 30_000 })
    const planText = await page.locator('[data-draft-plan]').innerText()
    ok('the dialog lists each missing document by action and kind with its measured price, before anything is spent', /#\d+ — operating text — about [\d.]+p \(measured, n=\d+\)/.test(planText), planText.slice(0, 400))
    const go = await page.locator('[data-draft-go]').innerText()
    ok('the one button names the price: "Draft these — about Np"', /^Draft these — about [\d.]+p$/.test(go), go)
    const rowsBefore = await prisma.documentDraftJob.count({ where: { ideaId: copyId } })
    await page.locator('[data-draft-go]').click()
    await page.waitForSelector('[data-draft-run]', { timeout: 15_000 })
    const queued = (await prisma.documentDraftJob.count({ where: { ideaId: copyId } })) - rowsBefore
    ok('pressing it queues the documents for the worker and shows the run in words', queued > 0 && /waiting/.test(await page.locator('[data-draft-run]').innerText()))
    // play the worker (with the fixture) until the run is drained
    let n = 0
    while (n < 40 && await W.runNextDraftJob('check', { call: fixture, ideaId: copyId, includeScratch: true })) n++
    await page.waitForFunction(() => /^Drafting what is needed — Finished:/.test(document.querySelector('[data-draft-run] p')?.textContent ?? ''), null, { timeout: 20_000 }).catch(() => {})
    const line = await page.locator('[data-draft-run] p').first().innerText()
    ok('the run line follows the worker to "Finished: N of N done"', /Finished: (\d+) of \1 done/.test(line), line)
    await page.waitForFunction((n) => (document.body.innerText.match(/Lex’s proposal waiting/g) ?? []).length >= n, queued, { timeout: 15_000 }).catch(() => {})
    const waitingShown = await page.evaluate(() => (document.body.innerText.match(/Lex’s proposal waiting/g) ?? []).length)
    ok('…and the tree, reloaded as each finished, shows each as "Lex’s proposal waiting"', waitingShown >= queued, `${waitingShown} shown, ${queued} queued`)
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  partA()
  const b = await partB().catch((e) => { fail++; ran++; console.log(`  ✗ part B threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
  if (b) { try { await partC(b.copyId, b.userId) } finally { await b.cleanup() } }
  console.log(`\ncheck:lex-26v2b — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead || !ran ? 1 : 0)
}
main()
