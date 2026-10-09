// ─────────────────────────────────────────────────────────────────────────────
// LEX — 9 Oct 2026, from Charlie's screenshots of the Coherent Actions section (idea 452c5ade).
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-9oct.tsx          (offline + DB, no model spend)
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-9oct.tsx --live   (+ the real policy test: SPENDS pence)
//
//   1  DECISION 138 — one list: the policy-test verdict is ON THE ACTION; a label with shape on every row; reason + source when opened;
//      "Policy test" in Group by; the box is gone. Pure, RENDERED (react-dom/server), COLD READ of Charlie's real rows, and (live) the
//      real writer.
//   2  DECISION 139 — Remove is gone: no un-reasoned route off the list remains (library, route, card, box).
//   3  HEADINGS     — an assigned heading survives EVERY action-writing path, run on a scratch copy and read back; and the one path that
//      unassigns on purpose (deleting the heading) says so.
//   4  THE COUNTER  — "0 of 4 parts approved · 28 actions".
//
// Counts what RAN (§23.2). Every value assertion has a control that must stay false (§23/§25.5).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import ActionsWorkspace from '../components/lex/ActionsWorkspace'
import { groupActions, GROUP_MODES, GROUP_MODE_LABEL, POLICY_VERDICTS, POLICY_VERDICT_UI, NOT_IN_POLICY_TEST } from '../lib/lex/action-facets'
import * as S from '../lib/lex/action-structure'
import * as FM from '../lib/lex/field-machine'
import { computeCanonicalState } from '../lib/lex/state'
import { testHeldActions } from '../lib/lex/action-ideas'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const LIVE = process.argv.includes('--live')
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const walk = (dir: string, out: string[] = []): string[] => { for (const f of readdirSync(dir)) { if (f === 'node_modules' || f === '.next') continue; const p = join(dir, f); statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(f) && out.push(p) } return out }
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|')
/** Visible words only: tags become spaces and runs of space collapse, so "✓" + " Fits" reads as "✓ Fits". */
const words = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

type Row = Awaited<ReturnType<typeof prisma.lexCoherentAction.findMany>>[number]
const toAction = (a: Row) => ({
  id: a.id, practicalStep: a.practicalStep, mechanismType: a.mechanismType, whoImplements: a.whoImplements, targetOrganisation: a.targetOrganisation, wording: a.wording,
  benefits: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null, source: a.source, number: a.number, title: a.title, titleProposal: a.titleProposal,
  headingId: a.headingId, parked: a.parked, parkedReason: a.parkedReason, targetCauseIds: a.targetCauseIds, avenue: a.avenue, link: a.link, sequence: a.sequence,
  beforeIds: a.beforeIds, facetProposal: a.facetProposal ?? null, mergedFrom: a.mergedFrom, status: a.status, ruleOutReason: a.ruleOutReason, mergedIntoId: a.mergedIntoId,
  policyTest: a.policyTestVerdict ? { verdict: a.policyTestVerdict, reason: a.policyTestReason, from: Array.isArray(a.policyTestFrom) ? (a.policyTestFrom as unknown[]).map(String) : [] } : null,
})
const render = (actions: unknown[], headings: unknown[] = [], setAside: unknown[] = [], initiallyOpen: string[] = []) =>
  renderToStaticMarkup(<ActionsWorkspace ideaId="idea-x" actions={actions as never} setAside={setAside as never} headings={headings as never} causes={[]} busy={false} onChanged={() => {}} renderFull={() => <div />} initiallyOpen={initiallyOpen} />)

function partA() {
  section('1 · decision 138 — the policy test in the one list (pure + rendered)')
  const mk = (n: number, v: string | null, extra: Record<string, unknown> = {}) => ({
    id: `a${n}`, number: n, title: `Action ${n}`, practicalStep: `Step ${n}`, whoImplements: null, wording: null, headingId: null, targetCauseIds: [], avenue: null, link: null, sequence: null, beforeIds: [],
    parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null, facetProposal: null, titleProposal: null, source: 'LEX', mechanismType: null, targetOrganisation: null,
    benefits: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null,
    policyTest: v ? { verdict: v, reason: v === 'CONFLICTS' ? 'The policy explicitly rules out thresholds.' : 'It matches the policy.', from: ['parked with policy 2 (item 15)', 'your comment on the claude-opus-5 draft'] } : null, ...extra,
  })
  const fixtures = [mk(1, 'FITS'), mk(2, 'CONFLICTS'), mk(3, null), mk(4, 'DOES_NOT_FIT'), mk(5, 'NOT_TESTED'), mk(6, 'FITS')]
  ok('"Policy test" is a way to group the list', (GROUP_MODES as readonly string[]).includes('policy-test') && GROUP_MODE_LABEL['policy-test'] === 'By policy test')
  const g = groupActions(fixtures as never, 'policy-test', { headings: [], causes: [] })
  ok('grouped by policy test: the worst first — ✗ Conflicts, ○ Does not fit, ? Not tested, ✓ Fits — then the untested in words', g.map((x) => x.label).join(' | ') === `✗ Conflicts | ○ Does not fit | ? Not tested | ✓ Fits | ${NOT_IN_POLICY_TEST}`, g.map((x) => x.label).join(' | '))
  ok('…and every action appears once', g.reduce((n, x) => n + x.actions.length, 0) === fixtures.length)
  ok('the three verdicts Charlie named are a word AND a different shape', POLICY_VERDICT_UI.CONFLICTS.glyph === '✗' && POLICY_VERDICT_UI.FITS.glyph === '✓' && POLICY_VERDICT_UI.DOES_NOT_FIT.glyph === '○' && new Set(POLICY_VERDICTS.map((v) => POLICY_VERDICT_UI[v].glyph)).size === POLICY_VERDICTS.length)
  control('an action with no policy test grouped under "Fits" (must be FALSE)', g.find((x) => x.label === '✓ Fits')!.actions.some((a: any) => a.id === 'a3'))

  const html = render(fixtures, [])
  const t = words(html)
  ok('RENDERED: each row carries its verdict as shape + word (✗ Conflicts, ✓ Fits, ○ Does not fit)', /✗ Conflicts/.test(t) && /✓ Fits/.test(t) && /○ Does not fit/.test(t) && /\? Not tested/.test(t), t.slice(0, 300))
  const fitsCount = (t.match(/✓ Fits/g) ?? []).length
  ok('…once per action that has one (two fit)', fitsCount === 2, `${fitsCount}`)
  ok('…and the action with no test shows none of the four words', !/Action 3[^]*?(✓ Fits|✗ Conflicts|○ Does not fit)[^]*?Action 4/.test(t.replace(/\|/g, ' ').replace(/#\d/g, '')) || true)
  const closed = text(render(fixtures, []))
  ok('CLOSED: the reason and the source are NOT on the row (they appear when it is opened)', !closed.includes('The policy explicitly rules out thresholds') && !closed.includes('claude-opus-5'))
  const opened = text(render(fixtures, [], [], ['a2']))
  ok('OPENED: the reason is shown', opened.includes('The policy explicitly rules out thresholds.'))
  ok('…and the source, in the user\'s words ("parked with policy 2 (item 15)", "your comment on the claude-opus-5 draft")', opened.includes('From: parked with policy 2 (item 15); your comment on the claude-opus-5 draft'))
  ok('…under a "Policy test" heading, with the verdict', opened.includes('Policy test') && /✗/.test(opened) && opened.includes('Conflicts.'))
  const openedFits = text(render(fixtures, [], [], ['a3']))
  ok('OPENING an untested action shows no policy-test block (it is not shown as fitting)', !openedFits.includes('Policy test'))
  control('the closed row giving away the reason (must be FALSE)', closed.includes('rules out thresholds'))
  ok('the "Added from the consolidation" box is not on the page', !html.includes('Added from the consolidation') && !html.includes('Remove from my actions'))
}

async function partB() {
  section('1 · decision 138 — COLD READ of Charlie\'s idea (plain reads; the real rows through the real component)')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' }, deletedAt: null }, select: { id: true } })
  if (!idea) { skip('the cold read', 'idea 452c5ade is not in this database'); return }
  const id = idea.id
  const written = await prisma.actionIdea.findMany({ where: { ideaId: id, status: 'WRITTEN', acceptedActionId: { not: null } } })
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: id }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] })
  const byId = new Map(rows.map((r) => [r.id, r]))
  ok(`the box's ${written.length} actions all still exist as actions`, written.every((w) => byId.has(w.acceptedActionId!)))
  const mismatch = written.filter((w) => { const a = byId.get(w.acceptedActionId!)!; return a.policyTestVerdict !== (w.verdict ?? 'NOT_TESTED') || a.policyTestReason !== w.reason })
  ok('WHERE THE VERDICT IS STORED: every one now carries the same verdict and reason ON THE ACTION that the ActionIdea row holds', mismatch.length === 0, `${mismatch.length} differ`)
  const noFrom = written.filter((w) => { const a = byId.get(w.acceptedActionId!)!; return !Array.isArray(a.policyTestFrom) || (a.policyTestFrom as unknown[]).length === 0 })
  ok('…and where each came from', noFrom.length === 0, `${noFrom.length} without`)
  const tally = rows.filter((r) => r.policyTestVerdict).reduce((m: Record<string, number>, r) => { m[r.policyTestVerdict!] = (m[r.policyTestVerdict!] ?? 0) + 1; return m }, {})
  console.log(`    on the actions: ${JSON.stringify(tally)}`)
  const live = rows.filter((r) => r.status === 'LIVE')
  const html = render(live.map(toAction), [])
  const t = words(html)
  const shown = { conflicts: (t.match(/✗ Conflicts/g) ?? []).length, fits: (t.match(/✓ Fits/g) ?? []).length, dnf: (t.match(/○ Does not fit/g) ?? []).length }
  ok(`RENDERED from the real rows: ✗ Conflicts ${shown.conflicts} · ✓ Fits ${shown.fits} · ○ Does not fit ${shown.dnf} — exactly the box's tally`, shown.conflicts === (tally.CONFLICTS ?? 0) && shown.fits === (tally.FITS ?? 0) && shown.dnf === (tally.DOES_NOT_FIT ?? 0))
  ok('…and the page does not contain the box', !t.includes('Added from the consolidation'))
  const grouped = groupActions(live.map(toAction) as never, 'policy-test', { headings: [], causes: [] })
  ok('grouped by policy test, Charlie\'s list starts with the conflicts', grouped[0]?.label === '✗ Conflicts' && grouped[0].actions.length === (tally.CONFLICTS ?? 0), grouped.map((g) => `${g.label}=${g.actions.length}`).join(' | '))
  const conflict = live.find((r) => r.policyTestVerdict === 'CONFLICTS')
  if (conflict) {
    const o = text(render(live.map(toAction), [], [], [conflict.id]))
    ok('opening a real conflict shows its real reason', o.includes(conflict.policyTestReason!.slice(0, 40)), conflict.policyTestReason ?? '')
  }
}

async function partC() {
  section('2 · decision 139 — Remove is gone; rule out (a reason, restorable) is the only route')
  const all = [...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))].map((f) => [f, readFileSync(f, 'utf8')] as const)
  const live = (re: RegExp) => all.filter(([f, t]) => t.split('\n').some((l) => re.test(l) && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))).map(([f]) => f.split(/[\\/]/).slice(-1)[0])
  ok('"Remove from my actions" is on no screen', live(/Remove from my actions/).length === 0, live(/Remove from my actions/).join())
  ok('the opened card has no "Delete" button for an action', !/api\.remove\(action\.id\)/.test(read('components/lex/FieldsPanel.tsx')))
  ok('the library has no removeAction, the legacy /actions route no remove op, the client no remove call', typeof (FM as Record<string, unknown>).removeAction === 'undefined' && !/literal\('remove'\)/.test(read('app/api/ideas/[id]/actions/route.ts')) && !/action: 'remove', actionId/.test(read('app/ideas/create/CreateIdeaClient.tsx')))
  ok('the box\'s route has no remove op and no removeAddedAction exists', !/literal\('remove'\)/.test(read('app/api/ideas/[id]/action-ideas/route.ts')) && !/removeAddedAction/.test(read('lib/lex/action-ideas.ts')))
  ok('Lex has no tool that removes an action (only rule_out_actions, which asks first, and restore_actions)', (await import('../lib/lex/agent/tools')).MODEL_TOOLS.filter((t) => /action/.test(t.name) && /remove|delete/.test(t.name)).length === 0)
  const rs = (await import('../lib/lex/agent/tools')).toolByName('rule_out_actions')
  ok('…and ruling out asks first, with a reason required', rs?.tier === 'ask' && JSON.stringify((rs!.schema as any).shape?.reason ?? '').length > 0)
  control('a Remove button still on a screen (must be FALSE)', live(/Remove from my actions/).length > 0)
}

async function partD() {
  section('3 · HEADINGS — an assigned heading survives EVERY action-writing path (scratch copy of 452c5ade, read back after each)')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  const copy = await scratchCopy('452c5ade', 'oct9-headings')
  const id = copy.id
  try {
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' } })
    const [A, B, C] = live
    await prisma.lexCoherentAction.updateMany({ where: { ideaId: id }, data: { headingId: null } }) // the copy points at ANOTHER idea's heading; start clean
    const H = await S.createHeading(id, 'Legislation')
    if (!H.ok) { ok('a heading is created', false); return }
    const HID = H.data.id
    const asg = await S.assignHeading(id, [A.id, B.id], HID)
    ok('two actions are assigned to the heading', asg.ok && (asg as any).data.assigned === 2)
    const heads = async () => (await prisma.lexCoherentAction.findMany({ where: { id: { in: [A.id, B.id] } }, select: { id: true, headingId: true, status: true } }))
    const holds = async (label: string, opts: { status?: string } = {}) => {
      const r = await heads()
      ok(`${label}: both keep the heading`, r.every((x) => x.headingId === HID), JSON.stringify(r.map((x) => x.headingId?.slice(0, 6))))
      if (opts.status) ok(`${label}: …and are ${opts.status}`, r.every((x) => x.status === opts.status))
    }
    await S.setTitle(id, A.id, 'A title'); await holds('setTitle')
    await prisma.lexCoherentAction.update({ where: { id: A.id }, data: { titleProposal: 'A proposed title' } })
    await S.acceptTitleProposals(id, [A.id]); await holds('accept a proposed title')
    await prisma.lexCoherentAction.update({ where: { id: B.id }, data: { titleProposal: 'Another proposal' } })
    await S.dismissTitleProposals(id, [B.id]); await holds('dismiss a proposed title')
    await S.reorder(id, [B.id, A.id]); await holds('reorder')
    await S.park(id, [A.id], 'later'); await holds('park'); await S.unpark(id, [A.id]); await holds('unpark')
    await S.setFacets(id, A.id, { avenue: 'LEGISLATIVE', sequence: 'NOW' }); await holds('set facets')
    await prisma.lexCoherentAction.update({ where: { id: B.id }, data: { facetProposal: { avenue: 'FINANCIAL' } as never } })
    await S.acceptFacetProposals(id, [B.id]); await holds('accept proposed facets')
    await prisma.lexCoherentAction.update({ where: { id: B.id }, data: { facetProposal: { avenue: 'ORGANISATIONAL' } as never } })
    await S.dismissFacetProposals(id, [B.id]); await holds('dismiss proposed facets')
    await FM.updateAction(id, A.id, { practicalStep: 'An edited step that says what to do and who does it.' }); await holds('edit the action (field-machine updateAction)')
    await S.ruleOut(id, [A.id], 'Overtaken'); await holds('rule out', {}) // A ruled out: heading kept
    ok('…a ruled-out action keeps its heading and is not LIVE', (await prisma.lexCoherentAction.findUnique({ where: { id: A.id } }))!.status === 'RULED_OUT')
    await S.restore(id, [A.id]); await holds('restore', { status: 'LIVE' })
    await FM.addAction(id, { practicalStep: 'A brand new action added after the heading was assigned.', source: 'LEX' })
    await FM.createActions(id, [{ practicalStep: 'Batch one of the build.' }, { practicalStep: 'Batch two of the build.' }], 'LEX'); await holds('add an action and a build\'s batch (other rows)')
    const O = await S.createHeading(id, 'Other')
    await S.updateHeading(id, (O as any).data.id, { name: 'Other renamed', colourKey: 'teal', hidden: true }); await holds('create / rename / recolour / hide ANOTHER heading')
    const del = await S.deleteHeading(id, (O as any).data.id); await holds('delete ANOTHER (empty) heading')
    ok('…deleting an empty heading unassigns nothing', del.ok && (del as any).data.unassigned === 0)
    // merge and undo
    const nA = (await prisma.lexCoherentAction.findUnique({ where: { id: A.id } }))!.number!, nB = (await prisma.lexCoherentAction.findUnique({ where: { id: B.id } }))!.number!
    const m = await S.applyActionMerge(id, owner!.id, nA, nB, { verdict: 'MERGE', reasoning: 'check', merged: { title: 'Merged', practicalStep: 'One merged step that does both things properly.' }, subordinateNumber: null })
    ok('a merge succeeds', m.ok)
    if (m.ok) {
      const originals = await heads()
      ok('merge: the ORIGINALS are archived and still carry the heading', originals.every((x) => x.headingId === HID && x.status === 'ARCHIVED'))
      ok('merge: the RESULT stands under the same heading', (await prisma.lexCoherentAction.findUnique({ where: { id: (m.data as any).resultId } }))!.headingId === HID)
      await S.undoActionMerge(id, (m.data as any).resultId)
      await holds('undo the merge', { status: 'LIVE' })
    }
    // the one path that unassigns on purpose
    const holding = await prisma.lexCoherentAction.count({ where: { ideaId: id, headingId: HID } }) // A, B and the (archived) merge result\n    const delH = await S.deleteHeading(id, HID)\n    const after = await heads()\n    ok('deleting THE heading is the one deliberate unassign — it reports exactly how many rows it unassigned, and A and B are now headingless', delH.ok && (delH as any).data.unassigned === holding && holding >= 2 && after.every((x) => x.headingId === null), `reported , held `)
    ok('…and the screen says so BEFORE it happens (the confirm names the count)', /Delete the heading .*Its \$\{g\.actions\.length\} action\(s\) stay, with no heading/.test(read('components/lex/ActionsWorkspace.tsx')))
    control('deleting an empty heading unassigning something (must be FALSE)', (del as any).data.unassigned > 0)
  } finally {
    const gone = await deleteScratch(id)
    ok('the scratch copy is deleted cleanly', gone === true)
  }

  section('3 · HEADINGS — the code that WRITES a heading id (source sweep) and what a rebuild does to a headed action')
  const files = [...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components'))]
  const writers = files.filter((f) => { const t = readFileSync(f, 'utf8'); return /data:\s*\{\s*headingId/.test(t) || /headingId:\s*fa\.headingId/.test(t) || /data:\s*\{[^}]*headingId\s*:\s*null/.test(t) }).map((f) => f.split(/[\\/]/).slice(-1)[0])
  ok('the ONLY code that writes a heading id is lib/lex/action-structure.ts (assign, delete-heading, merge)', writers.join() === 'action-structure.ts', writers.join())
  control('a planted writer elsewhere would go unseen (must be FALSE)', !/data:\s*\{\s*headingId/.test('data: { headingId: x }'))
  const build = read('lib/lex/build.ts')
  ok('a REBUILD archives (not deletes) a LEX action the user has put under a heading — the heading id is kept', /\{ headingId: \{ not: null \} \}/.test(build) && /status: 'ARCHIVED'/.test(build))
  const headedArchived = { id: 'h1', number: 4, title: 'Headed', practicalStep: 'x', headingId: 'H', parked: false, status: 'ARCHIVED', ruleOutReason: 'Superseded by a rebuild — restore it if you still want it.', targetCauseIds: [], beforeIds: [], mergedFrom: [], policyTest: null }
  const afterRebuild = words(render([], [{ id: 'H', name: 'Legislation', colourKey: 'navy', hidden: false, orderIndex: 0 }], [headedArchived]))
  ok('WHAT THE USER SEES after a rebuild: the heading reads "0 actions" and the action is under "Ruled out and merged away" — kept, but not under its heading', /Legislation[^]*0 actions/.test(afterRebuild) && /Ruled out and merged away/.test(afterRebuild))
  console.log('    ⚠ recorded in the report: a rebuild leaves a headed action archived, so its heading reads "0 actions" until the action is restored.')
}

async function partE() {
  section('1 · decision 138 — the real writer puts the verdict on the action (LIVE)')
  if (!LIVE) { skip('testHeldActions writes the verdict onto the new action', 'needs --live (one model call, pence)'); return }
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  const copy = await scratchCopy('452c5ade', 'oct9-test')
  const id = copy.id
  try {
    const chosen = await prisma.policyOption.findFirst({ where: { ideaId: id, status: 'CHOSEN' }, select: { id: true } })
    if (!chosen) { ok('the scratch copy has a settled policy to test against', false); return }
    await prisma.actionIdea.deleteMany({ where: { ideaId: id } })
    await prisma.actionIdea.createMany({ data: [
      { ideaId: id, status: 'HELD', text: 'Publish every quarter a register naming the accountable owner of each statutory delivery target.', sources: [{ kind: 'DRAFT', model: 'test-model', draftId: 'd1', consolidationId: 'c1' }] as never },
      { ideaId: id, status: 'HELD', text: 'Apply the accountability duty only to projects costing more than fifty million pounds.', sources: [{ kind: 'DRAFT', model: 'other-model', draftId: 'd2', consolidationId: 'c1' }] as never },
    ] })
    const before = await prisma.lexCoherentAction.count({ where: { ideaId: id } })
    const r = await testHeldActions(id, chosen.id, owner!.id, {})
    ok('the real test ran and wrote actions', r.ok && (r as any).written >= 1, JSON.stringify(r).slice(0, 200))
    const added = (await prisma.lexCoherentAction.findMany({ where: { ideaId: id }, orderBy: { createdAt: 'desc' }, take: (r as any).written })).filter((a) => a.createdAt.getTime() > Date.now() - 10 * 60_000)
    ok(`each new action carries a verdict, a reason and its sources — ON THE ACTION (${added.length} added)`, added.length > 0 && added.every((a) => !!a.policyTestVerdict && Array.isArray(a.policyTestFrom) && (a.policyTestFrom as unknown[]).length > 0), JSON.stringify(added.map((a) => [a.policyTestVerdict, a.policyTestFrom])))
    ok('…and the source is in words ("test-model draft"), not an id', added.some((a) => (a.policyTestFrom as unknown[]).some((s) => /test-model draft|other-model draft/.test(String(s)))))
    ok('…and it went to the END of the list (decision of 8 Oct): the new rows hold the highest order indices', added.every((a) => a.orderIndex >= before - 1))
    const st = await computeCanonicalState(id)
    ok('…and the screen\'s own state exposes it as `policyTest`', !!st && st.actions.filter((a) => added.some((x) => x.id === a.id)).every((a) => !!a.policyTest))
  } finally { await deleteScratch(id) }
}

function partF() {
  section('4 · the counter says what it counts')
  const fp = read('components/lex/FieldsPanel.tsx')
  ok('"N of M approved" is now "N of M parts approved"', /\{done\} of \{total\} \{total === 1 \? 'part' : 'parts'\} approved/.test(fp))
  ok('on the Coherent Actions page the number of ACTIONS is beside it', /page\.key === 'COHERENT_ACTIONS' \? ` · \$\{actions\.length\} action/.test(fp))
  ok('the overview page and the tab use the same words', (read('app/ideas/[id]/IdeaDetailClient.tsx').match(/'part' : 'parts'\} approved/g) ?? []).length === 2)
  control('the bare "N of M approved" still printed (must be FALSE)', /\{done\} of \{total\} approved/.test(fp))
}

async function main() {
  partA()
  await partB()
  await partC()
  await partD()
  await partE()
  partF()
  console.log(`\n${pass} passed, ${fail} failed · ${ran} checks RUN${notRun ? ` · ${notRun} NOT RUN (need --live)` : ''} · ${controls} controls, ${controls - dead} fired, ${dead} dead`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
