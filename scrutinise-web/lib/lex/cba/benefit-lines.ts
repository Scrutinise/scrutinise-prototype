// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §2a/§2b (decision 334) — BENEFIT LINES, the writers. One path for the form (the route) and for Lex's tools (parity).
//
//   · every save is a FieldRevision (fieldKey "benefitLine", targetId = the line, targetNumber = the action's number), so a change is never lost;
//   · nothing deletes: "Remove" sets REMOVED (kept, listed under "Removed", restorable);
//   · a line Lex writes is a PROPOSAL (status PROPOSED, with its reason) unless the owner dictated it; the owner accepts it or sets it aside;
//   · a REF must be a number in the idea's registry; a BENCHMARK must be a held CostBenchmark row; a CITATION must be a manifest key (337) —
//     each refused in words otherwise, the citation with its nearest held keys.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { LIMITS } from '../input-limits'
import { normaliseBenefit, benefitWords, type BenefitInput } from './benefit-lines-pure'
import { checkCitationKey } from './citation-manifest'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }
export interface Actor { userId: string; by: 'OWNER' | 'LEX'; dictated?: boolean; why?: string | null }

const FIELD = 'benefitLine'

async function actionOf(ideaId: string, actionId: string) {
  return prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true, number: true } })
}

/** The server half of the source rule: does the named source exist? */
async function sourceRefusal(ideaId: string, i: BenefitInput): Promise<string | null> {
  if (i.sourceKind === 'REF' && i.sourceRef != null) {
    const n = await prisma.ideaSource.count({ where: { ideaId, number: i.sourceRef } }).catch(() => null)
    if (n === 0) return `Not saved: [Ref: ${i.sourceRef}] is not in this idea’s numbered sources.`
  }
  if (i.sourceKind === 'BENCHMARK' && i.benchmarkId) {
    if (!(await prisma.costBenchmark.findUnique({ where: { id: i.benchmarkId }, select: { id: true } }))) return 'Not saved: that unit-cost row is not held.'
  }
  if (i.sourceKind === 'CITATION' && i.citationKey?.trim()) {
    const c = await checkCitationKey(i.citationKey)
    if (!c.ok) return `Not saved: ${(c as { error: string }).error}`
    i.citationKey = c.key
  }
  return null
}

async function revise(ideaId: string, actionNumber: number | null, lineId: string, prev: string, next: string, userId: string, origin: string) {
  await prisma.fieldRevision.create({ data: { ideaId, fieldKey: FIELD, targetId: lineId, targetNumber: actionNumber, previousText: prev, previousSource: 'USER', newText: next, acceptedById: userId, origin } })
}

const wordsOf = (r: Parameters<typeof benefitWords>[0]) => benefitWords(r)

export async function addBenefitLine(ideaId: string, actionId: string, input: BenefitInput, actor: Actor): Promise<Result<{ id: string; status: string; valuation: string; note: string | null; words: string }>> {
  const a = await actionOf(ideaId, actionId)
  if (!a) return { ok: false, error: 'Not saved: that action is not on this idea’s live list.' }
  const n0 = normaliseBenefit(input)
  if (!n0.ok) return { ok: false, error: (n0 as { error: string }).error }
  const n = n0 as Extract<typeof n0, { row: unknown }>
  const refused = await sourceRefusal(ideaId, { ...input, citationKey: n.row.citationKey })
  if (refused) return { ok: false, error: refused }
  if (n.row.citationKey) n.row.citationKey = (await checkCitationKey(n.row.citationKey) as { key: string }).key
  const count = await prisma.benefitLine.count({ where: { actionId, status: { in: ['ACCEPTED', 'PROPOSED'] } } })
  if (count >= LIMITS.benefitLinesPerAction) return { ok: false, error: `Not saved: #${a.number ?? '?'} already has ${count} benefit lines; the limit is ${LIMITS.benefitLinesPerAction}.` }
  const status = actor.by === 'LEX' && !actor.dictated ? 'PROPOSED' : 'ACCEPTED'
  const created = await prisma.benefitLine.create({ data: { actionId, ...n.row, status, proposedWhy: status === 'PROPOSED' ? actor.why?.trim() || null : null, orderIndex: count } })
  const words = wordsOf(created)
  await revise(ideaId, a.number, created.id, '', words, actor.userId, status === 'PROPOSED' ? 'BENEFIT_LINE_PROPOSED' : actor.by === 'LEX' ? 'BENEFIT_LINE_DICTATED' : 'BENEFIT_LINE_ADDED')
  return { ok: true, data: { id: created.id, status, valuation: created.valuation, note: n.note, words } }
}

export async function setBenefitLine(ideaId: string, lineId: string, patch: Partial<BenefitInput>, actor: Actor): Promise<Result<{ id: string; valuation: string; note: string | null; words: string }>> {
  const row = await prisma.benefitLine.findFirst({ where: { id: lineId, action: { ideaId } }, include: { action: { select: { number: true, status: true } } } })
  if (!row) return { ok: false, error: 'Not saved: that benefit line is not on this idea.' }
  if (row.status === 'REMOVED') return { ok: false, error: 'Not saved: that line was removed. Restore it first.' }
  // a Lex change to an ACCEPTED line is a proposal BESIDE it — never written over the owner's line
  if (actor.by === 'LEX' && !actor.dictated && row.status === 'ACCEPTED') {
    const merged: BenefitInput = { ...(row as unknown as BenefitInput), ...patch, beneficiary: (patch.beneficiary ?? row.beneficiary) as BenefitInput['beneficiary'] }
    const r = await addBenefitLine(ideaId, row.actionId, merged, { ...actor, why: `${actor.why?.trim() ? `${actor.why.trim()} ` : ''}(Proposed in place of “${row.label}”.)` })
    if (!r.ok) return { ok: false, error: (r as { error: string }).error }
    const d = (r as { data: { id: string; valuation: string; words: string } }).data
    return { ok: true, data: { id: d.id, valuation: d.valuation, note: `Lex’s change is a proposal beside “${row.label}”, which is unchanged.`, words: d.words } }
  }
  const merged: BenefitInput = {
    label: patch.label ?? row.label, beneficiary: (patch.beneficiary ?? row.beneficiary) as BenefitInput['beneficiary'], beneficiaryName: patch.beneficiaryName !== undefined ? patch.beneficiaryName : row.beneficiaryName,
    measure: patch.measure !== undefined ? patch.measure : row.measure, low: patch.low !== undefined ? patch.low : row.low, high: patch.high !== undefined ? patch.high : row.high,
    priceYear: patch.priceYear !== undefined ? patch.priceYear : row.priceYear, recurrence: patch.recurrence !== undefined ? patch.recurrence : (row.recurrence as BenefitInput['recurrence']),
    durationMonths: patch.durationMonths !== undefined ? patch.durationMonths : row.durationMonths, isHealth: patch.isHealth ?? row.isHealth,
    sourceKind: patch.sourceKind !== undefined ? patch.sourceKind : (row.sourceKind as BenefitInput['sourceKind']), sourceRef: patch.sourceRef !== undefined ? patch.sourceRef : row.sourceRef,
    benchmarkId: patch.benchmarkId !== undefined ? patch.benchmarkId : row.benchmarkId, citationKey: patch.citationKey !== undefined ? patch.citationKey : row.citationKey,
    ownerReason: patch.ownerReason !== undefined ? patch.ownerReason : row.ownerReason, notValuedWhy: patch.notValuedWhy !== undefined ? patch.notValuedWhy : row.notValuedWhy,
  }
  const n0 = normaliseBenefit(merged)
  if (!n0.ok) return { ok: false, error: (n0 as { error: string }).error }
  const n = n0 as Extract<typeof n0, { row: unknown }>
  const refused = await sourceRefusal(ideaId, { ...merged, citationKey: n.row.citationKey })
  if (refused) return { ok: false, error: refused }
  if (n.row.citationKey) n.row.citationKey = (await checkCitationKey(n.row.citationKey) as { key: string }).key
  const before = wordsOf(row)
  const updated = await prisma.benefitLine.update({ where: { id: lineId }, data: { ...n.row } })
  const after = wordsOf(updated)
  if (after !== before) await revise(ideaId, row.action.number, lineId, before, after, actor.userId, actor.by === 'LEX' ? 'BENEFIT_LINE_DICTATED' : 'BENEFIT_LINE_EDITED')
  return { ok: true, data: { id: lineId, valuation: updated.valuation, note: n.note, words: after } }
}

/** accept / set aside a proposal; remove / restore a line. Nothing is deleted. */
export async function changeBenefitStatus(ideaId: string, lineId: string, op: 'accept' | 'set_aside' | 'remove' | 'restore', actor: Actor): Promise<Result<{ id: string; status: string }>> {
  const row = await prisma.benefitLine.findFirst({ where: { id: lineId, action: { ideaId } }, include: { action: { select: { number: true } } } })
  if (!row) return { ok: false, error: 'That benefit line is not on this idea.' }
  const to = op === 'accept' ? 'ACCEPTED' : op === 'set_aside' ? 'SET_ASIDE' : op === 'remove' ? 'REMOVED' : 'ACCEPTED'
  const allowed = op === 'accept' || op === 'set_aside' ? row.status === 'PROPOSED' : op === 'remove' ? row.status === 'ACCEPTED' : row.status === 'REMOVED' || row.status === 'SET_ASIDE'
  if (!allowed) return { ok: false, error: `Nothing changed: that line is ${row.status.toLowerCase().replace('_', ' ')}, so it cannot be ${op === 'set_aside' ? 'set aside' : `${op}d`}.` }
  if (to === 'ACCEPTED') {
    const count = await prisma.benefitLine.count({ where: { actionId: row.actionId, status: 'ACCEPTED' } })
    if (count >= LIMITS.benefitLinesPerAction) return { ok: false, error: `Nothing changed: #${row.action.number ?? '?'} already has ${count} benefit lines; the limit is ${LIMITS.benefitLinesPerAction}.` }
  }
  await prisma.benefitLine.update({ where: { id: lineId }, data: { status: to } })
  const w = wordsOf(row)
  await revise(ideaId, row.action.number, lineId, `${row.status}: ${w}`, `${to}: ${w}`, actor.userId, `BENEFIT_LINE_${op.toUpperCase()}`)
  return { ok: true, data: { id: lineId, status: to } }
}

/** Every benefit line on an idea (all statuses — the screen groups them), oldest first per action. */
export async function listBenefitLines(ideaId: string) {
  return prisma.benefitLine.findMany({ where: { action: { ideaId } }, orderBy: [{ actionId: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }] })
}
