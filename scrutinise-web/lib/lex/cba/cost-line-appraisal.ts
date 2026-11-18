// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §3.1 / 337 / 339 / 340 — what a COST LINE carries beyond its figure, the writer. One path for the form and for Lex.
//
//   payer       who pays (§3.1). Anyone may set it; it is a fact about the line, not an assumption.
//   citationKey 337 — a manifest key or refused, with the nearest held keys.
//   onCost      340 — a STAFF line's employer on-cost uplift. The owner's is ACCEPTED. Lex's is a PROPOSAL and must name a source it holds
//               ([Ref: n], a held unit-cost row, or a manifest key) — without one it is refused, in words.
//   ob          339 — a CAPITAL line's Table 1 project type; lowering the rate needs the owner and a reason. Lex may NAME the type
//               (it is a reading of the line), never lower the rate.
// Every change is a FieldRevision (fieldKey "costLineAppraisal").
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { LIMITS } from '../input-limits'
import { parseLineAppraisal, PARTY_KINDS, OB_TYPES, partyWords, pct, OB_TYPE_WORD, type LineAppraisal, type PartyKind, type ObType } from './line-appraisal'
import { checkCitationKey } from './citation-manifest'
import { OPTIMISM_BIAS_TABLE_1 } from '../costing-params'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }
export interface AppraisalPatch {
  payer?: { kind: PartyKind; name?: string | null } | null
  citationKey?: string | null
  onCost?: { rate: number; source: string } | null
  /** accept / decline Lex's proposed on-cost (owner only) */
  onCostAnswer?: 'accept' | 'decline'
  obType?: ObType | null
  obLowered?: { rate: number; reason: string } | null
}

function words(a: LineAppraisal, citationKey: string | null): string {
  return [
    `pays: ${partyWords(a.payer)}`,
    a.onCost ? `on-cost ${pct(a.onCost.rate)} (${a.onCost.status === 'PROPOSED' ? 'proposed by Lex' : a.onCost.by === 'LEX' ? 'Lex’s, accepted' : 'the owner’s'}; ${a.onCost.source})` : 'no on-cost',
    a.ob ? `optimism bias: ${OB_TYPE_WORD[a.ob.type]}${a.ob.lowered ? `, lowered to ${pct(a.ob.lowered.rate)} (${a.ob.lowered.reason})` : ''}` : 'no project type',
    `citation: ${citationKey ?? 'none'}`,
  ].join('; ')
}

async function sourceHeld(ideaId: string, source: string): Promise<boolean> {
  const ref = /\[Ref:\s*(\d+)\]/i.exec(source)
  if (ref && (await prisma.ideaSource.count({ where: { ideaId, number: Number(ref[1]) } })) > 0) return true
  const key = /\b([a-z-]+:(?:\d+\.\d+|table-\d+))\b/.exec(source)
  if (key && (await checkCitationKey(key[1])).ok) return true
  const bench = /benchmark:([\w-]+)/.exec(source)
  if (bench && (await prisma.costBenchmark.findUnique({ where: { id: bench[1] }, select: { id: true } }))) return true
  return false
}

export async function setCostLineAppraisal(ideaId: string, lineId: string, patch: AppraisalPatch, actor: { userId: string; by: 'OWNER' | 'LEX' }): Promise<Result<{ words: string; appraisal: LineAppraisal; citationKey: string | null }>> {
  const row = await prisma.costLine.findFirst({ where: { id: lineId, action: { ideaId } }, include: { action: { select: { number: true } } } })
  if (!row) return { ok: false, error: 'Not saved: that cost line is not on this idea.' }
  const cur = parseLineAppraisal(row.appraisal)
  const next: LineAppraisal = { payer: cur.payer, onCost: cur.onCost, ob: cur.ob }
  let citationKey = row.citationKey
  if (patch.payer !== undefined) {
    if (patch.payer && !(PARTY_KINDS as readonly string[]).includes(patch.payer.kind)) return { ok: false, error: `Not saved: who pays must be one of ${PARTY_KINDS.join(', ').toLowerCase()}.` }
    if (patch.payer?.name && patch.payer.name.trim().length > LIMITS.beneficiaryName) return { ok: false, error: `Not saved: the payer’s name is ${patch.payer.name.trim().length} characters; the limit is ${LIMITS.beneficiaryName}.` }
    next.payer = patch.payer ? { kind: patch.payer.kind, name: patch.payer.name?.trim() || null } : null
  }
  if (patch.citationKey !== undefined) {
    if (patch.citationKey && patch.citationKey.trim()) {
      const c = await checkCitationKey(patch.citationKey)
      if (!c.ok) return { ok: false, error: `Not saved: ${(c as { error: string }).error}` }
      citationKey = c.key
    } else citationKey = null
  }
  if (patch.onCost !== undefined) {
    if (row.costType !== 'STAFF') return { ok: false, error: 'Not saved: an employer on-cost applies to a staffing line only.' }
    if (patch.onCost) {
      const { rate, source } = patch.onCost
      if (!(rate >= 0 && rate <= 1)) return { ok: false, error: 'Not saved: an on-cost uplift is a rate from 0% to 100%.' }
      if (!source?.trim() || source.trim().length < 3) return { ok: false, error: 'Not saved: an on-cost uplift needs its source — where the rate comes from.' }
      if (source.trim().length > LIMITS.appraisalSource) return { ok: false, error: `Not saved: the source is ${source.trim().length} characters; the limit is ${LIMITS.appraisalSource}.` }
      if (actor.by === 'LEX' && !(await sourceHeld(ideaId, source))) return { ok: false, error: 'Not saved: Lex may propose an on-cost only with a source it holds — a [Ref: n] on this idea, a held unit-cost row (benchmark:<id>), or a Green Book key such as green-book:6.58. Without one the line stays “excludes employer costs”.' }
      next.onCost = { rate, source: source.trim(), by: actor.by, status: actor.by === 'LEX' ? 'PROPOSED' : 'ACCEPTED' }
    } else next.onCost = null
  }
  if (patch.onCostAnswer) {
    if (actor.by !== 'OWNER') return { ok: false, error: 'Only the owner accepts or declines Lex’s proposed on-cost.' }
    if (!cur.onCost || cur.onCost.status !== 'PROPOSED') return { ok: false, error: 'Nothing changed: there is no proposed on-cost waiting on that line.' }
    next.onCost = patch.onCostAnswer === 'accept' ? { ...cur.onCost, status: 'ACCEPTED' } : null
  }
  if (patch.obType !== undefined) {
    if (row.costType !== 'CAPITAL') return { ok: false, error: 'Not saved: an optimism-bias project type applies to a capital line only. A non-capital line takes no uplift.' }
    if (patch.obType && !(OB_TYPES as readonly string[]).includes(patch.obType)) return { ok: false, error: `Not saved: the project type must be one of Table 1’s: ${OB_TYPES.map((t) => OB_TYPE_WORD[t]).join(', ')}.` }
    next.ob = patch.obType ? { type: patch.obType, lowered: cur.ob?.type === patch.obType ? cur.ob.lowered : null } : null
  }
  if (patch.obLowered !== undefined) {
    if (actor.by !== 'OWNER') return { ok: false, error: 'Only the owner may lower an optimism-bias rate, with a reason.' }
    if (!next.ob) return { ok: false, error: 'Not saved: choose the line’s Table 1 project type first.' }
    if (patch.obLowered) {
      const upper = OPTIMISM_BIAS_TABLE_1.value[next.ob.type].capex!.upper
      if (!(patch.obLowered.rate >= 0 && patch.obLowered.rate < upper)) return { ok: false, error: `Not saved: a lowered rate is from 0% to below the upper bound (${pct(upper)} for ${OB_TYPE_WORD[next.ob.type]}).` }
      const why = patch.obLowered.reason?.trim() ?? ''
      if (why.length < 10) return { ok: false, error: 'Not saved: say why the rate is lower — which risks are managed (at least 10 characters).' }
      if (why.length > LIMITS.obLowerReason) return { ok: false, error: `Not saved: the reason is ${why.length} characters; the limit is ${LIMITS.obLowerReason}.` }
      next.ob = { ...next.ob, lowered: { rate: patch.obLowered.rate, reason: why } }
    } else next.ob = { ...next.ob, lowered: null }
  }
  const before = words(cur, row.citationKey), after = words(next, citationKey)
  await prisma.costLine.update({ where: { id: lineId }, data: { appraisal: next as never, citationKey } })
  if (before !== after) {
    await prisma.fieldRevision.create({ data: { ideaId, fieldKey: 'costLineAppraisal', targetId: lineId, targetNumber: row.action.number, previousText: `${row.label}: ${before}`, previousSource: 'USER', newText: `${row.label}: ${after}`, acceptedById: actor.userId, origin: actor.by === 'LEX' ? 'COST_APPRAISAL_LEX' : 'COST_APPRAISAL_EDITED' } })
  }
  return { ok: true, data: { words: after, appraisal: next, citationKey } }
}
