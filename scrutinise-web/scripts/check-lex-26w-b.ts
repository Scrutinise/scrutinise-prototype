// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26w-b — LEX 26-W-b: the field guide (302) and the rest of the parity inventory (301).
//
//   A  the guide itself: every entry has a purpose, a fit and a tool line; every tool it names exists; a label RENAMED in the table the
//      screen renders is renamed in the guide (and a frozen copy, the control, is not)
//   B  asks first: every inventory tool that writes the owner's words or answers a proposal returns a confirm card, never a write
//   C  §2d parity: each inventory tool against the BUTTON — the real route handler, given the body the screen sends — on TWIN scratch
//      copies of 452c5ade, the stored rows compared field by field (ids and times aside); a raw write on one twin must break the match
//   D  the browser: the real record (steps 1–4) and the real document view, every section opened and the edit boxes pressed open; every
//      label rendered must be in the guide. Controls: a planted unguided button is caught; a label renamed before mounting appears on
//      screen AND is explained by the guide under its new word, while the old word no longer is.
//
//   npm run check:lex-26w-b        (offline: no model call; scratch copies deleted in a finally)
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import { execute, toolByName, INVENTORY_TOOLS } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'
import { guideEntries, explainField, toolsNamed, normLabel } from '../lib/lex/field-guide'
import { RECORD_UI } from '../lib/lex/screen-labels'
import * as SL from '../lib/lex/action-slots'
import * as CDS from '../lib/lex/action-conditions-server'
import * as DOCS from '../lib/lex/action-documents'
import { computeCanonicalState } from '../lib/lex/state'
import { enterPurpose } from '../lib/lex/build-context'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const ROOT = join(__dirname, '..')
const SOURCE = '452c5ade'
let pass = 0, failN = 0, controls = 0, dead = 0, notRun = 0
const ok = (label: string, cond: boolean, detail = '') => { if (cond) pass++; else failN++; console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${!cond && detail ? ` — ${detail}` : ''}`) }
const control = (label: string, holds: boolean) => { controls++; if (holds) { dead++; console.log(`DEAD control: ${label}`) } else console.log(`  control fired: ${label}`) }
const skip = (label: string, why: string) => { notRun++; console.log(`NOT RUN ${label} — ${why}`) }
const section = (s: string) => console.log(`\n${s}`)

const ctxFor = (ideaId: string, userId: string, confirmed = true, userMessages: string[] = []): ToolCtx => ({
  ideaId, userId, confirmed, agreedPence: null,
  turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages, pastedText: null },
})
const run = (name: string, ctx: ToolCtx, input: unknown) => execute(toolByName(name)!, ctx, input)

// ── A — the guide ─────────────────────────────────────────────────────────────────────────────────────────────
function partA() {
  section('A — the field guide')
  const all = guideEntries()
  ok(`the guide holds ${all.length} entries, each with a purpose, how it fits and a tool line`, all.length > 150 && all.every((e) => e.purpose.trim() && e.fits.trim() && e.tool.trim()), all.filter((e) => !e.purpose.trim() || !e.fits.trim() || !e.tool.trim()).map((e) => e.key).join(', '))
  const keys = all.map((e) => e.key)
  ok('no two entries share a key', new Set(keys).size === keys.length)
  const named = toolsNamed()
  const missing = named.filter((n) => !toolByName(n))
  ok(`every tool the guide names exists (${named.length} named)`, missing.length === 0, missing.join(', '))
  control('a tool name that does not exist is found (must be FALSE)', !!toolByName('no_such_tool_26wb'))
  const unnamed = INVENTORY_TOOLS.map((t) => t.name).filter((n) => !named.includes(n) && !['explain_field', 'list_fields'].includes(n))
  ok('every new inventory tool is named by the guide against its control', unnamed.length === 0, unnamed.join(', '))
  const e = explainField('Order')
  ok('explain_field("Order") answers from the guide: the record\'s Order section, and its tool', !!e.exact && /set_action_order/.test(e.exact.tool), JSON.stringify(e.exact ?? e.near.map((x) => x.key)))
  ok('explain_field finds a label with its number ("Use it as version 3")', explainField('Use it as version 3').exact?.key === 'document.useItAsVersion')
  // rename: the table the screen renders changes, the guide follows
  const was = RECORD_UI.ruleOut
  const frozen = guideEntries()
  ;(RECORD_UI as { ruleOut: string }).ruleOut = 'Rule it out (renamed)'
  try {
    const after = explainField('Rule it out (renamed)')
    ok('a label renamed in screen-labels is explained by the guide under its NEW word', after.exact?.key === 'record.ruleOut')
    ok('…and the old word no longer names that entry', explainField(was).exact?.key !== 'record.ruleOut')
    control('a guide built once and kept (a frozen copy) follows the rename (must be FALSE)', frozen.some((x) => x.label === 'Rule it out (renamed)'))
  } finally { (RECORD_UI as { ruleOut: string }).ruleOut = was }
}

// ── B — asks first ────────────────────────────────────────────────────────────────────────────────────────────
async function partB(copyId: string, userId: string) {
  section('B — asks first: the inventory tools that change the owner\'s things')
  const asks = INVENTORY_TOOLS.filter((t) => t.tier === 'ask')
  const ctx = ctxFor(copyId, userId, false)
  const sample: Record<string, unknown> = {
    set_action_title: { action: 1, title: 'x' }, answer_title_proposals: { accept: true }, edit_action_statement: { action: 1, statement: 'x' }, keep_conflict_note: { action: 1, note: 'because' },
    answer_facet_proposals: { accept: true }, answer_kind_proposal: { heading: 'x', accept: true }, retire_action_heading: { heading: 'x' }, answer_slot_proposal: { action: 1, slot: 'skill', accept: true },
    set_action_costs: { action: 1, implementationCost: null }, set_no_cost_reason: { action: 1, reason: 'free' }, add_cost_line: { action: 1, label: 'x' }, remove_cost_line: { action: 1, label: 'x' },
    change_condition: { op: 'add', text: 'a condition' }, answer_condition_proposal: { proposal: 1, accept: true }, answer_notes: { op: 'share', notes: ['abcd'] },
  }
  for (const t of asks) {
    const r = await execute(t, ctx, sample[t.name] ?? {})
    ok(`${t.name} asks first: a confirm card, nothing written`, !r.ok && !!r.pending, r.error ?? '')
  }
  ok(`every 'change' tool among them asks (${asks.length})`, INVENTORY_TOOLS.filter((t) => t.category === 'change').every((t) => t.tier === 'ask'))
}

// ── C — parity on twin copies ─────────────────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const DROP = new Set(['id', 'ideaId', 'actionId', 'noteId', 'sourceId', 'authorId', 'createdAt', 'updatedAt', 'setAsideAt', 'at', 'orderIndex'])
/** Ids and times differ between twins by construction; everything else must be identical. */
const stable = (v: unknown): string => JSON.stringify(v, (k, x) => (DROP.has(k) ? undefined : x instanceof Date ? 'T' : typeof x === 'string' && UUID.test(x) ? 'ID' : typeof x === 'string' && ISO.test(x) ? 'T' : x))

async function partC(A: { id: string; userId: string }, B: { id: string; userId: string }) {
  section('C — §2d parity: each tool against the button\'s route, on twin scratch copies, field by field')
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: A.userId } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const routes = {
    structure: await import('../app/api/ideas/[id]/action-structure/route'),
    actions: await import('../app/api/ideas/[id]/actions/route'),
    costLines: await import('../app/api/ideas/[id]/cost-lines/route'),
    documents: await import('../app/api/ideas/[id]/action-documents/route'),
    notebook: await import('../app/api/ideas/[id]/research-notebook/route'),
  }
  const press = async (route: keyof typeof routes, ideaId: string, body: unknown) => {
    const res = await (routes[route] as { POST: (r: Request, p: { params: Promise<{ id: string }> }) => Promise<Response> }).POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: ideaId }) })
    return { status: res.status, body: await res.json().catch(() => null) as Record<string, unknown> | null }
  }
  // the subject: the lowest-numbered live action (the same number on both twins)
  const pick = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: A.id, status: 'LIVE', parked: false }, orderBy: { number: 'asc' }, select: { number: true } })
  const n = pick.number!
  const idIn = async (ideaId: string) => (await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId, number: n }, select: { id: true } })).id
  const aA = await idIn(A.id), aB = await idIn(B.id)
  const actionSnap = async (ideaId: string) => {
    const a = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId, number: n } })
    const lines = await prisma.costLine.findMany({ where: { actionId: a.id }, orderBy: { label: 'asc' } })
    const causes = await prisma.diagnosisCause.findMany({ where: { ideaId }, select: { id: true, number: true } })
    const cn = new Map(causes.map((c) => [c.id, c.number]))
    return stable({ ...a, targetCauseIds: a.targetCauseIds.map((c) => cn.get(c)), headingId: null, lines })
  }
  const headSnap = async (ideaId: string) => stable(await prisma.actionHeading.findMany({ where: { ideaId }, orderBy: { orderIndex: 'asc' }, select: { name: true, colourKey: true, hidden: true, archivedAt: true, kind: true, proposedKind: true, proposedKindReason: true } }))
  const condSnap = async (ideaId: string) => stable((await prisma.idea.findUniqueOrThrow({ where: { id: ideaId }, select: { conditions: true } })).conditions)
  const noteSnap = async (ideaId: string) => stable(await prisma.researchNote.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' }, include: { replies: { orderBy: { createdAt: 'asc' } } } }))
  const twin = async (label: string, tool: () => Promise<{ ok: boolean; error?: string }>, button: () => Promise<{ status: number; body: Record<string, unknown> | null }>, snap: (ideaId: string) => Promise<string>) => {
    const t = await tool(), b = await button()
    const sa = await snap(A.id), sb = await snap(B.id)
    ok(`${label}: the tool and the button store the same`, t.ok && b.status < 300 && sa === sb, !t.ok ? `tool: ${t.error}` : b.status >= 300 ? `button ${b.status}: ${JSON.stringify(b.body).slice(0, 200)}` : `differs:\n    tool   ${sa.slice(0, 400)}\n    button ${sb.slice(0, 400)}`)
  }
  const ctx = ctxFor(A.id, A.userId, true)

  // fixtures, the same on both twins: a policy conflict, a title proposal, a classification proposal, a slot proposal, a heading kind
  // proposal, two conditions and a condition proposal
  for (const [ideaId, aid] of [[A.id, aA], [B.id, aB]] as const) {
    await prisma.lexCoherentAction.update({ where: { id: aid }, data: { policyTestVerdict: 'CONFLICTS', policyTestReason: 'fixture: it conflicts', titleProposal: 'A proposed title (fixture)', facetProposal: { avenue: 'FINANCIAL' } as never } })
    await SL.proposeSlotText(ideaId, aid, 'skill', { text: 'They run the scheme already (fixture).', reason: 'fixture', direction: null, linkNumber: null })
    const h = await prisma.actionHeading.findFirst({ where: { ideaId }, orderBy: { orderIndex: 'asc' } })
    if (h) await prisma.actionHeading.update({ where: { id: h.id }, data: { proposedKind: 'PLATFORM', proposedKindReason: 'fixture' } })
    const doc = await CDS.readConditions(ideaId)
    if (doc.items.filter((c) => !c.retired).length < 2) { await CDS.addCondition(ideaId, A.userId, 'Fixture condition one'); await CDS.addCondition(ideaId, A.userId, 'Fixture condition two') }
    await CDS.proposeCondition(ideaId, 'A proposed condition (fixture)', 'fixture')
  }
  const heading = (await prisma.actionHeading.findFirst({ where: { ideaId: A.id }, orderBy: { orderIndex: 'asc' } }))?.name ?? null
  const hB = heading ? (await prisma.actionHeading.findFirstOrThrow({ where: { ideaId: B.id, name: heading } })).id : null

  await twin('set_action_title / "Edit title" → Save', () => run('set_action_title', ctx, { action: n, title: 'A title from the check' }), () => press('structure', B.id, { op: 'setTitle', actionId: aB, title: 'A title from the check' }), actionSnap)
  await twin('edit_action_statement / "Edit the action" → Save', () => run('edit_action_statement', ctx, { action: n, statement: 'The statement, as the check sets it.' }), () => press('actions', B.id, { action: 'update', actionId: aB, practicalStep: 'The statement, as the check sets it.' }), actionSnap)
  await twin('keep_conflict_note / "Keep it, with a note"', () => run('keep_conflict_note', ctx, { action: n, note: 'Kept for the check.' }), () => press('structure', B.id, { op: 'keepConflict', actionId: aB, note: 'Kept for the check.' }), actionSnap)
  await twin('answer_title_proposals / accept the waiting title', () => run('answer_title_proposals', ctx, { accept: true, actions: [n] }), () => press('structure', B.id, { op: 'acceptTitles', ids: [aB] }), actionSnap)
  await twin('answer_facet_proposals / Accept beside "Lex proposes:"', () => run('answer_facet_proposals', ctx, { accept: true, actions: [n], step: 1 }), () => press('structure', B.id, { op: 'acceptFacets', ids: [aB], step: 1 }), actionSnap)
  const conds = async (ideaId: string) => (await CDS.readConditions(ideaId)).items.filter((c) => !c.retired)
  const [c1B] = await conds(B.id)
  await twin('set_action_conditions / "Conditions it delivers" (set)', () => run('set_action_conditions', ctx, { action: n, conditions: [1] }), () => press('structure', B.id, { op: 'assignConditions', actionIds: [aB], conditionIds: [c1B.id], mode: 'set' }), actionSnap)
  await twin('answer_slot_proposal / "Use it" on a step-2 proposal', () => run('answer_slot_proposal', ctx, { action: n, slot: 'skill', accept: true }), () => press('structure', B.id, { op: 'acceptSlot', actionId: aB, slot: 'skill' }), actionSnap)
  const range = { low: 10000, high: 25000, unit: 'GBP', basis: 'fixture basis', priceYear: 2025 }
  await twin('set_action_costs / "Edit costs" → Save', () => run('set_action_costs', ctx, { action: n, implementationCost: range }), () => press('actions', B.id, { action: 'update', actionId: aB, implementationCost: { ...range, userOverride: true } }), actionSnap)
  await twin('set_no_cost_reason / "no cost, because…"', () => run('set_no_cost_reason', ctx, { action: n, reason: 'It reuses an existing team.' }), () => press('actions', B.id, { action: 'update', actionId: aB, noCostReason: 'It reuses an existing team.' }), actionSnap)
  const line = { label: 'Guidance team (fixture)', costType: 'STAFF', category: 'IMPLEMENTATION', low: 50000, high: 80000, basis: 'fixture', priceYear: 2025, recurrence: 'ONE_OFF' }
  await twin('add_cost_line / "+ add a cost" → Add cost', () => run('add_cost_line', ctx, { action: n, ...line }), () => press('costLines', B.id, { action: 'add', actionId: aB, ...line, staffLevel: null, fteCount: null, durationMonths: null }), actionSnap)
  const lineB = await prisma.costLine.findFirstOrThrow({ where: { actionId: aB, label: line.label } })
  await twin('remove_cost_line / "delete" on a cost line', () => run('remove_cost_line', ctx, { action: n, label: line.label }), () => press('costLines', B.id, { action: 'remove', lineId: lineB.id }), actionSnap)
  await twin('set_document_needs / "Change what this needs"', () => run('set_document_needs', ctx, { action: n, mode: 'nothing', reason: 'Done by an existing scheme.' }), () => press('documents', B.id, { op: 'setNeeds', actionId: aB, mode: 'nothing', reason: 'Done by an existing scheme.' }), actionSnap)
  if (heading && hB) {
    await twin('answer_kind_proposal / Accept beside the proposed kind', () => run('answer_kind_proposal', ctx, { heading, accept: true }), () => press('structure', B.id, { op: 'answerKindProposal', headingId: hB, accept: true }), headSnap)
    await twin('set_heading_kind / the Kind menu', () => run('set_heading_kind', ctx, { heading, kind: 'GUIDANCE_PILOT' }), () => press('structure', B.id, { op: 'updateHeading', headingId: hB, kind: 'GUIDANCE_PILOT' }), headSnap)
    await twin('hide_action_heading / Hide', () => run('hide_action_heading', ctx, { heading, hidden: true }), () => press('structure', B.id, { op: 'updateHeading', headingId: hB, hidden: true }), headSnap)
    await twin('rename_action_heading / Rename → Save', () => run('rename_action_heading', ctx, { heading, to: `${heading} (renamed)` }), () => press('structure', B.id, { op: 'updateHeading', headingId: hB, name: `${heading} (renamed)` }), headSnap)
    await twin('retire_action_heading / "Retire heading"', () => run('retire_action_heading', ctx, { heading: `${heading} (renamed)` }), () => press('structure', B.id, { op: 'deleteHeading', headingId: hB }), headSnap)
  } else skip('the heading rows', 'the copy has no heading')
  await twin('change_condition add / the conditions list', () => run('change_condition', ctx, { op: 'add', text: 'A third condition (fixture)' }), () => press('structure', B.id, { op: 'addCondition', text: 'A third condition (fixture)' }), condSnap)
  const c2B = (await conds(B.id))[1]
  await twin('change_condition edit', () => run('change_condition', ctx, { op: 'edit', number: 2, text: 'Condition two, edited' }), () => press('structure', B.id, { op: 'editCondition', conditionId: c2B.id, text: 'Condition two, edited' }), condSnap)
  await twin('change_condition down', () => run('change_condition', ctx, { op: 'down', number: 1 }), async () => press('structure', B.id, { op: 'moveCondition', conditionId: (await conds(B.id))[0].id, dir: 'down' }), condSnap)
  await twin('change_condition retire', () => run('change_condition', ctx, { op: 'retire', number: 3 }), async () => press('structure', B.id, { op: 'retireCondition', conditionId: (await conds(B.id))[2].id, retired: true }), condSnap)
  const propB = (await CDS.readConditions(B.id)).proposals[0]
  await twin('answer_condition_proposal / add a proposed condition', () => run('answer_condition_proposal', ctx, { proposal: 1, accept: true }), () => press('structure', B.id, { op: 'acceptConditionProposal', proposalId: propB.id }), condSnap)
  // comments: the owner dictates a comment; then replies; then sets it aside and brings it back
  const said = 'This needs the Treasury on board first.'
  const ctxSaid = ctxFor(A.id, A.userId, true, [`add a comment on ${n}: ${said}`])
  await twin('add_action_comment (dictated) / "Add comment"', () => run('add_action_comment', ctxSaid, { action: n, comment: said, dictated: true }), () => press('notebook', B.id, { op: 'addNote', ownObservation: true, comment: said, stance: 'CONTEXT', tags: ['comment'], bearsOn: [{ kind: 'action', id: aB, label: `Action ${n}` }] }), noteSnap)
  const noteA = await prisma.researchNote.findFirstOrThrow({ where: { ideaId: A.id }, orderBy: { createdAt: 'desc' } })
  const noteB = await prisma.researchNote.findFirstOrThrow({ where: { ideaId: B.id }, orderBy: { createdAt: 'desc' } })
  const replyWords = 'Agreed, ask them now.'
  await twin('reply_to_comment (dictated) / Reply', () => run('reply_to_comment', ctxFor(A.id, A.userId, true, [replyWords]), { note: noteA.id.slice(0, 8), text: replyWords, dictated: true }), () => press('notebook', B.id, { op: 'reply', noteId: noteB.id, text: replyWords }), noteSnap)
  await twin('answer_notes set_aside / "Set aside" on a note', () => run('answer_notes', ctx, { op: 'set_aside', notes: [noteA.id.slice(0, 8)], reason: 'fixture' }), () => press('notebook', B.id, { op: 'setAside', noteIds: [noteB.id], reason: 'fixture' }), noteSnap)
  await twin('answer_notes bring_back / "Bring back"', () => run('answer_notes', ctx, { op: 'bring_back', notes: [noteA.id.slice(0, 8)] }), () => press('notebook', B.id, { op: 'restore', noteIds: [noteB.id] }), noteSnap)
  await twin('answer_notes mine_only / "Make mine only"', () => run('answer_notes', ctx, { op: 'mine_only', notes: [noteA.id.slice(0, 8)] }), () => press('notebook', B.id, { op: 'makeMineOnly', noteIds: [noteB.id] }), noteSnap)
  // refusals, in words
  const r1 = await run('reply_to_comment', ctxFor(A.id, A.userId, true, ['say something nice']), { note: noteA.id.slice(0, 8), text: 'Words the user never wrote.', dictated: true })
  ok(`a reply in the user's name that is not their words is refused: “${r1.error?.slice(0, 70)}…”`, !r1.ok && /own words/.test(r1.error ?? ''))
  const r2 = await run('edit_action_statement', ctx, { action: n, statement: 'x'.repeat(5000) })
  ok(`an over-limit statement is refused, not cut: “${r2.error?.slice(0, 70)}…”`, !r2.ok && /Nothing was saved/.test(r2.error ?? ''))
  const r3 = await run('explain_field', ctx, { name: 'zz no such control zz' })
  ok('explain_field says when the guide has no entry, rather than guessing', !r3.ok && /no entry/.test(r3.error ?? ''))
  // the comparator can see a difference: one raw write on twin A
  await prisma.lexCoherentAction.update({ where: { id: aA }, data: { title: 'written around the button' } })
  control('after a raw write on one twin, the twins still match (must be FALSE)', (await actionSnap(A.id)) === (await actionSnap(B.id)))
}

// ── D — the browser ───────────────────────────────────────────────────────────────────────────────────────────
async function partD(copy: { id: string; userId: string }) {
  section('D — the browser: every label on the real record and the real document view is in the guide')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  const bundle = (await build({ entryPoints: [join(ROOT, 'scripts/fixtures/field-guide-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })).outputFiles[0].text
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = await prisma.user.findUniqueOrThrow({ where: { id: copy.userId } })
  const docsRoute = await import('../app/api/ideas/[id]/action-documents/route')
  const structRoute = await import('../app/api/ideas/[id]/action-structure/route')
  const threadRoute = await import('../app/api/ideas/[id]/action-thread/route')
  // the subject: #207's record, with a drafting instruction (owner's version + Lex's waiting proposal, from a scripted model) and a code text
  // with Lex's proposal waiting
  const a = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, status: 'LIVE' }, orderBy: { number: 'asc' } })
  await prisma.lexCoherentAction.update({ where: { id: a.id }, data: { avenue: 'LEGISLATIVE', commentary: 'The owner’s own detail.\n\nParts of this action, quoted\n• [#12] “A merged component” (a component title) — fixture' } })
  const DR = await import('../lib/lex/action-draft')
  const { EMPTY_INSTRUCTION } = await import('../lib/lex/action-draft-pure')
  await DR.saveVersion(copy.id, a.id, { ...EMPTY_INSTRUCTION, instrument: 'AMENDING_ACT', dutyOnWhom: 'a fixture duty', enforcedHow: 'a fixture route', commencement: 'on a fixture day', extent: ['England and Wales'], purpose: 'A fixture purpose.', provisions: [{ docUri: 'ukpga/2010/25', provisionPath: 'section/5', relation: 'amends', note: 'fixture' }], precedents: [{ docUri: 'ukpga/1972/70', provisionPath: 'section/151', how: 'fixture' }], clause: '(1) The Minister must issue a code.\n(2) The code must be laid before Parliament.' }, { userId: copy.userId, author: 'OWNER' })
  const scripted = (async () => ({ ok: true, usage: { model: 'claude-sonnet-5-5', tokensIn: 1, tokensOut: 1 }, value: { instrument: 'AMENDING_ACT', dutyOnWhom: 'the Minister', enforcedHow: 'by Parliament', commencement: 'on Royal Assent', extent: ['UK'], provisions: [{ docUri: 'ukpga/2010/25', provisionPath: 'section/5', relation: 'amends', note: 'fixture' }], precedents: [], clause: '(1) The Minister must issue a code.\n(2) The code must be laid.\n(3) A new subsection.', plainWording: '', purpose: 'Fixture.', citations: [], reason: 'Scripted for the check.' } })) as never
  const drafted = await DR.draftWithLex(copy.id, a.id, copy.userId, { call: scripted })
  const code = await DOCS.writeTextProposal(copy.id, a.id, 'CODE_TEXT', 'Code text', { body: '## Introduction\n\nThis code applies to every owner.\n\n## 1. One owner\n\nYou must name one owner. (clause 1)', reason: 'fixture', pence: null, sources: [] })
  const docs = await prisma.actionDocument.findMany({ where: { actionId: a.id }, select: { id: true, kind: true, number: true } })
  const clauseDoc = docs.find((d) => d.kind === 'DRAFT_CLAUSE')
  ok('the fixtures are in place: an instruction with Lex\'s waiting proposal, and a code text with a proposal', drafted.ok && !!clauseDoc && !!code.documentId, drafted.ok ? '' : (drafted as { error: string }).error)

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 4000 } })
    // tsx compiles this file with esbuild keepNames, so functions handed to page.evaluate carry calls to esbuild's __name helper,
    // which the page does not have. Define it as the identity before any page script runs (a string, so it is not itself wrapped).
    await page.addInitScript('window.__name = (f) => f')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    const params = { params: Promise.resolve({ id: copy.id }) }
    for (const [glob, handler] of [['**/api/ideas/*/action-documents', docsRoute], ['**/api/ideas/*/action-structure', structRoute], ['**/api/ideas/*/action-thread**', threadRoute]] as const) {
      await page.route(glob, async (r) => {
        const h = handler as { POST?: (req: Request, p: typeof params) => Promise<Response>; GET?: (req: Request, p: typeof params) => Promise<Response> }
        const res = r.request().method() === 'GET' && h.GET ? await h.GET(new Request(`http://internal.invalid/${new URL(r.request().url()).search}`), params)
          : await h.POST!(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: r.request().postData() ?? '' }), params)
        await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
      })
    }
    await page.route('**/api/ideas/*/canonical-for-check', async (r) => { const s = await computeCanonicalState(copy.id); await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ actions: s!.actions, setAsideActions: s!.setAsideActions, actionHeadings: s!.actionHeadings, conditions: s!.conditions, costLines: s!.costLines, benchmarks: s!.benchmarks ?? [] }) }) })
    await page.route('**/api/ideas/*/{action-ideas,action-digest}**', (r) => r.fulfill({ contentType: 'application/json', body: '{"held":0,"digests":[],"notes":[]}' }))
    const mount = async (fg: Record<string, unknown>, before?: string) => {
      await page.goto('http://harness.test/')
      await page.evaluate((x) => { (window as unknown as { __fg: unknown }).__fg = x }, fg)
      await page.addScriptTag({ content: bundle })
      if (before) await page.evaluate(before)
      await page.evaluate(() => (window as unknown as { __mount: () => void }).__mount())
    }
    /** Every label-like element: its own words, the data on it trimmed away (numbers, states after " · ", what follows " — " or ":"). */
    const collect = () => page.evaluate(() => {
      const SKIP = '[data-quoted-parts] li, [data-record-document] > button, [data-statement], [data-explanation-text], [data-tree-document] > button, [data-comparison-row], [data-document-text], [data-text-proposal-body], [data-versions-tab], [data-document-reviews], [data-review-ask] li, [data-instruction-row], option, [data-order-after] p'
      // DATA, not a label: a value shown inside a control (an action's title on its row, a count, a hint), a box's "N left" counter, the
      // list filter's help text. Marked in the components; dropped before the label is read. Everything else inside a control is read.
      const DATA = '[data-shown-value], [data-limit-counter], [data-filter-help]'
      const own = (el: Element): string[] => {
        if (el.tagName === 'LABEL' || el.tagName === 'LEGEND') {
          return [Array.from(el.childNodes).filter((c) => c.nodeType === 3 || (c.nodeType === 1 && (c as Element).tagName === 'SPAN' && !(c as Element).getAttribute('aria-hidden') && !(c as Element).matches(DATA) && !(c as Element).querySelector(DATA))).map((c) => c.textContent ?? '').join(' ')]
        }
        // a control made of several labels (a kept block's title and its show/hide toggle) is read part by part
        const parts = Array.from(el.querySelectorAll('[data-label-part]'))
        if (parts.length) return parts.map((p) => (p as HTMLElement).innerText)
        if (!el.querySelector(DATA)) return [(el as HTMLElement).innerText]
        const c = el.cloneNode(true) as Element
        c.querySelectorAll(DATA).forEach((d) => d.remove())
        return [c.textContent ?? '']
      }
      const out: string[] = []
      for (const el of Array.from(document.querySelectorAll('button, summary, label, legend, th, caption, [role=tab], p.uppercase'))) {
        if (el.closest(SKIP)) continue
        for (const raw of own(el)) {
          let t = raw.replace(/[●○▸▾◇■◆✓✗⚑▲△▼▽]/g, ' ').replace(/\s+/g, ' ').trim()
          t = t.split(' · ')[0].split(' — ')[0].replace(/:\s.*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/[.:]$/, '').trim()
          if (!t || /^(D\.\d|#\d|\d)/.test(t)) continue
          out.push(t)
        }
      }
      return [...new Set(out)]
    })
    const guideSet = async () => new Set(await page.evaluate(() => {
      const g = (window as unknown as { __guide: { guideEntries: () => Array<{ label: string }>; normLabel: (s: string) => string } }).__guide
      return g.guideEntries().map((e) => g.normLabel(e.label.split(' · ')[0].split(' — ')[0].replace(/:\s.*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/[.:]$/, '').trim()))
    }))
    const openAll = async () => {
      for (let i = 0; i < 3; i++) await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { (d as HTMLDetailsElement).open = true }))
    }
    const press = async (name: RegExp) => { const b = page.getByRole('button', { name }).first(); if (await b.count()) { await b.click().catch(() => undefined); await page.waitForTimeout(150) } }
    const uncovered = async (): Promise<string[]> => {
      const g = await guideSet()
      const seen = await collect()
      const n = await page.evaluate((xs) => xs.map((x) => (window as unknown as { __guide: { normLabel: (s: string) => string } }).__guide.normLabel(x)), seen)
      return seen.filter((_, i) => !g.has(n[i]))
    }

    const all = new Set<string>(), missing = new Set<string>()
    for (const step of [1, 2, 3, 4] as const) {
      await mount({ mode: 'record', ideaId: copy.id, actionId: a.id, step })
      await page.waitForSelector('[data-record-order]', { timeout: 60_000 })
      await page.waitForSelector('[data-record-documents]', { timeout: 30_000 }).catch(() => undefined)
      await openAll()
      for (const re of [/^Edit title$/, /^Edit the action details$/, /^Answer$/, /^\+ add a cost$/, /^no cost, because…$/, /^Edit costs$/, /^write the instruction$/]) { await press(re); await openAll() }
      for (const l of await collect()) all.add(l)
      for (const l of await uncovered()) missing.add(`record step ${step}: ${l}`)
    }
    for (const d of [clauseDoc!.id, code.documentId]) {
      await mount({ mode: 'view', ideaId: copy.id, documentId: d })
      await page.waitForSelector('[data-document-view]', { timeout: 60_000 })
      for (const tab of ['text', 'instruction', 'touches', 'versions', 'issues']) {
        const t = page.locator(`[data-document-tab="${tab}"]`)
        if (await t.count()) { await t.click(); await page.waitForTimeout(200); await openAll(); for (const l of await collect()) all.add(l); for (const l of await uncovered()) missing.add(`document ${tab}: ${l}`) }
      }
      for (const re of [/^Ask Lex to redraft$/, /^Review this draft$/, /^Edit$/]) { await press(re); await page.waitForTimeout(400); await openAll(); for (const l of await collect()) all.add(l); for (const l of await uncovered()) missing.add(`document: ${l}`) }
    }
    ok(`every label rendered on the record (steps 1–4) and the document view is in the guide (${all.size} distinct labels read)`, missing.size === 0 && all.size > 60, [...missing].join(' | '))
    ok('no page error while rendering', errors.length === 0, errors.join(' | ').slice(0, 300))
    // control 1: a planted unguided button is caught
    await page.evaluate(() => { const b = document.createElement('button'); b.textContent = 'Zq unguided control'; document.body.appendChild(b) })
    control('a planted button the guide does not hold passes unnoticed (must be FALSE)', !(await uncovered()).includes('Zq unguided control'))
    // control 2: rename a label in the bundle's own table BEFORE mounting; the screen and the guide must both carry the new word
    await mount({ mode: 'record', ideaId: copy.id, actionId: a.id, step: 1 }, `window.__labels.RECORD_UI.ruleOut = 'Rule it out now'`)
    await page.waitForSelector('[data-record-order]', { timeout: 60_000 }); await openAll()
    const shownNew = (await collect()).includes('Rule it out now')
    const explained = await page.evaluate(() => (window as unknown as { __guide: { explainField: (s: string) => { exact: { key: string } | null } } }).__guide.explainField('Rule it out now').exact?.key ?? null)
    const oldGone = await page.evaluate(() => (window as unknown as { __guide: { explainField: (s: string) => { exact: { key: string } | null } } }).__guide.explainField('Rule out').exact?.key ?? null)
    ok('a label renamed in the table appears on the screen under its new word', shownNew)
    ok('…and the guide explains the new word, as the same entry (record.ruleOut)', explained === 'record.ruleOut')
    control('…the old word still names the entry after the rename (must be FALSE)', oldGone === 'record.ruleOut')
    ok('…and the coverage check still passes with the renamed label', !(await uncovered()).length, (await uncovered()).join(' | '))
  } finally { await browser.close() }
}

async function main() {
  enterPurpose('check')
  partA()
  const A = await scratchCopy(SOURCE, '26w-b-tool')
  const B = await scratchCopy(SOURCE, '26w-b-button')
  try {
    await partB(A.id, A.userId)
    await partC(A, B)
    await partD(B)
  } finally {
    for (const c of [A, B]) await deleteScratch(c.id).catch((e) => console.log(`(could not delete scratch ${c.id}: ${(e as Error).message})`))
  }
  console.log(`\ncheck:lex-26w-b — ${pass} passed, ${failN} failed — ${pass + failN} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(failN || dead ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
