// LEX 26-Y §7 — the sums already in an idea's record, for the honesty rule ("a number in a Lex reply about costs must match a line, a table
// row or a report figure"): every cost line's and benefit line's low/high, the legacy per-action ranges, and the latest report's figures.
import { prisma } from '@/lib/prisma'
import { sumsIn } from '../agent/honesty'

export async function recordFigures(ideaId: string): Promise<Set<number>> {
  const [costs, benefits, actions, report] = await Promise.all([
    prisma.costLine.findMany({ where: { action: { ideaId } }, select: { low: true, high: true } }),
    prisma.benefitLine.findMany({ where: { action: { ideaId } }, select: { low: true, high: true } }),
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { implementationCost: true, enforcementCost: true, regulatoryFriction: true } }),
    prisma.cbaReport.findFirst({ where: { ideaId }, orderBy: { version: 'desc' }, select: { result: true } }),
  ])
  const out = new Set<number>()
  const add = (n: unknown) => { if (typeof n === 'number' && Number.isFinite(n)) out.add(Math.round(n)) }
  for (const l of [...costs, ...benefits]) { add(l.low); add(l.high) }
  for (const a of actions) for (const r of [a.implementationCost, a.enforcementCost, a.regulatoryFriction]) { const x = r as { low?: unknown; high?: unknown } | null; add(x?.low); add(x?.high) }
  const trace = (report?.result as { engine?: { trace?: Record<string, { value: string }> } } | null)?.engine?.trace ?? {}
  for (const t of Object.values(trace)) for (const s of sumsIn(t.value)) out.add(s.pounds)
  return out
}
