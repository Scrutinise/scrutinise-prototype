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
// Everything here runs on SCRATCH copies of 452c5ade (scripts/lib/scratch-copy.ts), made and deleted here. Nothing writes to 452c5ade.
//
//   npm run check:lex-26aa
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { execute, toolByName, isModelTool } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'
import { guideEntries, toolsNamed } from '../lib/lex/field-guide'
import { CAUSE_UI } from '../lib/lex/screen-labels'

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
    ok('…and the link is still there, with its wording', (await prisma.coherentActionSection.findUnique({ where: { id: linkY.id } }))?.proposedWording === 'the victim’s wording')

    // A stranger who owns neither idea is refused at the ownership step (unchanged behaviour).
    setUser({ ...owner!, id: 'zz-26aa-a3-stranger', clerkId: 'zz-26aa-a3-stranger' })
    const stranger = await call(Y.id, linkY.id)
    control('a stranger who owns neither idea is refused (404) and deletes nothing', stranger.status === 404 && !!(await prisma.coherentActionSection.findUnique({ where: { id: linkY.id } })), JSON.stringify(stranger))

    // The owner deletes their own link through their own idea: the fix must not refuse the legitimate case.
    setUser(owner)
    const own = await call(X.id, linkX.id)
    control('the owner deletes their own idea’s link (200, gone)', own.status === 200 && !(await prisma.coherentActionSection.findUnique({ where: { id: linkX.id } })), JSON.stringify(own))
    const ownY = await call(Y.id, linkY.id)
    control('…and Y’s link goes when sent through Y, its own idea', ownY.status === 200 && !(await prisma.coherentActionSection.findUnique({ where: { id: linkY.id } })), JSON.stringify(ownY))
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

async function main() {
  part2Static()
  if (process.argv.includes('--pure')) { notRun += 2; console.log('  (A3 and item 2 on the database not run: --pure)') }
  else { await partA3(); await part2() }
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
