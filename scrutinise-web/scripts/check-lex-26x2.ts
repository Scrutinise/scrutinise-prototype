// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26x2 — LEX 26-X part X2 (BRIEF_26X §5c–§5e, §8 items 5–8): the Brief on every draft, "Draft it" between the Brief and the Draft,
// the companions, and #207's split as a proposal. Counts what RAN (§23.2). Spends NOTHING: every model call is a fixture.
//
//   A · pure — the Brief's reader, its checks in words, "Brief changed", and the strip's "Briefed" on fixtures for every kind
//   B · a scratch copy of 452c5ade through THE REAL ROUTE and the real functions: save (versions kept, a document made BRIEFED, the kind still
//       missing its draft); refusals in words; Lex's Brief beside, never over (use · set aside); "Draft it" refused while the Brief is empty and
//       below the measured price; the draft records the Brief it followed and says when the Brief has changed since; a clause's Brief is its
//       instruction, read in place; the 26-U clause versions are untouched (count + text before/after); Lex's tools on the same path
//   C · #207's split (§5e), on the copy: a proposal only — nothing moves until it is used; using it moves the text, with a FieldRevision; a
//       split made from details that have since changed is refused; the split is lossless, and its lossless test can fail
//   D · the record, RENDERED: §5c's order (statement → Brief → Draft → Action details …); the Brief's states; "Draft it" disabled with its reason
//   E · the drafter reads the Brief FIRST (the prompt it is sent), and names the version in its reason
//   F · the guide has an entry for every new label; read_brief / propose_brief exist
//   G · COLD READ of 452c5ade (§26): every live action's Brief, read with plain queries against briefView; 332's state (#207 one instrument,
//       D.207.1 set aside and kept, the split on the Code's Brief, D.207.1's content offered on #59)
//   H · 332 — a heading of kind code / management code → code text, regardless of avenue
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26x2.ts
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '../lib/prisma'
import * as BP from '../lib/lex/action-brief-pure'
import * as B from '../lib/lex/action-brief'
import * as D from '../lib/lex/action-documents'
import * as DP from '../lib/lex/action-documents-pure'
import * as PP from '../lib/lex/action-progress-pure'
import * as SL from '../lib/lex/screen-labels'
import { REVIEW_PASS_COUNT } from '../lib/lex/development'
import { composeKindDocument, kindInput, draftKindDocument } from '../lib/lex/document-drafting'
import { draftWithLex, saveVersion } from '../lib/lex/action-draft'
import { EMPTY_INSTRUCTION } from '../lib/lex/action-draft-pure'
import { useTextProposal } from '../lib/lex/action-documents'
import { guideEntries, normLabel, explainField } from '../lib/lex/field-guide'
import { execute, toolByName } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'
import type { callModelJson } from '../lib/lex/model-call'
import ActionsWorkspace from '../components/lex/ActionsWorkspace'
import BriefSection from '../components/lex/BriefSection'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { splitDetails, lossless } from './propose-26x-207-split'

const SOURCE = '452c5ade'
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ')
const P = REVIEW_PASS_COUNT

/** A fixture model: records what it was sent and answers with `value`; costs nothing. */
function fixture(value: unknown, sent: Array<{ user: string; system: string }> = []) {
  return (async (o: { user: string; system: string; model: string }) => {
    sent.push({ user: o.user, system: o.system })
    return { ok: true, value, usage: { model: o.model, tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } } }
  }) as unknown as typeof callModelJson
}
const OPERATING_ANSWER = { parts: [{ heading: 'Benchmarking', text: '1. The owner records the comparator used and the reason for it.' }, { heading: 'Purpose', text: 'Why the rule exists.' }], gaps: 'None known.', reason: 'fixture' }

// ── A · pure ────────────────────────────────────────────────────────────────────────────────────────────────
type Doc = PP.ProgressInput['documents'][number]
const doc = (kind: Doc['kind'], o: Partial<Doc> = {}): Doc => ({ kind, status: 'DRAFTED', acceptedV: null, current: { v: 1 }, reviewed: 0, brief: null, ...o })
const input = (kinds: Doc['kind'][], documents: Doc[]): PP.ProgressInput => ({ statement: 'An action.', headingId: 'h1', headingKind: 'CODE', needs: { kinds, why: 'derived', overridden: false }, documents })

function partA() {
  section('A · pure — the reader, the checks in words, "Brief changed", and the strip’s Briefed')
  const b = BP.parseBrief('CODE_TEXT', { must: ' do it ', mustInclude: ['a', '', 'b'], mustNot: [], tone: 'code', kind: { issuedBy: 'the PM', users: 'not a code field' }, modelledOn: { ref: 12 }, extra: 1 })
  ok('parseBrief keeps the kind’s own fields only, drops empty points and unknown keys', b.must === 'do it' && b.mustInclude.join() === 'a,b' && b.kind.issuedBy === 'the PM' && !('users' in b.kind) && !('extra' in b) && b.tone === 'code' && JSON.stringify(b.modelledOn) === '{"ref":12}', JSON.stringify(b))
  ok('an empty Brief is refused, in words', BP.briefProblems('CODE_TEXT', {}).join() === 'the Brief is empty — write at least one field')
  const over = BP.briefProblems('COSTING', { kind: { basis: 'x'.repeat(1001) } })
  ok('a field over its limit is refused naming the field and the limit (nothing cut)', over.length === 1 && /“Basis” is 1,001 characters; the limit is 1,000/.test(over[0]), over.join())
  ok('…a field the kind does not have is refused by name', /“issuedBy” is not a field of a costing’s Brief/.test(BP.briefProblems('COSTING', { kind: { issuedBy: 'x' } }).join()))
  ok('…a tone not in the list is refused, listing the list', /must be one of: statutory, code, guidance, specification, plain rules/.test(BP.briefProblems('CODE_TEXT', { must: 'x', tone: 'loud' }).join()))
  ok('"Brief changed since this draft": a Brief saved after the draft, or a draft written before any Brief; not when it follows the latest', BP.briefChanged(1, 2, true) && BP.briefChanged(null, 1, true) && !BP.briefChanged(2, 2, true) && !BP.briefChanged(null, null, true) && !BP.briefChanged(null, 3, false))
  control('a draft that follows the latest Brief reads as changed (must be FALSE)', BP.briefChanged(2, 2, true))
  ok('…and its words name both versions', BP.draftedFromWords(1, 2, true) === 'Brief changed since this draft (it was drafted from version 1; the Brief is at version 2)' && BP.draftedFromWords(2, 2, true) === 'drafted from Brief version 2')
  ok('the drafter’s block names its version and puts the Brief between <brief> tags, with what to do with each field', /^THE BRIEF \(version 3\)/.test(BP.briefPromptBlock('CODE_TEXT', b, 3)) && /Carry out every point under "Must include"/.test(BP.briefPromptBlock('CODE_TEXT', b, 3)) && /<brief>[\s\S]*Issued by: the PM[\s\S]*<\/brief>/.test(BP.briefPromptBlock('CODE_TEXT', b, 3)))
  ok('the prefill’s price is MEASURED (n runs), not a guess', BP.prefillPrice().n >= 3 && BP.prefillPrice().pence != null, JSON.stringify(BP.prefillPrice()))

  for (const k of ['CODE_TEXT', 'SPECIFICATION', 'OPERATING_TEXT', 'BACKGROUND_NOTE', 'COSTING'] as const) {
    const without = PP.progressOf(input([k], [doc(k)]), P)
    const withBrief = PP.progressOf(input([k], [doc(k, { brief: { v: 1 } })]), P)
    const briefedOnly = PP.progressOf(input([k], [doc(k, { status: 'BRIEFED', current: null, brief: { v: 1 } })]), P)
    ok(`${k}: a draft with no Brief → Briefed ○; with a saved Brief → Briefed ●; a Brief and no draft → "to draft"`, without.marks.briefed === 'none' && withBrief.marks.briefed === 'done' && briefedOnly.marks.briefed === 'done' && briefedOnly.marks.drafted === 'none' && briefedOnly.stage === 'toDraft', `${without.marks.briefed} ${withBrief.marks.briefed} ${briefedOnly.stage}`)
  }
  const clause = PP.progressOf(input(['DRAFT_CLAUSE', 'COLLISION_REPORT'], [doc('DRAFT_CLAUSE')]), P)
  ok('DRAFT_CLAUSE: its instruction is its Brief, read in place → Briefed ● with no Brief row', clause.marks.briefed === 'done')
  const two = PP.progressOf(input(['DRAFT_CLAUSE', 'SPECIFICATION'], [doc('DRAFT_CLAUSE'), doc('SPECIFICATION')]), P)
  ok('two kinds of draft, one briefed → Briefed ◐', two.marks.briefed === 'part', two.marks.briefed)
  control('a kind with no Brief reads Briefed ● (must be FALSE)', PP.progressOf(input(['CODE_TEXT'], [doc('CODE_TEXT')]), P).marks.briefed === 'done')
  ok('treeCounts: a BRIEFED document is not a drafted one and its kind is still missing', D.treeCounts([{ needs: { kinds: ['CODE_TEXT'], why: '', overridden: false }, documents: [{ kind: 'CODE_TEXT', status: 'BRIEFED' }] }]).missing === 1)
}

// ── B · the copy, the real route ────────────────────────────────────────────────────────────────────────────
const ctxFor = (ideaId: string, userId: string, userMessages: string[]): ToolCtx => ({
  ideaId, userId, confirmed: true, agreedPence: null,
  turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages, pastedText: null },
})

async function partBC() {
  section('B · the Brief through the real route, on a scratch copy of 452c5ade')
  const scratch = await scratchCopy(SOURCE, '26x2-brief')
  try {
    const user = await prisma.user.findUnique({ where: { id: scratch.userId } })
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = user
    const { POST } = await import('../app/api/ideas/[id]/action-documents/route')
    const post = async (b: unknown) => { const r = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(b) }), { params: Promise.resolve({ id: scratch.id }) }); return { status: r.status, json: await r.json() as { ok?: boolean; error?: string; data?: Record<string, unknown> } } }
    const act = async (n: number) => (await prisma.lexCoherentAction.findFirst({ where: { ideaId: scratch.id, number: n, status: 'LIVE' }, select: { id: true, number: true, commentary: true } }))!
    // the 26-U clause versions, before anything here writes (§8 item 6: nothing lost). ⚠ scratchCopy does NOT copy documents, so a copy
    // starts with no clause versions at all — and "the same before and after" over ZERO rows passed on the first run while proving nothing.
    // So a clause version is written first (26-U's own saveVersion, the owner's path), and the comparison requires at least one row.
    const clauseAction = await act(202)
    const owned = await saveVersion(scratch.id, clauseAction.id, { ...EMPTY_INSTRUCTION, instrument: 'AMENDING_ACT', dutyOnWhom: 'check:lex-26x2 — the owner’s duty line', enforcedHow: 'by the Minister', commencement: 'on Royal Assent', extent: ['UK'], clause: '(1) A check clause.', purpose: 'check' }, { userId: scratch.userId, author: 'OWNER' })
    const clauseRows = async () => (await prisma.actionDocumentVersion.findMany({ where: { role: 'VERSION', document: { ideaId: scratch.id, kind: 'DRAFT_CLAUSE' } }, orderBy: [{ documentId: 'asc' }, { v: 'asc' }], select: { id: true, v: true, body: true, payload: true } }))
    const clauseBefore = await clauseRows()
    ok('setup: the owner’s own clause version (26-U saveVersion) is on the copy — at least one clause version to compare', owned.ok && clauseBefore.length >= 1, JSON.stringify(owned).slice(0, 160))

    // #101 — organisational, operating text, no Brief yet
    const a = await act(101)
    const v0 = await post({ op: 'brief', actionId: a.id })
    const k0 = (v0.json.data as unknown as B.BriefView).kinds.find((k) => k.kind === 'OPERATING_TEXT')
    ok('the Brief view lists #101’s draft (operating text) with no Brief, and "Draft it" refused while it is empty', v0.status === 200 && !!k0 && !k0.current && k0.empty, JSON.stringify(v0.json).slice(0, 300))
    const refusedEmpty = await post({ op: 'draftIt', actionId: a.id, kind: 'OPERATING_TEXT', agreedPence: 100 })
    ok('"Draft it" with an empty Brief is refused in the button’s own words — nothing drafted, no document made', refusedEmpty.status === 422 && refusedEmpty.json.error === `“${SL.BRIEF_UI.draftIt}” was not done: ${SL.BRIEF_UI.briefEmpty}. Nothing was drafted.` && (await prisma.actionDocument.count({ where: { actionId: a.id, kind: 'OPERATING_TEXT' } })) === 0, refusedEmpty.json.error)
    const empty = await post({ op: 'saveBrief', actionId: a.id, kind: 'OPERATING_TEXT', brief: {} })
    ok('an empty Brief is refused, in words; nothing saved', empty.status === 422 && /the Brief is empty/.test(empty.json.error ?? '') && (await prisma.actionDocument.count({ where: { actionId: a.id } })) === 0, empty.json.error)
    const tooLong = await post({ op: 'saveBrief', actionId: a.id, kind: 'OPERATING_TEXT', brief: { mustInclude: ['x'.repeat(6001)] } })
    ok('a point over its limit is refused by the route, naming the field as the person knows it and the limit — nothing cut, nothing saved', tooLong.status === 422 && /“Must include, point 1” is 6,001 characters; the limit is 6,000/.test(tooLong.json.error ?? '') && (await prisma.actionDocument.count({ where: { actionId: a.id } })) === 0, tooLong.json.error)
    control('the refusal names the schema path instead (must be FALSE)', /brief\.mustInclude/.test(tooLong.json.error ?? ''))
    const first = { must: 'Write the benchmarking rule.', mustInclude: ['Name the comparator.', 'Record the reason.'], mustNot: ['No new body.'], tone: 'plain-rules' }
    const s1 = await post({ op: 'saveBrief', actionId: a.id, kind: 'OPERATING_TEXT', brief: first })
    const docRow = await prisma.actionDocument.findFirst({ where: { actionId: a.id, kind: 'OPERATING_TEXT' } })
    ok('saving makes version 1 on a document made BRIEFED (a Brief before any draft)', s1.status === 200 && s1.json.data?.v === 1 && docRow?.status === 'BRIEFED', `${s1.status} ${JSON.stringify(s1.json)} ${docRow?.status}`)
    const tree1 = (await D.documentTree(scratch.id)).headings.flatMap((h) => h.actions).find((x) => x.id === a.id)!
    ok('…the kind is still MISSING its draft (the plan offers it), and the tree carries the Brief', tree1.missing.includes('OPERATING_TEXT') && tree1.documents.find((d) => d.kind === 'OPERATING_TEXT')?.brief?.v === 1)
    ok('…packDocuments does not print a briefed-only document', !((await D.packDocuments(scratch.id)).get(a.id) ?? []).some((d) => d.kind === 'OPERATING_TEXT'))
    const s2 = await post({ op: 'saveBrief', actionId: a.id, kind: 'OPERATING_TEXT', brief: { ...first, mustInclude: [...first.mustInclude, 'Review yearly.'] } })
    const briefs = await prisma.actionDocumentVersion.findMany({ where: { documentId: docRow!.id, role: 'BRIEF' }, orderBy: { v: 'asc' } })
    ok('every save is a version: v2 saved, v1 kept word for word (never overwritten)', s2.json.data?.v === 2 && briefs.length === 2 && BP.parseBrief('OPERATING_TEXT', briefs[0].payload).mustInclude.length === 2 && BP.parseBrief('OPERATING_TEXT', briefs[1].payload).mustInclude.length === 3)

    // Lex's Brief beside — never over
    const lexBrief = BP.parseBrief('OPERATING_TEXT', { must: 'Lex’s version.', mustInclude: ['From the statement.'] })
    const w = await B.writeBriefProposal(scratch.id, a.id, 'OPERATING_TEXT', lexBrief, { reason: 'check fixture', pence: 0 })
    const after1 = await prisma.actionDocumentVersion.findMany({ where: { documentId: docRow!.id, role: 'BRIEF' }, orderBy: { v: 'asc' } })
    ok('Lex’s Brief is a PROPOSAL beside the owner’s: the saved Brief is still v2, unchanged', w.ok && after1.length === 2 && after1[1].body === briefs[1].body)
    const aside = await post({ op: 'setAsideBrief', documentId: docRow!.id })
    const asideRow = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docRow!.id, role: 'BRIEF_PROPOSAL' }, orderBy: { v: 'desc' } })
    ok('"Set it aside": answered DISMISSED and KEPT; the Brief unchanged', aside.status === 200 && asideRow?.answer === 'DISMISSED' && (await prisma.actionDocumentVersion.count({ where: { documentId: docRow!.id, role: 'BRIEF' } })) === 2)
    await B.writeBriefProposal(scratch.id, a.id, 'OPERATING_TEXT', lexBrief, { reason: 'check fixture again', pence: 0 })
    const used = await post({ op: 'useBrief', documentId: docRow!.id })
    const v3 = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docRow!.id, role: 'BRIEF', v: 3 } })
    ok('"Use it": the proposal becomes Brief v3 (by Lex), answered ACCEPTED and kept; v1 and v2 still there', used.status === 200 && v3?.author === 'LEX' && BP.parseBrief('OPERATING_TEXT', v3.payload).must === 'Lex’s version.' && (await prisma.actionDocumentVersion.count({ where: { documentId: docRow!.id, role: 'BRIEF_PROPOSAL', answer: 'ACCEPTED' } })) === 1 && (await prisma.actionDocumentVersion.count({ where: { documentId: docRow!.id, role: 'BRIEF' } })) === 3)
    const noneWaiting = await post({ op: 'useBrief', documentId: docRow!.id })
    ok('…with none waiting, "Use it" is refused in words', noneWaiting.status === 422 && /no proposed Brief waiting/.test(noneWaiting.json.error ?? ''))

    // Draft it: price, then the draft records the Brief it followed
    const cheap = await post({ op: 'draftIt', actionId: a.id, kind: 'OPERATING_TEXT', agreedPence: 0 })
    ok('"Draft it" below the measured price is refused, asking again — nothing drafted', cheap.status === 422 && /look again and agree the price/.test(cheap.json.error ?? '') && (await prisma.actionDocumentVersion.count({ where: { documentId: docRow!.id, role: 'PROPOSAL' } })) === 0, cheap.json.error)
    const sent: Array<{ user: string; system: string }> = []
    const drafted = await B.draftIt(scratch.id, a.id, 'OPERATING_TEXT', scratch.userId, 100, { call: fixture(OPERATING_ANSWER, sent) })
    const prop = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docRow!.id, role: 'PROPOSAL', answer: null } })
    ok('"Draft it" (fixture model) writes Lex’s draft as a PROPOSAL that records Brief version 3', drafted.ok && D.briefVOf(prop?.payload) === 3, JSON.stringify(drafted).slice(0, 200))
    ok('§5d — the drafter read the Brief FIRST: the prompt opens with "THE BRIEF (version 3)", before the Action details', /^THE BRIEF \(version 3\)/.test(sent[0]?.user ?? '') && (sent[0]?.user ?? '').indexOf('THE BRIEF') < (sent[0]?.user ?? '').indexOf('<action>'), (sent[0]?.user ?? '').slice(0, 120))
    ok('…and its reason names the version it followed', /Drafted from the Brief, version 3\./.test(prop?.reason ?? ''), prop?.reason ?? '')
    await useTextProposal(scratch.id, docRow!.id)
    const tree2 = (await D.documentTree(scratch.id)).headings.flatMap((h) => h.actions).find((x) => x.id === a.id)!
    const d2 = tree2.documents.find((d) => d.kind === 'OPERATING_TEXT')!
    ok('used, it is version 1 of the draft, DRAFTED, drafted from Brief v3 — "Brief changed" is false', d2.status === 'DRAFTED' && d2.current?.v === 1 && d2.draftedFromBriefV === 3 && !BP.briefChanged(d2.draftedFromBriefV, d2.brief?.v ?? null, true))
    control('"Brief changed" before the Brief is saved again (must be FALSE)', BP.briefChanged(d2.draftedFromBriefV, d2.brief?.v ?? null, true))
    await post({ op: 'saveBrief', actionId: a.id, kind: 'OPERATING_TEXT', brief: { ...first, must: 'Changed after the draft.' } })
    const v4 = (await post({ op: 'brief', actionId: a.id })).json.data as unknown as B.BriefView
    const k4 = v4.kinds.find((k) => k.kind === 'OPERATING_TEXT')!
    ok('the Brief saved again after the draft → "Brief changed since this draft", naming both versions', k4.changed && BP.draftedFromWords(k4.draft?.draftedFromBriefV ?? null, k4.current?.v ?? null, true) === 'Brief changed since this draft (it was drafted from version 3; the Brief is at version 4)')
    ok('…and a saved Brief never changes the draft’s status (still DRAFTED, version 1)', (await prisma.actionDocument.findUnique({ where: { id: docRow!.id } }))?.status === 'DRAFTED')

    // a draft clause: its Brief is its instruction, read in place — #202, whose clause version was written above
    const vc = ((await post({ op: 'brief', actionId: clauseAction.id })).json.data as unknown as B.BriefView).kinds.find((k) => k.kind === 'DRAFT_CLAUSE')
    const cur = (await D.draftFor(clauseAction.id))?.versions.at(-1)
    ok('#202 (a draft clause with a version): the Brief view reads its drafting instruction IN PLACE — the clause’s own current version, not empty, with no Brief row', !!vc?.instruction && vc.instruction.v === cur?.v && vc.instruction.dutyOnWhom === 'check:lex-26x2 — the owner’s duty line' && !vc.current && !vc.empty, JSON.stringify(vc?.instruction ?? null).slice(0, 160))
    const c = await act(38)
    const v38 = ((await post({ op: 'brief', actionId: c.id })).json.data as unknown as B.BriefView).kinds.find((k) => k.kind === 'DRAFT_CLAUSE')
    ok('#38 (on the copy: no clause document) → no instruction and no Brief → empty, so "Draft it" is refused until one is written', !!v38 && !v38.instruction && v38.empty)
    const csent: Array<{ user: string; system: string }> = []
    await post({ op: 'saveBrief', actionId: c.id, kind: 'DRAFT_CLAUSE', brief: { must: 'Name one owner for every task.', mustNot: ['Do not create a new body.'] } })
    const clauseFixture = { instrument: 'AMENDING_ACT', provisions: [], dutyOnWhom: 'the accounting officer', enforcedHow: 'by the Minister', commencement: 'on Royal Assent', extent: ['UK'], precedents: [], clause: '(1) Every task has one named owner.', plainWording: '', purpose: 'one owner', citations: [], reason: 'fixture' }
    const cr = await draftWithLex(scratch.id, c.id, scratch.userId, { call: fixture(clauseFixture, csent) })
    const cprop = await prisma.actionDocumentVersion.findFirst({ where: { role: 'PROPOSAL', answer: null, document: { actionId: c.id, kind: 'DRAFT_CLAUSE' } }, orderBy: { v: 'desc' } })
    if (!cr.ok && /OPC|read/.test((cr as { error: string }).error)) skip('the clause drafter read the clause’s Brief first', (cr as { error: string }).error)
    else ok('the clause drafter reads the clause’s Brief FIRST and the proposal records the Brief version', cr.ok && /^THE BRIEF \(version 1\)/.test(csent[0]?.user ?? '') && D.briefVOf(cprop?.payload) === 1, `${JSON.stringify(cr).slice(0, 160)} ${(csent[0]?.user ?? '').slice(0, 80)}`)
    const clauseAfter = await clauseRows()
    ok(`§8 item 6 — the 26-U clause VERSIONS are untouched: the same ${clauseBefore.length} row(s), the same text, the same instruction, before and after every Brief write and the clause drafter`, clauseBefore.length >= 1 && clauseBefore.length === clauseAfter.length && clauseBefore.every((r, i) => r.id === clauseAfter[i].id && r.body === clauseAfter[i].body && JSON.stringify(r.payload) === JSON.stringify(clauseAfter[i].payload)), `${clauseBefore.length} → ${clauseAfter.length}`)
    control('the comparison over ZERO rows (must be FALSE — it would pass while proving nothing)', clauseBefore.length === 0)

    // Lex's tools: the same path as the screen
    const words = 'please brief #101: name the comparator'
    const t = await execute(toolByName('propose_brief')!, ctxFor(scratch.id, scratch.userId, [words]), { action: 101, must: 'From chat.', mustInclude: ['name the comparator'], reason: 'from the owner’s words', provenance: { kind: 'user_words', refs: [], quote: 'name the comparator' } })
    const viaTool = await prisma.actionDocumentVersion.findFirst({ where: { documentId: docRow!.id, role: 'BRIEF_PROPOSAL', answer: null } })
    ok('propose_brief writes through the SAME writer: a proposal beside the Brief, never a Brief version', t.ok && BP.parseBrief('OPERATING_TEXT', viaTool?.payload).must === 'From chat.' && (await prisma.actionDocumentVersion.count({ where: { documentId: docRow!.id, role: 'BRIEF' } })) === 4, JSON.stringify(t).slice(0, 200))
    const rb = await execute(toolByName('read_brief')!, ctxFor(scratch.id, scratch.userId, []), { action: 101 })
    const rbData = (rb as { data?: { briefs?: Array<{ version: number | null; proposalWaiting: unknown; briefChangedSinceDraft: boolean }> } }).data
    ok('read_brief reads what the screen reads (version 4, a proposal waiting, "changed since the draft")', rb.ok && rbData?.briefs?.[0]?.version === 4 && !!rbData.briefs[0].proposalWaiting && rbData.briefs[0].briefChangedSinceDraft === true, JSON.stringify(rbData).slice(0, 200))

    // ── C · #207's split, on the copy ─────────────────────────────────────────────────────────────────────
    section('C · #207’s split (§5e) — a proposal; nothing moves until it is used')
    const s = await act(207)
    const before = s.commentary ?? ''
    const sp = splitDetails(before)
    const lost = lossless(before, sp.brief, sp.stays)
    ok('the split is LOSSLESS: every non-empty line of the details is in the Brief or in what stays, word for word', !sp.problems.length && lost.length === 0 && sp.brief.mustInclude.length === 15, `${sp.problems.join('; ')} lost ${lost.length}`)
    control('a split that drops item 8 is lossless (must be FALSE)', lossless(before, { ...sp.brief, mustInclude: sp.brief.mustInclude.filter((_, i) => i !== 7) }, sp.stays).length === 0)
    const wp = await B.writeBriefProposal(scratch.id, s.id, 'CODE_TEXT', sp.brief, { reason: 'check: the split', pence: 0, split: { detailAfter: sp.stays, from: before } })
    ok('written as ONE proposal; #207’s Action details UNCHANGED until it is used', wp.ok && (await act(207)).commentary === before)
    const sv = ((await post({ op: 'brief', actionId: s.id })).json.data as unknown as B.BriefView).kinds.find((k) => k.kind === 'CODE_TEXT')
    ok('the record shows it: a code text Brief for #207 (the instrument it holds) with the split waiting, not stale', !!sv?.proposal?.split && !sv.proposal.split.stale && sv.proposal.split.detailAfter === sp.stays)
    // a split made from details that have since changed is refused
    await prisma.lexCoherentAction.update({ where: { id: s.id }, data: { commentary: `${before}\n\nA line the owner added after the split.` } })
    const stale = await post({ op: 'useBrief', documentId: wp.ok ? wp.data.documentId : '' })
    ok('a split whose Action details changed since is REFUSED, in words — nothing moved, nothing lost', stale.status === 422 && /changed since this split was proposed/.test(stale.json.error ?? '') && /A line the owner added/.test((await act(207)).commentary ?? ''), stale.json.error)
    await prisma.lexCoherentAction.update({ where: { id: s.id }, data: { commentary: before } })
    const accepted = await post({ op: 'useBrief', documentId: wp.ok ? wp.data.documentId : '' })
    const afterDetails = (await act(207)).commentary
    const rev = await prisma.fieldRevision.findFirst({ where: { ideaId: scratch.id, targetId: s.id, origin: 'BRIEF_SPLIT' } })
    const b207 = await B.briefView(scratch.id, s.id)
    const cur207 = b207.ok ? b207.data.kinds.find((k) => k.kind === 'CODE_TEXT')?.current : null
    ok('"Accept the split": the Brief holds the items (15 points), the Action details keep the rest, and a FieldRevision keeps the old text', accepted.status === 200 && afterDetails === sp.stays && cur207?.brief.mustInclude.length === 15 && rev?.previousText === before && rev?.newText === sp.stays, `${accepted.status} ${accepted.json.error ?? ''}`)
  } finally {
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = undefined
    console.log(`  (scratch copy deleted: ${await deleteScratch(scratch.id)})`)
  }
}

// ── D · the record, rendered ─────────────────────────────────────────────────────────────────────────────────
function mkAction(n: number) {
  return {
    id: `a${n}`, number: n, title: `Action ${n}`, practicalStep: `The body of action ${n}, written out in full.`, whoImplements: null, wording: null, headingId: 'h1',
    targetCauseIds: [], avenue: 'ORGANISATIONAL', link: null, sequence: null, beforeIds: [], parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null,
    facetProposal: null, titleProposal: null, source: 'LEX', mechanismType: null, targetOrganisation: null, benefits: null, implementationCost: null, enforcementCost: null,
    regulatoryFriction: null, policyTest: null, conflictNote: null, conditionIds: [], supportOnly: false, commentary: 'The details.',
  }
}
function partD() {
  section('D · the record, RENDERED — §5c’s order, the Brief’s states, "Draft it"')
  const rows = [mkAction(1)]
  const prog: PP.Progress = { stage: 'toBrief', noDraft: null, draftKinds: ['OPERATING_TEXT'], marks: { defined: 'done', briefed: 'none', drafted: 'none', reviewed: 'none', accepted: 'none' } }
  const html = renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: 'idea-x', actions: rows as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Operations', colourKey: 'blue', hidden: false, orderIndex: 0, kind: 'OTHER' }] as never,
    causes: [] as never, busy: false, onChanged: () => {}, initiallyOpen: ['a1'], page: 'drafting', onPage: () => {},
    initialDevelopment: { rows: [{ id: 'a1', progress: prog }], counts: PP.draftingCounts([prog]), parked: 0 },
    renderFull: (a: { number: number }, _s: number, between?: React.ReactNode) => React.createElement('div', null, `STATEMENT ${a.number}`, between, `ACTION DETAILS ${a.number}`),
  }))
  const at = (s: string) => html.indexOf(s)
  ok('§5c order: statement → the Brief → the Draft → Action details → Law (each found, in that order)', [at('STATEMENT 1'), at('data-record-section="brief"'), at('data-record-section="documents"'), at('ACTION DETAILS 1'), at('data-record-section="law"')].every((x, i, xs) => x >= 0 && (i === 0 || x > xs[i - 1])), [at('STATEMENT 1'), at('data-record-section="brief"'), at('data-record-section="documents"'), at('ACTION DETAILS 1'), at('data-record-section="law"')].join(','))
  ok('…the Brief and the Draft are OPEN; "Back to Organising" is above them all', /<details data-record-section="brief"[^>]*open=""/.test(html) && /<details data-record-section="documents"[^>]*open=""/.test(html) && at('data-back-to-organising') < at('STATEMENT 1'))
  control('the Draft drawn above the Brief (must be FALSE)', at('data-record-section="documents"') < at('data-record-section="brief"'))
  ok('the jump band names the Brief first, then the Draft ("Documents" until X3’s rename)', /data-band="brief"[\s\S]*data-band="documents"[\s\S]*data-band="detail"/.test(html))

  const k = (o: Partial<B.BriefKindView>): B.BriefKindView => ({ kind: 'OPERATING_TEXT', documentId: 'd1', d: 'D.1.1', current: null, versions: [], proposal: null, instruction: null, draft: null, changed: false, empty: true, ...o })
  const view = (kinds: B.BriefKindView[]): B.BriefView => ({ number: 1, kinds, why: null, prefill: BP.prefillPrice() })
  const draw = (v: B.BriefView) => renderToStaticMarkup(React.createElement(BriefSection, { ideaId: 'x', a: { id: 'a1', number: 1, avenue: 'ORGANISATIONAL' }, disabled: false, onChanged: () => {}, initialView: v, besideDraftIt: React.createElement('span', { 'data-beside': '' }, 'NO DRAFT BOX') }))
  const e = draw(view([k({})])), et = textOf(e)
  ok('an empty Brief: "Write the Brief", "Ask Lex to write the Brief — about Np" (measured), and "Draft it" DISABLED with its reason in words', et.includes(SL.BRIEF_UI.editBrief) && /Ask Lex to write the Brief — about [\d.]+p/.test(et) && /data-draft-it-button[^>]*disabled=""|disabled=""[^>]*data-draft-it-button/.test(e) && et.includes(`— ${SL.BRIEF_UI.briefEmpty}`), et.slice(0, 300))
  ok('…"Needs no draft, because…" is beside "Draft it" (straight after it, in the same section)', e.indexOf('data-draft-it=') >= 0 && e.indexOf('data-beside') > e.indexOf('data-draft-it='))
  const brief = BP.parseBrief('OPERATING_TEXT', { must: 'Write the rule.', mustInclude: ['One.', 'Two.'] })
  const full = draw(view([k({ empty: false, current: { v: 2, author: 'OWNER', at: '2026-11-07T00:00:00Z', brief, body: BP.briefBody('OPERATING_TEXT', brief) }, versions: [{ v: 1, author: 'OWNER', at: '' }, { v: 2, author: 'OWNER', at: '' }], draft: { v: 1, draftedFromBriefV: 1 }, changed: true })]))
  const ft = textOf(full)
  ok('a saved Brief: its version and author in words ("version 2, by you … 2 versions kept"), its text, "Edit the Brief", and "Draft it — about Np" enabled', /version 2, by you, 7 Nov 2026 · 2 versions kept/.test(ft) && ft.includes('## Must include') && ft.includes(SL.BRIEF_UI.editBriefAgain) && /Draft it — about [\d.]+p/.test(ft) && !/data-draft-it-button[^>]*disabled/.test(full), ft.slice(0, 300))
  ok('…and under it, in words and a ⚠, "Brief changed since this draft (it was drafted from version 1; the Brief is at version 2)"', ft.includes('⚠ Brief changed since this draft (it was drafted from version 1; the Brief is at version 2)'))
  const prop = draw(view([k({ empty: false, current: { v: 1, author: 'OWNER', at: '2026-11-07T00:00:00Z', brief, body: 'MINE' }, proposal: { v: 1, at: '', reason: 'why', pence: 1.5, brief, body: 'LEXS', split: null } })]))
  const pt = textOf(prop)
  ok('Lex’s proposed Brief is drawn BESIDE the saved one (both texts shown), with Use it · Edit it, then save · Set it aside — ◇ and a 2px frame, not colour', pt.includes('MINE') && pt.includes('LEXS') && pt.includes(SL.BRIEF_UI.useBrief) && pt.includes(SL.BRIEF_UI.editThenSave) && pt.includes(SL.BRIEF_UI.setAside) && /border-2 border-zinc-900[^"]*"[^>]*data-brief-proposal/.test(prop) && pt.includes('◇'))
  const sp = draw(view([k({ empty: false, proposal: { v: 1, at: '', reason: 'split', pence: 0, brief, body: 'LEXS', split: { detailAfter: 'WHAT STAYS', stale: true } } })]))
  ok('a split proposal says what the Action details would keep, and a STALE one says why it cannot be used (button disabled)', textOf(sp).includes('WHAT STAYS') && textOf(sp).includes('The Action details have changed since this split was proposed') && /data-brief-use[^>]*disabled=""|disabled=""[^>]*data-brief-use/.test(sp) && textOf(sp).includes(SL.BRIEF_UI.acceptSplit))
  const cl = draw(view([k({ kind: 'DRAFT_CLAUSE', empty: false, instruction: { v: 3, instrument: 'an amending Act', dutyOnWhom: 'the officer', enforcedHow: 'by the Minister', commencement: 'on Royal Assent', extent: ['UK'], provisions: 2, purpose: 'p', full: {} as never } })]))
  ok('a draft clause’s Brief shows its drafting instruction, read in place, with "Edit the drafting instruction"', /Its drafting instruction\s*: version 3 — instrument an amending Act; duty on the officer/.test(textOf(cl)) && textOf(cl).includes(SL.BRIEF_UI.editInstruction), textOf(cl).slice(0, 300))
}

// ── E · the drafter's prompt ─────────────────────────────────────────────────────────────────────────────────
async function partE() {
  section('E · composeKindDocument reads the Brief first (the prompt it is SENT), and says when there is none')
  const sent: Array<{ user: string; system: string }> = []
  const base = { number: 1, title: 't', statement: 's', detail: 'DETAILS HERE', avenue: 'ORGANISATIONAL', who: null, heading: null, policy: 'p', slots: [], instruction: null, costLines: [], sources: [] }
  const brief = BP.parseBrief('OPERATING_TEXT', { must: 'Do the thing.', mustNot: ['Never this.'] })
  const r = await composeKindDocument('OPERATING_TEXT', { ...base, brief: { v: 5, brief } }, { ideaId: 'x', userId: null, call: fixture(OPERATING_ANSWER, sent) })
  ok('the user block OPENS with the Brief (version 5), with Must not inside it, before the Action details', /^THE BRIEF \(version 5\)/.test(sent[0]?.user ?? '') && /Must not\n1\. Never this\./.test(sent[0]?.user ?? '') && (sent[0]?.user ?? '').indexOf('<brief>') < (sent[0]?.user ?? '').indexOf('DETAILS HERE'))
  ok('…and the reason says "Drafted from the Brief, version 5."', r.ok && /Drafted from the Brief, version 5\./.test(r.data.reason))
  const none = await composeKindDocument('OPERATING_TEXT', { ...base, brief: null }, { ideaId: 'x', userId: null, call: fixture(OPERATING_ANSWER, []) })
  ok('with no Brief the reason SAYS it was drafted from the Action details alone (never silent)', none.ok && /No Brief was saved for this draft/.test(none.data.reason))
  void kindInput; void draftKindDocument
}

// ── F · the guide ──────────────────────────────────────────────────────────────────────────────────────────
function partF() {
  section('F · the field guide (26-W-b) and the tools')
  const labels = new Set(guideEntries().map((e) => normLabel(e.label)))
  const tables: Record<string, Record<string, string>> = { BRIEF_UI: SL.BRIEF_UI, BRIEF_FIELD_WORD: SL.BRIEF_FIELD_WORD, TONE_WORD: SL.TONE_WORD }
  const missing = Object.entries(tables).flatMap(([t, tbl]) => Object.values(tbl).filter((l) => !labels.has(normLabel(l))).map((l) => `${t}: ${l}`))
  ok('every new label has a guide entry', missing.length === 0, missing.join(' | '))
  ok('explain_field("The Brief") answers exactly, naming read_brief and propose_brief', /read_brief, propose_brief/.test(explainField('The Brief').exact?.tool ?? ''), JSON.stringify(explainField('The Brief').exact))
  ok('read_brief and propose_brief are tools Lex is offered', !!toolByName('read_brief') && !!toolByName('propose_brief'))
}

// ── G · cold read of 452c5ade ────────────────────────────────────────────────────────────────────────────────
async function partG() {
  section('G · COLD READ of 452c5ade (§26) — the Brief view against plain reads, nothing written')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE } }, select: { id: true } })
  if (!idea) { skip('G', 'no idea 452c5ade'); return }
  const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id, status: 'LIVE' }, select: { id: true, number: true } })
  const briefRows = await prisma.actionDocumentVersion.findMany({ where: { role: 'BRIEF', document: { ideaId: idea.id } }, select: { v: true, document: { select: { actionId: true, kind: true } } } })
  let agree = 0, checked = 0
  const disagree: string[] = []
  for (const a of live.slice(0, 60)) {
    const v = await B.briefView(idea.id, a.id)
    if (!v.ok) { disagree.push(`#${a.number}: ${(v as { error: string }).error}`); continue }
    for (const k of v.data.kinds) {
      checked++
      const plain = briefRows.filter((r) => r.document.actionId === a.id && r.document.kind === k.kind).map((r) => r.v)
      const top = plain.length ? Math.max(...plain) : null
      if ((k.current?.v ?? null) === top) agree++; else disagree.push(`#${a.number} ${k.kind}: view ${k.current?.v ?? null} vs plain ${top}`)
    }
  }
  ok(`every live action’s Brief version, as the record reads it, equals the plain read (${checked} drafts on ${live.length} live actions)`, checked > 0 && agree === checked, disagree.slice(0, 5).join(' | '))
  // a clause's per-kind fields, read in place: on the real data, every live action whose clause has a version
  const clauseDocs = await prisma.actionDocument.findMany({ where: { ideaId: idea.id, kind: 'DRAFT_CLAUSE', status: { not: 'SUPERSEDED' }, versions: { some: { role: 'VERSION' } } }, select: { actionId: true } })
  const liveIds = new Set(live.map((a) => a.id))
  const clauses = clauseDocs.filter((d) => liveIds.has(d.actionId))
  if (!clauses.length) skip('a clause’s instruction read in place, on the real data', 'no live action on 452c5ade has a clause version')
  let same = 0
  for (const cd of clauses) {
    const v = await B.briefView(idea.id, cd.actionId)
    const ins = v.ok ? v.data.kinds.find((k) => k.kind === 'DRAFT_CLAUSE')?.instruction : null
    const cur = (await D.draftFor(cd.actionId))?.versions.at(-1)
    if (ins && cur && ins.v === cur.v && ins.dutyOnWhom === cur.dutyOnWhom && ins.provisions === cur.provisions.length) same++
  }
  if (clauses.length) ok(`a clause’s Brief reads its instruction IN PLACE on the real data: ${same} of ${clauses.length} live clause(s) with a version match their own current version`, same === clauses.length)
  // ⚠ MOVED BY 332 (CCh-Lex 7 Nov (1)): #207's instrument is the Code text; its draft clause D.207.1 is set aside (kept). Was: "#207 shows a
  // Brief for BOTH instruments it holds (code text and draft clause) — 313's finding, on the screen".
  const n207 = live.find((a) => a.number === 207)
  if (n207) {
    const v = await B.briefView(idea.id, n207.id)
    const kinds = v.ok ? v.data.kinds.map((k) => k.kind) : []
    ok('332: #207 shows ONE Brief, the code text’s — the draft clause is no longer offered', v.ok && kinds.length === 1 && kinds[0] === 'CODE_TEXT', kinds.join(','))
    const docs = await prisma.actionDocument.findMany({ where: { actionId: n207.id }, select: { number: true, kind: true, status: true, supersededBy: true, id: true, _count: { select: { versions: true } } } })
    const d1 = docs.find((d) => d.number === 1), d2 = docs.find((d) => d.number === 2)
    ok('332: D.207.1 (the draft clause) is set aside and KEPT — superseded by D.207.2, the Code, its rows still there', d1?.kind === 'DRAFT_CLAUSE' && d1.status === 'SUPERSEDED' && d1.supersededBy === d2?.id && d1._count.versions > 0, JSON.stringify(d1))
    const k = v.ok ? v.data.kinds.find((x) => x.kind === 'CODE_TEXT') : null
    ok('332: #207’s split is proposed against the Code’s Brief, and waiting', !!k?.proposal?.split, k?.proposal ? `proposal v${k.proposal.v}` : 'no proposal')
  } else skip('#207 one instrument (332)', '#207 is not live')
  const n59 = live.find((a) => a.number === 59)
  if (n59) {
    const v = await B.briefView(idea.id, n59.id)
    const k = v.ok ? v.data.kinds.find((x) => x.kind === 'DRAFT_CLAUSE') : null
    const p = k?.proposal ? await prisma.actionDocumentVersion.findFirst({ where: { documentId: k.documentId ?? '', role: 'BRIEF_PROPOSAL', v: k.proposal.v } }) : null
    ok('332: D.207.1’s content is OFFERED on #59’s Brief — a proposal, waiting, never over a saved Brief, carried word for word (subsection 5(a) is there)', !!p && !p.answer && /D\.207\.1/.test(p.reason ?? '') && /first investigation must focus on ascertaining causes in the system/.test(p.body ?? ''), p ? `answer ${p.answer}` : 'no proposal on #59')
  } else skip('#59 proposal (332)', '#59 is not live')
}

// ── H · 332: a heading of kind code / management code makes a code, regardless of avenue ─────────────────────────────
function partH() {
  section('H · 332 — a "code" or "management code" heading → code text, whatever the avenue')
  const needs = (avenue: string | null, headingKind: string | null, instrument: string | null = null) => DP.needsDocuments({ avenue, instrument: instrument as never, headingKind, headingName: 'H' }).kinds.join('+')
  ok('a legislative action under a code heading → code text (not a clause) — #207’s case', needs('LEGISLATIVE', 'CODE') === 'CODE_TEXT')
  ok('an organisational action under a management code heading → code text (not operating text)', needs('ORGANISATIONAL', 'MANAGEMENT_CODE') === 'CODE_TEXT')
  ok('no avenue under a code heading → code text (it was "nothing derived")', needs(null, 'MANAGEMENT_CODE') === 'CODE_TEXT' && /a management code heading/.test(DP.needsDocuments({ avenue: null, instrument: null, headingKind: 'MANAGEMENT_CODE', headingName: 'CS Mgt Code' }).why))
  ok('other headings are untouched: legislative under primary legislation → clause + collision report; platform still adds a specification', needs('LEGISLATIVE', 'PRIMARY_LEGISLATION') === 'DRAFT_CLAUSE+COLLISION_REPORT' && needs('ORGANISATIONAL', 'PLATFORM') === 'OPERATING_TEXT+SPECIFICATION')
  ok('the owner’s own "needs nothing" still wins over the heading', DP.needsDocuments({ avenue: 'LEGISLATIVE', instrument: null, headingKind: 'CODE', override: { mode: 'nothing', reason: 'r' } as never }).kinds.length === 0)
  control('the pre-332 rule (avenue first) giving #207 a code text (must be FALSE)', needs('LEGISLATIVE', null) === 'CODE_TEXT')
}

async function main() {
  console.log('check:lex-26x2 — X2 (decision 309: the Brief on every draft; 313 companions; §5e #207)')
  partA()
  await partBC()
  partD()
  await partE()
  partF()
  await partG()
  partH()
  console.log(`\n${ran} ran: ${pass} passed, ${fail} failed · ${controls} controls, ${dead} dead · ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
