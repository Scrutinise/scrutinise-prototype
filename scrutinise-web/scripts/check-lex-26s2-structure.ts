// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 decisions 186-191 (CCh 18 Oct 2026 (4) + (5)) - check:lex-26s2-structure.
//
//   188  the CONDITIONS facet: Charlie's ten verbatim, coverage ("NO ACTION" in words), the checklist lines, support, retire (never delete), Lex's proposals
//   189  the AVENUE RULE: verbatim, in Classify's prompt, the FAQ and Lex's instructions
//   190  RE-SORT INTO HEADINGS and CONSOLIDATE THIS HEADING: apply logic with a fake model (no spend), nothing deletes, every fold/move restorable
//   UI   (A) Hide all / Show all headings and (B) the find box exist; the real-browser behaviour is in check:lex-26s-browser
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s2-structure.ts
//
// Works on a SCRATCH COPY of 452c5ade (deleted at the end). The model is stood in for by the module's own seam. Counts what RAN; every value
// assertion has a control that stays false.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import * as AC from '../lib/lex/action-conditions'
import * as CD from '../lib/lex/action-conditions-server'
import * as RP from '../lib/lex/action-resort-pure'
import * as RS from '../lib/lex/action-resort'
import * as S from '../lib/lex/action-structure'
import * as ST from '../lib/lex/action-steps'
import * as F from '../lib/lex/action-facets'
import { computeCanonicalState } from '../lib/lex/state'
import { computeCostSummary } from '../lib/lex/field-machine'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument } from '../lib/documents/build-proposal'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import { toolByName, execute } from '../lib/lex/agent/tools'
import { FAQ_MARKDOWN } from '../lib/faq-content'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { SEVEN_HEADINGS, CHARLIES_TEN, CONDITIONS_SOURCE } from './lib/seven-headings'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')

// the brief's own words, typed here once more so a drift in the code is a failure here
const AVENUE_RULE_BRIEF = 'Legislative — anything Parliament enacts or that is laid before it: Acts, statutory codes (the Civil Service Code), statutory instruments. Organisational — management codes, guidance, software, training, bodies, practice. Financial — money mechanisms: budgets, incentives, pricing, benchmarks.'

function partA() {
  section('A · 188 — the conditions, PURE: parse, coverage in words, the two checklist lines, support, retire')
  const doc = AC.parseConditions({ items: CHARLIES_TEN.map((text, i) => ({ id: `c${i + 1}`, text, by: 'u', at: 'x' })), proposals: [], source: { noteId: null, label: 'the brief' } })
  ok('the ten are read in order, verbatim', doc.items.length === 10 && doc.items.every((c, i) => c.text === CHARLIES_TEN[i]), String(doc.items.length))
  ok('…the first is "One named owner per task" and the tenth "Ruthless brevity in goals"', doc.items[0].text === 'One named owner per task' && doc.items[9].text === 'Ruthless brevity in goals')
  ok('malformed JSON reads as an empty list, not a crash', AC.parseConditions('nope').items.length === 0 && AC.parseConditions(null).items.length === 0 && AC.parseConditions({ items: [{ id: '', text: 'x' }, { id: 'a', text: '  ' }] }).items.length === 0)
  const acts = [
    { id: 'a1', conditionIds: ['c1', 'c2'], supportOnly: false },
    { id: 'a2', conditionIds: ['c2'], supportOnly: false },
    { id: 'a3', conditionIds: [], supportOnly: true },
    { id: 'a4', conditionIds: [], supportOnly: false },
  ]
  const cov = AC.conditionCoverage(doc, acts)
  ok('condition 1 is delivered by a1 only; condition 2 by a1 and a2', JSON.stringify(cov.rows[0].actionIds) === '["a1"]' && JSON.stringify(cov.rows[1].actionIds) === '["a1","a2"]')
  ok('eight conditions have no action (3 to 10), and they are named by number', cov.uncovered.length === 8 && cov.uncovered[0].number === 3 && cov.uncovered[7].number === 10)
  ok('an action that delivers nothing and is not support is "unassigned"; a support action is not', JSON.stringify(cov.unassigned) === '["a4"]' && cov.support === 1)
  control('a support action counted as delivering a condition (must be FALSE)', cov.rows.some((r) => r.actionIds.includes('a3')))
  const lines = AC.conditionChecklist(doc, acts)
  ok('the checklist says "8 of 10 conditions have no action" and "1 action delivers no condition and is not marked support"', lines[0].text === '8 of 10 conditions have no action' && lines[1].text === '1 action delivers no condition and is not marked support' && !lines[0].done && !lines[1].done, lines.map((l) => l.text).join(' | '))
  const full = AC.conditionChecklist(doc, doc.items.map((c, i) => ({ id: `x${i}`, conditionIds: [c.id], supportOnly: false })))
  ok('…and when every condition has an action and every action delivers one, both lines read done in the brief\'s words', full[0].text === 'Every condition has at least one action' && full[1].text === 'Every action delivers at least one condition or is marked support' && full.every((l) => l.done))
  ok('an idea with no conditions has no condition lines (nothing to be unfinished)', AC.conditionChecklist(AC.EMPTY_CONDITIONS, acts).length === 0)
  const retired = { ...doc, items: doc.items.map((c, i) => (i === 0 ? { ...c, retired: true } : c)) }
  const covR = AC.conditionCoverage(retired, acts)
  ok('a RETIRED condition leaves the coverage and renumbers the rest', covR.rows.length === 9 && covR.rows[0].condition.id === 'c2' && covR.rows[0].number === 1)
  ok('…and the step-1 checklist carries the condition lines when the idea has conditions', ST.stepChecklist(1, acts.map((a) => ({ ...a, headingId: 'h', targetCauseIds: ['x'], avenue: 'FINANCIAL', policyTest: null, conflictNote: null })) as never, { duplicatesChecked: true, conditions: doc }).some((l) => l.key === 'conditionCovered'))
  control('the same checklist without conditions carrying the lines (must be FALSE)', ST.stepChecklist(1, acts.map((a) => ({ ...a, headingId: 'h', targetCauseIds: ['x'], avenue: 'FINANCIAL', policyTest: null, conflictNote: null })) as never, { duplicatesChecked: true }).some((l) => l.key === 'conditionCovered'))
  ok('words for an action: "1 and 2", "support", "none"', AC.conditionWords(doc, acts[0]) === '1 and 2' && AC.conditionWords(doc, acts[2]) === 'support' && AC.conditionWords(doc, acts[3]) === 'none')
}

function partB() {
  section('B · 189 — the avenue rule, VERBATIM, in Classify\'s prompt, the FAQ and Lex\'s instructions')
  ok('the rule is the brief\'s string, character for character', F.AVENUE_RULE === AVENUE_RULE_BRIEF, F.AVENUE_RULE)
  ok('Classify\'s avenue line prints it (source: the prompt builds from AVENUE_RULE)', /THE RULE \(follow it exactly\): \$\{AVENUE_RULE\}/.test(read('lib/lex/action-structure.ts')))
  ok('the FAQ prints it, and says what a condition is', FAQ_MARKDOWN.includes(AVENUE_RULE_BRIEF) && /conditions/.test(FAQ_MARKDOWN) && /NO ACTION/.test(FAQ_MARKDOWN))
  ok('Lex\'s instructions carry it word for word', read('lib/lex/agent/system-prompt.ts').includes(AVENUE_RULE_BRIEF))
  control('a prompt that paraphrases the rule matching the brief (must be FALSE)', 'Legislative means a Bill; Organisational means how a body works'.includes(AVENUE_RULE_BRIEF))
}

function partC() {
  section('C · 190 — the pure half: plan, fold lines (quote + cite), restore, validation of a model answer, the price')
  const plan = RP.parseHeadingPlan(SEVEN_HEADINGS)
  ok('Charlie\'s seven, in his order, with "Legislation" as the former name of "Primary legislation"', plan?.targets.map((t) => t.name).join(' · ') === 'Primary legislation · Civil Service Code · Civil Service Management Code · The accountability platform · Budgets and standards · Transparency and oversight · Training, guidance and the pilot' && plan.targets[0].formerly?.[0] === 'Legislation')
  ok('a plan with fewer than two headings is no plan (the button stays absent)', RP.parseHeadingPlan({ targets: [{ name: 'A', purpose: '' }] }) === null && RP.parseHeadingPlan(null) === null)
  const l1 = RP.foldLine(31, 'Name the owner', 'The Minister names one owner per task.', 'part of the same duty')
  ok('a fold line cites the number and quotes the statement', l1 === '• [#31] “The Minister names one owner per task.” (Name the owner) — part of the same duty', l1)
  const c1 = RP.addFoldLines('My own note.', [l1, RP.foldLine(32, null, 'Owners are published.', null)])
  ok('the header is added once, under the user\'s own commentary, which is kept', c1.startsWith('My own note.\n\nParts of this action, quoted\n• [#31]') && c1.split('Parts of this action, quoted').length === 2)
  const c2 = RP.removeFoldLine(c1, 31)!
  ok('unfolding one removes ITS line only and keeps the header while another remains', !c2.includes('[#31]') && c2.includes('[#32]') && c2.includes('Parts of this action, quoted'))
  // 199 - commentary written before the plain words carries the old header: it shows under the new one, adds under it once, and clears with the last part
  const old = 'My own note.\n\nComponents folded in:\n• [#31] “x.”'
  ok('199 old commentary shows under the new header, and the old words are gone from what is shown', RP.plainFoldHeader(old).includes('Parts of this action, quoted\n• [#31]') && !RP.plainFoldHeader(old).includes('Components'))
  ok('199 adding a part to old commentary does not make a second header', RP.addFoldLines(old, [RP.foldLine(32, null, 'y.', null)]).split('Parts of this action, quoted').length === 2 && !RP.addFoldLines(old, [RP.foldLine(32, null, 'y.', null)]).includes('Components folded in'))
  ok('199 taking out the last part of old commentary leaves the user\'s own words', RP.removeFoldLine(old, 31) === 'My own note.')
  control('199 old commentary shown with the old header unchanged (must be FALSE)', RP.plainFoldHeader(old) === old)
  const c3 = RP.removeFoldLine(c2, 32)
  ok('unfolding the last removes the header and leaves the user\'s own words exactly', c3 === 'My own note.')
  control('unfolding a component that was never folded changing the text (must be FALSE)', RP.removeFoldLine('My own note.', 99) !== 'My own note.')
  const live = new Set([1, 2, 3, 4, 5, 6])
  const v = RP.validateConsolidation({
    mechanisms: [{ leadNumber: 1, componentNumbers: [2, 3, 1, 9], reason: 'r' }, { leadNumber: 2, componentNumbers: [4], reason: 'x' }, { leadNumber: 9, componentNumbers: [5], reason: 'x' }],
    duplicates: [{ keepNumber: 5, duplicateNumber: 6, reason: 'same' }, { keepNumber: 3, duplicateNumber: 4, reason: 'overlaps' }, { keepNumber: 5, duplicateNumber: 5, reason: 'self' }],
  }, live)
  ok('a valid group is kept: #1 leads #2 and #3; the lead is never its own component; a number the heading does not hold is refused', v.mechanisms.length === 1 && v.mechanisms[0].lead === 1 && JSON.stringify(v.mechanisms[0].components) === '[2,3]', JSON.stringify(v.mechanisms))
  ok('an action already in a group cannot lead another (#2) or be folded again, and a lead that is not on the heading (#9) is refused', !v.mechanisms.some((m) => m.lead === 2 || m.lead === 9) && v.refused.some((r) => /#9/.test(r)) && v.refused.length >= 4, v.refused.join(' | '))
  ok('a duplicate pair is kept only when neither takes part in another group; a self-pair is refused', JSON.stringify(v.duplicates.map((d) => [d.keep, d.duplicate])) === '[[5,6]]', JSON.stringify(v.duplicates))
  ok('everything refused is REPORTED in words, never silently dropped', v.refused.every((r) => r.length > 12))
  const e = RP.resortEstimate(175)
  ok('the re-sort estimate for 175 actions is 5 requests', e.calls === 5)
  ok('the price card says "not yet measured" until a measured run is recorded here, and "measured" after', (RP.RESORT_RUNS.length === 0) === !e.measured)
  control('an estimate that is measured while no run is recorded (must be FALSE)', RP.RESORT_RUNS.length === 0 && e.measured)
}

async function partD() {
  section('D · 188 on a SCRATCH COPY of 452c5ade — seeded verbatim, assigned, retired, proposed (nothing deleted)')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  const copy = await scratchCopy('452c5ade', 's26s2s')
  const id = copy.id
  try {
    // the check OWNS its data (CLAUDE.md §25.4): the copy of the live idea now carries Charlie's own condition assignments, which this fixture must not inherit
    await prisma.lexCoherentAction.updateMany({ where: { ideaId: id }, data: { conditionIds: [], supportOnly: false } })
    const rows0 = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, number: true } })
    const sd = await CD.seedConditions(id, owner.id, CHARLIES_TEN, CONDITIONS_SOURCE)
    const doc = await CD.readConditions(id)
    ok('Charlie\'s ten are stored on the idea, verbatim and in order, with the source cited', sd.ok && doc.items.length === 10 && doc.items.every((c, i) => c.text === CHARLIES_TEN[i]) && /18 Oct 2026/.test(doc.source?.label ?? ''))
    const again = await CD.seedConditions(id, owner.id, CHARLIES_TEN, CONDITIONS_SOURCE)
    ok('seeding again keeps the same ids (nothing duplicated)', again.ok && (await CD.readConditions(id)).items.every((c, i) => c.id === doc.items[i].id) && (await CD.readConditions(id)).items.length === 10)
    const [a1, a2, a3] = rows0
    const c = doc.items
    const r1 = await CD.assignConditions(id, [a1.id], { conditionIds: [c[0].id, c[5].id] })
    const got1 = await prisma.lexCoherentAction.findUnique({ where: { id: a1.id }, select: { conditionIds: true, supportOnly: true } })
    ok('an action delivers many conditions: 1 and 6 set', r1.ok && JSON.stringify(got1?.conditionIds) === JSON.stringify([c[0].id, c[5].id]) && !got1?.supportOnly)
    await CD.assignConditions(id, [a1.id], { conditionIds: [c[2].id], mode: 'add' })
    ok('…"add" keeps what it had', (await prisma.lexCoherentAction.findUnique({ where: { id: a1.id }, select: { conditionIds: true } }))?.conditionIds.length === 3)
    await CD.assignConditions(id, [a2.id], { support: true })
    const g2 = await prisma.lexCoherentAction.findUnique({ where: { id: a2.id }, select: { conditionIds: true, supportOnly: true } })
    ok('"support" is stored, and delivers no condition', g2?.supportOnly === true && g2.conditionIds.length === 0)
    await CD.assignConditions(id, [a2.id], { conditionIds: [c[1].id] })
    ok('choosing a condition ends "support" (an action cannot both deliver one and deliver none)', (await prisma.lexCoherentAction.findUnique({ where: { id: a2.id }, select: { supportOnly: true } }))?.supportOnly === false)
    const bad = await CD.assignConditions(id, [a3.id], { conditionIds: ['not-a-condition'] })
    ok('a condition id that is not on this idea is refused in words, nothing changed', !bad.ok && /not on this idea/.test((bad as { error: string }).error) && (await prisma.lexCoherentAction.findUnique({ where: { id: a3.id }, select: { conditionIds: true } }))?.conditionIds.length === 0)
    control('the refusal changing the action (must be FALSE)', (await prisma.lexCoherentAction.findUnique({ where: { id: a3.id }, select: { conditionIds: true } }))?.conditionIds.length !== 0)
    // coverage as the screen reads it
    const st = (await computeCanonicalState(id))!
    ok('the canonical state carries the conditions and each action\'s delivery', st.conditions.items.length === 10 && st.actions.find((a) => a.id === a1.id)?.conditionIds.length === 3 && st.actions.find((a) => a.id === a2.id)?.conditionIds.length === 1)
    const cov = AC.conditionCoverage(st.conditions, st.actions)
    ok('conditions 1, 2, 3 and 6 now have an action; 4, 5, 7, 8, 9 and 10 read NO ACTION', JSON.stringify(cov.uncovered.map((u) => u.number)) === '[4,5,7,8,9,10]', JSON.stringify(cov.uncovered.map((u) => u.number)))
    // retire never deletes
    await CD.retireCondition(id, c[9].id, true)
    const rd = await CD.readConditions(id)
    ok('retiring a condition KEEPS it (10 stored, 9 active), and an action pointing at it keeps the pointer', rd.items.length === 10 && AC.activeConditions(rd).length === 9)
    await CD.retireCondition(id, c[9].id, false)
    ok('…and Bring back restores it', AC.activeConditions(await CD.readConditions(id)).length === 10)
    // proposals
    const p = await CD.proposeCondition(id, 'Every owner can say how they were chosen', 'no condition covers selection')
    let d2 = await CD.readConditions(id)
    ok('Lex\'s addition is a PROPOSAL beside the list: the list is unchanged', p.ok && d2.proposals.length === 1 && d2.items.length === 10)
    const dup = await CD.proposeCondition(id, 'one named owner per task', 'dup')
    ok('a proposal that repeats a condition already on the list is refused', !dup.ok)
    const acc = await CD.acceptConditionProposal(id, owner.id, d2.proposals[0].id)
    d2 = await CD.readConditions(id)
    ok('accepting makes it condition 11 and clears the proposal', acc.ok && d2.items.length === 11 && d2.proposals.length === 0 && d2.items[10].text === 'Every owner can say how they were chosen')
    const edit = await CD.editCondition(id, c[0].id, '   ')
    ok('an empty edit is refused (to remove one, retire it)', !edit.ok)
    // the Lex tools
    const ctx = { ideaId: id, userId: owner.id, turn: { userMessages: [] } } as never
    ok('Lex has conditions_coverage and propose_condition', !!toolByName('conditions_coverage') && !!toolByName('propose_condition'))
    const cc = await execute(toolByName('conditions_coverage')!, ctx, {})
    ok('conditions_coverage reports the numbered conditions and says NO ACTION where none delivers', cc.ok && JSON.stringify(cc.data).includes('NO ACTION'), JSON.stringify(cc).slice(0, 200))
    const pc = await execute(toolByName('propose_condition')!, ctx, { text: 'Someone can stop a task that has gone wrong', why: 'a stop right is not covered' })
    ok('propose_condition stores a PROPOSAL only (the list stays at 11)', pc.ok && (await CD.readConditions(id)).items.length === 11 && (await CD.readConditions(id)).proposals.length === 1)
  } finally { await deleteScratch(id) }
}

async function partE() {
  section('E · 190 on a SCRATCH COPY — Re-sort and Consolidate with a fake model: moves are remembered and undone, nothing is deleted')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  const copy = await scratchCopy('452c5ade', 's26s2r')
  const id = copy.id
  const realCall = RS.seams.callModelJson
  try {
    ok('the copy carries the headings (the Re-sort works on them)', (await prisma.actionHeading.count({ where: { ideaId: id } })) >= 5)
    await prisma.$executeRaw`UPDATE "Idea" SET "headingPlan" = NULL WHERE id = ${id}` // the live idea now HAS its plan (seeded 18 Oct); the copy inherits it, so clear it to test the no-plan case
    const none = await RS.resortPlan(id)
    ok('without a plan the Re-sort refuses in words (the button is absent too)', !none.ok && /no instrument headings/.test((none as { error: string }).error))
    await RS.setHeadingPlan(id, SEVEN_HEADINGS)
    // three OLD themes the plan does not cover (so the archive logic is tested whatever Charlie's headings are today): A holds two actions the model will move, B is empty, C holds the one action the fake model leaves out
    const liveRows0 = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, number: true } })
    const SKIP = liveRows0[0].number!
    const mkHead = (name: string, orderIndex: number) => prisma.actionHeading.create({ data: { ideaId: id, name, colourKey: 'c1', orderIndex } })
    const [hA, hB, hC] = [await mkHead('Old theme A', 90), await mkHead('Old theme B', 91), await mkHead('Old theme C', 92)]
    await prisma.lexCoherentAction.updateMany({ where: { id: { in: [liveRows0[1].id, liveRows0[2].id] } }, data: { headingId: hA.id } })
    await prisma.lexCoherentAction.update({ where: { id: liveRows0[0].id }, data: { headingId: hC.id } })
    const before = await prisma.lexCoherentAction.findMany({ where: { ideaId: id }, select: { id: true, status: true, headingId: true, number: true, practicalStep: true, commentary: true } })
    const total0 = before.length
    const live0 = before.filter((b) => b.status === 'LIVE')
    const headsBefore = await prisma.actionHeading.findMany({ where: { ideaId: id }, select: { id: true, name: true } })
    const legislation = headsBefore.find((h) => h.name === 'Legislation')
    const plan = await RS.resortPlan(id)
    ok('the plan lists the seven with "Primary legislation" renaming "Legislation", batches of at most 40, and the headings to be archived', plan.ok && plan.data.targets.length === 7 && plan.data.targets[0].renamesFrom === 'Legislation' && plan.data.batches.every((b) => b.length <= 40) && plan.data.batches.flat().length === live0.length && plan.data.retiring.length === headsBefore.filter((h) => !SEVEN_HEADINGS.targets.some((t) => t.name.toLowerCase() === h.name.toLowerCase() || (t.formerly ?? []).some((f) => f.toLowerCase() === h.name.toLowerCase()))).length && plan.data.retiring.length >= 3 && ['Old theme A', 'Old theme B', 'Old theme C'].every((n) => plan.data.retiring.some((r) => r.name === n)), plan.ok ? `${plan.data.batches.length} batches, ${plan.data.retiring.length} retiring` : (plan as { error: string }).error)
    ok('…and the card has a price in words', plan.ok && plan.data.estimate.pence > 0 && typeof plan.data.estimate.measured === 'boolean')

    // ── the fake model: places action i under target (number mod 7), EXCEPT one it deliberately leaves out
    const targets = SEVEN_HEADINGS.targets.map((t) => t.name)
    const skippedNumber = SKIP
    RS.seams.callModelJson = (async (opts: { user: string }) => {
      const nums = [...opts.user.matchAll(/^\[(\d+)\]/gm)].map((m) => Number(m[1]))
      return { ok: true, value: { actions: nums.filter((n) => n !== skippedNumber).map((n) => ({ number: n, heading: targets[n % 7], reason: `because #${n} is carried by ${targets[n % 7]}` })) }, usage: { recorded: { pence: 1 } } }
    }) as never
    let moved = 0, notPlaced = 0
    for (const ids of plan.ok ? plan.data.batches : []) {
      const r = await RS.resortBatch(id, owner.id, ids)
      if (r.ok) { moved += r.data.moved; notPlaced += r.data.notPlaced }
    }
    ok('the batches placed every action but the one the model left out, which is REPORTED as not placed', notPlaced === 1 && moved > 40, `moved ${moved}, not placed ${notPlaced}`)
    const mid = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, select: { id: true, number: true, headingId: true, headingWasId: true, headingReason: true } })
    const headsNow = await prisma.actionHeading.findMany({ where: { ideaId: id }, select: { id: true, name: true } })
    const nameOf = (hid: string | null) => headsNow.find((h) => h.id === hid)?.name
    ok('every placed action is under the heading the model chose, with its reason stored', mid.filter((m) => m.number != null && m.number !== skippedNumber).every((m) => nameOf(m.headingId) === targets[m.number! % 7] && /^because #\d+ is carried by /.test(m.headingReason ?? '')))
    ok('the seven exist; each short name Charlie had (Legislation, CS Code, CS Mgt Code, The platform, Rules & Standards, Oversight, Training) was RENAMED in place - same id, not a new heading', targets.every((t) => headsNow.some((h) => h.name === t)) && SEVEN_HEADINGS.targets.every((t) => { const old = headsBefore.find((h) => (t.formerly ?? []).some((f) => f.toLowerCase() === h.name.toLowerCase())); return !old || headsNow.find((h) => h.name === t.name)?.id === old.id }) && headsNow.find((h) => h.name === 'Primary legislation')?.id === legislation?.id && !headsNow.some((h) => h.name === 'Legislation'))
    ok('the action the model left out stays exactly where it was', before.find((b) => b.number === skippedNumber)?.headingId === mid.find((m) => m.number === skippedNumber)?.headingId)
    ok('each moved action remembers the heading it was on', mid.filter((m) => m.headingWasId).length === moved)
    const fin = await RS.resortFinish(id)
    const afterFin = await prisma.actionHeading.findMany({ where: { ideaId: id, archivedAt: { not: null } }, select: { id: true, name: true } })
    ok('the old headings that are now empty are ARCHIVED (kept), the plan\'s seven are not', fin.ok && afterFin.length === fin.data.archived.length && JSON.stringify(afterFin.map((h) => h.name).sort()) === '["Old theme A","Old theme B"]' && !afterFin.some((h) => targets.includes(h.name)), fin.ok ? `${fin.data.archived.length} archived, still holding ${JSON.stringify(fin.data.stillHolding)}` : '')
    ok('a heading that still holds a live action (C: the one the model left out) is NOT archived, and is named as still holding', fin.ok && fin.data.stillHolding.length === 1 && fin.data.stillHolding[0].name === 'Old theme C' && fin.data.stillHolding[0].live === 1 && !afterFin.some((h) => h.name === 'Old theme C'))
    const st = (await computeCanonicalState(id))!
    ok('the screen\'s state hides archived headings and lists them as retired, restorable', !st.actionHeadings.some((h) => afterFin.some((a) => a.id === h.id)) && st.archivedHeadings.length === afterFin.length && st.resortUndoable === moved)
    control('an archived heading still in the live list of headings (must be FALSE)', st.actionHeadings.some((h) => afterFin.some((a) => a.id === h.id)))
    const back = await S.restoreHeading(id, afterFin[0].id)
    ok('Bring back restores one archived heading (empty)', back.ok && (await computeCanonicalState(id))!.actionHeadings.some((h) => h.id === afterFin[0].id))
    await prisma.actionHeading.update({ where: { id: afterFin[0].id }, data: { archivedAt: new Date() } })

    // ── undo
    const u = await RS.undoResort(id)
    const restored = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, select: { id: true, headingId: true, headingWasId: true, headingReason: true } })
    ok('Undo puts every moved action back on the heading it was on, byte for byte', u.ok && live0.every((b) => restored.find((r) => r.id === b.id)?.headingId === b.headingId), u.ok ? `${u.data.restored} restored` : '')
    ok('…clears the memory and the reasons, and brings back the archived headings the actions return to', restored.every((r) => r.headingWasId == null && r.headingReason == null) && u.ok && u.data.headingsBack.length === new Set(mid.map((m) => m.headingWasId).filter((w) => w && afterFin.some((a) => a.id === w))).size && u.data.headingsBack.length >= 1)
    ok('…and the headings the actions came from are no longer archived', (await prisma.actionHeading.count({ where: { ideaId: id, archivedAt: { not: null } } })) <= 1)
    control('an Undo with nothing to undo succeeding (must be FALSE)', (await RS.undoResort(id)).ok)

    // ── re-sort again, then CONSOLIDATE one heading with a fake that tries to smuggle its own text in
    await RS.resortFinish(id) // (the plan's headings exist; nothing is empty-and-retirable that matters here)
    for (const ids of plan.ok ? plan.data.batches : []) await RS.resortBatch(id, owner.id, ids)
    const heads2 = await prisma.actionHeading.findMany({ where: { ideaId: id } })
    const target = heads2.find((h) => h.name === 'The accountability platform')!
    const members = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, headingId: target.id, status: 'LIVE' }, orderBy: { number: 'asc' } })
    ok('the heading to consolidate holds several live actions', members.length >= 6, String(members.length))
    const [lead, c1, c2, dupKeep, dupDrop] = members
    // give the components a cause and a condition the lead lacks, to see them move to the lead and come back
    const doc = await CD.seedConditions(id, owner.id, CHARLIES_TEN, CONDITIONS_SOURCE).then(() => CD.readConditions(id))
    const aCause = (await prisma.diagnosisCause.findFirst({ where: { ideaId: id } }))!
    await prisma.lexCoherentAction.update({ where: { id: lead.id }, data: { commentary: 'My own commentary on the lead.', targetCauseIds: [], conditionIds: [] } })
    await prisma.lexCoherentAction.update({ where: { id: c1.id }, data: { targetCauseIds: [aCause.id], conditionIds: [doc.items[0].id] } })
    const wholeBefore = await prisma.lexCoherentAction.count({ where: { ideaId: id } })
    RS.seams.callModelJson = (async () => ({
      ok: true, usage: { recorded: { pence: 2 } },
      value: {
        mechanisms: [{ leadNumber: lead.number, componentNumbers: [c1.number, c2.number, 99999], reason: 'FORGED TEXT the model wants in the quote' }],
        duplicates: [{ keepNumber: dupKeep.number, duplicateNumber: dupDrop.number, reason: 'same thing' }],
      },
    })) as never
    const plan2 = await RS.consolidatePlan(id, target.id)
    ok('the consolidate card knows the heading, its size and a price in words', plan2.ok && plan2.data.heading === 'The accountability platform' && plan2.data.actions === members.length && plan2.data.estimate.pence > 0)
    const res = await RS.consolidateHeading(id, owner.id, target.id)
    ok('the consolidation runs: two components folded, one duplicate merged, the impossible number refused in words', res.ok && res.data.folded.length === 2 && res.data.merged.length === 1 && res.data.refused.some((r) => /99999/.test(r)), res.ok ? JSON.stringify({ f: res.data.folded.length, m: res.data.merged.length, r: res.data.refused }) : (res as { error: string }).error)
    ok('live actions on the heading fell by 3 (two folded, one merged)', res.ok && res.data.before - res.data.after === 3)
    const L = await prisma.lexCoherentAction.findUnique({ where: { id: lead.id } })
    const q = (n: { number: number | null; practicalStep: string }) => `• [#${n.number}] “${n.practicalStep.replace(/\s+/g, ' ').trim()}”`
    ok('each folded component is QUOTED in the lead\'s commentary from its OWN row, cited by number', !!L && L.commentary!.includes(q(c1)) && L.commentary!.includes(q(c2)))
    ok('…the model\'s own words appear only as the reason; the user\'s commentary is kept first', L!.commentary!.startsWith('My own commentary on the lead.') && L!.commentary!.includes('FORGED TEXT the model wants in the quote') && !L!.commentary!.replace(/ — FORGED TEXT the model wants in the quote/g, '').includes('FORGED'))
    control('the quote carrying anything but the row\'s own words (must be FALSE)', !L!.commentary!.includes(q(c1)))
    ok('the lead took the cause and the condition its component carried', L!.targetCauseIds.includes(aCause.id) && L!.conditionIds.includes(doc.items[0].id))
    const C1 = await prisma.lexCoherentAction.findUnique({ where: { id: c1.id } })
    ok('a folded component is ARCHIVED with a pointer to its mechanism, and is kept whole', C1?.status === 'ARCHIVED' && C1.foldedIntoId === lead.id && C1.practicalStep === c1.practicalStep)
    const D = await prisma.lexCoherentAction.findUnique({ where: { id: dupDrop.id } })
    ok('the duplicate went through the MERGE: archived, pointing at the one kept', D?.status === 'ARCHIVED' && D.mergedIntoId === dupKeep.id)
    ok('NOTHING WAS DELETED: the number of action rows is unchanged', (await prisma.lexCoherentAction.count({ where: { ideaId: id } })) === wholeBefore)
    const st2 = (await computeCanonicalState(id))!
    ok('the screen\'s state shows the folded components in the set-aside list, each with its pointer', [c1.id, c2.id].every((x) => st2.setAsideActions.some((a) => a.id === x && a.foldedIntoId === lead.id)))
    // ── 195 - the Proposal prints the commentary as "Components and detail"; the Meeting Pack does not; the folded component's cost line rolls up
    const cl = await prisma.costLine.create({ data: { actionId: c1.id, label: 'ROLLUP-PROBE line', category: 'IMPLEMENTATION', low: 1000, high: 2000, unit: 'GBP', basis: 'probe' } })
    const withLine = await computeCostSummary(id)
    const snap = await buildProposalSnapshot(id)
    const sLead = snap.actions.find((a) => a.id === lead.id)
    ok('195 the snapshot gives the mechanism its commentary and the folded component\'s cost line, labelled with the component number', !!sLead && (sLead.commentary ?? '').includes(q(c1)) && sLead.costLines.some((l) => l.label === 'ROLLUP-PROBE line' && l.fromNumber === c1.number))
    ok('…the folded component is not a row of its own in the document', !snap.actions.some((a) => a.id === c1.id))
    const proposalText = JSON.stringify(buildProposalDocument(snap).model)
    ok('195 the Proposal prints "Commentary" with the quoted component under its mechanism', proposalText.includes('Commentary') && proposalText.includes('Parts of this action, quoted') && !proposalText.includes('Components') && proposalText.includes('My own commentary on the lead.') && proposalText.includes(c1.practicalStep.replace(/\s+/g, ' ').trim().slice(0, 40)))
    ok('…and the rolled-up cost line, saying which component it came from', proposalText.includes('ROLLUP-PROBE line') && proposalText.includes(`from part #${c1.number}, quoted in`))
    const packText = JSON.stringify(buildMeetingPackDocument(snap).model)
    ok('195 the Meeting Pack does NOT print the commentary', !packText.includes('Parts of this action, quoted') && !packText.includes('My own commentary on the lead.'))
    control('the Meeting Pack carrying the quoted parts (must be FALSE)', packText.includes('Parts of this action, quoted'))
    await prisma.costLine.delete({ where: { id: cl.id } })
    const withoutLine = await computeCostSummary(id)
    ok('195 the cost summary counts the folded component\'s line (the total moves when the line goes)', JSON.stringify(withLine.totals) !== JSON.stringify(withoutLine.totals))
    control('the cost summary unchanged by a folded component\'s line (must be FALSE)', JSON.stringify(withLine.totals) === JSON.stringify(withoutLine.totals))
    // ── 18 Oct (9) 2 - "Retire heading" ARCHIVES: the row stays, its actions lose the heading, Bring back re-attaches them
    const headsWithLive = new Set((await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE', headingId: { not: null } }, select: { headingId: true } })).map((x) => x.headingId))
    const retireH = heads2.find((x) => x.id !== target.id && x.archivedAt == null && x.name !== target.name && headsWithLive.has(x.id))!
    const heldBy = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, headingId: retireH.id, status: 'LIVE' }, select: { id: true } })
    const rt = await S.deleteHeading(id, retireH.id)
    const rowAfter = await prisma.actionHeading.findFirst({ where: { id: retireH.id, archivedAt: { not: null } } })
    ok('Retire heading archives the heading row (it still exists) and unassigns exactly the actions it held', rt.ok && !!rowAfter && rt.data.unassigned === heldBy.length && heldBy.length > 0 && (await prisma.lexCoherentAction.count({ where: { id: { in: heldBy.map((x) => x.id) }, headingId: null } })) === heldBy.length)
    ok('…and it no longer shows on the live list of headings', !(await computeCanonicalState(id))!.actionHeadings.some((x) => x.id === retireH.id))
    await S.restoreHeading(id, retireH.id)
    ok('Bring back restores the heading AND puts its actions back on it', (await prisma.lexCoherentAction.count({ where: { id: { in: heldBy.map((x) => x.id) }, headingId: retireH.id, headingWasId: null } })) === heldBy.length)
    control('Retire heading removing the heading row (must be FALSE)', (await prisma.actionHeading.findFirst({ where: { id: retireH.id }, select: { id: true } })) === null)
    // ── 198 - the cost total excludes lines on ruled-out and merged-away actions; folded components' lines stay in; restoring brings a line back
    const other = members.find((m) => ![lead, c1, c2, dupKeep, dupDrop].some((x) => x.id === m.id))!
    const base = JSON.stringify((await computeCostSummary(id)).totals)
    const l198 = await prisma.costLine.create({ data: { actionId: other.id, label: '198-probe line', category: 'IMPLEMENTATION', low: 5000, high: 6000, unit: 'GBP', basis: 'probe' } })
    const withLive = JSON.stringify((await computeCostSummary(id)).totals)
    ok('198 a cost line on a LIVE action is in the total', withLive !== base)
    await S.ruleOut(id, [other.id], 'probe')
    const whileOut = JSON.stringify((await computeCostSummary(id)).totals)
    ok('198 ruling the action out DROPS its line from the total (back to the total without it)', whileOut === base, `${whileOut} vs ${base}`)
    control('the total unchanged by ruling out an action that has a cost line (must be FALSE)', whileOut === withLive)
    await S.restore(id, [other.id])
    ok('198 restoring the action brings the total back', JSON.stringify((await computeCostSummary(id)).totals) === withLive)
    const dl = await prisma.costLine.create({ data: { actionId: dupDrop.id, label: '198-merged-away line', category: 'IMPLEMENTATION', low: 9000, high: 9500, unit: 'GBP', basis: 'probe' } })
    ok('198 a line on a MERGED-AWAY action is not in the total', JSON.stringify((await computeCostSummary(id)).totals) === withLive)
    await prisma.costLine.deleteMany({ where: { id: { in: [dl.id, l198.id] } } })
    // restore
    const rr = await S.restore(id, [c1.id, c2.id])
    const L2 = await prisma.lexCoherentAction.findUnique({ where: { id: lead.id } })
    ok('Restore unfolds: both are LIVE again, their quotes and the header are gone, the user\'s commentary is exactly as it was', rr.ok && L2?.commentary === 'My own commentary on the lead.' && (await prisma.lexCoherentAction.count({ where: { id: { in: [c1.id, c2.id] }, status: 'LIVE', foldedIntoId: null } })) === 2)
    ok('…and the lead gives back the cause and the condition the fold added', !L2!.targetCauseIds.includes(aCause.id) && !L2!.conditionIds.includes(doc.items[0].id))
    control('Restore leaving a quote behind in the lead\'s commentary (must be FALSE)', /\[#\d+\]/.test(L2!.commentary ?? ''))
    const rr2 = await S.restore(id, [dupDrop.id])
    ok('a merged duplicate is restored by the same Restore', rr2.ok && (await prisma.lexCoherentAction.findUnique({ where: { id: dupDrop.id } }))?.status === 'LIVE')
    // validation really is applied to a model that names a lead not on the heading
    RS.seams.callModelJson = (async () => ({ ok: true, usage: { recorded: { pence: 1 } }, value: { mechanisms: [{ leadNumber: 99999, componentNumbers: [lead.number], reason: 'x' }], duplicates: [] } })) as never
    const bad = await RS.consolidateHeading(id, owner.id, target.id)
    ok('a group whose lead is not on the heading is refused and NOTHING is written', bad.ok && bad.data.folded.length === 0 && bad.data.after === bad.data.before && bad.data.refused.length >= 1)
    RS.seams.callModelJson = (async () => ({ ok: false, reason: 'truncated', detail: 'cut off', usage: { recorded: { pence: 0 } } })) as never
    const failed = await RS.consolidateHeading(id, owner.id, target.id)
    ok('a failed model call says so in words and changes nothing', !failed.ok && /Nothing was changed/.test((failed as { error: string }).error))
    const one = await RS.consolidatePlan(id, (await prisma.actionHeading.findFirst({ where: { ideaId: id, name: 'Training, guidance and the pilot' } }))!.id)
    ok('a heading is only offered when it holds two or more actions', one.ok || /nothing to consolidate/.test((one as { error: string }).error))
  } finally {
    RS.seams.callModelJson = realCall
    await deleteScratch(id)
  }
}

function partF() {
  section('F · the screen — Hide all / Show all headings and the find box exist (behaviour is asserted in a real browser by check:lex-26s-browser)')
  const w = read('components/lex/ActionsWorkspace.tsx')
  ok('"Hide all headings" / "Show all headings" is one control in the toolbar, next to Group', /data-hide-all-headings/.test(w) && /Show all headings/.test(w) && /Hide all headings/.test(w) && w.indexOf('data-hide-all-headings') > w.indexOf('Group'))
  ok('it writes through one op for every heading', /setHeadingsHidden/.test(w) && /setHeadingsHidden/.test(read('lib/lex/action-structure-schema.ts')) && /case 'setHeadingsHidden'/.test(read('app/api/ideas/[id]/action-structure/route.ts')))
  ok('the find box matches title, statement and commentary, every word, and says "n of m actions match" with a one-press Clear', /data-find-box/.test(w) && /a\.title/.test(w) && /a\.practicalStep/.test(w) && /a\.commentary/.test(w) && /actions? match/.test(w) && /data-find-clear/.test(w))
  ok('"Consolidate this heading" is on a heading\'s own header and "Re-sort into headings" beside Classify (step 1 only)', /data-consolidate-button/.test(w) && /ResortTool/.test(w))
  // 199 - plain words, everywhere consolidation is explained. The card is read from source and the words are asserted verbatim.
  const card = read('components/lex/ActionsStructureTools.tsx').slice(read('components/lex/ActionsStructureTools.tsx').indexOf('export function ConsolidateCard'))
  const cardText = card.replace(/\{[^{}]*\}/g, '')
  ok('199 the confirm box reads “Tidy “{heading}” ({n} actions)?” and the decided explanation, word for word',
    card.includes('Tidy “{s.heading}” ({s.actions} actions)?') &&
    card.includes('Lex reads the actions under this heading and sorts out two things. Parts of a bigger action — a field, a rule or a step that only makes sense inside another action on this list — are tucked into that action’s Commentary, quoted word for word with their number, so nothing is lost and “Restore” puts any of them back as its own row. Two actions saying the same thing are joined into one, and both originals are kept. Nothing is deleted. Estimated '))
  ok('199 the result box reads “{n} → {m} live actions.”, “{k} tucked into their bigger action: #a into #b, …”, “{j} pair(s) joined: #c into #d, both kept.”',
    card.includes('{r.before} → {r.after} live actions') && card.includes(' tucked into their bigger action: ') && card.includes('Each is quoted in that action’s Commentary and kept under “Ruled out and merged away”.') && card.includes(" joined: ") && card.includes(', both kept.') && card.includes("'pair' : 'pairs'") && card.includes("join(', ')"))
  const screenFiles = ['components/lex/ActionsStructureTools.tsx', 'components/lex/ActionsWorkspace.tsx', 'lib/lex/agent/controls.ts']
  const banned = /\b(components?|mechanisms?|folded|unfold(ed)?)\b/i
  const wordsOnly = (l: string) => l.replace(/[\w.]*[fF]olded[\w]*(?:Id|Count)?|data-folded-count/g, (m) => (/[.\-]|Id$|Count$/.test(m) ? '' : m))
  const strings = screenFiles.flatMap((f) => read(f).split('\n').filter((l) => /consolidat|tucked|Retire|set aside|Ruled out and merged|Restore|Join /i.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\bimport\b|ComponentType|component\b.*\bfile\b|a component|components\/lex|the component|\.tsx|per-component|client component|`file`/.test(l)).map((l) => `${f}: ${l.trim().slice(0, 160)}`))
  ok('199 no “component”, “mechanism”, “folded” or “unfold” in the consolidation strings on screen or in Lex\'s controls list', !strings.some((s) => banned.test(wordsOnly(s.split(': ').slice(1).join(': ')))), strings.filter((s) => banned.test(wordsOnly(s.split(': ').slice(1).join(': ')))).join(' | ').slice(0, 400))
  control('199 the ban missing the old words when they are put back (must be FALSE)', !banned.test('Folded 2 components into their mechanism'))
  ok('199 the ruled-out row says “part of #n” and its button is plain “Restore”', /`part of #\$\{byIdAll\.get\(a\.foldedIntoId\)\?\.number \?\? '\?'\}`/.test(w) && !/'Unfold'/.test(w))
  ok('199 Lex\'s controls list names “Consolidate this heading” in the same plain words', /label: 'Consolidate this heading', file: 'components\/lex\/ActionsWorkspace.tsx'[^\n]*tucked into that action’s Commentary[^\n]*joined into one/.test(read('lib/lex/agent/controls.ts')))
  ok('the conditions view is a step-1 view and the conditions panel is step 1\'s', /1: \['list', 'coverage', 'conditions'\]/.test(w) && /step === 1 && <ConditionsPanel/.test(w))
  control('the find box also offered in step 3 (must be FALSE: it is a list tool, in every step the list is; this asserts it is not step-gated by mistake)', /step === 3 && .*data-find-box/.test(w))
}

async function main() {
  partA(); partB(); partC()
  await partD()
  await partE()
  partF()
  console.log(`\n${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
