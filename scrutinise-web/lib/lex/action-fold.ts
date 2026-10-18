// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 decision 190 - UNFOLD: the way back from Consolidate. Its own module because both action-structure (Restore) and action-resort need it.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { removeFoldLine } from './action-resort-pure'

/**
 * Unfold components: the component is LIVE again, its bullet leaves the mechanism's commentary, and the causes / conditions the fold added to
 * the mechanism are taken back unless another still-folded component of the same mechanism brought them too.
 */
export async function unfold(ideaId: string, ids: string[]): Promise<number> {
  const comps = await prisma.lexCoherentAction.findMany({ where: { ideaId, id: { in: ids }, foldedIntoId: { not: null } }, select: { id: true, number: true, foldedIntoId: true, foldedAdded: true } })
  let n = 0
  for (const c of comps) {
    const lead = await prisma.lexCoherentAction.findUnique({ where: { id: c.foldedIntoId! }, select: { id: true, commentary: true, targetCauseIds: true, conditionIds: true } })
    const added = (c.foldedAdded ?? {}) as { targetCauseIds?: string[]; conditionIds?: string[] }
    if (lead) {
      const others = await prisma.lexCoherentAction.findMany({ where: { ideaId, foldedIntoId: lead.id, id: { not: c.id } }, select: { foldedAdded: true } })
      const stillBrought = (key: 'targetCauseIds' | 'conditionIds') => new Set(others.flatMap((o) => ((o.foldedAdded ?? {}) as Record<string, string[]>)[key] ?? []))
      const sc = stillBrought('targetCauseIds'), sd = stillBrought('conditionIds')
      await prisma.lexCoherentAction.update({
        where: { id: lead.id },
        data: {
          commentary: removeFoldLine(lead.commentary, c.number!),
          targetCauseIds: lead.targetCauseIds.filter((x) => !(added.targetCauseIds ?? []).includes(x) || sc.has(x)),
          conditionIds: lead.conditionIds.filter((x) => !(added.conditionIds ?? []).includes(x) || sd.has(x)),
        },
      })
    }
    await prisma.lexCoherentAction.update({ where: { id: c.id }, data: { status: 'LIVE', foldedIntoId: null, foldedAdded: Prisma.DbNull, ruleOutReason: null } })
    n++
  }
  return n
}
