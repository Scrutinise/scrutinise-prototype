// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26aa — LEX 26-AA (BRIEF_26AA; CCh's GOs of 20 Nov 07:40 and 07:57). Counts what RAN: ran, passed, controls fired,
// dead, not run.
//
//   A3 · the legislation-link DELETE is scoped to the idea in the URL: another idea's link is refused with a worded 404 and is
//        still there afterwards; the owner deletes their own (control); a stranger is refused (control).
//   2  · add_cause / edit_cause / retire_cause: ask first; on TWIN scratch copies each stores exactly what the Diagnosis page's button
//        stores through POST /causes (every cause compared field by field, archived ones too); a raw write on one twin breaks the match
//        (control); the undo (restore_cause) brings the archived causes back with their numbers; the screen's depth limit and the
//        Diagnosis gate hold; the buttons read CAUSE_UI and every label has a guide entry naming its tool.
//
//   1  · item 1 (183/196): no user-content delete outside three named exceptions (a static scan over app/ and lib/, planted controls);
//        each of the five paths archives (kept, by whom, why; out of every live read) and restores as it was; numbers never reused;
//        a bulk write does not reach an archived row; privacy and idea scope hold on remove and restore.
//
// Everything here runs on SCRATCH copies of 452c5ade (scripts/lib/scratch-copy.ts), made and deleted here. Nothing writes to 452c5ade.
//
//   npm run check:lex-26aa
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { execute, toolByName, isModelTool } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'
import { guideEntries, toolsNamed } from '../lib/lex/field-guide'
import { CAUSE_UI, TREE_UI, SOURCES_UI, ADD_RESEARCH_UI, ARCHIVE_UI } from '../lib/lex/screen-labels'
import { addPolicyOption } from '../lib/lex/field-machine'
import { listArchivedGroups } from '../lib/lex/archive'
import { FACET_LABEL, SORT_LABEL } from '../lib/lex/source-list'
import { STANCE_LABEL } from '../lib/lex/research-notebook-schema'
import { planFor } from '../lib/lex/document-drafting'
import { KIND_RUNS, kindPrice, isProposing, isProposingInNote, proposalShape } from '../lib/lex/document-drafting-pure'

const ROOT = join(__dirname, '..')
/** Comments are stripped before a source is scanned, so a comment naming a literal cannot satisfy or fail a check. */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const SOURCE = '452c5ade'
let ran = 0, pass = 0, fail = 0, controls = 0, dead = 0, notRun = 0
const ok = (name: string, cond: boolean, detail?: unknown) => {
  ran++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 300)}`}`) }
}
/** A control: a case that MUST come out the other way, so the assertion beside it is known to be able to fail. */
const control = (name: string, cond: boolean, detail?: unknown) => { controls++; if (!cond) dead++; ok(`control: ${name}`, cond, detail) }
const section = (s: string) => console.log(`\n${s}`)
const setUser = (u: unknown) => { (globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = u }

async function partA3() {
  section('A3 · the legislation-link DELETE is scoped to the idea in the URL')
  const { DELETE } = await import('../app/api/ideas/[id]/legislation-link/route')
  const call = async (ideaId: string, rowId: string) => {
    const r = await DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ coherentActionSectionId: rowId }) }), { params: Promise.resolve({ id: ideaId }) })
    return { status: r.status, json: await r.json() as { ok?: boolean; error?: string } }
  }
  // Two ideas: the victim (Y) holds the link; the caller's own idea (X) is the one in the URL. Both are scratch copies of 452c5ade.
  const Y = await scratchCopy(SOURCE, '26aa-a3-victim')
  const X = await scratchCopy(SOURCE, '26aa-a3-caller')
  const made: string[] = []
  try {
    const section1 = await prisma.legislationSection.findFirst({ select: { id: true } }) // read only: any held section will do
    if (!section1) throw new Error('no LegislationSection to link to')
    const caY = await prisma.coherentAction.create({ data: { ideaId: Y.id, title: 'ZZ-scratch 26aa A3 action (victim)' }, select: { id: true } })
    const caX = await prisma.coherentAction.create({ data: { ideaId: X.id, title: 'ZZ-scratch 26aa A3 action (caller)' }, select: { id: true } })
    made.push(caY.id, caX.id)
    const linkY = await prisma.coherentActionSection.create({ data: { coherentActionId: caY.id, legislationSectionId: section1.id, proposedWording: 'the victim’s wording' }, select: { id: true } })
    const linkX = await prisma.coherentActionSection.create({ data: { coherentActionId: caX.id, legislationSectionId: section1.id }, select: { id: true } })

    // The caller owns idea X (the URL) and knows the id of Y's link.
    const owner = await prisma.user.findUnique({ where: { id: X.userId } })
    setUser(owner)
    const attack = await call(X.id, linkY.id)
    ok('another idea’s link, sent through the caller’s own idea, is refused with a 404', attack.status === 404, JSON.stringify(attack))
    ok('…in words', attack.json.error === 'That law link is not on this idea.', attack.json.error)
    ok('…and the link is still there, with its wording, and live', (await prisma.coherentActionSection.findFirst({ where: { id: linkY.id } }))?.proposedWording === 'the victim’s wording')

    // A stranger who owns neither idea is refused at the ownership step (unchanged behaviour).
    setUser({ ...owner!, id: 'zz-26aa-a3-stranger', clerkId: 'zz-26aa-a3-stranger' })
    const stranger = await call(Y.id, linkY.id)
    control('a stranger who owns neither idea is refused (404) and deletes nothing', stranger.status === 404 && !!(await prisma.coherentActionSection.findUnique({ where: { id: linkY.id } })), JSON.stringify(stranger))

    // The owner deletes their own link through their own idea: the fix must not refuse the legitimate case.
    setUser(owner)
    const own = await call(X.id, linkX.id)
    // ⚠ 26-AA item 1 restated these two: a removed link is ARCHIVED now, so "gone" means out of every live read, not absent from the table.
    const removed = async (id: string) => { const r = await prisma.coherentActionSection.findUnique({ where: { id } }); return !!r?.archivedAt && r.archivedById === owner!.id && !(await prisma.coherentActionSection.findFirst({ where: { id } })) }
    control('the owner removes their own idea’s link (200, archived by them, out of every live read)', own.status === 200 && await removed(linkX.id), JSON.stringify(own))
    const ownY = await call(Y.id, linkY.id)
    control('…and Y’s link goes when sent through Y, its own idea', ownY.status === 200 && await removed(linkY.id), JSON.stringify(ownY))
  } finally {
    setUser(undefined)
    // CoherentAction → Idea has no cascade, so the rows made here go before the scratch ideas (their links cascade with them).
    if (made.length) await prisma.coherentAction.deleteMany({ where: { id: { in: made } } })
    console.log(`  (scratch copies deleted: ${await deleteScratch(X.id)}, ${await deleteScratch(Y.id)})`)
  }
}

// ── item 2 — the cause tools against the Diagnosis page's buttons ───────────────────────────────────────────────────────────────────
const ctxFor = (ideaId: string, userId: string, confirmed: boolean): ToolCtx => ({
  ideaId, userId, confirmed, agreedPence: null,
  turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages: [], pastedText: null },
})
/** Every cause on the idea, archived ones too (naming `archivedAt` steps lib/prisma.ts's live-only filter aside), ids and times aside. */
async function causeSnap(ideaId: string): Promise<string> {
  const rows = await prisma.diagnosisCause.findMany({ where: { ideaId, archivedAt: undefined }, orderBy: { number: 'asc' } })
  const num = new Map(rows.map((r) => [r.id, r.number]))
  return JSON.stringify(rows.map(({ id: _i, ideaId: _d, createdAt: _c, updatedAt: _u, archivedAt, parentCauseId, ...rest }) => ({ ...rest, archived: !!archivedAt, parent: parentCauseId ? num.get(parentCauseId) ?? 'gone' : null })))
}

function part2Static() {
  section('2 · the cause tools — static: the buttons read the table, the guide names the tools')
  const panel = stripComments(readFileSync(join(ROOT, 'components/lex/FieldsPanel.tsx'), 'utf8'))
  const literal = ['>Add cause<', '>+ cause beneath<', "'Add another cause'", "'Add cause'"].filter((s) => panel.includes(s))
  ok('FieldsPanel renders the cause buttons from CAUSE_UI, not literals', literal.length === 0 && /CAUSE_UI\.remove/.test(panel) && /CAUSE_UI\.addBeneath\b/.test(panel), literal.join(', '))
  const entries = guideEntries()
  const missing = (Object.keys(CAUSE_UI) as Array<keyof typeof CAUSE_UI>).filter((k) => !entries.some((e) => e.key === `cause.${k}` && e.label === CAUSE_UI[k]))
  ok('every CAUSE_UI label has a field-guide entry under its own word', missing.length === 0, missing.join(', '))
  const named = toolsNamed()
  ok('the guide names add_cause, edit_cause and retire_cause, and each exists and is offered to the model', ['add_cause', 'edit_cause', 'retire_cause'].every((n) => named.includes(n) && !!toolByName(n) && isModelTool(n)))
  ok('restore_cause exists for undo but is not offered to the model (an inverse)', !!toolByName('restore_cause') && !isModelTool('restore_cause'))
  ok('all four ask first (tier "ask")', ['add_cause', 'edit_cause', 'retire_cause', 'restore_cause'].every((n) => toolByName(n)!.tier === 'ask'))
}

async function part2() {
  section('2 · the cause tools — asks first, then parity with the buttons on TWIN scratch copies, field by field')
  const A = await scratchCopy(SOURCE, '26aa-causes-tool')
  const B = await scratchCopy(SOURCE, '26aa-causes-button')
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: A.userId } })
    setUser(owner)
    const { POST } = await import('../app/api/ideas/[id]/causes/route')
    const press = async (ideaId: string, body: unknown) => {
      const r = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: ideaId }) })
      return { status: r.status, json: await r.json().catch(() => null) as Record<string, unknown> | null }
    }
    const run = (name: string, ideaId: string, input: unknown, confirmed = true) => execute(toolByName(name)!, ctxFor(ideaId, A.userId, confirmed), input)
    const idOf = async (ideaId: string, number: number) => (await prisma.diagnosisCause.findFirstOrThrow({ where: { ideaId, number }, select: { id: true } })).id
    ok('the twins start identical', (await causeSnap(A.id)) === (await causeSnap(B.id)))

    // asks first: nothing is written until the owner presses the button
    const before = await causeSnap(A.id)
    const live = await prisma.diagnosisCause.findMany({ where: { ideaId: A.id }, orderBy: { number: 'asc' }, select: { number: true } })
    const n1 = live[0]?.number
    if (n1 == null) throw new Error('the source idea has no causes to test against')
    for (const [name, input] of [['add_cause', { cause: 'An unconfirmed cause' }], ['edit_cause', { number: n1, cause: 'Unconfirmed wording' }], ['retire_cause', { number: n1 }]] as const) {
      const r = await run(name, A.id, input, false)
      ok(`${name} asks first: a confirm card, nothing written`, !r.ok && !!r.pending, r.error)
    }
    ok('…and the causes are exactly as they were', (await causeSnap(A.id)) === before)

    const twin = async (label: string, tool: () => Promise<{ ok: boolean; error?: string }>, button: () => Promise<{ status: number; json: unknown }>) => {
      const t = await tool(), b = await button()
      const sa = await causeSnap(A.id), sb = await causeSnap(B.id)
      ok(`${label}: the tool and the button store the same`, t.ok && b.status < 300 && sa === sb, !t.ok ? `tool: ${t.error}` : b.status >= 300 ? `button ${b.status}: ${JSON.stringify(b.json).slice(0, 200)}` : `differs:\n    tool   ${sa.slice(-500)}\n    button ${sb.slice(-500)}`)
      return t
    }
    const added = await twin('add_cause / "Add cause"', () => run('add_cause', A.id, { cause: 'Officials have no duty to publish the reasons. ', whyPersisted: 'Nobody has asked for one.' }), () => press(B.id, { action: 'add', cause: 'Officials have no duty to publish the reasons. ', whyPersisted: 'Nobody has asked for one.' }))
    const newN = (added as { data?: { number?: number } }).data?.number
    ok('add_cause reports the new cause’s number, and it is the twin’s number too', newN != null && !!(await prisma.diagnosisCause.findFirst({ where: { ideaId: B.id, number: newN, cause: 'Officials have no duty to publish the reasons.' } })), String(newN))
    await twin('add_cause beneath / "+ cause beneath" → Add', () => run('add_cause', A.id, { cause: 'The duty was dropped from the 2019 bill.', beneath: newN }), async () => press(B.id, { action: 'add', cause: 'The duty was dropped from the 2019 bill.', parentCauseId: await idOf(B.id, newN!) }))
    await twin('edit_cause / "Edit" → Save (cause and evidence; why untouched)', () => run('edit_cause', A.id, { number: newN, cause: 'Officials owe no duty to publish their reasons.', evidence: 'The 2019 bill, clause 4 (dropped).' }), async () => press(B.id, { action: 'update', causeId: await idOf(B.id, newN!), cause: 'Officials owe no duty to publish their reasons.', evidence: 'The 2019 bill, clause 4 (dropped).' }))
    await twin('edit_cause clearing the evidence / Save with the box emptied', () => run('edit_cause', A.id, { number: newN, evidence: '' }), async () => press(B.id, { action: 'update', causeId: await idOf(B.id, newN!), evidence: '' }))
    const retired = await twin('retire_cause / "Remove" (it and the cause beneath it are archived)', () => run('retire_cause', A.id, { number: newN }), async () => press(B.id, { action: 'remove', causeId: await idOf(B.id, newN!) }))
    ok('retire_cause archived two (the cause and the one beneath it), and hands back an undo', (retired as { data?: { archived?: number }; undo?: unknown }).data?.archived === 2 && !!(retired as { undo?: unknown }).undo)
    ok('the archived causes keep their numbers (nothing deleted)', (await prisma.diagnosisCause.count({ where: { ideaId: A.id, archivedAt: { not: null }, number: { gte: newN! } } })) === 2)

    // a raw write on one twin must break the match: the comparison can fail
    const rawA = await idOf(A.id, n1)
    const was = (await prisma.diagnosisCause.findUniqueOrThrow({ where: { id: rawA } })).cause
    await prisma.diagnosisCause.update({ where: { id: rawA }, data: { cause: `${was} (raw)` } })
    control('a raw write on one twin is seen as a difference', (await causeSnap(A.id)) !== (await causeSnap(B.id)))
    await prisma.diagnosisCause.update({ where: { id: rawA }, data: { cause: was } })

    // undo: restore_cause brings both back, numbers unchanged
    const back = await run('restore_cause', A.id, { number: newN })
    const liveAgain = await prisma.diagnosisCause.findMany({ where: { ideaId: A.id, number: { gte: newN! } }, select: { number: true, parentCauseId: true } })
    ok('restore_cause (the undo) brings the cause and the one beneath it back, with their numbers', back.ok && (back as { data?: { restored?: number } }).data?.restored === 2 && liveAgain.length === 2 && liveAgain.some((c) => c.number === newN && !c.parentCauseId), JSON.stringify(back).slice(0, 200))

    // the depth limit the screen applies ("deepest level")
    // newN is on level 1 (the top); three causes beneath it in a chain reach level 4, the deepest
    let parent = newN!
    for (let i = 0; i < 3; i++) {
      const r = await run('add_cause', A.id, { cause: `A deeper cause, level ${i + 2}.`, beneath: parent })
      parent = (r as { data?: { number?: number } }).data!.number!
    }
    const tooDeep = await run('add_cause', A.id, { cause: 'One level too deep.', beneath: parent })
    ok('beneath a cause on the fourth level is refused, in the screen’s words', !tooDeep.ok && /deepest level/.test(tooDeep.error ?? ''), tooDeep.error)
    const okDeep = await prisma.diagnosisCause.count({ where: { ideaId: A.id, cause: { startsWith: 'A deeper cause' } } })
    control('the three levels down to it were allowed (the refusal is the limit, not a blanket refusal)', okDeep === 3)

    // the gate: before the Diagnosis is entered, the tool refuses as the route does
    const page = (await prisma.idea.findUniqueOrThrow({ where: { id: A.id }, select: { lexPage: true } })).lexPage
    await prisma.idea.update({ where: { id: A.id }, data: { lexPage: 'ORIENTATION' } })
    try {
      const g = await run('add_cause', A.id, { cause: 'Before the Diagnosis.' })
      const gb = await press(A.id, { action: 'add', cause: 'Before the Diagnosis.' })
      ok('before the Diagnosis is entered, add_cause refuses as the button’s route does (409)', !g.ok && /not been started/.test(g.error ?? '') && gb.status === 409, `${g.error} / ${gb.status}`)
    } finally { await prisma.idea.update({ where: { id: A.id }, data: { lexPage: page } }) }
  } finally {
    setUser(undefined)
    console.log(`  (scratch copies deleted: ${await deleteScratch(A.id)}, ${await deleteScratch(B.id)})`)
  }
}

// ── item 3 — draft_heading_needs against "Draft what this heading needs" ───────────────────────────────────────────────────────────
function part3Static() {
  section('3 · draft_heading_needs — static')
  const t = toolByName('draft_heading_needs')
  ok('draft_heading_needs exists, is offered to the model, and asks first (a run tool, tier "ask")', !!t && isModelTool('draft_heading_needs') && t.tier === 'ask' && t.category === 'run')
  const g = guideEntries().find((e) => e.label === TREE_UI.draftWhatHeadingNeeds)
  ok('the guide\'s "Draft what this heading needs" names draft_heading_needs (it said "none — not yet")', !!g && /draft_heading_needs/.test(g.tool), g?.tool)
}

async function part3() {
  section('3 · draft_heading_needs — the same plan, price and queue as the button, on TWIN scratch copies')
  // ⚠ The live worker never claims a scratch idea's jobs (runNextDraftJob: `NOT i."isScratch"`), so queueing here spends nothing.
  const A = await scratchCopy(SOURCE, '26aa-heading-tool')
  const B = await scratchCopy(SOURCE, '26aa-heading-button')
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: A.userId } })
    setUser(owner)
    const { POST } = await import('../app/api/ideas/[id]/action-documents/route')
    const press = async (ideaId: string, body: unknown) => {
      const r = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: ideaId }) })
      return { status: r.status, json: await r.json().catch(() => null) as { ok?: boolean; data?: Record<string, unknown>; error?: string } | null }
    }
    const ctx = (confirmed: boolean, agreedPence: number | null): ToolCtx => ({ ...ctxFor(A.id, A.userId, confirmed), agreedPence })
    // a heading on the copy with something to draft
    const heads = await prisma.actionHeading.findMany({ where: { ideaId: A.id }, orderBy: { orderIndex: 'asc' }, select: { id: true, name: true } })
    let pick: { name: string; pence: number; items: number } | null = null
    for (const h of heads) {
      const p = await planFor(A.id, { headingId: h.id })
      if (p.ok && p.data.items.length) { pick = { name: h.name, pence: p.data.pence, items: p.data.items.length }; break }
    }
    if (!pick) { notRun++; console.log('  NOT RUN — no heading on the copy has anything left to draft'); return }
    const hB = (await prisma.actionHeading.findFirstOrThrow({ where: { ideaId: B.id, name: pick.name }, select: { id: true } })).id
    console.log(`  (heading “${pick.name}”: ${pick.items} item(s), plan total ${pick.pence.toFixed(2)}p)`)
    const jobs = async (ideaId: string) => {
      const rows = await prisma.documentDraftJob.findMany({ where: { ideaId }, orderBy: { seq: 'asc' }, select: { actionId: true, kind: true, seq: true, pricePence: true, status: true, userId: true } })
      const num = new Map((await prisma.lexCoherentAction.findMany({ where: { ideaId }, select: { id: true, number: true } })).map((a) => [a.id, a.number]))
      return JSON.stringify(rows.map((r) => ({ ...r, actionId: num.get(r.actionId) })))
    }

    const asked = await execute(toolByName('draft_heading_needs')!, ctx(false, null), { heading: pick.name })
    ok('asks first: a confirm card carrying the plan\'s total, nothing queued', !asked.ok && !!asked.pending && Math.abs((asked.pending.pence ?? -1) - pick.pence) < 0.001 && /^measured/.test(asked.pending.priceSource ?? '') && (await prisma.documentDraftJob.count({ where: { ideaId: A.id } })) === 0, JSON.stringify(asked.pending))

    const low = Math.max(0, pick.pence - 1)
    const lowT = await execute(toolByName('draft_heading_needs')!, ctx(true, low), { heading: pick.name })
    const lowB = await press(B.id, { op: 'draftQueue', headingId: hB, agreedPence: low })
    ok('pressed at a price below the plan, both the tool and the button refuse and queue nothing', !lowT.ok && /you agreed/.test(lowT.error ?? '') && lowB.status === 422 && (await prisma.documentDraftJob.count({ where: { ideaId: { in: [A.id, B.id] } } })) === 0, `${lowT.error} / ${lowB.status}`)

    const t = await execute(toolByName('draft_heading_needs')!, ctx(true, pick.pence), { heading: pick.name })
    const b = await press(B.id, { op: 'draftQueue', headingId: hB, agreedPence: pick.pence })
    const ja = await jobs(A.id), jb = await jobs(B.id)
    ok('at the agreed price, the tool and the button queue the same jobs (action, kind, order, price, status, who)', t.ok && b.status === 200 && ja === jb && ja !== '[]', !t.ok ? t.error : `\n    tool   ${ja.slice(0, 300)}\n    button ${jb.slice(0, 300)}`)
    ok(`…${pick.items} job(s) each, priced as the plan`, (t as { data?: { queued?: number; pence?: number } }).data?.queued === pick.items && Math.abs(((t as { data?: { pence?: number } }).data?.pence ?? -1) - pick.pence) < 0.001)
    const unknown = await execute(toolByName('draft_heading_needs')!, ctx(true, 999), { heading: 'No such heading 26aa' })
    control('an unknown heading is refused in words', !unknown.ok && /no heading/.test(unknown.error ?? ''))
    // a stray job on one twin must break the match
    await prisma.documentDraftJob.updateMany({ where: { ideaId: A.id, seq: 0 }, data: { pricePence: 0.01 } })
    control('a changed job on one twin is seen as a difference', (await jobs(A.id)) !== (await jobs(B.id)))
  } finally {
    setUser(undefined)
    // the scratch ideas' queued jobs go first (scratch only: the ideas were made above)
    await prisma.documentDraftJob.deleteMany({ where: { ideaId: { in: [A.id, B.id] } } })
    console.log(`  (scratch copies deleted: ${await deleteScratch(A.id)}, ${await deleteScratch(B.id)})`)
  }
}

// ── item 4 — the four kinds' prices are re-measured, n ≥ 3, with the current template ─────────────────────────────────────────────
function part4() {
  section('4 · the prices of the four kinds whose templates changed in 26-W: n ≥ 3, measured after the change, no V2b figure left')
  const since = { SPECIFICATION: '2026-11-20', OPERATING_TEXT: '2026-11-20', BACKGROUND_NOTE: '2026-11-20', COSTING: '2026-11-18' } as const
  const measuredSince = (runs: Array<{ on: string }>, day: string) => runs.length >= 3 && runs.every((r) => (/\d{4}-\d{2}-\d{2}/.exec(r.on)?.[0] ?? '') >= day)
  for (const [k, day] of Object.entries(since) as Array<[keyof typeof since, string]>) {
    const runs = KIND_RUNS[k]
    const dates = runs.map((r) => /\d{4}-\d{2}-\d{2}/.exec(r.on)?.[0] ?? '')
    ok(`${k}: n = ${runs.length} (≥ 3), every run dated ${day} or later — none from the 24 Oct template`, measuredSince(runs, day), dates.join(', '))
    const p = kindPrice(k)
    ok(`${k}: the button's price is the mean of those runs (${p.pence}p, n=${p.n})`, p.n === runs.length && p.pence != null && Math.abs(p.pence - runs.reduce((s, r) => s + r.pence, 0) / runs.length) < 0.06)
  }
  control('two new runs, or three with one from 24 Oct, fail that test', !measuredSince([{ on: '2026-11-20' }, { on: '2026-11-20' }], '2026-11-20') && !measuredSince([{ on: '2026-11-20' }, { on: '2026-11-20' }, { on: 'x, 2026-10-24 (#7)' }], '2026-11-20'))
}

// ── item 5 — every label SourceBrowser and AddResearch render is in the field guide (a real browser) ─────────────────────────────────
function part5Static() {
  section('5 · Sources and Add research — static: the controls read the tables')
  const sb = stripComments(readFileSync(join(ROOT, 'components/lex/SourceBrowser.tsx'), 'utf8'))
  const ar = stripComments(readFileSync(join(ROOT, 'components/lex/AddResearch.tsx'), 'utf8'))
  const sbLit = ['>Choose<', "'+ All filters'", "'− Fewer filters'", '>Clear<', '>Kind<'].filter((s) => sb.includes(s))
  const arLit = ['>+ Add a quote<', '>+ More details<', "'Fetch a readable view'", '>Start again<', '>Permission<', "'Save'"].filter((s) => ar.includes(s))
  ok('SourceBrowser renders its controls from SOURCES_UI, not literals', sbLit.length === 0 && /SOURCES_UI\.choose/.test(sb), sbLit.join(', '))
  ok('AddResearch renders its controls from ADD_RESEARCH_UI, not literals', arLit.length === 0 && /AR\.startAgain/.test(ar), arLit.join(', '))
  // ⚠ Each key has ITS OWN entry: a label covered only by another entry with the same word ("Clear" is also common.clear) would pass the
  // browser's word-for-word coverage while saying nothing about this control (found by mutation M5a).
  const keys = guideEntries().map((e) => e.key)
  const tables: Array<[string, Record<string, unknown>]> = [['sources', SOURCES_UI], ['addResearch', ADD_RESEARCH_UI], ['sourceKind', FACET_LABEL], ['sourceSort', SORT_LABEL], ['stance', STANCE_LABEL]]
  const noEntry = tables.flatMap(([p, t]) => Object.keys(t).filter((k) => !keys.includes(`${p}.${k}`)).map((k) => `${p}.${k}`))
  ok(`every key of SOURCES_UI, ADD_RESEARCH_UI and the kind, sort and stance words has its own guide entry (${tables.reduce((n, [, t]) => n + Object.keys(t).length, 0)} keys)`, noEntry.length === 0, noEntry.join(', '))
}

async function part5() {
  section('5 · Sources and Add research — in a real browser, every label rendered is in the field guide')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { notRun++; console.log(`  NOT RUN — playwright is not loadable: ${(e as Error).message}`); return }
  const { build } = await import('esbuild')
  const bundle = (await build({ entryPoints: [join(ROOT, 'scripts/fixtures/research-guide-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })).outputFiles[0].text
  const copy = await scratchCopy(SOURCE, '26aa-research-guide')
  const browser = await chromium.launch()
  try {
    setUser(await prisma.user.findUniqueOrThrow({ where: { id: copy.userId } }))
    const registry = await import('../app/api/ideas/[id]/source-registry/route')
    const notebook = await import('../app/api/ideas/[id]/research-notebook/route')
    const params = { params: Promise.resolve({ id: copy.id }) }
    // fixtures on the copy, through the real route: a web page and pasted text, so the list has rows, "Choose" buttons and a duplicate to offer
    const add = async (body: unknown) => (await notebook.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), params)).status
    const s1 = await add({ op: 'addNote', newSource: { kind: 'URL', title: 'ZZ fixture web page', url: 'https://example.org/zz-26aa-fixture', sourceType: 'web page' }, comment: 'fixture', stance: 'CONTEXT', bearsOn: [], tags: [] })
    // ⚠ NO fullText: a source with text is read into findings by a model call (runMaterialFindings), and this check spends nothing
    const s2 = await add({ op: 'addNote', newSource: { kind: 'DOCUMENT', title: 'ZZ fixture pasted text', sourceType: 'pasted text' }, comment: 'fixture', stance: 'SUPPORTS', bearsOn: [], tags: [] })
    ok('the fixtures are on the copy (two sources, through the notebook route)', s1 === 200 && s2 === 200, `${s1} ${s2}`)

    const page = await browser.newPage({ viewport: { width: 1200, height: 3000 } })
    await page.addInitScript('window.__name = (f) => f')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    for (const [glob, h] of [['**/api/ideas/*/source-registry**', registry], ['**/api/ideas/*/research-notebook**', notebook]] as const) {
      await page.route(glob, async (r) => {
        const u = new URL(r.request().url())
        if (/research-notebook\/(fetch|extract)/.test(u.pathname)) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not in this check"}' })
        const hh = h as { GET?: (req: Request, p: typeof params) => Promise<Response>; POST?: (req: Request, p: typeof params) => Promise<Response> }
        const res = r.request().method() === 'GET' ? await hh.GET!(new Request(`http://internal.invalid/${u.search}`), params)
          : await hh.POST!(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: r.request().postData() ?? '' }), params)
        await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
      })
    }
    const mount = async (mode: string, before?: string) => {
      await page.goto('http://harness.test/')
      await page.evaluate((x) => { (window as unknown as { __rh: unknown }).__rh = x }, { mode, ideaId: copy.id })
      await page.addScriptTag({ content: bundle })
      if (before) await page.evaluate(before)
      await page.evaluate(() => (window as unknown as { __mount: () => void }).__mount())
    }
    // The same reading of a label as check:lex-26w-b's part D: a control's own words, with data (counts, values) and decoration dropped.
    const collect = () => page.evaluate(() => {
      const SKIP = '[data-host-cards], option, [data-dup-groups] li, [data-source-count], [data-saved-ref]'
      const DATA = '[data-shown-value], [data-limit-counter], [data-filter-help]'
      const own = (el: Element): string[] => {
        if (el.tagName === 'LABEL' || el.tagName === 'LEGEND') {
          return [Array.from(el.childNodes).filter((c) => c.nodeType === 3 || (c.nodeType === 1 && (c as Element).tagName === 'SPAN' && !(c as Element).getAttribute('aria-hidden') && !(c as Element).matches(DATA) && !(c as Element).querySelector(DATA))).map((c) => c.textContent ?? '').join(' ')]
        }
        if (!el.querySelector(DATA)) return [(el as HTMLElement).innerText]
        const c = el.cloneNode(true) as Element
        c.querySelectorAll(DATA).forEach((d) => d.remove())
        return [c.textContent ?? '']
      }
      const out: string[] = []
      const take = (raw: string) => {
        let t = raw.replace(/[●○▸▾◇■◆✓✗⚑▲△▼▽]/g, ' ').replace(/\s+/g, ' ').trim()
        t = t.split(' · ')[0].split(' — ')[0].replace(/:\s.*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/[.:]$/, '').trim()
        if (t && !/^(#\d|\d)/.test(t)) out.push(t)
      }
      for (const el of Array.from(document.querySelectorAll('button, summary, label, legend, th, caption, [role=tab], [role=radio], p.uppercase'))) {
        if (el.closest(SKIP)) continue
        for (const raw of own(el)) take(raw)
      }
      // the sort choices are words on the screen too (an <option> is skipped above, so these are read on their own, the same way)
      for (const o of Array.from(document.querySelectorAll('[data-source-sort] option'))) take(o.textContent ?? '')
      return [...new Set(out)]
    })
    const uncovered = async (): Promise<string[]> => page.evaluate((seen) => {
      const g = (window as unknown as { __guide: { guideEntries: () => Array<{ label: string }>; normLabel: (s: string) => string } }).__guide
      const held = new Set(g.guideEntries().map((e) => g.normLabel(e.label.split(' · ')[0].split(' — ')[0].replace(/:\s.*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/[.:]$/, '').trim())))
      return seen.filter((s) => !held.has(g.normLabel(s)))
    }, await collect())
    const press = async (sel: string) => { const b = page.locator(sel).first(); if (await b.count()) { await b.click().catch(() => undefined); await page.waitForTimeout(150) } }

    const all = new Set<string>(), missing = new Set<string>()
    const read = async (where: string) => { for (const l of await collect()) all.add(l); for (const l of await uncovered()) missing.add(`${where}: ${l}`) }
    for (const mode of ['sources', 'pick'] as const) {
      await mount(mode)
      await page.waitForSelector(`[data-source-browser="${mode === 'sources' ? 'list' : 'pick'}"]`, { timeout: 60_000 })
      await read(mode)
      await press('[data-all-filters]'); await press('[data-dups-only]'); await press('[data-quick-facet="web"]')
      await read(`${mode}, every filter open`)
    }
    for (const mode of ['dialog', 'bare'] as const) {
      await mount(mode)
      await page.waitForSelector('[data-choose-file]', { timeout: 60_000 })
      await read(mode)
      await press('[data-add-quote]'); await press('[data-add-comment]'); await press('[data-more-details]')
      await page.locator('textarea').first().fill('Pasted text for the check, long enough to show the quote button and the permission box.')
      await page.waitForTimeout(150)
      await read(`${mode}, every part open`)
      await page.locator('input[aria-label="Web address"]').fill('https://example.org/zz-26aa-fixture')
      await page.waitForSelector('[data-already-added]', { timeout: 10_000 }).catch(() => undefined)
      await read(`${mode}, a duplicate found`)
      await press('[data-dup-yes]')
      await read(`${mode}, a further note on it`)
      await press('button:has-text("Change")')
      await press('[data-further-note-link]')
      await page.waitForSelector('[data-further-note-picker] [data-source-browser="pick"]', { timeout: 30_000 }).catch(() => undefined)
      await read(`${mode}, the picker open`)
    }
    ok(`every label rendered by SourceBrowser and AddResearch is in the guide (${all.size} distinct labels read)`, missing.size === 0 && all.size >= 30, [...missing].join(' | ') || `only ${all.size} read`)
    ok('…the duplicate offer, the further-note picker and its "Choose" were among them', ['Yes', 'No', 'Choose', 'Possible duplicates', 'Use the selected passage as the quote'].every((l) => all.has(l)), [...all].join(', ').slice(0, 400))
    ok('no page error while rendering', errors.length === 0, errors.join(' | ').slice(0, 300))
    await page.evaluate(() => { const b = document.createElement('button'); b.textContent = 'Zq unguided control'; document.body.appendChild(b) })
    control('a planted button the guide does not hold is caught', (await uncovered()).includes('Zq unguided control'))
    // rename in the bundle's own table BEFORE mounting: the screen and the guide move together
    await mount('pick', `window.__labels.SOURCES_UI.choose = 'Pick this one'`)
    await page.waitForSelector('[data-pick-source]', { timeout: 60_000 })
    const shownNew = (await collect()).includes('Pick this one')
    const explained = await page.evaluate(() => (window as unknown as { __guide: { explainField: (s: string) => { exact: { key: string } | null } } }).__guide.explainField('Pick this one').exact?.key ?? null)
    ok('a label renamed in SOURCES_UI appears on the screen under its new word, and the guide explains it as the same entry', shownNew && explained === 'sources.choose', `${shownNew} ${explained}`)
    ok('…and the coverage still holds with the renamed label', !(await uncovered()).length, (await uncovered()).join(' | '))
  } finally {
    await browser.close()
    setUser(undefined)
    console.log(`  (scratch copy deleted: ${await deleteScratch(copy.id)})`)
  }
}

// ── item 8 (decision 355) — a background note reports its sources; the guard no longer refuses it for that ─────────────────────────
function part8() {
  section('8 · the background-note guard: a source reported or quoted is not a proposal; a real list of proposals still is')
  // the 23 paragraphs the guard counted as proposing in 5 refused drafts (20 Nov, scripts/diagnose-26aa-bgnote.ts on #24, #25, #36)
  const real = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/bgnote-refused-paragraphs-26aa.json'), 'utf8')) as string[]
  control(`the fixture is the problem: the old rule counts all ${real.length} as proposing`, real.length === 23 && real.every(isProposing))
  const still = real.filter(isProposingInNote)
  ok('…the background note\'s rule counts none of them: each reports, quotes or restates its source', still.length === 0, still.map((s) => s.slice(0, 90)).join(' | '))
  const asBody = real.map((p, i) => `## Section ${i + 1}\n\n${p}`).join('\n\n')
  ok('a background note made of those paragraphs is saved, not refused', !proposalShape('BACKGROUND_NOTE', asBody).refused)
  ok('…while the SAME text as a specification is still refused (the other kinds stay strict)', proposalShape('SPECIFICATION', asBody).refused)
  // planted: a real list of proposals in the note's own voice
  const list = ['## What should happen', 'Departments should introduce a named owner for every project.', 'The Cabinet Office should publish a register of owners by 2027.', 'Ministers ought to require annual training for every senior official.', 'Each department could set its own targets for the register.', '## What the sources do not settle', 'The source gives no date for the register [Ref: 213].'].join('\n\n')
  const shape = proposalShape('BACKGROUND_NOTE', list)
  ok(`a planted list of proposals in the note's own voice is still refused (${shape.proposing} of ${shape.paragraphs} proposing)`, shape.refused, shape.why)
  ok('first-person proposing counts even when it cites: "We recommend … [Ref: 213]"', isProposingInNote('We recommend that departments adopt the register [Ref: 213].'))
  ok('a proposing word inside a quotation is the source\'s: \'The aim is: "Departments should adopt it."\' is not counted', !isProposingInNote('The aim is: "Departments should adopt it within a year."'))
  control('…but the same words outside the quotation are', isProposingInNote('The aim is that departments should adopt it within a year.'))
  ok('"The Blueprint says … should …" is reported, not proposed; "The Cabinet Office should own …" with no source is proposed', !isProposingInNote('The Blueprint says the Cabinet Office should own the standards.') && isProposingInNote('The Cabinet Office should own the standards.'))
  const bg = KIND_RUNS.BACKGROUND_NOTE
  ok(`the background note is priced from n = ${bg.length} drafts measured with the fixed guard (n ≥ 5), the three once refused among them`, bg.length >= 5 && bg.every((r) => /fixed guard/.test(r.on)) && [24, 25, 36].every((n) => bg.some((r) => r.on.includes(`#${n},`))))
}

// ── item 1 — the hard deletes of user content become archive with restore (decisions 183/196) ───────────────────────────────────────
/** The models whose rows are user content. A `.delete(` / `.deleteMany(` on any of them, outside the three named exceptions, is red. */
const USER_CONTENT_MODELS = ['policyOption', 'ideaNote', 'coherentActionSection', 'evidenceItem', 'ideaGroup', 'diagnosisCause', 'ideaUserMaterial', 'idea', 'actionHeading', 'costLine', 'benefitLine']
const USER_CONTENT_TABLES = ['PolicyOption', 'IdeaNote', 'CoherentActionSection', 'EvidenceItem', 'IdeaGroup', 'DiagnosisCause', 'IdeaUserMaterial', 'Idea', 'ActionHeading', 'CostLine', 'BenefitLine']
/** Each exception is a file AND a model, and each says why. Nothing else may delete user content. */
const DELETE_EXCEPTIONS: Array<{ file: string; model: string; why: string }> = [
  { file: 'lib/lex/field-machine.ts', model: 'costLine', why: 'decision 320: cost lines stay deletable (remove_cost_line)' },
  { file: 'lib/graph/position-block.ts', model: 'evidenceItem', why: 'the POSITIONS pass is derived and rewritten wholesale (inventory E)' },
  { file: 'lib/lex/idea-lifecycle.ts', model: 'ideaGroup', why: 'cleanupGroupIfEmpty removes a group with no idea left in it (26-D §5d; inventory E)' },
]
const deleteRe = new RegExp(`\\b\\w+\\.(${USER_CONTENT_MODELS.join('|')})\\.(delete|deleteMany)\\(`, 'g')
const rawDeleteRe = new RegExp(`DELETE\\s+FROM\\s+"?(${USER_CONTENT_TABLES.join('|')})"?(\\s|;|$)`, 'gi')
/** The scanner, applied to one file's text (comments stripped first). Returns every user-content delete it finds. */
function userContentDeletes(file: string, text: string): Array<{ file: string; model: string; at: string }> {
  const s = stripComments(text)
  const out: Array<{ file: string; model: string; at: string }> = []
  for (const m of s.matchAll(deleteRe)) out.push({ file, model: m[1], at: m[0] })
  for (const m of s.matchAll(rawDeleteRe)) out.push({ file, model: m[1].charAt(0).toLowerCase() + m[1].slice(1), at: m[0].trim() })
  return out
}
function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

function part1Static() {
  section('1 · no user-content DELETE remains outside the named exceptions (static scan over app/ and lib/, with planted controls)')
  const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]
  const found = files.flatMap((f) => userContentDeletes(f.slice(ROOT.length + 1).replace(/\\/g, '/'), readFileSync(f, 'utf8')))
  const isExcepted = (d: { file: string; model: string }) => DELETE_EXCEPTIONS.some((x) => x.file === d.file && x.model === d.model)
  const offenders = found.filter((d) => !isExcepted(d))
  ok(`the scan reached ${files.length} files under app/ and lib/`, files.length > 500, files.length)
  ok('no user-content delete outside the exceptions', offenders.length === 0, offenders.map((o) => `${o.file}: ${o.at}`).join(' | '))
  for (const x of DELETE_EXCEPTIONS) {
    ok(`the exception is still there, and still needed: ${x.file} (${x.model}) — ${x.why}`, found.some((d) => d.file === x.file && d.model === x.model))
  }
  // planted: a hard delete of each kind the scanner must catch, and the forms it must not be fooled by
  control('a planted `prisma.ideaNote.deleteMany({…})` is caught', userContentDeletes('x.ts', 'await prisma.ideaNote.deleteMany({ where: { id } })').length === 1)
  control('a planted `tx.policyOption.delete(` inside a transaction is caught', userContentDeletes('x.ts', 'await tx.policyOption.delete({ where: { id } })').length === 1)
  control('a planted raw `DELETE FROM "EvidenceItem"` is caught', userContentDeletes('x.ts', 'await pool.query(`DELETE FROM "EvidenceItem" WHERE id = $1`, [id])').length === 1)
  control('…while the same words in a comment are not', userContentDeletes('x.ts', '// we used to call prisma.ideaNote.delete( here\n/* DELETE FROM "IdeaNote" */').length === 0)
  control('…and a cost-line delete outside field-machine.ts is NOT excepted (the exception is a file and a model)', !isExcepted({ file: 'app/api/x/route.ts', model: 'costLine' }))
  // the screens say what happens
  const screens: Array<[string, string]> = [['components/lex/FieldsPanel.tsx', 'data-remove-option'], ['components/lex/NotesPanel.tsx', 'data-remove-note'], ['components/lex/YourMaterial.tsx', 'data-remove-source']]
  for (const [f, marker] of screens) {
    const s = stripComments(readFileSync(join(ROOT, f), 'utf8'))
    const line = s.split('\n').find((l) => l.includes(marker)) ?? ''
    ok(`${f}: the button reads ARCHIVE_UI.remove ("${ARCHIVE_UI.remove}"), not "Delete"`, /ARCHIVE_UI\.remove/.test(s.slice(s.indexOf(marker), s.indexOf(marker) + 400)) && !/>\s*Delete\s*</.test(s), line.trim().slice(0, 160))
  }
  ok(`My Ideas: "Ungroup" reads ARCHIVE_UI.ungroup ("${ARCHIVE_UI.ungroup}")`, /data-ungroup[^>]*>\{ARCHIVE_UI\.ungroup\}/.test(stripComments(readFileSync(join(ROOT, 'components/lex/MyIdeasList.tsx'), 'utf8'))))
  const costLineButton = stripComments(readFileSync(join(ROOT, 'components/lex/FieldsPanel.tsx'), 'utf8'))
  ok('decision 320: the cost line\'s own remove button is unchanged (costLinesApi.remove, not an archive)', /costLinesApi\.remove\(l\.id\)/.test(costLineButton))
}

async function part1() {
  section('1 · archive with restore, path by path, on scratch copies of 452c5ade')
  const S = await scratchCopy(SOURCE, '26aa-archive')
  const T = await scratchCopy(SOURCE, '26aa-archive-other')
  const madeActions: string[] = []
  let throwaway: string | null = null
  const groupIds: string[] = []
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: S.userId } })
    // A throwaway user, made and deleted here: "someone else" for the privacy control, and the owner in the group test, so no real
    // account ever holds a test note or a test group.
    const mark = `zz26aa_${Date.now()}`
    const u = await prisma.user.create({
      data: { clerkId: mark, email: `${mark}@example.invalid`, firstName: 'Check', lastName: '26AA', name: 'Check 26AA', username: mark, referralCode: randomUUID() },
    })
    throwaway = u.id
    setUser(owner)

    // ── A1 · candidate approaches ────────────────────────────────────────────
    {
      const { POST } = await import('../app/api/ideas/[id]/policy-options/route')
      const press = async (ideaId: string, body: unknown) => {
        const r = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: ideaId }) })
        return { status: r.status, json: await r.json().catch(() => null) as { state?: { policyOptions: Array<{ id: string }>; removedPolicyOptions: Array<{ id: string; number: number | null }> }; error?: unknown } | null }
      }
      let live = await prisma.policyOption.findMany({ where: { ideaId: S.id }, orderBy: { number: 'asc' }, select: { id: true, number: true, status: true } })
      if (live.length < 2) {
        await addPolicyOption(S.id, { approach: 'ZZ 26aa scratch approach one', source: 'USER' })
        await addPolicyOption(S.id, { approach: 'ZZ 26aa scratch approach two', source: 'USER' })
        live = await prisma.policyOption.findMany({ where: { ideaId: S.id }, orderBy: { number: 'asc' }, select: { id: true, number: true, status: true } })
      }
      const top = live.reduce((a, b) => ((b.number ?? 0) > (a.number ?? 0) ? b : a))
      const highest = top.number ?? 0
      const r = await press(S.id, { action: 'remove', optionId: top.id })
      ok(`A1 "Remove (can be restored)" on candidate ${highest} answers 200`, r.status === 200, JSON.stringify(r.json?.error ?? r.status))
      const row = await prisma.policyOption.findUnique({ where: { id: top.id } })
      ok('A1 …the row is kept: archived, by the owner, reason REMOVED, number and status unchanged', !!row?.archivedAt && row.archivedById === owner.id && row.archiveReason === 'REMOVED' && row.number === highest && row.status === top.status, JSON.stringify(row && { a: row.archivedAt, by: row.archivedById, why: row.archiveReason, n: row.number, s: row.status }))
      ok('A1 …it has left the live list (the state the screen reads)', !r.json?.state?.policyOptions.some((o) => o.id === top.id))
      ok('A1 …and is listed under "Removed", with its number', !!r.json?.state?.removedPolicyOptions.some((o) => o.id === top.id && o.number === highest))
      ok('A1 …a direct read (findMany) no longer sees it', !(await prisma.policyOption.findMany({ where: { ideaId: S.id }, select: { id: true } })).some((o) => o.id === top.id))
      const added = await addPolicyOption(S.id, { approach: 'ZZ 26aa scratch: added after a removal', source: 'USER' })
      ok(`A1 numbers are never reused: the next candidate is ${highest + 1}, not ${highest}`, added.number === highest + 1, added.number)
      const back = await press(S.id, { action: 'restore', optionId: top.id })
      const after = await prisma.policyOption.findUnique({ where: { id: top.id } })
      ok('A1 Restore brings it back: live, its number and status as they were, the stamp cleared', back.status === 200 && after?.archivedAt === null && after.archivedById === null && after.archiveReason === null && after.number === highest && after.status === (top.status === 'CHOSEN' ? 'CANDIDATE' : top.status), JSON.stringify(after && { a: after.archivedAt, n: after.number, s: after.status }))
      ok('A1 …and it is in the live list again', !!back.json?.state?.policyOptions.some((o) => o.id === top.id) && !back.json?.state?.removedPolicyOptions.some((o) => o.id === top.id))
      const again = await press(S.id, { action: 'restore', optionId: top.id })
      control('A1 restoring a live candidate is refused, in words (422)', again.status === 422 && typeof again.json?.error === 'string', JSON.stringify(again.json))
      const other = await prisma.policyOption.findFirst({ where: { ideaId: T.id }, select: { id: true } })
      if (other) {
        const cross = await press(S.id, { action: 'remove', optionId: other.id })
        control('A1 another idea\'s candidate, sent through this idea, is refused and left live', cross.status === 422 && !(await prisma.policyOption.findUnique({ where: { id: other.id } }))?.archivedAt, JSON.stringify(cross.json))
      } else { notRun++; console.log('  (A1 cross-idea control not run: the second copy has no candidate)') }
      // a bulk write must not reach an archived row: "rule out every other policy" on choose
      await press(S.id, { action: 'remove', optionId: added.id })
      const statusBefore = (await prisma.policyOption.findUnique({ where: { id: added.id } }))!.status
      await prisma.policyOption.updateMany({ where: { ideaId: S.id }, data: { stale: true } })
      const bulk = await prisma.policyOption.findUnique({ where: { id: added.id } })
      ok('A1 a bulk updateMany on the idea\'s candidates does not touch an archived one', bulk?.stale === false && bulk.status === statusBefore, JSON.stringify(bulk && { stale: bulk.stale }))
    }

    // ── A2 · private notes ───────────────────────────────────────────────────
    {
      const notes = await import('../app/api/ideas/[id]/notes/route')
      const P = { params: Promise.resolve({ id: S.id }) }
      const made = await notes.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ heading: '' }) }), P)
      const madeBody = await made.json() as { notes: Array<{ id: string; title: string }> }
      const fresh = madeBody.notes[madeBody.notes.length - 1]
      await notes.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ noteId: fresh.id, title: 'ZZ 26aa note', body: 'Who to ask about the register.' }) }), P)
      const del = await notes.DELETE(new Request(`http://x?noteId=${fresh.id}`, { method: 'DELETE' }), P)
      const delBody = await del.json() as { notes: Array<{ id: string }>; removed: Array<{ id: string; title: string }> }
      const row = await prisma.ideaNote.findUnique({ where: { id: fresh.id } })
      ok('A2 "Remove (can be restored)" keeps the note: archived, by its author, reason REMOVED, words intact', del.status === 200 && !!row?.archivedAt && row.archivedById === owner.id && row.archiveReason === 'REMOVED' && row.body === 'Who to ask about the register.', JSON.stringify(row && { a: row.archivedAt, by: row.archivedById }))
      ok('A2 …out of the notes list, and under "Removed"', !delBody.notes.some((n) => n.id === fresh.id) && delBody.removed.some((n) => n.id === fresh.id && n.title === 'ZZ 26aa note'))
      const res = await notes.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ noteId: fresh.id, restore: true }) }), P)
      const resBody = await res.json() as { notes: Array<{ id: string; title: string }>; removed: Array<{ id: string }> }
      ok('A2 Restore brings it back with its title and words, and out of "Removed"', res.status === 200 && resBody.notes.some((n) => n.id === fresh.id && n.title === 'ZZ 26aa note') && !resBody.removed.some((n) => n.id === fresh.id) && (await prisma.ideaNote.findUnique({ where: { id: fresh.id } }))?.archivedAt === null)
      // privacy: another user's note on the same idea
      const theirs = await prisma.ideaNote.create({ data: { ideaId: S.id, userId: u.id, title: 'ZZ 26aa someone else', body: 'not yours' }, select: { id: true } })
      const cross = await notes.DELETE(new Request(`http://x?noteId=${theirs.id}`, { method: 'DELETE' }), P)
      control('A2 another user\'s note on the same idea cannot be removed (404), and stays live', cross.status === 404 && (await prisma.ideaNote.findUnique({ where: { id: theirs.id } }))?.archivedAt === null)
      const peek = await notes.GET(new Request('http://x'), P)
      control('A2 …nor seen in the owner\'s removed list', !((await peek.json()) as { removed: Array<{ id: string }> }).removed.some((n) => n.id === theirs.id))
      // the seeded "My original idea" note does not come back unbidden once removed. The copy is given a summary to seed from (scratch only).
      await prisma.idea.update({ where: { id: S.id }, data: { summaryDescription: 'ZZ 26aa: the original idea, in the owner\'s words.' } })
      await notes.GET(new Request('http://x'), P)
      const seeded = await prisma.ideaNote.findFirst({ where: { ideaId: S.id, userId: owner.id, source: { not: 'USER' } }, select: { id: true } })
      if (seeded) {
        await notes.DELETE(new Request(`http://x?noteId=${seeded.id}`, { method: 'DELETE' }), P)
        await notes.GET(new Request('http://x'), P)
        const seededRows = await prisma.ideaNote.count({ where: { ideaId: S.id, userId: owner.id, source: { not: 'USER' }, archivedAt: undefined } })
        ok('A2 a removed "My original idea" is not seeded again on the next load (one row, archived)', seededRows === 1, seededRows)
      } else { notRun++; console.log('  (A2 seeded-note case not run: the copy has no summary to seed from)') }
    }

    // ── A3 · law links: restore, and a re-add restores rather than duplicating ──
    {
      const ll = await import('../app/api/ideas/[id]/legislation-link/route')
      const P = { params: Promise.resolve({ id: S.id }) }
      const sec = await prisma.legislationSection.findFirst({ select: { id: true } })
      const ca = await prisma.coherentAction.create({ data: { ideaId: S.id, title: 'ZZ-scratch 26aa archive action' }, select: { id: true } })
      madeActions.push(ca.id)
      const link = await prisma.coherentActionSection.create({ data: { coherentActionId: ca.id, legislationSectionId: sec!.id, proposedWording: 'the owner’s wording' }, select: { id: true } })
      const del = await ll.DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ coherentActionSectionId: link.id }) }), P)
      const row = await prisma.coherentActionSection.findUnique({ where: { id: link.id } })
      ok('A3 removing a law link archives it with the owner\'s wording', del.status === 200 && !!row?.archivedAt && row.archivedById === owner.id && row.proposedWording === 'the owner’s wording')
      ok('A3 …and a direct read no longer sees it', !(await prisma.coherentActionSection.findFirst({ where: { coherentActionId: ca.id } })))
      const res = await ll.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ coherentActionSectionId: link.id, restore: true }) }), P)
      ok('A3 Restore brings it back, wording intact', res.status === 200 && (await prisma.coherentActionSection.findFirst({ where: { coherentActionId: ca.id } }))?.proposedWording === 'the owner’s wording')
      const res2 = await ll.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ coherentActionSectionId: link.id, restore: true }) }), { params: Promise.resolve({ id: T.id }) })
      control('A3 a restore sent through another idea is refused (404)', res2.status === 404)
      await ll.DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ coherentActionSectionId: link.id }) }), P)
      const re = await ll.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ coherentActionId: ca.id, legislationSectionId: sec!.id, proposedWording: 'new wording' }) }), P)
      const reBody = await re.json() as { record: { id: string } }
      const all = await prisma.coherentActionSection.findMany({ where: { coherentActionId: ca.id, archivedAt: undefined }, select: { id: true, archivedAt: true, proposedWording: true } })
      ok('A3 re-adding a removed link restores that row with the new wording (no archived twin)', reBody.record.id === link.id && all.length === 1 && all[0].archivedAt === null && all[0].proposedWording === 'new wording', JSON.stringify(all))
    }

    // ── A4 · a filed source and its findings ─────────────────────────────────
    {
      const mat = await import('../app/api/ideas/[id]/material/route')
      const P = { params: Promise.resolve({ id: S.id }) }
      const makeSource = async (label: string) => {
        const m = await prisma.ideaUserMaterial.create({ data: { ideaId: S.id, kind: 'FILE', label, addedBy: owner.id, status: 'READY', text: 'The register has no owner.', findingCount: 2, findingsAt: new Date() }, select: { id: true } })
        const base = { ideaId: S.id, passKey: `material:${m.id}`, sourceType: 'USER_DOCUMENT', sourceId: m.id, body: 'b' }
        const acc = await prisma.evidenceItem.create({ data: { ...base, title: 'ZZ accepted finding', status: 'ACCEPTED' }, select: { id: true } })
        const pro = await prisma.evidenceItem.create({ data: { ...base, title: 'ZZ proposed finding', status: 'PROPOSED' }, select: { id: true } })
        return { id: m.id, acc: acc.id, pro: pro.id }
      }
      const src = await makeSource('ZZ 26aa source (screen)')
      const del = await mat.DELETE(new Request(`http://x?materialId=${src.id}`, { method: 'DELETE' }), P)
      const delBody = await del.json() as { material: Array<{ id: string }>; removed: Array<{ id: string }> }
      const f = await prisma.evidenceItem.findMany({ where: { id: { in: [src.acc, src.pro] }, archivedAt: undefined }, select: { id: true, status: true, archivedAt: true, archiveReason: true, archivedById: true } })
      ok('A4 removing a source archives its findings with it (both kept, SOURCE_ARCHIVED, by the owner)', del.status === 200 && f.length === 2 && f.every((x) => !!x.archivedAt && x.archiveReason === 'SOURCE_ARCHIVED' && x.archivedById === owner.id), JSON.stringify(f))
      ok('A4 …the ACCEPTED finding is still ACCEPTED in the archive', f.find((x) => x.id === src.acc)?.status === 'ACCEPTED')
      ok('A4 …no live read sees them', (await prisma.evidenceItem.count({ where: { ideaId: S.id, passKey: `material:${src.id}` } })) === 0)
      ok('A4 …the source is under "Removed"', !delBody.material.some((m) => m.id === src.id) && delBody.removed.some((m) => m.id === src.id))
      const res = await mat.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ restore: src.id }) }), P)
      const resBody = await res.json() as { findingsRestored?: number; reread?: boolean; material: Array<{ id: string }> }
      const back = await prisma.evidenceItem.findMany({ where: { ideaId: S.id, passKey: `material:${src.id}` }, select: { id: true, status: true } })
      ok('A4 Restore brings the source and both findings back, each with its own status, without a re-read', res.status === 200 && resBody.findingsRestored === 2 && resBody.reread === false && back.length === 2 && back.find((x) => x.id === src.acc)?.status === 'ACCEPTED' && back.find((x) => x.id === src.pro)?.status === 'PROPOSED' && resBody.material.some((m) => m.id === src.id), JSON.stringify({ s: res.status, r: resBody.findingsRestored, rr: resBody.reread, back }))
      const again = await mat.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ restore: src.id }) }), P)
      control('A4 restoring a live source is refused, in words (404)', again.status === 404 && typeof ((await again.json()) as { error?: unknown }).error === 'string')
      // Lex: archive_source / restore_source share the functions
      const viaLex = await makeSource('ZZ 26aa source (Lex)')
      const ctx = ctxFor(S.id, owner.id, true)
      const a = await execute(toolByName('archive_source')!, ctx, { sourceId: viaLex.id })
      const fl = await prisma.evidenceItem.findMany({ where: { id: { in: [viaLex.acc, viaLex.pro] }, archivedAt: undefined }, select: { archivedAt: true, archiveReason: true } })
      ok('A4 Lex\'s archive_source archives the findings too (it deleted them before)', a.ok && fl.length === 2 && fl.every((x) => !!x.archivedAt && x.archiveReason === 'SOURCE_ARCHIVED'), a.error)
      const b = await execute(toolByName('restore_source')!, ctx, { sourceId: viaLex.id })
      const data = b.data as { findingsRestored?: number; reread?: boolean } | undefined
      ok('A4 Lex\'s restore_source brings them back without a re-read (no spend)', b.ok && data?.findingsRestored === 2 && data.reread === false && (await prisma.evidenceItem.count({ where: { ideaId: S.id, passKey: `material:${viaLex.id}` } })) === 2, b.error ?? JSON.stringify(data))
      // a source archived before 26-AA: its findings were deleted, and it had none to begin with here, so no re-read either
      const legacy = await prisma.ideaUserMaterial.create({ data: { ideaId: S.id, kind: 'FILE', label: 'ZZ 26aa legacy source', addedBy: owner.id, status: 'READY', text: 't', findingCount: 0, findingsAt: new Date(), archivedAt: new Date() }, select: { id: true } })
      const lr = await mat.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ restore: legacy.id }) }), P)
      const lrBody = await lr.json() as { findingsRestored?: number; reread?: boolean }
      ok('A4 a source that had no findings is restored without a re-read', lr.status === 200 && lrBody.reread === false && lrBody.findingsRestored === 0, JSON.stringify(lrBody))
      notRun++; console.log('  (A4 the legacy re-read — a source archived before 26-AA with findings — not run: it spends a model call; the branch is one `if` in restoreSource)')
    }

    // ── B · My Ideas groups (a throwaway owner, so no real account holds a test group) ──
    {
      await prisma.idea.updateMany({ where: { id: { in: [S.id, T.id] } }, data: { creatorId: u.id } })
      setUser(u)
      const g = await prisma.ideaGroup.create({ data: { ownerId: u.id, name: 'ZZ 26aa group' }, select: { id: true } })
      const g2 = await prisma.ideaGroup.create({ data: { ownerId: u.id, name: 'ZZ 26aa other group' }, select: { id: true } })
      groupIds.push(g.id, g2.id)
      await prisma.idea.updateMany({ where: { id: { in: [S.id, T.id] } }, data: { groupId: g.id } })
      const gr = await import('../app/api/ideas/groups/[groupId]/route')
      const P = { params: Promise.resolve({ groupId: g.id }) }
      const un = await gr.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ ungroup: true }) }), P)
      const row = await prisma.ideaGroup.findUnique({ where: { id: g.id } })
      const ideasNow = await prisma.idea.findMany({ where: { id: { in: [S.id, T.id] } }, select: { groupId: true } })
      ok('B "Ungroup" returns both ideas to the ungrouped list, as before', un.status === 200 && ideasNow.every((i) => i.groupId === null))
      ok('B …and keeps the group: archived, UNGROUPED, with the two ideas it held', !!row?.archivedAt && row.archiveReason === 'UNGROUPED' && row.archivedById === u.id && [...row.archivedIdeaIds].sort().join() === [S.id, T.id].sort().join(), JSON.stringify(row && { a: row.archivedAt, ids: row.archivedIdeaIds }))
      ok('B …out of the live groups, and listed for restore', !(await prisma.ideaGroup.findMany({ where: { ownerId: u.id } })).some((x) => x.id === g.id) && (await listArchivedGroups(u.id)).some((x) => x.id === g.id && x.ideaCount === 2))
      await prisma.idea.update({ where: { id: T.id }, data: { groupId: g2.id } }) // filed elsewhere since
      const re = await gr.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ restore: true }) }), P)
      const reBody = await re.json() as { returnedIdeaIds?: string[]; leftWhereTheyAre?: number }
      const s2 = await prisma.idea.findUnique({ where: { id: S.id }, select: { groupId: true } })
      const t2 = await prisma.idea.findUnique({ where: { id: T.id }, select: { groupId: true } })
      ok('B Restore puts back the idea that is still ungrouped, and leaves the one filed elsewhere where it is (and says so)', re.status === 200 && s2?.groupId === g.id && t2?.groupId === g2.id && reBody.leftWhereTheyAre === 1 && reBody.returnedIdeaIds?.join() === S.id, JSON.stringify(reBody))
      ok('B …the group is live again, its stamp and list cleared', (await prisma.ideaGroup.findUnique({ where: { id: g.id } }))?.archivedAt === null && (await prisma.ideaGroup.findUnique({ where: { id: g.id } }))?.archivedIdeaIds.length === 0)
      setUser({ ...u, id: owner.id })
      const theirs = await gr.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ ungroup: true }) }), P)
      control('B another user cannot ungroup (404), and the group stays live', theirs.status === 404 && (await prisma.ideaGroup.findUnique({ where: { id: g.id } }))?.archivedAt === null)
    }
  } finally {
    setUser(undefined)
    // the copies go back to their owner before they are deleted, so the throwaway user can go after them
    await prisma.idea.updateMany({ where: { id: { in: [S.id, T.id] } }, data: { creatorId: S.userId, groupId: null } })
    if (groupIds.length) await prisma.ideaGroup.deleteMany({ where: { id: { in: groupIds }, archivedAt: undefined } }) // the check's own rows
    if (madeActions.length) await prisma.coherentAction.deleteMany({ where: { id: { in: madeActions } } })
    console.log(`  (scratch copies deleted: ${await deleteScratch(S.id)}, ${await deleteScratch(T.id)})`)
    if (throwaway) await prisma.user.delete({ where: { id: throwaway } })
  }
}

async function main() {
  // --item1: the item-1 parts only (the mutation runner uses it, one mutant at a time)
  if (process.argv.includes('--item1')) {
    part1Static(); await partA3(); await part1()
    console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
    process.exit(fail || dead ? 1 : 0)
  }
  part1Static()
  part2Static()
  part3Static()
  part4()
  part5Static()
  part8()
  if (process.argv.includes('--pure')) { notRun += 5; console.log('  (A3, items 1, 2, 3 and 5 on the database not run: --pure)') }
  else { await partA3(); await part1(); await part2(); await part3(); await part5() }
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
