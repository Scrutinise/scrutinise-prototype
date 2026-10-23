// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26v1b — BRIEF_26V1b §8, all twelve items: V1b-a (1–5, 7, 9) in A–C, V1b-b (6, 8, 10, 11) in D–E. Counts what RAN (§23.2).
//   D · the three views on the real held text of s.149 (6), the parser's coverage on 452c5ade (cold, §4c), Order by dependency with a
//       circle refused (11), the explanatory note (8; its document write is NOT RUN until the widened CHECK is applied — it ships with the code).
//   E · the browser: the board's drag to re-head, drag to merge and the "pair" outline (10); the three views' toggle (6).
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
// V1b-b
import * as TA from '../lib/lex/textual-amendment-pure'
import * as TO from '../lib/lex/action-touches'
import * as AV from '../components/lex/AmendmentViews'
import * as OV from '../components/lex/ActionsOrder'
import * as S from '../lib/lex/action-structure'
import { becauseOf } from '../lib/lex/action-order-pure'
import { computeCanonicalState } from '../lib/lex/state'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildActionsPackDocument } from '../lib/documents/build-actions-pack'
import { NOTE_CAVEAT } from '../lib/lex/action-documents-pure'
import { NOTE_RUNS, notePrice, noteBody } from '../lib/lex/explanatory-note-pure'
import { noteAskWords } from '../components/lex/DocumentView'

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
  // 26-V1b §5 (259): the clause was accepted at version 1 (B1), so it now needs its explanatory note too — three needed, not two.
  ok('the band’s states are the data’s: Documents "3 needed, 1 drafted" (an accepted clause needs its explanatory note, 259), Law "2 rows", Detail "1 part"', st.documents === '3 needed, 1 drafted' && st.law === '2 rows' && st.detail === '1 part' && !!docsRow?.needs.kinds.includes('EXPLANATORY_NOTE'), JSON.stringify(st))

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

// ── D · V1b-b: items 6, 8, 11 — real functions on the scratch copy, and the parser's coverage on 452c5ade (cold) ─────────────────────
const FIX_SUBST = '(1) In section 149 of the Equality Act 2010 (public sector equality duty)—\n(a) for subsection (2) substitute—\n“(2) A fixture person exercising public functions must have regard to the fixture matters.”;\n(b) omit subsection (4);\n(c) after subsection (6) insert—\n“(6A) A fixture subsection inserted by the check.”'
const FIX_MISS = '(1) In section 149 of the Equality Act 2010, for “a fixture phrase the Act does not contain” substitute “anything at all”.'
const FIX_MOD = '(1) The Fixture Regulations 2011 (S.I. 2011/9999) have effect as if they did not apply to a fixture body.'
const S149 = { docUri: EQUALITY, provisionPath: 'section/149', relation: 'amends' as const, note: 'fixture' }

async function partD(copyId: string, userId: string): Promise<{ a202: string; a38: string; a59: string; heading: string; doc202: string } | null> {
  section('D1 · item 6 — the three views, on the REAL held text of Equality Act 2010 s.149 (the §4d fixture)')
  const held = await TO.heldSectionText(EQUALITY, 'section/149')
  if (!held.text) { skip('the three views', `s.149 is not held: ${held.reason}`); return null }
  const lines = TA.heldLines(held.text, '149')
  ok('the held text reads back into numbered lines: (1)…(9), with (1)’s paragraphs (a)–(c)', lines.filter((l) => l.at.para == null).map((l) => l.at.sub).join(',') === '1,2,3,4,5,6,7,8,9' && lines.filter((l) => l.at.sub === '1' && l.at.para).map((l) => l.at.para).join('') === 'abc', lines.map((l) => l.label).join(''))
  const p = TA.parseAmendments(FIX_SUBST)
  ok('the fixture parses: one amendment to s.149 of the Equality Act 2010, three operations (substitute, omit, insert)', p.amendments.length === 1 && p.amendments[0].section === '149' && p.amendments[0].ops.map((o) => o.kind).join(',') === 'substitute-unit,omit-unit,insert-after' && !p.unparsed.length, JSON.stringify(p))
  const m = TA.applyAmendments(lines, p.amendments[0].ops, 'section 149')
  ok('marked up: (2) substituted (old struck, new underlined), (4) omitted, (6A) inserted — each changed line labelled in words', m.findings.length === 0 && m.applied === 3
    && m.lines.some((l) => l.label === '(2)' && l.change === 'substituted' && l.segs.every((s) => s.k === 'omitted')) && m.lines.some((l) => l.label === '(2)' && l.insertedLine && l.change === 'substituted')
    && m.lines.some((l) => l.label === '(4)' && l.change === 'omitted') && m.lines.some((l) => l.label === '(6A)' && l.change === 'inserted'), JSON.stringify(m.findings))
  const stands = TA.asItStands(lines).join('\n'), amended = TA.asAmended(m).join('\n')
  ok('as it stands is the held text: the old (2) and (4) are there; no (6A)', /\(2\) A person who is not a public authority/.test(stands) && /\(4\) The steps involved/.test(stands) && !/\(6A\)/.test(stands))
  ok('as amended: the new (2) and (6A) are in; the old (2) and (4) are gone; (6) is followed by (6A)', /\(2\) A fixture person/.test(amended) && /\(6\)[^\n]*\n\(6A\) A fixture subsection/.test(amended) && !/A person who is not a public authority/.test(amended) && !/\(4\) The steps involved/.test(amended))
  const titles = { [EQUALITY]: 'Equality Act 2010' }, heldMap = { [`${EQUALITY}|section/149`]: held }
  const html = renderToStaticMarkup(React.createElement(AV.default, { clause: FIX_SUBST, provisions: [S149], titles, held: heldMap }))
  const words = [...html.matchAll(/data-change-word="?[^>]*>([a-z]+)</g)].map((x) => x[1])
  ok('rendered: the toggle of three buttons, and the change words on the screen — substituted, omitted, inserted — with <del> and <ins>', /As it stands[\s\S]*Marked up[\s\S]*As amended/.test(textOf(html)) && ['substituted', 'omitted', 'inserted'].every((w) => words.includes(w)) && /<del/.test(html) && /<ins/.test(html), words.join(','))
  control('a changed line drawn with no change word beside it (colour or style alone) (must be FALSE)', m.lines.filter((l) => l.segs.some((s) => s.k !== 'same')).length > words.length)
  const miss = TA.applyAmendments(lines, TA.parseAmendments(FIX_MISS).amendments[0]?.ops ?? [], 'section 149')
  const missHtml = textOf(renderToStaticMarkup(React.createElement(AV.default, { clause: FIX_MISS, provisions: [S149], titles, held: heldMap })))
  ok('an unmatched substitute: "the words ‘…’ were not found in section 149 as held; the marked-up view cannot be drawn — check the clause", and the side-by-side', /^the words ‘a fixture phrase the Act does not contain’ were not found in section 149 as held; the marked-up view cannot be drawn for it — check the clause\.$/.test(miss.findings[0] ?? '') && /were not found in section 149 as held/.test(missHtml) && /As it stands[\s\S]*The clause/.test(missHtml), miss.findings.join(' | '))
  const mod = TA.parseAmendments(FIX_MOD)
  const modHtml = textOf(renderToStaticMarkup(React.createElement(AV.default, { clause: FIX_MOD, provisions: [{ docUri: 'uksi/2011/9999', provisionPath: null, relation: 'modifies', note: '' }], titles: {}, held: {} })))
  ok('a modifies clause: "as proposed", with the non-textual line', !mod.amendments.length && mod.nonTextual.length === 1 && AV.proposedLine(false, true) === 'As proposed — a non-textual modification; nothing to mark up.' && /A non-textual modification: the Fixture Regulations 2011 \(S\.I\. 2011\/9999\) are not amended; they are read differently for these bodies\./.test(modHtml), modHtml.slice(0, 300))
  control('the views drawn for a modifies clause (must be FALSE)', /data-amendment-toggle/.test(renderToStaticMarkup(React.createElement(AV.default, { clause: FIX_MOD, provisions: [], titles: {}, held: {} }))))

  section('D2 · §4c — the parser’s coverage on the real clauses of 452c5ade (cold: a plain read, nothing written)')
  const real = await prisma.$queryRawUnsafe<Array<{ n: number; role: string; v: number; clause: string | null }>>(`SELECT a.number AS n, v.role, v.v, v.payload->>'clause' AS clause FROM action_document d JOIN "LexCoherentAction" a ON a.id = d.action_id JOIN action_document_version v ON v.document_id = d.id WHERE d.idea_id LIKE '452c5ade%' AND d.kind = 'DRAFT_CLAUSE' ORDER BY a.number, v.role, v.v`)
  const cov = TA.coverage(real.map((r) => r.clause ?? ''))
  console.log(`    coverage: ${real.length} clause texts · ${cov.amendments} amendments parse (${cov.ops} operations) · ${cov.unparsed.length} do not · ${cov.nonTextual} non-textual${cov.unparsed.map((u) => `\n      not read: (${u.part}) ${u.why}`).join('')}`)
  ok('every textual amendment Lex has drafted on 452c5ade parses (none unread), and #202 v2’s regulations line is read as non-textual', real.length > 0 && cov.amendments >= 2 && cov.unparsed.length === 0 && cov.nonTextual >= 1, JSON.stringify(cov))
  const v1 = real.find((r) => r.n === 202 && r.role === 'PROPOSAL' && r.v === 1)
  const v1m = v1 ? TA.applyAmendments(lines, TA.parseAmendments(v1.clause ?? '').amendments[0]?.ops ?? [], 'section 149') : null
  ok('a real finding: #202’s proposal 1 inserts a subsection (8) at the end, but s.149 as held already has a (8) — said in words', !!v1m && v1m.findings.some((f) => /inserts a subsection \(8\), but section 149 as held already has a subsection \(8\)/.test(f)), v1m?.findings.join(' | '))

  section('D3 · item 11 — Order by dependency only: "must come after", a because line, a circle refused in words (262)')
  const num = async (n: number) => (await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copyId, number: n, status: 'LIVE' }, select: { id: true } })).id
  const [a59, a202, a38] = [await num(59), await num(202), await num(38)]
  const BECAUSE = 'the Code must exist before the duty bites'
  const r1 = await S.setAfter(copyId, a202, a59, true, BECAUSE)
  const live1 = await S.liveRows(copyId)
  ok('"#202 must come after #59, because …": #59 comes before #202 (beforeIds), the because is on #202’s record', r1.ok && live1.find((r) => r.id === a59)!.beforeIds.includes(a202) && becauseOf(live1.find((r) => r.id === a202)!.record)[a59] === BECAUSE)
  const r2 = await S.setAfter(copyId, a59, a202, true, null)
  ok('the reverse is refused, naming both: "#59 cannot come after #202: #202 already has to come after #59 … cannot go round in a circle"', !r2.ok && /#59 cannot come after #202: #202 already has to come after #59\./.test((r2 as { error: string }).error) && /circle/.test((r2 as { error: string }).error), (r2 as { error?: string }).error)
  control('the refused link written anyway (must be FALSE)', (await S.liveRows(copyId)).find((r) => r.id === a202)!.beforeIds.includes(a59))
  await S.setAfter(copyId, a38, a202, true, null)
  const r3 = await S.setFacets(copyId, a38, { beforeIds: [a59] })
  ok('a longer circle through Lex’s path too (setFacets): "#59 cannot come after #38 … (through #202)"', !r3.ok && /#59 cannot come after #38: #38 already has to come after #59 \(through #202\)/.test((r3 as { error: string }).error), (r3 as { error?: string }).error)
  // the old column is kept, unshown (262): set it, and assert the screen never says it
  await prisma.lexCoherentAction.update({ where: { id: a202 }, data: { sequence: 'LATER' } })
  const st = await computeCanonicalState(copyId)
  const step4 = (open: string[]) => renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: copyId, actions: st!.actions as never, setAside: [] as never, headings: st!.actionHeadings as never, causes: [] as never, busy: false, onChanged: () => {}, initiallyOpen: open, step: 4 as never, costLineActionIds: [],
    renderFull: (_x: unknown, _s: number, between?: React.ReactNode) => React.createElement('div', null, between),
  }))
  const closed = textOf(step4([]))
  const html4 = step4([a202])
  const t4 = `${closed} ${textOf(html4)}`
  ok('step 4, the list: #202’s row reads "must come after #59 (the Code must exist before the duty bites)"', closed.includes(`must come after #59 (${BECAUSE})`))
  ok('step 4, #202 opened: "Must come after #59" with its because line in an editable box (300, counted), Remove, and Add', /data-order-after="59"/.test(html4) && html4.includes(`value="${BECAUSE}"`) && /Must come after #59/.test(textOf(html4)) && /Remove/.test(textOf(html4)) && /data-order-add/.test(html4))
  ok('…and no Now / Next / Later, no "Sequence", anywhere on step 4 — although #202’s column still says LATER', !/\b(Now|Next|Later)\b/.test(t4.replace(/Later phase/g, '')) && !/Sequence/.test(t4) && (await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: a202 } })).sequence === 'LATER', (/.{30}\b(Now|Next|Later|Sequence)\b.{30}/.exec(t4) ?? [''])[0])
  const order = renderToStaticMarkup(React.createElement(OV.OrderView, { actions: st!.actions as never }))
  const ot = textOf(order)
  ok('the derived order, numbered, with the reasons: #59 before #202 before #38', ot.indexOf('#59') < ot.indexOf('#202') && ot.indexOf('#202') < ot.indexOf('#38') && ot.includes(`must come after #59 (${BECAUSE})`))
  const snap = await buildProposalSnapshot(copyId)
  const pack = buildActionsPackDocument(snap, { selection: { actionIds: [a59, a202, a38] } })
  const packText = JSON.stringify(pack.model.blocks)
  ok('the Actions Pack: each action’s 9 reads "Order: must come after …", and an ORDER section prints the derived order with the reasons', /"Order: "/.test(packText) && /must come after #59 \(the Code must exist before the duty bites\)/.test(packText) && /"title":"ORDER"/.test(packText) && /1\. #59 /.test(packText))
  control('the pack printing the old "Sequence:" line (Now / Next / Later) (must be FALSE)', /Sequence: /.test(packText))

  // fixtures for the browser and D4
  const h = await S.createHeading(copyId, 'Fixture heading for the board')
  await prisma.lexCoherentAction.updateMany({ where: { id: { in: [a59, a202, a38] } }, data: { avenue: 'LEGISLATIVE' } })
  const sv = await DR.saveVersion(copyId, a202, { ...EMPTY_INSTRUCTION, instrument: 'AMENDING_ACT', provisions: [S149], clause: FIX_SUBST }, { userId, author: 'OWNER' })
  const doc202 = sv.ok ? (await prisma.actionDocument.findFirstOrThrow({ where: { actionId: a202, kind: 'DRAFT_CLAUSE' } })).id : ''
  return h.ok ? { a202, a38, a59, heading: h.data.id, doc202 } : null
}

/** D4 · item 8 — the explanatory note. Writes a note document, so it needs the widened CHECK (it ships with this code; NOT RUN before). */
async function partD4(copyId: string, a59: string) {
  section('D4 · item 8 — the explanatory note: price measured, caveat first, needed for an accepted clause, printed after its clause')
  ok('the price is MEASURED (n≥3 runs on a scratch copy) and the ask says so', NOTE_RUNS.length >= 3 && notePrice().n === NOTE_RUNS.length && /measured on a copy of a real idea, n=3/.test(noteAskWords(notePrice())), noteAskWords(notePrice()))
  const nb = noteBody({ purpose: 'Why. [Ref: 4] [Ref: 99]', subsections: [{ n: 1, text: 'One.' }, { n: 3, text: 'Three.' }], commencementAndExtent: 'When and where.' }, [1, 2], new Set([4]))
  ok('noteBody: the caveat is the first line; one part per subsection; a missing one is said; an invented [Ref: n] is taken out and said', nb.body.split('\n')[0] === NOTE_CAVEAT && /## Subsection \(2\)\nLex wrote no paragraph for this subsection\./.test(nb.body) && nb.missing.join() === '2' && nb.extra.join() === '3' && nb.dropped.join() === '99' && /\[Ref: 4\]/.test(nb.body) && !/\[Ref: 99\]/.test(nb.body))
  const widened = (await prisma.$queryRawUnsafe<Array<{ def: string }>>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'action_document_kind_check'`))[0]?.def ?? ''
  if (!/EXPLANATORY_NOTE/.test(widened)) { skip('writing and printing a note document', 'action_document_kind_check is not yet widened (prisma/lex_26v1b_explanatory_note.sql ships with this push)'); return }
  const w = await D.writeTextProposal(copyId, a59, 'EXPLANATORY_NOTE', 'Explanatory note', { body: nb.body, reason: 'fixture', pence: 0, sources: [] })
  const used = await D.useTextProposal(copyId, w.documentId)
  const v = await documentView(copyId, w.documentId)
  ok('the proposal is used as version 1 (by Lex), kept as answered; the view’s text starts with the caveat', used.ok && !!v.ok && v.data.current?.author === 'LEX' && v.data.doc.current?.body.startsWith(NOTE_CAVEAT) === true && !v.data.textProposal)
  const snap = await buildProposalSnapshot(copyId)
  const packText = JSON.stringify(buildActionsPackDocument(snap, { selection: { actionIds: [a59] } }).model.blocks)
  const iClause = packText.indexOf('Drafting instruction and clause'), iNote = packText.indexOf('Explanatory note (explanatory note'), iColl = packText.indexOf('(collision report')
  ok('printed in the Actions Pack straight after its clause, before the collision report, caveat first', iClause >= 0 && iNote > iClause && (iColl < 0 || iNote < iColl) && packText.indexOf(NOTE_CAVEAT) > iNote, `${iClause} ${iNote} ${iColl}`)
}

// ── E · V1b-b in the browser: the board (item 10) and the three views (item 6) ──────────────────────────────────
async function partE(copyId: string, userId: string, f: { a202: string; a38: string; a59: string; heading: string; doc202: string }) {
  section('E · the browser — the board and the three views, the real routes on the scratch copy')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section E', `playwright is not loadable: ${(e as Error).message}`); return }
  const bundle = (await build({ entryPoints: [join(ROOT, 'scripts/fixtures/doc-view-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })).outputFiles[0].text
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const docsRoute = await import('../app/api/ideas/[id]/action-documents/route')
  const structRoute = await import('../app/api/ideas/[id]/action-structure/route')
  const browser = await chromium.launch()
  try {
    // ⚠ The harness page carries no Tailwind CSS, so the board's columns STACK here (in the app they sit side by side). A drag needs its
    // source and its target both under the pointer, so the viewport is made tall enough to hold every column at once.
    const page = await browser.newPage({ viewport: { width: 1400, height: 16000 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    const params = { params: Promise.resolve({ id: copyId }) }
    for (const [glob, handler] of [['**/api/ideas/*/action-documents', docsRoute], ['**/api/ideas/*/action-structure', structRoute]] as const) {
      await page.route(glob, async (r) => {
        const h = handler as { POST: (req: Request, p: typeof params) => Promise<Response>; GET?: (req: Request, p: typeof params) => Promise<Response> }
        const res = r.request().method() === 'GET' && h.GET ? await h.GET(new Request('http://internal.invalid/'), params)
          : await h.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: r.request().postData() ?? '' }), params)
        await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
      })
    }
    await page.route('**/api/ideas/*/canonical-for-check', async (r) => { const s = await computeCanonicalState(copyId); await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ actions: s!.actions, setAsideActions: s!.setAsideActions, actionHeadings: s!.actionHeadings, conditions: s!.conditions }) }) })
    await page.route('**/api/ideas/*/{action-ideas,action-digest,action-thread}**', (r) => r.fulfill({ contentType: 'application/json', body: '{"held":0,"digests":[],"notes":[]}' }))
    const load = async (dv: Record<string, unknown>) => { await page.goto('http://harness.test/'); await page.evaluate((x) => { (window as unknown as { __dv: unknown }).__dv = x }, dv); await page.addScriptTag({ content: bundle }) }

    // item 10 — the board
    await load({ mode: 'workspace', ideaId: copyId, step: 1 })
    await page.waitForSelector('[role="tab"]', { timeout: 30_000 })
    await page.getByRole('tab', { name: /Board/ }).click()
    await page.waitForSelector('[data-board]')
    const col = page.locator(`[data-board-column="${f.heading}"]`)
    ok('the board: a column per heading (in list order) and "Unsorted", cards with "needs N documents"', (await col.count()) === 1 && (await page.locator('[data-board-column="__unsorted"]').count()) === 1 && (await page.locator(`[data-board-card="${f.a59}"] [data-board-needs]`).innerText().catch(() => '')).length > 0)
    const drag = async (from: string, to: import('playwright').Locator) => {
      const hb = await page.locator(`[data-board-card="${from}"] button[aria-label^="Drag action"]`).boundingBox(), tb = await to.boundingBox()
      if (!hb || !tb) return false
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down()
      await page.mouse.move(tb.x + tb.width / 2, tb.y + Math.min(30, tb.height / 2), { steps: 8 }); await page.mouse.up()
      return true
    }
    const boxes = JSON.stringify([await page.locator(`[data-board-card="${f.a59}"] button[aria-label^="Drag action"]`).boundingBox(), await col.locator('h4').boundingBox()])
    await drag(f.a59, col.locator('h4'))
    await page.waitForFunction((id) => !!document.querySelector(`[data-board-column="${id}"] [data-board-card]`), f.heading, { timeout: 20_000 }).catch(() => {})
    ok('drag a card to another column = re-head, through assignHeading: #59 is under the heading in the database and in its column', (await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: f.a59 } })).headingId === f.heading && (await col.locator(`[data-board-card="${f.a59}"]`).count()) === 1,
      `boxes ${boxes}; strip: ${(await page.locator('[data-status-strip]').innerText().catch(() => 'none')).slice(0, 300)}`)
    const before = await prisma.lexCoherentAction.count({ where: { ideaId: copyId, status: 'LIVE' } })
    await drag(f.a202, page.locator(`[data-board-card="${f.a38}"]`))
    await page.waitForSelector('[aria-label="Merge two actions"]', { timeout: 10_000 }).catch(() => {})
    ok('drag a card onto another = the existing merge dialogue opens with both (#202 and #38), and nothing is merged yet', /#202 and #38/.test(await page.locator('[aria-label="Merge two actions"] h4').innerText().catch(() => '')) && (await prisma.lexCoherentAction.count({ where: { ideaId: copyId, status: 'LIVE' } })) === before)
    await page.locator('[data-board-merges] button', { hasText: 'Find duplicates' }).click()
    await page.waitForSelector('[data-board-merge-pair]', { timeout: 30_000 }).catch(() => {})
    const pairBtn = page.locator('[data-board-merge-pair]').first()
    if (!(await pairBtn.count())) skip('a merge-pair click outlines both', 'Find duplicates found no pair on the copy')
    else {
      await pairBtn.click()
      const outlined = await page.locator('[data-board-pair="true"]').count()
      const words = await page.locator('[data-board-pair-word]').allInnerTexts()
      ok('a possible merge clicked: BOTH cards outlined (thick border) and each says "pair" (shape + word, not colour)', outlined === 2 && words.length === 2 && words.every((w) => /pair/i.test(w)))
    }

    // item 6 — the three views in the browser, on #202's fixture version
    await load({ mode: 'view', ideaId: copyId, documentId: f.doc202 })
    await page.waitForSelector('[data-amendment-toggle]', { timeout: 60_000 })
    const marked = await page.locator('[data-amendment-marked]').innerText()
    ok('the Text tab shows "Marked up" first, with the change words beside the lines', /SUBSTITUTED|substituted/.test(marked) && /OMITTED|omitted/.test(marked) && /INSERTED|inserted/.test(marked))
    await page.locator('[data-amendment-mode="stands"]').click()
    const stands = await page.locator('[data-amendment-lines]').innerText()
    await page.locator('[data-amendment-mode="amended"]').click()
    const amended = await page.locator('[data-amendment-lines]').innerText()
    ok('the toggle: as it stands has the old (2) and (4); as amended has the new (2) and (6A) and not the old', /A person who is not a public authority/.test(stands) && /\(4\) The steps involved/.test(stands) && /A fixture person/.test(amended) && /\(6A\)/.test(amended) && !/\(4\) The steps involved/.test(amended))
    ok('no uncaught page error (E)', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  await partA().catch((e) => { fail++; ran++; console.log(`  ✗ part A threw: ${(e as Error).stack?.slice(0, 800)}`) })
  let copyId: string | null = null
  try {
    const b = await partB().catch((e) => { fail++; ran++; console.log(`  ✗ part B threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
    if (b) { copyId = b.copyId; await partC(b.copyId, b.userId, b.docId) }
    if (b) {
      const f = await partD(b.copyId, b.userId).catch((e) => { fail++; ran++; console.log(`  ✗ part D threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
      if (f) {
        await partD4(b.copyId, f.a59).catch((e) => { fail++; ran++; console.log(`  ✗ part D4 threw: ${(e as Error).stack?.slice(0, 800)}`) })
        await partE(b.copyId, b.userId, f).catch((e) => { fail++; ran++; console.log(`  ✗ part E threw: ${(e as Error).stack?.slice(0, 800)}`) })
      }
    }
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
