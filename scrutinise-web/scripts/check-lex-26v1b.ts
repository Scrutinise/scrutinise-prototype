// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26v1b — BRIEF_26V1b §8 for V1b-a (items 1–5, 7, 9; 6, 8, 10, 11 come with V1b-b). Counts what RAN (§23.2).
//
//   A · the cold read (§26): 452c5ade as it stands, through readers with no side effect — the Law panel rendered from ideaLawSet (9), D.38.1's
//       header strip against the database (3, after Charlie's use), and "Commentary" nowhere on the record or in a prompt (2).
//   B · on a scratch copy, through the real functions (§25.3): the strip after an Accept and after a later edit (3, 263); the "which action
//       will?" question appearing for a hand "amends" row and going when an instruction amends that Act (9); the record's section order (1);
//       what it touches — SIs and judgments, "none held" where there are none (5).
//   C · the browser: the REAL DocumentView and JumpBand in Chromium, answered by the REAL route handlers on the scratch copy — the comparison
//       (Take this, Take all, Set aside, Save; 7), the Instruction table with the reasoning in its collapsible (4), the touches blocks (5),
//       Accept, and the band's "≡ More" at a narrow width (1).
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26v1b.ts
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import { EMPTY_INSTRUCTION, type DraftInstruction } from '../lib/lex/action-draft-pure'
import * as DR from '../lib/lex/action-draft'
import * as D from '../lib/lex/action-documents'
import { documentView, actionDocuments } from '../lib/lex/document-view'
import { headerStrip, cutClause, takePart, joinClause } from '../lib/lex/document-view-pure'
import { bandStates, detailParts } from '../lib/lex/record-layout-pure'
import { ideaLawSet } from '../lib/lex/statutory-graph'
import { unansweredAmendment, alsoNamedAt, sourceWords } from '../lib/lex/law-panel-words'
import { touchOf } from '../lib/lex/action-touches'
import { SYSTEM_PREFIX } from '../lib/lex/agent/system-prompt'
import { MODEL_TOOLS } from '../lib/lex/agent/tools'
import IdeaLawPanel from '../components/lex/IdeaLawPanel'
import ActionsWorkspace from '../components/lex/ActionsWorkspace'
import * as FP from '../components/lex/FieldsPanel'
import { scratchCopy } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const CRAG = 'ukpga/2010/25', EQUALITY = 'ukpga/2010/15'

const stripOf = (v: Extract<Awaited<ReturnType<typeof documentView>>, { ok: true }>['data']) => headerStrip({
  d: v.doc.d, title: v.doc.title, status: v.doc.status, acceptedV: v.doc.acceptedV,
  current: v.current ? { v: v.current.v, author: v.current.author, fromProposal: v.current.fromProposal, previousAuthor: v.current.previousAuthor } : null,
  law: { live: v.law.live.length + v.law.precedents, targets: v.law.live.map((l) => l.target), precedents: v.law.precedents }, proposalWaiting: v.proposal?.v ?? null,
})

// ── A · cold read ──────────────────────────────────────────────────────────────────────────────────────────────
async function partA() {
  section('A · cold read — 452c5ade as it stands (readers with no side effect; nothing written)')
  const idea = (await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Idea" WHERE id LIKE '452c5ade%'`)[0]
  if (!idea) { skip('the cold read', '452c5ade not found'); return }

  section('A1 · item 9 — the Law panel, rendered from the reader the page calls')
  const set = await ideaLawSet(idea.id, { external: false })
  const html = renderToStaticMarkup(React.createElement(IdeaLawPanel, { set, error: null }))
  const text = textOf(html)
  const instr = set.rows.flatMap((r) => r.sources).filter((s) => s.source === 'drafting_instruction')
  ok('no internal id anywhere on the panel (6a)', !UUID.test(text), (UUID.exec(text) ?? [''])[0])
  control('the panel printing the raw source_detail of an instruction row (must be FALSE)', instr.some((s) => s.sourceDetail && text.includes(s.sourceDetail)))
  const n38 = instr.find((s) => s.action?.number === 38)
  ok('an instruction row reads "From #38’s drafting instruction, version N" (6a)', !!n38 && text.includes(sourceWords(n38)) && /From #38’s drafting instruction, version \d+/.test(text), n38 ? sourceWords(n38) : 'no #38 row')
  const foiWhole = set.rows.find((r) => r.docUri === 'ukpga/2000/36' && !r.provisionPath)
  ok('the whole-Act FOI line says it is also named at Schedule 1, by #38 (6b)', !!foiWhole && alsoNamedAt(set.rows, foiWhole).some((x) => /^schedule 1, relies on, by #38$/.test(x)) && /Also named at: [^.]*schedule 1, relies on, by #38/.test(text))
  const cragAmends = set.rows.find((r) => r.docUri === CRAG && r.relation === 'amends')
  ok('the hand "amends" CRaG line asks "which action will?" — no instruction yet amends CRaG (6c)', !!cragAmends && !!unansweredAmendment(set.rows, cragAmends) && /No action’s instruction yet amends this Act — which action will\?/.test(text))
  const naa = set.rows.find((r) => r.docUri === 'ukpga/1983/44')
  control('the question on a relies-on line (NAA 1983) (must be FALSE)', !!naa && !!unansweredAmendment(set.rows, naa))

  section('A2 · item 3 — D.38.1’s header strip against the database (after Charlie used Lex’s proposal)')
  const a38 = await prisma.lexCoherentAction.findFirst({ where: { ideaId: idea.id, number: 38, status: 'LIVE' }, select: { id: true } })
  const doc = a38 ? await prisma.actionDocument.findFirst({ where: { actionId: a38.id, kind: 'DRAFT_CLAUSE' }, include: { versions: true } }) : null
  if (!a38 || !doc) { skip('D.38.1 strip', 'no D.38.1'); return }
  const v = await documentView(idea.id, doc.id)
  if (!v.ok) { ok('D.38.1 opens', false, (v as { error: string }).error); return }
  const latest = doc.versions.filter((x) => x.role === 'VERSION').sort((a, b) => b.v - a.v)[0]
  const liveRows = await prisma.ideaLawLink.count({ where: { actionId: a38.id, source: 'drafting_instruction', supersededById: null, withdrawnAt: null } })
  const s = stripOf(v.data)
  const line = [...s.pieces, s.status].join(' · ')
  ok('the strip names the version the database holds, and who wrote it', !!latest && line.includes(`version ${latest.v}`) && (latest.author !== 'LEX' || /Lex’s draft \(proposal \d+\), used by you/.test(line)), line)
  ok(`the strip's law-row count is the database's (${liveRows} live rows)`, line.includes(`${liveRows} law row${liveRows === 1 ? '' : 's'} written`), line)
  ok('the status is the database’s, in words (263: used is not accepted)', doc.status === 'ACCEPTED' ? s.status === `accepted (version ${doc.acceptedV})` : s.status === 'not yet accepted' && s.prompt?.includes('Accept when you are content') === true, `${doc.status} → ${s.status}`)

  section('A3 · item 2 — "Commentary" nowhere on the record or in a prompt (257)')
  const literals = (file: string) => (readFileSync(join(ROOT, file), 'utf8').match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? []).map((l) => l.replace(/\$\{[^}]*\}/g, ''))
  const promptFiles = ['lib/lex/agent/system-prompt.ts', 'lib/lex/action-draft.ts', 'lib/lex/action-digest-pure.ts']
  // Code inside a template (`row.commentary`, the column) is not prompt text; and the corpus rule's "history, commentary, what was said in
  // the press" is commentary OUTSIDE the corpus, not the action's box — the one sanctioned use, named here so a new one still fails.
  const OUTSIDE = 'history, commentary, what was said in the press'
  const hits = promptFiles.flatMap((f) => literals(f).map((l) => l.replace(/[\w?.]*\.commentary\b|\bcommentary(Max|Length)\b/g, '').replace(OUTSIDE, ''))
    .filter((l) => /commentary/i.test(l)).map((l) => `${f}: ${(/.{0,40}commentary.{0,40}/is.exec(l) ?? [''])[0]}`))
  ok('no prompt string in the agent, the drafting pass or the digest says "commentary"', hits.length === 0, hits.join(' | '))
  const toolText = JSON.stringify(MODEL_TOOLS.map((t) => [t.name, t.description, Object.keys((t.schema as unknown as { shape?: object }).shape ?? {})]))
  ok('no tool Lex is given is named or described with "commentary" (set_action_detail, add_action’s detail)', !/commentary/i.test(toolText) && /set_action_detail/.test(toolText), (/.{40}commentary.{40}/i.exec(toolText) ?? [''])[0])
  ok('the system prompt names the box Detail', String(SYSTEM_PREFIX).includes('DETAIL (unlimited'))
}

// ── B · scratch ────────────────────────────────────────────────────────────────────────────────────────────────
const LEX_REASON = 'Fixture reasoning paragraph: the second subsection carries the owner’s choice, and the third is added because the duty needs a date. This text must sit in the collapsible, never in a table cell.'
const ins59 = (clause: string, extra: Partial<DraftInstruction> = {}): DraftInstruction => ({
  ...EMPTY_INSTRUCTION, instrument: 'AMENDING_ACT', dutyOnWhom: 'a fixture duty', enforcedHow: 'a fixture route', commencement: 'on a fixture day', extent: ['England and Wales'], purpose: 'A fixture purpose.',
  provisions: [{ docUri: EQUALITY, provisionPath: 'section/149', relation: 'amends', note: 'the duty this removes' }, { docUri: CRAG, provisionPath: 'section/10', relation: 'relies_on', note: 'the merit standard' }],
  clause, ...extra,
})

async function partB(): Promise<{ copyId: string; userId: string; docId: string } | null> {
  section('B · on a scratch copy of 452c5ade — the real functions')
  const copy = await scratchCopy('452c5ade', '26v1b')
  const a59 = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, number: 59, status: 'LIVE' }, select: { id: true } })
  const a202 = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, number: 202, status: 'LIVE' }, select: { id: true } })
  await prisma.lexCoherentAction.updateMany({ where: { id: { in: [a59.id, a202.id] } }, data: { avenue: 'LEGISLATIVE' } })

  section('B1 · item 3 / 263 — the strip after a use, after an Accept, after a later edit')
  await D.writeDraftProposal(copy.id, a59.id, { ...ins59('(1) First, as Lex has it.\n(2) Second.'), at: new Date().toISOString(), reason: LEX_REASON, pence: 0 }, true)
  const used = await DR.acceptProposal(copy.id, a59.id)
  const doc = await prisma.actionDocument.findFirstOrThrow({ where: { actionId: a59.id, kind: 'DRAFT_CLAUSE' } })
  let v = await documentView(copy.id, doc.id)
  let s = v.ok ? stripOf(v.data) : null
  ok('after USING Lex’s proposal: "version 1, Lex’s draft (proposal 1), used by you · 2 law rows written … · not yet accepted — Accept when you are content"',
    used.ok && !!s && s.pieces[2] === 'version 1, Lex’s draft (proposal 1), used by you' && /^2 law rows written: /.test(s.pieces[3] ?? '') && s.status === 'not yet accepted' && s.prompt === 'Accept when you are content', JSON.stringify(s))
  await D.acceptDocument(copy.id, doc.id)
  v = await documentView(copy.id, doc.id); s = v.ok ? stripOf(v.data) : null
  ok('after Accept: "accepted (version 1)", and no prompt to accept', s?.status === 'accepted (version 1)' && s.prompt === null, JSON.stringify(s))
  await DR.saveVersion(copy.id, a59.id, ins59('(1) First, as the owner has it.\n(2) Second.'), { userId: copy.userId, author: 'OWNER' })
  v = await documentView(copy.id, doc.id); s = v.ok ? stripOf(v.data) : null
  ok('after a later edit: "version 2, yours (from Lex’s version 1)" · "accepted at version 1, then changed — accept again"', s?.pieces[2] === 'version 2, yours (from Lex’s version 1)' && s.status === 'accepted at version 1, then changed — accept again', JSON.stringify(s))
  control('the edit erasing the earlier sign-off (acceptedV gone) (must be FALSE)', (await prisma.actionDocument.findUniqueOrThrow({ where: { id: doc.id } })).acceptedV !== 1)
  ok('Versions: each version says what it changed and which law rows it wrote', !!v.ok && v.data.versions.length === 2 && /words \(/.test(v.data.versions[1].changeWords ?? '') && v.data.versions[0].lawWritten.length === 2)

  section('B2 · item 9 — "which action will?" appears for a hand amends row, and goes when an instruction amends the Act')
  await prisma.ideaLawLink.create({ data: { ideaId: copy.id, actionId: null, targetKind: 'act', docUri: CRAG, provisionPath: null, relation: 'amends', source: 'hand', sourceDetail: 'check 26v1b', note: 'fixture: the idea amends CRaG', asAt: new Date() } })
  const before = await ideaLawSet(copy.id, { external: false })
  const htmlBefore = textOf(renderToStaticMarkup(React.createElement(IdeaLawPanel, { set: before, error: null })))
  ok('with only the hand row, the panel asks "which action will?"', /which action will\?/.test(htmlBefore))
  const w = await DR.saveVersion(copy.id, a202.id, { ...ins59('(1) In section 5 of the Constitutional Reform and Governance Act 2010, omit subsection (2).'), provisions: [{ docUri: CRAG, provisionPath: 'section/5', relation: 'amends', note: 'fixture: an amendment to CRaG' }] }, { userId: copy.userId, author: 'OWNER' })
  const after = await ideaLawSet(copy.id, { external: false })
  const htmlAfter = textOf(renderToStaticMarkup(React.createElement(IdeaLawPanel, { set: after, error: null })))
  ok('once #202’s instruction amends CRaG (s.5), the question is gone', w.ok && !/which action will\?/.test(htmlAfter), w.ok ? '' : (w as { error: string }).error)
  ok('…and the whole-Act line says where else CRaG is named: "section 5, amends, by #202"', /Also named at: [^.]*section 5, amends, by #202/.test(htmlAfter))

  section('B3 · item 1 — the record, top to bottom (the real workspace and the real card)')
  const row = await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: a59.id } })
  const act = { ...row, beforeIds: [], targetCauseIds: [], facetProposal: null, policyTest: { verdict: 'FITS', reason: 'It fits.', from: [] }, commentary: 'The owner’s own detail.\n\nParts of this action, quoted\n• [#12] “A merged component” (a component title) — fixture', number: 59, id: 'a59' }
  const html = renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: copy.id, actions: [act] as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Primary legislation', colourKey: 'blue', hidden: false, orderIndex: 0 }] as never,
    causes: [] as never, busy: false, onChanged: () => {}, initiallyOpen: ['a59'], step: 1 as never, costLineActionIds: [],
    renderFull: (x: unknown, st: number, between?: React.ReactNode) => React.createElement(FP.ActionCard, { action: x as never, step: st as never, between, benchmarks: [], costLines: [], busy: false, api: {} as never, costLinesApi: {} as never }),
  }))
  const at = (re: RegExp) => html.search(re)
  const order = [at(/data-statement/), at(/data-jump-band/), at(/data-record-section="policy"/), at(/data-record-section="detail"/), at(/data-record-section="documents"/), at(/data-record-section="law"/), at(/data-record-section="who"/), at(/data-record-section="costs"/), at(/data-record-section="order"/), at(/data-record-section="comments"/)]
  ok('Statement → jump band → policy test → Detail → Documents → Law → Who, how and against → Costs → Order → Comments', order.every((p, i) => p >= 0 && (i === 0 || p > order[i - 1])), order.join(','))
  ok('the band names each section with its state in words, the heading menu at its right', /data-band="documents"/.test(html) && /data-band="comments"/.test(html) && /Heading for action 59/.test(html.slice(at(/data-jump-band/), at(/data-record-section="policy"/))))
  ok('"Detail" is the label, and "Commentary" is nowhere on the record (257)', />Detail<\/p>/.test(html) && !/Commentary/.test(textOf(html)))
  ok('2d: the quoted parts are one collapsible list, "Parts of this action, quoted (1)"', /Parts of this action, quoted \(1\)/.test(textOf(html)) && detailParts(act.commentary).parts[0].title === 'a component title')
  const facts = await actionDocuments(copy.id, a59.id)
  const docsRow = facts.ok ? facts.data : null
  const st = bandStates({ detail: act.commentary, documents: docsRow ? { needed: docsRow.needs.kinds.length, drafted: docsRow.documents.filter((d) => docsRow.needs.kinds.includes(d.kind) && d.current).length, accepted: 0, total: docsRow.documents.length } : null, lawRows: docsRow?.lawRows ?? null, whoAnswered: 0, whoOf: 7, costs: 'not answered', after: [], comments: 0 })
  ok('the band’s states are the data’s: Documents "2 needed, 1 drafted", Law "2 rows", Detail "1 part"', st.documents === '2 needed, 1 drafted' && st.law === '2 rows' && st.detail === '1 part', JSON.stringify(st))

  section('B4 · item 5 — what it touches: SIs made under it, judgments interpreting it, "none held" where there are none')
  const t149 = await touchOf({ docUri: EQUALITY, provisionPath: 'section/149', relation: 'amends', note: '' })
  const t10 = await touchOf({ docUri: CRAG, provisionPath: 'section/10', relation: 'relies_on', note: '' })
  const t153 = await touchOf({ docUri: EQUALITY, provisionPath: 'section/153', relation: 'relies_on', note: '' })
  ok('Equality Act s.149: judgments held (the citator’s case-law rows), each with court, date and the citing paragraph', !!t149.judgments && t149.judgments.cases > 0 && t149.judgments.rows.length > 0 && t149.judgments.rows.every((j) => !!j.court && !!j.paragraph && /^https:\/\/caselaw\.nationalarchives\.gov\.uk\//.test(j.link)), `${t149.judgments?.cases} cases`)
  ok('Equality Act s.149: no instrument is made under it, and it says so — and how many name the Act without a section', !!t149.madeUnder && t149.madeUnder.total === 0 && t149.madeUnder.actLevel > 0)
  ok('Equality Act s.153: the instruments made under it, titled and linked', !!t153.madeUnder && t153.madeUnder.total > 0 && t153.madeUnder.rows.every((r) => !!r.title && r.link.startsWith('https://www.legislation.gov.uk/')))
  ok('CRaG s.10: no judgment held — the block will say "none held", not be empty', !!t10.judgments && t10.judgments.cases === 0 && t10.judgments.failed === null)
  control('a judgment that cites s.1490 counted as citing s.149 (must be FALSE)', !!t149.judgments?.rows.some((j) => /section-1490/.test(j.passage)))

  section('B5 · item 7 (pure) — the working copy: Take this, Take all')
  const asIs = cutClause('Caveat line.\n(1) Mine.\n(2) Also mine.'), lex = cutClause('Caveat line.\n(1) Lex’s.\n(2) Also Lex’s.\n(3) Lex adds.')
  const took = takePart(asIs, lex, 3)
  ok('"Take this" on (3) adds Lex’s (3) and keeps my (1) and (2)', joinClause(took) === 'Caveat line.\n(1) Mine.\n(2) Also mine.\n(3) Lex adds.')
  ok('"Take this" on (1) replaces my (1) only', joinClause(takePart(asIs, lex, 1)) === 'Caveat line.\n(1) Lex’s.\n(2) Also mine.')

  // the browser's fixture: a waiting proposal beside version 2
  await D.writeDraftProposal(copy.id, a59.id, { ...ins59('(1) First, as Lex has it.\n(2) Second.\n(3) Third, Lex adds a date.', { precedents: [{ docUri: 'ukpga/2000/8', provisionPath: 'section/204A', how: 'adapted' }] }), at: new Date().toISOString(), reason: LEX_REASON, pence: 0 }, true)
  return { copyId: copy.id, userId: copy.userId, docId: doc.id }
}

// ── C · the browser ────────────────────────────────────────────────────────────────────────────────────────────
async function partC(copyId: string, userId: string, docId: string) {
  section('C · the browser — the real DocumentView and JumpBand, answered by the real routes on the scratch copy')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/doc-view-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const docsRoute = await import('../app/api/ideas/[id]/action-documents/route')
  const structRoute = await import('../app/api/ideas/[id]/action-structure/route')
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    for (const [glob, handler] of [['**/api/ideas/*/action-documents', docsRoute], ['**/api/ideas/*/action-structure', structRoute]] as const) {
      await page.route(glob, async (r) => {
        const params = { params: Promise.resolve({ id: copyId }) }
        const res = await (handler as { POST: (req: Request, p: typeof params) => Promise<Response> }).POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: r.request().postData() ?? '' }), params)
        await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
      })
    }
    const load = async (dv: Record<string, unknown>) => {
      await page.goto('http://harness.test/')
      await page.evaluate((x) => { (window as unknown as { __dv: unknown }).__dv = x }, dv)
      await page.addScriptTag({ content: bundle })
    }

    // item 1 — the band at a narrow and a wide width
    await load({ mode: 'band', width: 360 })
    await page.waitForSelector('[data-jump-band]')
    await page.waitForTimeout(200)
    ok('the band at 360 px puts the rest under "≡ More"', (await page.locator('[data-band-more]').count()) === 1 && /≡ More/.test(await page.locator('[data-band-more]').innerText()))
    await page.locator('[data-band-more]').click()
    ok('…and "≡ More" opens the rest, each with its state in words', /Comments · 3/.test(await page.locator('[data-band-menu]').innerText()))
    await load({ mode: 'band', width: 1100 })
    await page.waitForSelector('[data-jump-band]')
    await page.waitForTimeout(200)
    control('"≡ More" at 1,100 px, where every button fits (must be FALSE)', (await page.locator('[data-band-more]').count()) > 0)

    // the document view
    await load({ mode: 'view', ideaId: copyId, documentId: docId })
    await page.waitForSelector('[data-document-strip]', { timeout: 30_000 })
    const strip = await page.locator('[data-document-strip]').innerText()
    ok('the strip in the browser: "D.59.1 · … version 2, yours (from Lex’s version 1) · 2 law rows written … · accepted at version 1, then changed — accept again"', /D\.59\.1/.test(strip) && /version 2, yours \(from Lex’s version 1\)/.test(strip) && /2 law rows written/.test(strip) && /accepted at version 1, then changed — accept again/.test(strip), strip.slice(0, 400))
    ok('3g: Lex’s proposal sits beside it in three columns — as it stands · Lex proposes · your working copy', (await page.locator('[data-comparison]').count()) === 1 && /As it stands[\s\S]*Lex proposes[\s\S]*Your working copy/.test(await page.locator('[data-comparison] thead').innerText()))
    await page.locator('[data-take-part="3"]').click()
    await page.locator('[data-save-version]').click()
    await page.waitForFunction(() => /version 3, yours/.test(document.querySelector('[data-document-strip]')?.textContent ?? ''), null, { timeout: 20_000 }).catch(() => {})
    const v3 = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docId, role: 'VERSION', v: 3 } })
    const p2 = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docId, role: 'PROPOSAL', v: 2 } })
    ok('"Take this" on (3), then Save: version 3 is yours — my (1), Lex’s (3) — and Lex’s proposal still waits', !!v3 && v3.author === 'OWNER' && v3.body.includes('(1) First, as the owner has it.') && v3.body.includes('(3) Third, Lex adds a date.') && !!p2 && p2.answer === null, v3?.body.slice(0, 300))
    await page.locator('[data-take-all]').click()
    await page.locator('[data-save-version]').click()
    await page.waitForFunction(() => /version 4, Lex’s draft/.test(document.querySelector('[data-document-strip]')?.textContent ?? ''), null, { timeout: 20_000 }).catch(() => {})
    const v4 = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docId, role: 'VERSION', v: 4 } })
    const p2b = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docId, role: 'PROPOSAL', v: 2 } })
    ok('"Take all", then Save: version 4 is Lex’s whole instruction (its precedent too), and the proposal is answered "used"', !!v4 && v4.author === 'LEX' && JSON.stringify(v4.payload).includes('section/204A') && p2b?.answer === 'ACCEPTED')

    // item 4 — the Instruction tab
    await page.locator('[data-document-tab="instruction"]').click()
    const rows = await page.locator('[data-instruction-row]').count()
    const cells = await page.locator('[data-instruction-table]').innerText()
    ok('4: the provision lines are a TABLE (Act · Provision · What we do · Why), one row each, with Act titles', rows === 2 && /Equality Act 2010/.test(cells) && /section 149/.test(cells) && /relies on/.test(cells))
    ok('4: Lex’s reasoning is in the collapsible "Why Lex drafted it this way", not in the table', !cells.includes('Fixture reasoning paragraph') && (await page.locator('[data-why-lex]').innerText()).includes('Why Lex drafted it this way'))
    ok('4: the precedents are a second table (Act · provision · what we take from it)', /Financial Services and Markets Act 2000|ukpga\/2000\/8/.test(await page.locator('[data-precedent-table]').innerText()))

    // item 5 — the touches tab
    await page.locator('[data-document-tab="touches"]').click()
    await page.waitForSelector('[data-touch-block="judgments"]', { timeout: 60_000 })
    const blocks = await page.locator('[data-touch-block]').allInnerTexts()
    const judg = await page.locator('[data-touch-block="judgments"]').allInnerTexts()
    ok('5: s.149’s judgments block lists judgments, most recent first; CRaG s.10’s says "none held"', judg.length === 2 && /judgments? cite this provision/.test(judg[0]) && /none held/.test(judg[1]), judg.map((j) => j.slice(0, 120)).join(' | '))
    ok('5: s.149’s SIs block says "none held for this provision", with how many name the Act', /none held for this provision; \d+ instruments? name the Act/.test((await page.locator('[data-touch-block="made-under"]').allInnerTexts())[0] ?? ''))
    control('an empty block (a heading with nothing under it) (must be FALSE)', blocks.some((b) => b.split('\n').filter((l) => l.trim()).length < 2))

    // item 7 — Set aside, kept and listed
    await D.writeDraftProposal(copyId, (await prisma.actionDocument.findUniqueOrThrow({ where: { id: docId } })).actionId, { ...ins59('(1) A third proposal.'), at: new Date().toISOString(), reason: 'fixture', pence: 0 }, true)
    await load({ mode: 'view', ideaId: copyId, documentId: docId })
    await page.waitForSelector('[data-set-aside]', { timeout: 30_000 })
    await page.locator('[data-set-aside]').click()
    await page.waitForFunction(() => !document.querySelector('[data-comparison]'), null, { timeout: 20_000 }).catch(() => {})
    const p3 = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docId, role: 'PROPOSAL', v: 3 } })
    await page.locator('[data-document-tab="versions"]').click()
    ok('7: "Set aside" keeps the proposal (answered, not deleted) and Versions lists it as set aside', p3?.answer === 'DISMISSED' && /Lex’s proposal 3 — set aside/.test(await page.locator('[data-versions-tab]').innerText()))

    // Accept from the strip
    await page.locator('[data-document-accept]').click()
    await page.waitForFunction(() => /accepted \(version 4\)/.test(document.querySelector('[data-document-status]')?.textContent ?? ''), null, { timeout: 20_000 }).catch(() => {})
    ok('Accept from the strip: "accepted (version 4)" in the strip and in the database', /accepted \(version 4\)/.test(await page.locator('[data-document-status]').innerText()) && (await prisma.actionDocument.findUniqueOrThrow({ where: { id: docId } })).acceptedV === 4)
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  await partA().catch((e) => { fail++; ran++; console.log(`  ✗ part A threw: ${(e as Error).stack?.slice(0, 800)}`) })
  let copyId: string | null = null
  try {
    const b = await partB().catch((e) => { fail++; ran++; console.log(`  ✗ part B threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
    if (b) { copyId = b.copyId; await partC(b.copyId, b.userId, b.docId) }
  } finally {
    if (copyId) {
      // the hand row this check wrote, then the copy (deleteScratch takes its documents and law rows)
      const { deleteScratch } = await import('./lib/scratch-copy')
      await prisma.ideaLawLink.updateMany({ where: { ideaId: copyId }, data: { supersededById: null } }).catch(() => {})
      await prisma.ideaLawLink.deleteMany({ where: { ideaId: copyId } }).catch(() => {})
      await deleteScratch(copyId).catch((e) => console.log(`  ⚠ the scratch copy was not deleted: ${(e as Error).message}`))
    }
  }
  console.log(`\ncheck:lex-26v1b — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead || !ran ? 1 : 0)
}
main()
