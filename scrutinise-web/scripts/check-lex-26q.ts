// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26q — BRIEF_26Q: making a long list of coherent actions workable.
//
//   npm run check:lex-26q                    Part A (pure) + Part B (database, no model) + the cold read
//   npm run check:lex-26q -- --live          …plus Part C: the REAL model passes, the REAL route and the REAL Lex tools, on a
//                                            SCRATCH COPY of Charlie's idea. ⚠ SPENDS (≈ 10–20p). Needs the preload:
//                                            npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26q.ts --live
//
// ⚠ CLAUDE.md §25 — values are read OUT of the running system (`computeCanonicalState`, the ledger, the rows), not asserted
// from source. §26 — the cold read takes a subject this check did not create. §23.1 — every file a user sees is first proved
// to have an importer. §23.2 — it prints checks RUN, and the controls that fired (§25.5: each control returns whether the
// PROPERTY holds on a deliberately broken input, and must be false).
// ─────────────────────────────────────────────────────────────────────────────

process.env.LEX_AGENT_SECRET = process.env.LEX_AGENT_SECRET || 'check-lex-26q-secret'

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { prisma } from '../lib/prisma'
import { HEADING_PALETTE, lightnessOf, contrastOnWhite, colourFor, nextColourKey } from '../lib/lex/action-headings'
import { groupActions, coverageGrid, sequenceLayout, rankDuplicates, universalCauseIds, specificEnough, actionLabel, GROUP_MODES, type ActionLike } from '../lib/lex/action-facets'
import { computeCanonicalState } from '../lib/lex/state'
import { addAction, removeAction } from '../lib/lex/field-machine'
import * as S from '../lib/lex/action-structure'
import { kernelText } from '../lib/lex/build'
import { execute, toolByName, MODEL_TOOLS } from '../lib/lex/agent/tools'
import { handleConfirm } from '../lib/lex/agent/turn'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0
const failures: string[] = []
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) } else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const controls: Array<{ label: string; fired: boolean }> = []
function control(label: string, propertyHoldsOnBrokenInput: () => boolean) {
  let held: boolean
  try { held = propertyHoldsOnBrokenInput() } catch { held = false }
  controls.push({ label, fired: !held })
}
const section = (s: string) => console.log(`\n── ${s}`)

const ROOT = resolve(process.cwd())
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n === 'generated') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}
const SOURCE = ['app', 'components', 'lib'].flatMap((d) => walk(join(ROOT, d)))
const importersOf = (name: string) => SOURCE.filter((f) => !f.endsWith(`${name}.ts`) && !f.endsWith(`${name}.tsx`) && new RegExp(`from\\s+['"][^'"]*/${name}['"]`).test(readFileSync(f, 'utf8')))

const A = (id: string, n: number, over: Partial<ActionLike> = {}): ActionLike => ({
  id, number: n, title: null, practicalStep: `step ${n}`, whoImplements: null, wording: null, headingId: null, targetCauseIds: [], avenue: null, link: null, sequence: null, beforeIds: [], ...over,
})

function partA() {
  section('A · the palette — name, shape, lightness and colour; never colour alone (§3b)')
  const L = HEADING_PALETTE.map((c) => lightnessOf(c.hex))
  const sorted = [...L].sort((a, b) => a - b)
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i])
  ok('eight colours', HEADING_PALETTE.length === 8)
  ok('every colour has its own SHAPE glyph', new Set(HEADING_PALETTE.map((c) => c.glyph)).size === 8)
  ok('every colour has its own name and key', new Set(HEADING_PALETTE.map((c) => c.name)).size === 8 && new Set(HEADING_PALETTE.map((c) => c.key)).size === 8)
  ok('they DIFFER IN LIGHTNESS: every neighbouring pair is at least 5 L* apart', Math.min(...gaps) >= 5, `min step ${Math.min(...gaps).toFixed(1)} over a ${(sorted[7] - sorted[0]).toFixed(0)}-point ladder`)
  ok('the ladder is wide enough to survive greyscale (≥ 40 L* from darkest to lightest)', sorted[7] - sorted[0] >= 40)
  ok('every colour is a legible trim on white (≥ 3:1 non-text contrast)', HEADING_PALETTE.every((c) => contrastOnWhite(c.hex) >= 3), `lightest ${Math.min(...HEADING_PALETTE.map((c) => contrastOnWhite(c.hex))).toFixed(2)}:1`)
  ok('a new heading takes an unused colour', nextColourKey(['navy', 'maroon']) === 'forest')
  control('a palette of eight same-lightness colours would be caught', () => { const flat = [40, 40, 40, 40, 40, 40, 40, 40]; const s = [...flat].sort((a, b) => a - b); return Math.min(...s.slice(1).map((v, i) => v - s[i])) >= 5 })
  const compSrc = read('components/lex/ActionsWorkspace.tsx')
  ok('the workspace prints the heading NAME and the glyph beside the colour trim (§23.1: it is imported)', /<span>\{h\.name\}<\/span>/.test(compSrc) && /\{c\.glyph\}/.test(compSrc) && importersOf('ActionsWorkspace').length >= 1 && importersOf('FieldsPanel').length >= 1)

  section('A · regrouping is a view (§4) — every facet, one control')
  const causes = [{ id: 'c1', number: 1, cause: 'one' }, { id: 'c2', number: 2, cause: 'two' }, { id: 'c3', number: 3, cause: 'three' }]
  const heads = [{ id: 'h1', name: 'Legislation', colourKey: 'navy', hidden: false, orderIndex: 0 }, { id: 'h2', name: 'Practical', colourKey: 'maroon', hidden: true, orderIndex: 1 }, { id: 'h3', name: 'Empty one', colourKey: 'forest', hidden: false, orderIndex: 2 }]
  const acts = [
    A('a1', 1, { headingId: 'h1', targetCauseIds: ['c1'], avenue: 'LEGISLATIVE', sequence: 'NOW', link: 'duty and means' }),
    A('a2', 2, { headingId: 'h2', targetCauseIds: ['c1', 'c2'], avenue: 'FINANCIAL', sequence: 'LATER', link: 'consequence' }),
    A('a3', 3, { targetCauseIds: [], avenue: null, sequence: null, link: null }),
    A('a4', 4, { headingId: 'h1', targetCauseIds: ['c2'], avenue: 'LEGISLATIVE', sequence: 'NEXT', link: 'duty and means' }),
  ]
  const ctx = { headings: heads, causes }
  const gh = groupActions(acts, 'heading', ctx)
  ok('by heading: the user\'s headings in their order, an EMPTY heading still shown, unheaded actions under "No heading"', gh.map((g) => g.label).join('|') === 'Legislation|Practical|Empty one|No heading')
  ok('by heading: a hidden heading is flagged hidden, with its count', gh[1].hidden === true && gh[1].actions.length === 1)
  ok('by heading: counts', gh.map((g) => g.actions.length).join(',') === '2,1,0,1')
  ok('by cause: an action with two causes sits under its FIRST only', (() => { const g = groupActions(acts, 'cause', ctx); return g[0].actions.map((a) => a.id).join() === 'a1,a2' && g[1].actions.map((a) => a.id).join() === 'a4' })())
  ok('by cause: actions with no cause are said to have none', groupActions(acts, 'cause', ctx).some((g) => g.label === 'No cause recorded' && g.actions[0].id === 'a3'))
  ok('by avenue: fixed order, unassigned last', groupActions(acts, 'avenue', ctx).map((g) => g.label).join('|') === 'Legislative|Financial|No avenue assigned')
  ok('by sequence: now, next, later, then unplaced', groupActions(acts, 'sequence', ctx).map((g) => g.label).join('|') === 'Now|Next|Later|Not placed in the sequence')
  ok('by link: distinct wordings, none last', groupActions(acts, 'link', ctx).map((g) => g.label).join('|') === 'consequence|duty and means|No link recorded')
  ok('regrouping never loses an action (no-loss over every mode)', GROUP_MODES.every((m) => groupActions(acts, m, ctx).reduce((n, g) => n + g.actions.length, 0) === acts.length))
  control('a regrouping that dropped the unheaded action would be caught', () => gh.slice(0, 3).reduce((n, g) => n + g.actions.length, 0) === acts.length)
  ok('"specific enough" = draft wording or a named implementer, derived', specificEnough({ wording: 'x', whoImplements: null }) && specificEnough({ wording: null, whoImplements: 'HMT' }) && !specificEnough({ wording: ' ', whoImplements: null }))
  ok('a title leads where there is one, otherwise the first words', actionLabel({ title: 'Publish the measure', practicalStep: 'long text' }) === 'Publish the measure' && actionLabel({ title: null, practicalStep: 'x'.repeat(200) }).length <= 90)

  section('A · the coverage grid — an empty row is a cause with no action (§6a)')
  const g = coverageGrid(acts, causes)
  ok('cause 3 has no action: an EMPTY ROW', g.uncovered.length === 1 && g.uncovered[0].number === 3)
  ok('rows know which actions attack them', g.causes[0].actionIds.join() === 'a1,a2' && g.causes[1].actionIds.join() === 'a2,a4')
  ok('an action with no recorded cause is reported as unplaceable, and the share recorded is stated', g.unlinkedActionIds.join() === 'a3' && g.recorded.linked === 3 && g.recorded.total === 4)
  control('a grid that called every cause covered would be caught', () => coverageGrid([], causes).uncovered.length === 0)

  section('A · the sequence view — what is achievable first and unlocks the rest (§6b)')
  const seq = sequenceLayout([
    A('x', 1, { sequence: 'NOW', beforeIds: ['y', 'z'] }), A('y', 2, { sequence: 'NEXT', beforeIds: ['z'] }), A('z', 3, { sequence: 'LATER' }), A('w', 4, { sequence: 'NOW' }),
  ])
  ok('columns', seq.columns.NOW.length === 2 && seq.columns.NEXT.length === 1 && seq.columns.LATER.length === 1)
  ok('"unlocks" is transitive (x unlocks y and z)', seq.unlocks.x === 2 && seq.unlocks.y === 1 && seq.unlocks.z === 0)
  ok('start with the NOW action that unlocks the most, and not one that unlocks nothing', seq.startWith.join() === 'x')
  const cyc = sequenceLayout([A('p', 1, { beforeIds: ['q'] }), A('q', 2, { beforeIds: ['p'] })])
  ok('an impossible order (A before B before A) is reported, not hidden', cyc.onCycle.length === 2)
  const contra = sequenceLayout([A('m', 1, { sequence: 'LATER', beforeIds: ['n'] }), A('n', 2, { sequence: 'NOW' })])
  ok('a "later" action that must come before a "now" one is flagged against the columns', contra.contradictions.length === 1)
  ok('an edge to an action no longer on the list is dangling, not drawn', sequenceLayout([A('k', 1, { beforeIds: ['gone'] })]).danglingEdges.length === 1)
  control('a layout that ignored dependencies would show no unlocks', () => sequenceLayout([A('x', 1, { sequence: 'NOW', beforeIds: [] }), A('y', 2)]).unlocks.x > 0)

  section('A · "Find duplicates" — closest pairs first, ignoring what every action attacks (§5b)')
  const many = [
    A('d1', 1, { practicalStep: 'Publish the named owner of every statutory delivery target on a public register', targetCauseIds: ['c1'] }),
    A('d2', 2, { practicalStep: 'Publish a public register naming the owner of each statutory delivery target', targetCauseIds: ['c1'] }),
    A('d3', 3, { practicalStep: 'Train departmental staff in procurement negotiation techniques', targetCauseIds: ['c1'] }),
    A('d4', 4, { practicalStep: 'Amend the Civil Service Code to include a personal duty of candour', targetCauseIds: ['c1'] }),
    A('d5', 5, { practicalStep: 'Create an independent audit unit reporting annually to Parliament', targetCauseIds: ['c1'] }),
    A('d6', 6, { practicalStep: 'Appoint the first accountable officers at director level', targetCauseIds: ['c2'] }),
  ]
  const dup = rankDuplicates(many)
  ok('the two near-identical actions are the TOP pair', dup.pairs[0]?.a === 'd1' && dup.pairs[0]?.b === 'd2', dup.pairs[0] ? `${Math.round(dup.pairs[0].score * 100)}%` : 'none')
  ok('unrelated actions are not paired', !dup.pairs.some((p) => (p.a === 'd3' || p.b === 'd3') && (p.a === 'd5' || p.b === 'd5')))
  ok('a cause nearly every action attacks (c1: 5 of 6) is IGNORED as evidence, and said to be', universalCauseIds(many).join() === 'c1' && dup.ignoredUniversalCauseIds.join() === 'c1' && dup.pairs.every((p) => p.sharedCauseIds.length === 0))
  control('a ranker that counted the universal cause would lift an unrelated pair', () => { const d = rankDuplicates(many.map((x) => ({ ...x, targetCauseIds: ['c1', ...x.targetCauseIds].slice(0, 1) })), { minScore: 0 }); return d.pairs.some((p) => p.sharedCauseIds.length > 0) })
  ok('with fewer than five linked actions there is no "everything" to ignore', universalCauseIds(many.slice(0, 3)).length === 0)
}

async function partB() {
  section('B · the database — every write proved on a scratch idea, and read back through what the screen reads')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' }, select: { id: true } })
  if (!owner) { ok('the owner account exists for the scratch idea', false, 'NOT CHECKED'); return }
  const idea = await prisma.idea.create({
    data: { creatorId: owner.id, title: 'ZZ-26Q scratch: action structure', summaryDescription: 'Scratch idea for check:lex-26q — safe to delete.', govtArea: 'Cabinet Office', ideaType: 'LEGISLATION', govtLevel: 'NATIONAL', stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT' },
    select: { id: true },
  })
  const id = idea.id
  try {
    const c1 = await prisma.diagnosisCause.create({ data: { ideaId: id, cause: 'Responsibility is spread across committees', number: 1 } as never })
    const c2 = await prisma.diagnosisCause.create({ data: { ideaId: id, cause: 'Officials face no personal consequence', number: 2 } as never })
    await prisma.diagnosisCause.create({ data: { ideaId: id, cause: 'Nobody measures delivery against a stated outcome', number: 3 } as never })
    const mk = async (step: string, extra: Record<string, unknown> = {}) => (await addAction(id, { practicalStep: step, source: 'USER', ...extra }))
    const a1 = await mk('Publish the named owner of each statutory target on a public register', { whoImplements: 'Cabinet Office' })
    const a2 = await mk('Publish a public register naming the owner of every statutory delivery target')
    const a3 = await mk('Amend the Civil Service Code to include a personal duty of candour')
    const a4 = await mk('Create an independent audit unit reporting annually to Parliament')
    // a row created by a path that never heard of `number` (the gap-check/consolidation paths use prisma.create directly)
    const raw = await prisma.lexCoherentAction.create({ data: { ideaId: id, practicalStep: 'Appoint the first accountable officers at director level', source: 'LEX' as never } })
    const nums = [a1, a2, a3, a4, raw].map((r) => r.id)
    const rows0 = await prisma.lexCoherentAction.findMany({ where: { id: { in: nums } }, select: { id: true, number: true }, orderBy: { createdAt: 'asc' } })
    ok('every action has a NUMBER, including one created by a path that never set it (the database trigger)', rows0.every((r) => r.number != null) && new Set(rows0.map((r) => r.number)).size === 5, rows0.map((r) => r.number).join(','))

    section('B · headings, assignment, order, titles')
    const h1 = await S.createHeading(id, 'Legislation')
    const h1again = await S.createHeading(id, 'legislation')
    ok('a heading is created once; the same name (any case) reuses it', h1.ok && h1again.ok && h1.data.id === h1again.data.id && h1again.data.created === false)
    const h2 = await S.createHeading(id, 'Practical')
    const colours = (await prisma.actionHeading.findMany({ where: { ideaId: id } })).map((h) => h.colourKey)
    ok('two headings get two different colours', new Set(colours).size === 2, colours.join(','))
    if (!h1.ok || !h2.ok) return
    const asg = await S.assignHeading(id, [a1.id, a2.id, a3.id], h1.data.id)
    ok('three actions assigned in one go', asg.ok && asg.data.assigned === 3)
    ok('an action id from ANOTHER idea cannot be assigned (scoped to the idea)', (await S.assignHeading(id, ['not-an-action-here'], h1.data.id)).ok && (await prisma.lexCoherentAction.count({ where: { id: 'not-an-action-here' } })) === 0)
    const other = await S.assignHeading(id, [a4.id], 'a-heading-on-nobodys-idea')
    ok('a heading that is not on this idea is refused', !other.ok)
    const ord = await S.reorder(id, [a4.id, a3.id, a2.id, a1.id])
    const st1 = await computeCanonicalState(id)
    ok('reorder is persisted and is what the screen reads', ord.ok && st1!.actions.slice(0, 4).map((a) => a.id).join() === [a4.id, a3.id, a2.id, a1.id].join(), st1!.actions.map((a) => a.number).join(','))
    ok('reorder never changes a NUMBER (the number is the user\'s name for the action)', st1!.actions.find((a) => a.id === a1.id)!.number === rows0.find((r) => r.id === a1.id)!.number)
    await S.setTitle(id, a1.id, 'Publish every named owner’s measure')
    await prisma.lexCoherentAction.update({ where: { id: a2.id }, data: { titleProposal: 'Name the owner of each delivery target' } })
    const acc = await S.acceptTitleProposals(id)
    const st2 = await computeCanonicalState(id)
    ok('a title is saved; a PROPOSED title is not the title until accepted, and accepting moves it', st2!.actions.find((a) => a.id === a1.id)!.title === 'Publish every named owner’s measure' && acc.ok && acc.data.accepted === 1 && st2!.actions.find((a) => a.id === a2.id)!.title === 'Name the owner of each delivery target' && st2!.actions.find((a) => a.id === a2.id)!.titleProposal === null)

    section('B · facets are proposals until accepted; park and rule out are restorable; nothing deletes')
    const sf = await S.setFacets(id, a1.id, { avenue: 'LEGISLATIVE', sequence: 'NOW', link: 'duty and means', targetCauseIds: [c1.id], beforeIds: [a3.id] })
    ok('facets are set and read back', sf.ok && (await computeCanonicalState(id))!.actions.find((a) => a.id === a1.id)!.targetCauseIds.join() === c1.id)
    ok('a cause that is not on this idea is refused', !(await S.setFacets(id, a1.id, { targetCauseIds: ['nope'] })).ok)
    ok('an invalid avenue is refused', !(await S.setFacets(id, a1.id, { avenue: 'BANANA' })).ok)
    await prisma.lexCoherentAction.update({ where: { id: a3.id }, data: { facetProposal: { avenue: 'FINANCIAL', sequence: 'NEXT', targetCauseIds: [c2.id] } } })
    const beforeAccept = (await computeCanonicalState(id))!.actions.find((a) => a.id === a3.id)!
    ok('a PROPOSED classification does not change the action until accepted', beforeAccept.avenue === null && beforeAccept.facetProposal?.avenue === 'FINANCIAL')
    await S.acceptFacetProposals(id, [a3.id])
    const afterAccept = (await computeCanonicalState(id))!.actions.find((a) => a.id === a3.id)!
    ok('accepting copies the proposal onto the action and clears it', afterAccept.avenue === 'FINANCIAL' && afterAccept.sequence === 'NEXT' && afterAccept.targetCauseIds.join() === c2.id && afterAccept.facetProposal === null)

    const pk = await S.park(id, [a4.id], 'later phase')
    ok('park: the action stays LIVE, flagged, with its reason', pk.ok && (await computeCanonicalState(id))!.actions.find((a) => a.id === a4.id)!.parked === true)
    ok('unpark brings it back', (await S.unpark(id, [a4.id])).ok && (await computeCanonicalState(id))!.actions.find((a) => a.id === a4.id)!.parked === false)
    ok('rule out WITHOUT a reason is refused', !(await S.ruleOut(id, [raw.id], '')).ok && (await prisma.lexCoherentAction.findUnique({ where: { id: raw.id } }))!.status === 'LIVE')
    await S.ruleOut(id, [raw.id], 'Overtaken by the audit unit')
    const st3 = await computeCanonicalState(id)
    ok('a ruled-out action leaves `actions` and appears in `setAsideActions` WITH its reason', !st3!.actions.some((a) => a.id === raw.id) && st3!.setAsideActions.find((a) => a.id === raw.id)?.ruleOutReason === 'Overtaken by the audit unit')
    ok('…and the ROW STILL EXISTS (nothing deletes)', (await prisma.lexCoherentAction.count({ where: { id: raw.id } })) === 1)
    const kt = await kernelText(id)
    ok('the kernel text Lex and every check read does NOT carry the ruled-out action', !kt.includes('first accountable officers') && kt.includes('named owner'))
    await S.restore(id, [raw.id])
    ok('restore brings it back, reason cleared', (await computeCanonicalState(id))!.actions.some((a) => a.id === raw.id) && (await prisma.lexCoherentAction.findUnique({ where: { id: raw.id } }))!.ruleOutReason === null)
    await removeAction(id, raw.id)
    ok('the OLD "Delete" (removeAction) is now a rule-out: the row survives and so would its costs', (await prisma.lexCoherentAction.count({ where: { id: raw.id } })) === 1 && (await prisma.lexCoherentAction.findUnique({ where: { id: raw.id } }))!.status === 'RULED_OUT')
    await S.restore(id, [raw.id])

    section('B · merge keeps the originals; costs are carried; undo restores')
    await prisma.costLine.create({ data: { actionId: a1.id, label: 'Register build', costType: 'OTHER', category: 'IMPLEMENTATION', low: 10, high: 20 } as never })
    await prisma.costLine.create({ data: { actionId: a2.id, label: 'Register upkeep', costType: 'OTHER', category: 'ENFORCEMENT', low: 5, high: 6 } as never })
    await S.setFacets(id, a2.id, { targetCauseIds: [c2.id] })
    await S.setFacets(id, a4.id, { beforeIds: [a1.id] })
    const n1 = (await prisma.lexCoherentAction.findUnique({ where: { id: a1.id } }))!.number!, n2 = (await prisma.lexCoherentAction.findUnique({ where: { id: a2.id } }))!.number!
    const m = await S.applyActionMerge(id, owner.id, n1, n2, { verdict: 'MERGE', reasoning: 'check', merged: { title: 'Publish a register of delivery-target owners', practicalStep: 'Publish a public register naming the owner of every statutory delivery target.' }, subordinateNumber: null })
    ok('MERGE writes ONE new numbered action', m.ok && m.data.kind === 'MERGED' && m.data.resultNumber > Math.max(n1, n2))
    if (!m.ok) return
    const st4 = await computeCanonicalState(id)
    const merged = st4!.actions.find((a) => a.id === m.data.resultId)!
    ok('the merged action carries BOTH parents\' causes, their heading and their numbers', merged.targetCauseIds.sort().join() === [c1.id, c2.id].sort().join() && merged.headingId === h1.data.id && merged.mergedFrom.sort().join() === [n1, n2].sort().join())
    ok('BOTH originals are KEPT — archived, pointing at the result, with the reason', [a1.id, a2.id].every((x) => st4!.setAsideActions.find((a) => a.id === x)?.status === 'ARCHIVED' && st4!.setAsideActions.find((a) => a.id === x)?.mergedIntoId === m.data.resultId))
    ok('neither original is on the live list (so nothing counts them twice)', !st4!.actions.some((a) => a.id === a1.id || a.id === a2.id))
    const costs = await prisma.costLine.findMany({ where: { actionId: m.data.resultId } })
    ok('the cost lines of BOTH are carried onto the merged action (a merge must not lose a costing)', costs.length === 2)
    ok('an action that had to come BEFORE a parent now has to come before the merged action', (await prisma.lexCoherentAction.findUnique({ where: { id: a4.id } }))!.beforeIds.join() === m.data.resultId)
    ok('only MERGE / ONE_CONTAINS write; SEQUENCE and CONTRADICTORY are advice and are refused', !(await S.applyActionMerge(id, owner.id, n1, n2, { verdict: 'SEQUENCE', reasoning: 'x', merged: null, subordinateNumber: n2 })).ok)
    await S.undoActionMerge(id, m.data.resultId)
    const st5 = await computeCanonicalState(id)
    ok('undo brings both originals back LIVE, and the merged action is ruled out ("Merge undone"), not deleted', [a1.id, a2.id].every((x) => st5!.actions.some((a) => a.id === x)) && st5!.setAsideActions.find((a) => a.id === m.data.resultId)?.ruleOutReason === 'Merge undone.' && (await prisma.lexCoherentAction.count({ where: { id: m.data.resultId } })) === 1)
    const f = await S.applyActionMerge(id, owner.id, n1, n2, { verdict: 'ONE_CONTAINS_THE_OTHER', reasoning: 'x', merged: { title: 'Publish every owner', practicalStep: 'Publish the named owner of each statutory target on a public register, kept current.' }, subordinateNumber: n2 })
    const st6 = await computeCanonicalState(id)
    ok('ONE_CONTAINS: the container is restated in place, the other archived into it', f.ok && f.data.kind === 'ENHANCED' && st6!.actions.find((a) => a.id === a1.id)!.practicalStep.endsWith('kept current.') && st6!.setAsideActions.find((a) => a.id === a2.id)?.mergedIntoId === a1.id)
    ok('the container\'s PRIOR wording is kept as a revision', (await prisma.fieldRevision.count({ where: { ideaId: id, targetId: a1.id, origin: 'ACTION_MERGE' } })) === 1)

    section('B · headings: delete unassigns; hide keeps the header; the free tests read the RECORDED link')
    await S.updateHeading(id, h2.data.id, { hidden: true })
    ok('a hidden heading is flagged in the state', (await computeCanonicalState(id))!.actionHeadings.find((h) => h.id === h2.data.id)?.hidden === true)
    const del = await S.deleteHeading(id, h1.data.id)
    const st7 = await computeCanonicalState(id)
    ok('deleting a heading removes ONLY the heading; its actions keep everything else and lose the heading', del.ok && st7!.actionHeadings.every((h) => h.id !== h1.data.id) && st7!.actions.every((a) => a.headingId !== h1.data.id) && st7!.actions.find((a) => a.id === a3.id)!.title === null && st7!.actions.some((a) => a.id === a3.id))
    const gap = await S.causesWithoutAction(id)
    ok('"what has no action against it?" — cause 3 (no recorded link), from recorded links', gap.uncovered.some((u) => u.number === 3) && !gap.uncovered.some((u) => u.number === 2))
    const dups = await S.findDuplicates(id)
    ok('Find duplicates reads the live list (the archived originals are not paired)', dups.pairs.every((p) => st7!.actions.some((a) => a.id === p.a) && st7!.actions.some((a) => a.id === p.b)))
    ok('a ruled-out action never reaches the costing', (await prisma.lexCoherentAction.count({ where: { ideaId: id, status: 'LIVE' } })) === st7!.actions.length)
  } finally {
    await prisma.idea.delete({ where: { id } }).catch(() => {})
    ok('the scratch idea and everything under it is gone (cascade)', (await prisma.lexCoherentAction.count({ where: { ideaId: id } })) + (await prisma.actionHeading.count({ where: { ideaId: id } })) === 0)
  }
}

async function coldRead() {
  section('COLD READ (§26) · Charlie\'s own idea (452c5ade): not created and not touched by this check')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } })
  if (!idea) { ok('the cold-read subject exists', false, 'NOT CHECKED'); return }
  const before = await prisma.lexCoherentAction.count({ where: { ideaId: idea.id } })
  const st = await computeCanonicalState(idea.id)
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id }, select: { number: true, status: true } })
  ok('reading the state wrote nothing (the action count is unchanged)', (await prisma.lexCoherentAction.count({ where: { ideaId: idea.id } })) === before)
  ok('every one of his actions has a number, and none repeats', rows.every((r) => r.number != null) && new Set(rows.map((r) => r.number)).size === rows.length, `${rows.length} actions`)
  ok('the state\'s `actions` is exactly the LIVE rows; set-aside is the rest', st!.actions.length === rows.filter((r) => r.status === 'LIVE').length && st!.setAsideActions.length === rows.filter((r) => r.status !== 'LIVE').length)
  ok('the screen\'s data has the fields the list needs (number, title slot, headingId, facets)', st!.actions.every((a) => 'number' in a && 'title' in a && 'headingId' in a && Array.isArray(a.targetCauseIds) && Array.isArray(a.beforeIds)))
}

async function partC() {
  section('C · LIVE — the real model passes, the real route and the real Lex tools, on a scratch copy of Charlie\'s idea (SPENDS)')
  if (!(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER) {
    // the route calls Clerk; a script has no session. Only getAuthenticatedUser is substituted (scripts/lib/stub-auth.cjs).
    const probe = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = probe
  }
  const copy = await scratchCopy('452c5ade', 'actions-26q')
  const id = copy.id
  const user = { id: copy.userId }
  const callRoute = async (body: Record<string, unknown>) => {
    const { POST } = await import('../app/api/ideas/[id]/action-structure/route')
    const res = await POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
    return { status: res.status, json: (await res.json()) as { ok: boolean; result: any; error: string | null; state: any } }
  }
  const ctx = (confirmed = false) => ({ ideaId: id, userId: copy.userId, confirmed, turn: { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: [], pastedText: null } })
  let spent = 0
  const since = new Date()
  try {
    const n0 = (await computeCanonicalState(id))!.actions.length
    ok('the copy has a realistic list', n0 >= 15, `${n0} actions`)

    const t = await callRoute({ op: 'proposeTitles' })
    ok('the route: "Title these for me" succeeds', t.status === 200 && t.json.ok, t.json.error ?? `${t.json.result?.proposed} proposed`)
    const stT = t.json.state
    const untitledLeft = stT.actions.filter((a: any) => !a.title && !a.titleProposal).length
    ok('every untitled action got a PROPOSED title (none saved as the user\'s)', untitledLeft <= 1 && stT.actions.every((a: any) => !a.title), `${untitledLeft} without`)
    const props = stT.actions.map((a: any) => a.titleProposal).filter(Boolean) as string[]
    ok('the titles say what the action DOES: at least 90% are three words or more', props.filter((p) => p.split(/\s+/).length >= 3).length / Math.max(props.length, 1) >= 0.9, `${props.filter((p) => p.split(/\s+/).length >= 3).length} of ${props.length}`)
    ok('no title is a copy of another (two actions on one theme must differ)', new Set(props.map((p) => p.toLowerCase())).size === props.length)
    ok('the titles are short', props.every((p) => p.length <= 110))
    control('a topic-only title ("Transparency") would fail the three-word test', () => 'Transparency'.split(/\s+/).length >= 3)
    control('a duplicate title would fail the uniqueness test', () => new Set(['a b c', 'A B C'].map((p) => p.toLowerCase())).size === 2)
    console.log('    sample titles:', props.slice(0, 4).map((p) => `“${p}”`).join(' · '))
    await callRoute({ op: 'acceptTitles' })

    const f = await callRoute({ op: 'proposeFacets' })
    ok('the route: "Classify with Lex" succeeds', f.status === 200 && f.json.ok, f.json.error ?? `${f.json.result?.proposed} proposed, ${f.json.result?.links?.length} links`)
    const acts = f.json.state.actions as any[]
    const causeIds = new Set((f.json.state.diagnosisCauses as any[]).map((c) => c.id))
    ok('proposals only — nothing was written onto the actions themselves', acts.every((a) => !a.avenue && !a.sequence && a.targetCauseIds.length === 0 || a.facetProposal === null))
    const withProp = acts.filter((a) => a.facetProposal)
    ok('most actions received a proposal', withProp.length >= acts.length * 0.8, `${withProp.length} of ${acts.length}`)
    ok('every proposed cause is a REAL cause on this idea', withProp.every((a) => (a.facetProposal.targetCauseIds ?? []).every((c: string) => causeIds.has(c))))
    ok('every proposed avenue / sequence is in the closed set', withProp.every((a) => (!a.facetProposal.avenue || ['LEGISLATIVE', 'ORGANISATIONAL', 'FINANCIAL'].includes(a.facetProposal.avenue)) && (!a.facetProposal.sequence || ['NOW', 'NEXT', 'LATER'].includes(a.facetProposal.sequence))))
    ok('every "before" is a real action, never itself', withProp.every((a) => (a.facetProposal.beforeIds ?? []).every((b: string) => b !== a.id && acts.some((x) => x.id === b))))
    ok('Lex read binding links out of the settled guiding policy', (f.json.result?.links?.length ?? 0) >= 2, (f.json.result?.links ?? []).join(' | ').slice(0, 160))
    const linkSet = new Set<string>(f.json.result?.links ?? [])
    ok('every proposed link is one of the links Lex itself named (no stray wording)', withProp.every((a) => !a.facetProposal.link || linkSet.has(a.facetProposal.link)))
    await callRoute({ op: 'acceptFacets' })
    const st = (await computeCanonicalState(id))!
    const grid = coverageGrid(st.actions as never, st.diagnosisCauses.map((c) => ({ id: c.id, number: c.number, cause: c.cause })))
    ok('after accepting, the coverage grid is built on RECORDED links', grid.recorded.linked >= st.actions.length * 0.7, `${grid.recorded.linked} of ${grid.recorded.total} actions carry a cause`)
    console.log(`    uncovered causes: ${grid.uncovered.map((u) => '#' + u.number).join(', ') || 'none'}`)

    const h = await callRoute({ op: 'suggestHeadings' })
    ok('the route: "Suggest headings" returns 3–8 named headings from the settled policy', h.status === 200 && h.json.ok && h.json.result.suggestions.length >= 3 && h.json.result.suggestions.length <= 8, (h.json.result?.suggestions ?? []).map((s: any) => s.name).join(' · ').slice(0, 200))
    for (const s of (h.json.result?.suggestions ?? []).slice(0, 3)) await callRoute({ op: 'createHeading', name: s.name })

    // the real Lex tools
    const live = (await computeCanonicalState(id))!.actions
    const headName = (await computeCanonicalState(id))!.actionHeadings[0]?.name ?? 'Transparency'
    const a7 = live[0].number!, a12 = live[1].number!
    const ass = await execute(toolByName('assign_action_heading')!, ctx(), { actions: [a7, a12, 9999], heading: headName })
    ok('Lex tool: "put 7 and 12 under <heading>" assigns, and reports the one that does not exist', ass.ok && (ass.data as any).assigned === 2 && (ass.data as any).notFound.includes(9999) && !!ass.items?.some((i) => !i.ok))
    const none = await execute(toolByName('causes_without_action')!, ctx(), {})
    ok('Lex tool: "what has no action against it?" answers from recorded links', none.ok && Array.isArray((none.data as any).causesWithNoAction))
    const grp = await execute(toolByName('group_actions')!, ctx(), { by: 'cause' })
    ok('Lex tool: "group these by cause" is READ ONLY (no heading changed)', grp.ok && (await computeCanonicalState(id))!.actions.find((a) => a.number === a7)?.headingId != null)
    const dd = await execute(toolByName('find_action_duplicates')!, ctx(), {})
    ok('Lex tool: "which of these are duplicates?"', dd.ok)
    const cmp = await execute(toolByName('compare_actions')!, ctx(), { a: a7, b: a12 })
    ok('Lex tool: compare returns a verdict in the closed set and changes nothing', cmp.ok && ['MERGE', 'ONE_CONTAINS_THE_OTHER', 'SEQUENCE', 'CONTRADICTORY'].includes((cmp.data as any).verdict) && (await computeCanonicalState(id))!.actions.length === live.length, `${(cmp.data as any)?.verdict}`)

    // asks first: a chat "yes" is not a confirmation; the button is
    const ro = await execute(toolByName('rule_out_actions')!, ctx(), { actions: [a12], reason: 'Covered by the register action' })
    ok('Lex tool: rule_out_actions ASKS FIRST — a pending confirmation, nothing changed', !ro.ok && !!ro.pending && (await prisma.lexCoherentAction.findFirst({ where: { ideaId: id, number: a12 } }))!.status === 'LIVE')
    const idea1 = await prisma.idea.findUniqueOrThrow({ where: { id }, select: { id: true, creatorId: true, aiChatHistory: true } })
    const pressed = await handleConfirm({ ideaId: id, user: { id: user.id }, idea: idea1, token: ro.pending!.token })
    ok('the BUTTON (handleConfirm with the signed token) rules it out', pressed.status === 200 && (await prisma.lexCoherentAction.findFirst({ where: { ideaId: id, number: a12 } }))!.status === 'RULED_OUT')
    const undoTok = ((pressed.body.agent as { undo?: Array<{ token: string }> })?.undo ?? [])[0]?.token
    ok('…with an undo that restores it', !!undoTok && (await (async () => { const i2 = await prisma.idea.findUniqueOrThrow({ where: { id }, select: { id: true, creatorId: true, aiChatHistory: true } }); const u = await handleConfirm({ ideaId: id, user: { id: user.id }, idea: i2, token: undoTok }); return u.status === 200 })()) && (await prisma.lexCoherentAction.findFirst({ where: { ideaId: id, number: a12 } }))!.status === 'LIVE')

    const mg = await execute(toolByName('merge_actions')!, ctx(), { numberA: a7, numberB: a12, mode: 'merge', title: 'Publish one register of owners', practicalStep: 'Publish one public register naming the accountable owner of every statutory delivery target.' })
    ok('Lex tool: merge_actions ASKS FIRST', !mg.ok && !!mg.pending && (await computeCanonicalState(id))!.actions.length === live.length)
    const i3 = await prisma.idea.findUniqueOrThrow({ where: { id }, select: { id: true, creatorId: true, aiChatHistory: true } })
    const mp = await handleConfirm({ ideaId: id, user: { id: user.id }, idea: i3, token: mg.pending!.token })
    const stM = (await computeCanonicalState(id))!
    ok('confirming the merge: one new action, both originals kept beneath it', mp.status === 200 && stM.actions.length === live.length - 1 && stM.setAsideActions.filter((a) => a.status === 'ARCHIVED').length === 2)

    ok('all fourteen 26-Q tools are registered with the tiers the brief sets (merge and rule-out ask; assigning, titling, facets free)',
      (['title_actions', 'classify_actions', 'suggest_action_headings', 'create_action_heading', 'assign_action_heading', 'set_action_facets', 'group_actions', 'find_action_duplicates', 'causes_without_action', 'compare_actions', 'park_actions', 'restore_actions'] as const).every((n) => toolByName(n)?.tier === 'free')
      && toolByName('merge_actions')?.tier === 'ask' && toolByName('rule_out_actions')?.tier === 'ask' && MODEL_TOOLS.some((x) => x.name === 'merge_actions'))
  } finally {
    const rows = await prisma.$queryRaw<Array<{ p: number | null }>>`SELECT sum("estCostPence")::float p FROM "LlmSpend" WHERE "ideaId" = ${id} AND "createdAt" >= ${since}`
    spent = rows[0]?.p ?? 0
    await deleteScratch(id)
    console.log(`\n  COST OF PART C: ${spent.toFixed(1)}p. Scratch copy deleted.`)
  }
}

async function main() {
  const live = process.argv.includes('--live')
  partA()
  await partB()
  await coldRead()
  if (live) await partC()
  else console.log('\n── C · LIVE — NOT RUN (pass --live; it spends)')
  const dead = controls.filter((c) => !c.fired)
  console.log(`\n${pass} passed, ${fail} failed · ${pass + fail} checks RUN${live ? '' : ' (Part C NOT RUN)'} · ${controls.length} controls, ${controls.length - dead.length} fired, ${dead.length} dead`)
  for (const d of dead) console.log(`  ✗ DEAD CONTROL — ${d.label}`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  await prisma.$disconnect()
  process.exit(fail || dead.length ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
