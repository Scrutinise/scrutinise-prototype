// ─────────────────────────────────────────────────────────────────────────────
// 26-T2 §4 (decisions 145, 202) — THE ACTIONS PACK: a printable pack of ANY selection of actions with everything the record holds.
//
// The ninth document kind, and a different reader again: a reviewer who will mark up paper. So:
//   · EVERY PARAGRAPH IS NUMBERED  H.A.S - heading letter, the action's place in print order under that heading, and the section (1-11).
//     "B.3.6 is wrong" works on paper and by email. The scheme is printed in a one-line key at the top.
//   · EVERY SECTION OF EVERY ACTION IS PRINTED, even empty: a slot nobody has answered reads "not yet answered" (never silence, which reads as
//     "fine"), so the numbers are the same on every printing and a gap is visible as a gap.
//   · NOTHING IS GENERATED. It arranges what the record holds: the owner's words, the quoted parts of a bigger action, the digest as written
//     and dated (with its staleness), each source as [Ref: n].
//
// Order: key · Guiding Policy · conditions · per heading (name, purpose, digest, its actions) · Incentives · Considered, not taken · sources.
// ─────────────────────────────────────────────────────────────────────────────

import type { Block, DocumentModel, Run, SourceRef } from './model'
import { markdownToBlocks } from './markdown'
import { snapshotHash, assertRenderableSnapshot, type ProposalSnapshot, type SnapshotAction } from './proposal-snapshot'
import { betaBlocks, figureRuns, money, type ProposalBuildResult } from './build-proposal'
import { PACK_SLOT_LABEL, type ActionsPackData, type PackAction, type PackDigest } from './actions-pack-types'
import { text, numbered, letterFor, incentiveBlocks, notTakenBlocks, dateWords } from './pack-sections'
import { DIGEST_QUESTIONS } from '@/lib/lex/action-digest-pure'
import { INCENTIVE_WORD } from '@/lib/lex/incentive-map'
import { CLAUSE_CAVEAT, INSTRUMENT_WORD, provisionLine } from '@/lib/lex/action-draft-pure'
import { NEAR_QUESTION, STATE_WORDS as TOUCH_STATE } from '@/lib/lex/action-touches-pure'
import { KIND_WORD, dNumberWords } from '@/lib/lex/action-documents-pure'
import { afterWords, derivedOrder } from '@/lib/lex/action-order-pure'

/** Which actions to print. `actionIds` wins; else a heading (`'__none'` = the actions with no heading); else everything. */
export interface PackSelection { actionIds?: string[]; headingId?: string | null }

export const PACK_SECTIONS = [
  'What it is', 'Parts of this action, quoted', 'Who', 'Incentive now, and what changes it', 'Skill, how it is enforced, what will oppose it, and what tells us it worked',
  // 9 was "Sequence" (Now / Next / Later); decision 262 retired those words and the paragraph keeps its number as "Order".
  'Causes and conditions', 'Test against the guiding policy', 'Cost', 'Order', 'Sources', 'The owner’s notes',
  // 26-U — appended, never inserted: 1-11 keep their numbers on every printing (a reviewer's "B.3.6" must still mean the same paragraph).
  'Draft text', 'What this touches',
  // 26-V1 §2e/§6 — appended the same way: the action's documents, in number order, each with its D-number and its status.
  'Documents',
] as const

export const PACK_KEY_LINE =
  'How the paragraphs are numbered: H.A.S - H is the heading’s letter, A is the action’s place in this printing under that heading, S is the section (1 What it is … 11 The owner’s notes, 12 Draft text, 13 What this touches, 14 Documents). '
  + 'To say a paragraph is wrong, quote its number, for example “B.2.3”. 0.n are the Guiding Policy and the conditions; D is a digest; INC.n and NOT.n are the Incentives and the Considered, not taken sections. '
  + 'A document on an action has a D-number (D.38.2 = action 38, document 2) and is printed with its status: a D-number is our own output, never a source, so it is never in the [Ref: n] list.'

const NOT_ANSWERED = 'not yet answered'
const AVENUE: Record<string, string> = { LEGISLATIVE: 'legislative', ORGANISATIONAL: 'organisational', FINANCIAL: 'financial' }
const VERDICT: Record<string, string> = { FITS: 'fits the policy', DOES_NOT_FIT: 'does not fit the policy', CONFLICTS: 'conflicts with the policy', NOT_TESTED: 'not tested against the policy' }
const refTokens = (refs: number[]): Run[] => (refs.length ? [{ text: ` ${refs.map((n) => `[Ref: ${n}]`).join(' ')}` }] : [])

export function selectActions(data: ActionsPackData, sel: PackSelection): { actions: PackAction[]; label: string } {
  if (sel.actionIds?.length) {
    const ids = new Set(sel.actionIds)
    const actions = data.actions.filter((a) => ids.has(a.id))
    return { actions, label: `${actions.length} selected ${actions.length === 1 ? 'action' : 'actions'}` }
  }
  if (sel.headingId !== undefined && sel.headingId !== null) {
    const none = sel.headingId === '__none'
    const actions = data.actions.filter((a) => (none ? a.headingId == null : a.headingId === sel.headingId))
    const h = data.headings.find((x) => x.id === sel.headingId)
    return { actions, label: none ? 'the actions with no heading' : `the heading “${h?.name ?? 'unknown'}”` }
  }
  return { actions: data.actions, label: 'all the actions' }
}

/** Heading blocks in print order: the headings in list order, then "No heading" last. Only headings that have a selected action (or were asked for) are printed. */
export function headingGroups(data: ActionsPackData, actions: PackAction[], sel: PackSelection): Array<{ id: string | null; name: string; purpose: string | null; actions: PackAction[] }> {
  const groups = data.headings.map((h) => ({ id: h.id as string | null, name: h.name, purpose: h.purpose, actions: actions.filter((a) => a.headingId === h.id) }))
  groups.push({ id: null, name: 'No heading', purpose: null, actions: actions.filter((a) => a.headingId == null) })
  const asked = sel.headingId && sel.headingId !== '__none' ? sel.headingId : null
  return groups.filter((g) => g.actions.length > 0 || (asked != null && g.id === asked))
}

function slotLine(a: PackAction, key: keyof typeof PACK_SLOT_LABEL): Run[] {
  const s = a.slots[key]
  return [{ text: `${PACK_SLOT_LABEL[key]}: `, bold: true }, s?.text ? { text: s.text } : { text: NOT_ANSWERED, italic: true }]
}

function costBlocks(label: string, a: PackAction, sa: SnapshotAction | undefined): Block[] {
  if (!sa) return [numbered(label, [{ text: `Cost: ${NOT_ANSWERED}`, italic: true }])]
  const out: Block[] = []
  const runs: Run[][] = []
  for (const [l, f] of [['Cost to implement (one-off)', sa.implementationCost], ['Cost to enforce (ongoing)', sa.enforcementCost], ['Cost of compliance (ongoing)', sa.regulatoryFriction]] as const) {
    const r = figureRuns(l, f)
    if (r) runs.push(r)
  }
  for (const l of sa.costLines) {
    const amount = money({ low: l.low, high: l.high, unit: l.unit, basis: l.basis, benchmarkId: l.benchmarkId, userOverride: false, priceYear: l.priceYear })
    runs.push([{ text: l.label, bold: true }, { text: `${amount ? ` — ${amount}` : ''}${l.recurrence === 'ONE_OFF' ? ' one-off' : l.recurrence === 'PER_YEAR' ? ' per year' : ''}` }, { text: l.basis ? ` (${l.basis})` : ' (no basis stated)', italic: !l.basis }, ...(l.fromNumber != null ? [{ text: ` — from part #${l.fromNumber}`, italic: true }] : [])])
  }
  if (sa.noCostReason) runs.push([{ text: 'No cost, because: ', bold: true }, { text: sa.noCostReason }])
  if (!runs.length) return [numbered(label, [{ text: `Cost: ${NOT_ANSWERED}`, italic: true }])]
  out.push(numbered(label, [{ text: 'Cost', bold: true }]))
  out.push({ kind: 'bullets', items: runs })
  void a
  return out
}

function actionBlocks(L: string, n: number, a: PackAction, sa: SnapshotAction | undefined, numberToHeading: Map<number, string>, all: PackAction[]): Block[] {
  const N = (s: number) => `${L}.${n}.${s}`
  const blocks: Block[] = []
  blocks.push({ kind: 'heading', level: 2, runs: [{ text: `${L}.${n}  #${a.number}  ${a.title ?? a.statement.slice(0, 90)}` }] })
  // 1 · what it is
  blocks.push(numbered(N(1), [{ text: PACK_SECTIONS[0] + ': ', bold: true }, { text: a.statement }]))
  const meta = [a.avenue ? `avenue: ${AVENUE[a.avenue] ?? a.avenue.toLowerCase()}` : null, a.parked ? `later phase${a.parkedReason ? ` (${a.parkedReason})` : ''}` : null].filter(Boolean)
  if (meta.length) blocks.push({ kind: 'note', text: meta.join(' · ') })
  if (a.detail) blocks.push(...markdownToBlocks(a.detail))
  // 2 · the quoted parts
  if (a.parts.length) {
    blocks.push(numbered(N(2), [{ text: `${PACK_SECTIONS[1]}:`, bold: true }]))
    blocks.push({ kind: 'bullets', items: a.parts.map((p): Run[] => [{ text: `#${p.number} `, bold: true }, { text: `“${p.quote}”` }, ...(p.title ? [{ text: ` (${p.title})`, italic: true }] : []), ...(p.reason ? [{ text: ` — ${p.reason}`, italic: true }] : []), ...refTokens(p.refs)]) })
  } else blocks.push(numbered(N(2), [{ text: `${PACK_SECTIONS[1]}: `, bold: true }, { text: 'none - no other action has been folded into this one.', italic: true }]))
  // 3 · who
  blocks.push(numbered(N(3), slotLine(a, 'who')))
  // 4 · incentive now / what changes it
  const inc = a.slots.incentiveNow, chg = a.slots.whatChangesIt
  blocks.push(numbered(N(4), [{ text: 'Incentive now: ', bold: true },
    inc?.text ? { text: `${inc.direction ? `${INCENTIVE_WORD[inc.direction]} - ` : 'no direction chosen - '}${inc.text}` } : { text: NOT_ANSWERED, italic: true },
    { text: '   What changes it: ', bold: true },
    chg?.text ? { text: `${chg.text}${chg.linkNumber != null ? ` (relies on #${chg.linkNumber}${numberToHeading.get(chg.linkNumber) ? `, under “${numberToHeading.get(chg.linkNumber)}”` : ''})` : ' (no action linked)'}` } : { text: NOT_ANSWERED, italic: true }]))
  // 5 · skill / how / against / worked
  blocks.push(numbered(N(5), [{ text: `${PACK_SECTIONS[4]}:`, bold: true }]))
  blocks.push({ kind: 'bullets', items: (['skill', 'how', 'against', 'worked'] as const).map((k) => slotLine(a, k)) })
  // 6 · causes and conditions
  blocks.push(numbered(N(6), [{ text: 'Causes: ', bold: true }, { text: a.causeNumbers.length ? a.causeNumbers.map((c) => `cause ${c}`).join(', ') : 'none recorded', italic: !a.causeNumbers.length },
    { text: '   Conditions it delivers: ', bold: true }, { text: a.support ? 'marked support - it delivers none directly' : a.conditionNumbers.length ? a.conditionNumbers.map((c) => `condition ${c}`).join(', ') : 'none recorded', italic: !a.support && !a.conditionNumbers.length }]))
  // 7 · policy test
  blocks.push(numbered(N(7), [{ text: `${PACK_SECTIONS[6]}: `, bold: true },
    a.policyTest ? { text: `${VERDICT[a.policyTest.verdict] ?? a.policyTest.verdict}${a.policyTest.reason ? ` - ${a.policyTest.reason}` : ''}${a.policyTest.verdict === 'CONFLICTS' && a.policyTest.conflictNote ? ` (kept, with the owner’s note: ${a.policyTest.conflictNote})` : ''}` } : { text: 'not tested against the policy', italic: true }]))
  // 8 · cost
  blocks.push(...costBlocks(N(8), a, sa))
  // 9 · order (262): what it must come after, with the reasons, and what it comes before — never Now / Next / Later
  const after = afterLinesOf(a, all)
  blocks.push(numbered(N(9), [{ text: 'Order: ', bold: true },
    after.length ? { text: afterWords(after.map((x) => ({ id: String(x.number), number: x.number, because: x.because }))) } : { text: 'nothing it must come after', italic: true },
    ...(a.beforeNumbers.length ? [{ text: `; comes before ${a.beforeNumbers.map((x) => `#${x}`).join(', ')}` }] : [])]))
  // 10 · sources
  blocks.push(numbered(N(10), [{ text: 'Sources: ', bold: true }, a.refs.length ? { text: a.refs.map((r) => `[Ref: ${r}]`).join(' ') } : { text: 'none recorded for this action', italic: true }]))
  // 11 · the owner's notes
  if (a.notes.length) {
    blocks.push(numbered(N(11), [{ text: `${PACK_SECTIONS[10]}:`, bold: true }]))
    blocks.push({ kind: 'bullets', items: a.notes.map((x): Run[] => [{ text: x.text }, { text: ` — ${x.author}, ${dateWords(x.at)}`, italic: true }, ...refTokens(x.ref != null ? [x.ref] : [])]) })
  } else blocks.push(numbered(N(11), [{ text: `${PACK_SECTIONS[10]}: `, bold: true }, { text: 'none in the record.', italic: true }]))
  // 12 · draft text — the instruction, then the clause with its caveat (the caveat is the clause's first line and is never printed without it)
  const d = a.draft ?? null // a snapshot stored before 26-U has no draft: it reads as none written
  if (!d) blocks.push(numbered(N(12), [{ text: `${PACK_SECTIONS[11]}: `, bold: true }, { text: 'no drafting instruction yet.', italic: true }]))
  else {
    const legislative = a.avenue === 'LEGISLATIVE'
    blocks.push(numbered(N(12), [{ text: `${PACK_SECTIONS[11]} (version ${d.v}, by ${d.by === 'USER' ? 'the owner' : 'Lex, accepted by the owner'}): `, bold: true }, { text: `instrument — ${d.instrument ? INSTRUMENT_WORD[d.instrument] : NOT_ANSWERED}; duty on — ${d.dutyOnWhom || NOT_ANSWERED}; enforced — ${d.enforcedHow || NOT_ANSWERED}${legislative ? `; commencement — ${d.commencement || NOT_ANSWERED}; extent — ${d.extent.join(', ') || NOT_ANSWERED}` : ''}.` }]))
    if (d.provisions.length) blocks.push({ kind: 'bullets', items: d.provisions.map((p): Run[] => [{ text: provisionLine(p) }]) })
    if (d.precedents.length) blocks.push({ kind: 'bullets', items: d.precedents.map((p): Run[] => [{ text: `Precedent: ${p.docUri}${p.provisionPath ? ` ${p.provisionPath}` : ''} — ${p.how}` }]) })
    const body = legislative ? d.clause : d.plainWording
    if (body) for (const para of body.split(/\n+/).filter((l) => l.trim())) blocks.push({ kind: 'paragraph', runs: [{ text: para, italic: para.startsWith(CLAUSE_CAVEAT) }] })
    else blocks.push({ kind: 'paragraph', runs: [{ text: legislative ? 'The clause: not yet drafted.' : 'Wording: not yet written.', italic: true }] })
  }
  // 13 · what this touches — computed for this printing from the instruction's provisions, with the honest states in words
  if (!a.touches?.length) blocks.push(numbered(N(13), [{ text: `${PACK_SECTIONS[12]}: `, bold: true }, { text: d ? 'the instruction names no provision it amends, repeals, modifies, relies on or is constrained by.' : 'nothing to compute until there is a drafting instruction.', italic: true }]))
  else {
    blocks.push(numbered(N(13), [{ text: `${PACK_SECTIONS[12]}:`, bold: true }]))
    blocks.push({ kind: 'bullets', items: a.touches.map((t): Run[] => [{ text: `${provisionLine(t.line)} — ${TOUCH_STATE[t.state]}${t.stateReason ? ` (${t.stateReason})` : ''}${t.effects ? `. ${t.effects.perType.map((c) => `${c.type}: ${c.total} (${c.changeTheWords} change the words, ${c.doNotChangeTheWords} do not, ${c.unclassified} unclassified)`).join('; ')}. ${t.effects.freshness}` : ''}${t.near.length ? ` Near provisions — ${NEAR_QUESTION}: ${t.near.map((n) => `s.${n.number} ${n.title}`).join('; ')}.` : ''}` }]) })
  }
  // 14 · documents — in number order after the record, each with its D-number and status in words (241: never read as settled)
  const docs = a.documents ?? [] // a snapshot stored before 26-V has none: it reads as none
  if (!docs.length) blocks.push(numbered(N(14), [{ text: `${PACK_SECTIONS[13]}: `, bold: true }, { text: 'none on this action yet.', italic: true }]))
  else {
    blocks.push(numbered(N(14), [{ text: `${PACK_SECTIONS[13]}:`, bold: true }]))
    for (const doc of docs) {
      blocks.push({ kind: 'heading', level: 3, runs: [{ text: `${dNumberWords({ action: a.number, number: doc.number, status: doc.status, stale: !!doc.stale })} — ${doc.title} (${KIND_WORD[doc.kind]}${doc.v ? `, version ${doc.v}` : ''})` }] })
      if (doc.stale) blocks.push({ kind: 'note', text: `Out of date: ${doc.stale}` })
      if (doc.body.trim()) blocks.push(...markdownToBlocks(doc.body))
      else blocks.push({ kind: 'paragraph', runs: [{ text: 'No version yet — only a draft from Lex, not yet used.', italic: true }] })
    }
  }
  return blocks
}

/** What an action must come after. A snapshot stored before 26-V1b has no afterLines: read them back from the others' beforeNumbers. */
function afterLinesOf(a: PackAction, all?: PackAction[]): Array<{ number: number; because: string | null }> {
  if (a.afterLines) return a.afterLines
  return (all ?? []).filter((o) => o.beforeNumbers.includes(a.number)).map((o) => ({ number: o.number, because: null }))
}

/**
 * 26-V1b §7b (262) — THE ORDER SECTION: the derived order over the printed actions, numbered, with the reasons — the same derivation as
 * step 4's view. Actions caught in a circle are named apart, never printed as if they had a place.
 */
function orderBlocks(actions: PackAction[]): Block[] {
  const blocks: Block[] = [{ kind: 'section', title: 'ORDER' }]
  if (!actions.length) return blocks
  const key = (n: number) => String(n)
  const nodes = actions.map((a) => ({ id: key(a.number), number: a.number, beforeIds: a.beforeNumbers.map(key) }))
  const because = new Map(actions.map((a) => [key(a.number), new Map(afterLinesOf(a, actions).map((x) => [key(x.number), x.because]))]))
  const { rows, unplaced } = derivedOrder(nodes, (later, earlier) => because.get(later)?.get(earlier) ?? null)
  blocks.push({ kind: 'paragraph', runs: [{ text: 'Worked out from what each action must come after; actions with nothing before them keep the list’s order. Within this printing only.', italic: true }] })
  const title = new Map(actions.map((a) => [key(a.number), a.title ?? a.statement.slice(0, 80)]))
  blocks.push({ kind: 'bullets', items: rows.map((r): Run[] => [{ text: `${r.place}. #${r.number} `, bold: true }, { text: `${title.get(r.id) ?? ''} — ${afterWords(r.after)}` }]) })
  if (unplaced.length) blocks.push({ kind: 'note', text: `Not placed — an impossible order: ${unplaced.map((id) => `#${id}`).join(', ')} each have to come after another in the same circle.` })
  return blocks
}

/** §2e — the Documents list, beside Sources and never merged into it: every document on the printed actions, with its status. */
function documentListBlocks(actions: PackAction[]): Block[] {
  const all = actions.flatMap((a) => (a.documents ?? []).map((d) => ({ a, d })))
  const blocks: Block[] = [{ kind: 'section', title: 'DOCUMENTS' }]
  if (!all.length) { blocks.push({ kind: 'paragraph', runs: text('No document is recorded on the actions in this printing.') }); return blocks }
  blocks.push({ kind: 'paragraph', runs: [{ text: 'Our own outputs on the actions, in number order. None of them is evidence: the evidence is the Sources list.', italic: true }] })
  blocks.push({ kind: 'bullets', items: all.map(({ a, d }): Run[] => [{ text: dNumberWords({ action: a.number, number: d.number, status: d.status, stale: !!d.stale }), bold: true }, { text: ` — ${d.title} (${KIND_WORD[d.kind]})` }]) })
  return blocks
}


/**
 * 229/267 — the consequential schedule across the printed actions: the DRAFTED amendments in ACCEPTED drafting instructions, counted and
 * listed. ⚠ Never a figure from the record of effects or from a reference (GRAPH 8 rule 4): those are candidates, and this annexe records
 * what has been drafted and accepted. A draft not yet accepted is not here.
 */
function scheduleBlocks(actions: PackAction[]): Block[] {
  const all = actions.flatMap((a) => (a.scheduleRows ?? []).map((r) => ({ a, r })))
  const blocks: Block[] = [{ kind: 'section', title: 'ANNEXE — CONSEQUENTIAL AMENDMENTS AND REPEALS' }]
  if (!all.length) { blocks.push({ kind: 'paragraph', runs: [{ text: 'No printed action has an accepted drafting instruction that amends, repeals or modifies an existing provision yet. A draft that is not accepted is not listed here.', italic: true }] }); return blocks }
  const n = (rel: string) => all.filter(({ r }) => r.relation === rel).length
  const acts = new Set(all.map(({ r }) => r.docUri)).size
  blocks.push({ kind: 'paragraph', runs: [{ text: `Drafted and accepted: ${n('amends')} amended, ${n('repeals')} repealed, ${n('modifies')} modified, across ${acts} Act${acts === 1 ? '' : 's'}. Only accepted drafting instructions are listed; nothing here is taken from the record of effects or of references.` }] })
  blocks.push({ kind: 'bullets', items: all.map(({ a, r }): Run[] => [{ text: `#${a.number}: ${provisionLine({ docUri: r.docUri, provisionPath: r.provisionPath, relation: r.relation as never, note: r.note })} — version ${r.v}, accepted (${r.d})` }]) })
  return blocks
}

function digestBlocks(prefix: string, d: PackDigest): Block[] {
  const blocks: Block[] = []
  let i = 0
  const P = () => `${prefix}.D.${++i}`
  blocks.push({ kind: 'heading', level: 2, runs: text(`Digest · written ${dateWords(d.createdAt)}${d.scope === 'HEADING' && d.headingName ? ` · “${d.headingName}”` : ' · the whole set'} · ${d.answering} models answered`) })
  if (d.staleNote) blocks.push({ kind: 'note', text: `Out of date: ${d.staleNote}` })
  for (const q of DIGEST_QUESTIONS.keys()) {
    const a = d.answers.find((x) => x.question === q + 1)
    blocks.push(numbered(P(), [{ text: `${q + 1}. ${DIGEST_QUESTIONS[q]} `, bold: true }, a ? { text: a.reconciled } : { text: 'The judge gave no answer to this question.', italic: true }]))
  }
  if (d.disagreements.length) {
    blocks.push(numbered(P(), [{ text: d.answering === 4 ? 'Where the four disagree:' : `Where the ${d.answering} that answered disagree:`, bold: true }]))
    blocks.push({ kind: 'bullets', items: d.disagreements.map((x): Run[] => [{ text: `${x.topic} — `, bold: true }, { text: x.positions.map((p) => `${p.model}: ${p.position}`).join(' | ') }]) })
  }
  if (d.gaps.length) {
    blocks.push(numbered(P(), [{ text: 'What is missing, most-named first:', bold: true }]))
    blocks.push({ kind: 'bullets', items: d.gaps.map((g): Run[] => [{ text: g.item, bold: true }, { text: ` (${g.category}; named by ${g.namedBy.length}) — what fails without it: ${g.whatFails}` }]) })
  }
  return blocks
}

export function buildActionsPackDocument(snapshot: ProposalSnapshot, opts: { selection?: PackSelection } = {}): ProposalBuildResult {
  assertRenderableSnapshot(snapshot)
  const sel = opts.selection ?? {}
  const data = snapshot.actionsPack
  const blocks: Block[] = []
  blocks.push(...betaBlocks())
  if (!data) {
    blocks.push({ kind: 'note', text: 'This version of the proposal was stored before the Actions Pack existed, so the record it holds cannot be arranged as a pack. Generate the pack from the working draft instead.' })
    return finish(snapshot, blocks, sel, 'no actions')
  }
  const { actions, label } = selectActions(data, sel)
  blocks.push({ kind: 'note', text: PACK_KEY_LINE })
  blocks.push({ kind: 'note', text: `This printing: ${label} of ${data.actions.length} live ${data.actions.length === 1 ? 'action' : 'actions'}.` })

  // ── the Guiding Policy ──
  const chosen = (snapshot.options ?? []).find((o) => o.status === 'CHOSEN')
  blocks.push({ kind: 'heading', level: 1, runs: text('The Guiding Policy') })
  if (chosen) {
    blocks.push(numbered('0.1', [{ text: 'Statement: ', bold: true }, { text: chosen.approach }]))
    const summary = [chosen.caseFor, chosen.chainLink ? `If only part is delivered: ${chosen.chainLink}` : null].filter(Boolean).join(' ')
    blocks.push(numbered('0.2', [{ text: 'Summary: ', bold: true }, summary ? { text: summary } : { text: NOT_ANSWERED, italic: true }]))
  } else blocks.push(numbered('0.1', [{ text: 'No Guiding Policy has been settled yet.', italic: true }]))

  // ── the conditions ──
  blocks.push({ kind: 'heading', level: 1, runs: text('The conditions the proposal must meet') })
  if (data.conditions.length) {
    data.conditions.forEach((c) => blocks.push(numbered(`0.${c.number + 2}`, [{ text: `Condition ${c.number}: `, bold: true }, { text: c.text }])))
    if (data.conditionsSource) blocks.push({ kind: 'note', text: `Where the list came from: ${data.conditionsSource}` })
  } else blocks.push(numbered('0.3', [{ text: 'The owner has recorded no conditions.', italic: true }]))

  // ── the whole-set digest, when everything is printed ──
  const all = !sel.actionIds?.length && (sel.headingId === undefined || sel.headingId === null)
  const setDigest = data.digests.find((d) => d.scope === 'SET')
  if (all) {
    blocks.push({ kind: 'heading', level: 1, runs: text('Digest of the whole set') })
    if (setDigest) blocks.push(...digestBlocks('SET', setDigest))
    else blocks.push({ kind: 'paragraph', runs: [{ text: 'SET.D.1  ', bold: true }, { text: 'none yet.', italic: true }] })
  }

  // ── per heading ──
  const saById = new Map((snapshot.actions ?? []).map((a) => [a.id, a]))
  const headingOf = new Map(data.actions.map((a) => [a.number, data.headings.find((h) => h.id === a.headingId)?.name ?? '']))
  const numberToHeading = new Map([...headingOf.entries()].filter(([, v]) => v))
  const groups = headingGroups(data, actions, sel)
  groups.forEach((g, gi) => {
    const L = letterFor(gi)
    blocks.push({ kind: 'section', title: `${L} · ${g.name}` })
    blocks.push(numbered(`${L}.P`, [{ text: 'Purpose: ', bold: true }, g.purpose ? { text: g.purpose } : { text: g.id ? NOT_ANSWERED : 'these actions are not under any heading.', italic: true }]))
    const hd = g.id ? data.digests.find((d) => d.scope === 'HEADING' && d.headingId === g.id) : null
    if (g.id) {
      if (hd) blocks.push(...digestBlocks(L, hd))
      else blocks.push({ kind: 'paragraph', runs: [{ text: `${L}.D.1  `, bold: true }, { text: 'Digest: none yet.', italic: true }] })
    }
    if (!g.actions.length) blocks.push({ kind: 'paragraph', runs: text('No live actions under this heading.') })
    g.actions.forEach((a, ai) => blocks.push(...actionBlocks(L, ai + 1, a, saById.get(a.id), numberToHeading, data.actions)))
  })

  // ── 26-V1b §7b: the order, derived (262) ──
  blocks.push(...orderBlocks(actions))

  // ── incentives (over the printed actions) ──
  blocks.push({ kind: 'section', title: 'INCENTIVES' })
  blocks.push(...incentiveBlocks(actions))

  // ── considered, not taken: ruled-out actions under the printed headings ──
  blocks.push({ kind: 'section', title: 'CONSIDERED, NOT TAKEN' })
  const headingIds = new Set<string | null>(groups.map((g) => g.id))
  blocks.push(...notTakenBlocks(data, { headingIds, includeNotebook: false }))

  // ── 26-U §4b: the consequential schedule (229) ──
  blocks.push(...scheduleBlocks(actions))

  // ── the source list, numbered ──
  const cited = [...new Set(actions.flatMap((a) => a.refs))].sort((x, y) => x - y)
  const byNumber = new Map(data.registry.map((s) => [s.number, s]))
  blocks.push({ kind: 'section', title: 'SOURCES' })
  if (cited.length) {
    const refs: SourceRef[] = cited.map((n) => { const s = byNumber.get(n); return { ref: n, title: s?.title ?? 'A source not in the registry', citation: s?.citation ?? '', url: s?.url ?? '' } })
    blocks.push({ kind: 'sources', label: `Sources cited in this printing (${cited.length})`, refs })
  } else blocks.push({ kind: 'paragraph', runs: text('No source is recorded against the actions in this printing.') })

  // ── 26-V1 §2e: the documents, as a second list (outputs), never merged into the sources (evidence) ──
  blocks.push(...documentListBlocks(actions))

  return finish(snapshot, blocks, sel, label)
}

function finish(snapshot: ProposalSnapshot, blocks: Block[], sel: PackSelection, label: string): ProposalBuildResult {
  const model: DocumentModel = {
    title: `${snapshot.title} — Actions Pack`,
    subtitle: `${label}. Every paragraph is numbered so a reviewer can refer to it.`,
    sourceLabel: 'the working record of this proposal (headings, actions, the step-2 answers, digests and notes)',
    generatedAt: new Date(snapshot.generatedAt),
    blocks,
  }
  void sel
  return { model, fingerprint: snapshotHash(snapshot), sourceLabel: model.sourceLabel }
}
