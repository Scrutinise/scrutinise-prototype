// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X X3 §6a (decisions 311, 314, 317) — THE DEEPENING PAGE'S OWN SECTIONS, server half. Read-only: nothing here spends or writes.
//
//   1 Collision  — the consequential schedule and every draft's collision report, with counts by part (the clause's own rows; "What depends on
//                  this"; "Provisions that refer to this — for review", 267/269), each with its staleness; and the actions that need a report
//                  and have none yet.
//   3 Reviews    — every ACCEPTED draft (accepted at its current version: that is the version the passes read), how many of the five passes
//                  have read it, and the summed MEASURED price of the passes still to run (reviewPlan's own price, per document).
//   5 Costs      — the cost lines rolled up by heading and by year (cost-years-pure.ts), uprated by the same deflator series as the cost summary.
//
// The four-model digest (2) and the gap check (4) keep their own routes; this file does not restate them.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { documentTree } from './action-documents'
import { KIND_WORD, rowOf, type DocumentKind, type EffectRow } from './action-documents-pure'
import { draftKindsOf } from './action-progress-pure'
import { reviewPlan } from './document-review'
import { PASSES } from './deepening-config'
import { costTable, type CostTable } from './cost-years-pure'
import { uprater } from './field-machine'

export interface CollisionDoc {
  documentId: string; d: string; kind: 'COLLISION_REPORT' | 'CONSEQUENTIAL_SCHEDULE'; actionNumber: number | null; actionTitle: string
  v: number | null; at: string | null; stale: string | null
  /** COLLISION_REPORT: rows per part. CONSEQUENTIAL_SCHEDULE: `clause` = the amendments listed. */
  counts: { clause: number; depends: number; refers: number }
}
export interface CollisionSection { schedule: CollisionDoc[]; reports: CollisionDoc[]; missing: Array<{ number: number | null; title: string }>; totals: { depends: number; refers: number } }

export interface ReviewDraft { documentId: string; d: string; kind: string; actionNumber: number | null; v: number; passesRead: number; toRun: number; pence: number | null; unmeasured: boolean }
export interface ReviewSection {
  drafts: ReviewDraft[]
  /** Accepted at an earlier version and edited since: the passes read the CURRENT version, which is not accepted - listed, not run. */
  movedOn: Array<{ d: string; actionNumber: number | null; acceptedV: number; v: number }>
  passes: number
  /** The summed price of every pass still to run; null when any is unmeasured (then the button says so). */
  pence: number | null
  toRun: number
}

export interface CostSection {
  table: CostTable
  headings: Record<string, string>
  /** The year the figures are uprated to, and how many lines carry no price year (summed as entered). */
  pricesOf: number | null
  noPriceYear: number
  /** Actions answered "no cost, because…" - counted as answered, not as missing. */
  noCostActions: number
  /** Actions with neither a cost line nor a "no cost" answer. */
  uncosted: number
}

export interface DeepeningOverview { collision: CollisionSection; reviews: ReviewSection; costs: CostSection }

const label = (a: { title: string | null; statement: string }) => a.title?.trim() || (a.statement.length > 90 ? `${a.statement.slice(0, 89)}…` : a.statement)

export async function deepeningOverview(ideaId: string): Promise<DeepeningOverview> {
  const tree = await documentTree(ideaId)
  const rows = tree.headings.flatMap((h) => h.actions)
  const [collision, reviews, costs] = await Promise.all([collisionSection(ideaId, rows), reviewSection(ideaId, rows), costSection(ideaId)])
  return { collision, reviews, costs }
}

type TreeRow = Awaited<ReturnType<typeof documentTree>>['headings'][number]['actions'][number]

async function collisionSection(ideaId: string, rows: TreeRow[]): Promise<CollisionSection> {
  const docs = rows.flatMap((a) => a.documents.filter((d) => d.status !== 'SUPERSEDED' && (d.kind === 'COLLISION_REPORT' || d.kind === 'CONSEQUENTIAL_SCHEDULE')).map((d) => ({ a, d })))
  const latest = await prisma.actionDocumentVersion.findMany({
    where: { documentId: { in: docs.map((x) => x.d.id) }, role: 'VERSION' }, orderBy: { v: 'desc' }, select: { documentId: true, v: true, payload: true },
  })
  const payloadOf = (id: string) => latest.find((x) => x.documentId === id)?.payload as { rows?: unknown[] } | undefined
  const out: CollisionDoc[] = docs.map(({ a, d }) => {
    const prow = Array.isArray(payloadOf(d.id)?.rows) ? (payloadOf(d.id)!.rows as EffectRow[]) : []
    const counts = d.kind === 'CONSEQUENTIAL_SCHEDULE'
      ? { clause: prow.length, depends: 0, refers: 0 }
      : { clause: prow.filter((r) => rowOf(r) === 'clause').length, depends: prow.filter((r) => rowOf(r) === 'depends').length, refers: prow.filter((r) => rowOf(r) === 'refers').length }
    return { documentId: d.id, d: d.d, kind: d.kind as CollisionDoc['kind'], actionNumber: a.number, actionTitle: label(a), v: d.current?.v ?? null, at: d.current?.at ?? null, stale: d.stale, counts }
  })
  const reports = out.filter((x) => x.kind === 'COLLISION_REPORT')
  return {
    schedule: out.filter((x) => x.kind === 'CONSEQUENTIAL_SCHEDULE'),
    reports,
    missing: rows.filter((a) => a.missing.includes('COLLISION_REPORT')).map((a) => ({ number: a.number, title: label(a) })),
    totals: { depends: reports.reduce((n, r) => n + r.counts.depends, 0), refers: reports.reduce((n, r) => n + r.counts.refers, 0) },
  }
}

async function reviewSection(ideaId: string, rows: TreeRow[]): Promise<ReviewSection> {
  const drafts: ReviewDraft[] = []
  const movedOn: ReviewSection['movedOn'] = []
  for (const a of rows) {
    const instrument = draftKindsOf([...new Set(a.documents.filter((d) => d.status !== 'SUPERSEDED' && d.acceptedV != null).map((d) => d.kind as DocumentKind))])
    const doc = a.documents.find((d) => d.status !== 'SUPERSEDED' && d.acceptedV != null && instrument.includes(d.kind as DocumentKind))
    if (!doc || !doc.current) continue
    if (doc.status !== 'ACCEPTED') { movedOn.push({ d: doc.d, actionNumber: a.number, acceptedV: doc.acceptedV!, v: doc.current.v }); continue }
    const plan = await reviewPlan(ideaId, doc.id)
    if (!plan.ok) continue
    const p = plan.data
    drafts.push({
      documentId: doc.id, d: doc.d, kind: KIND_WORD[doc.kind as DocumentKind] ?? doc.kind, actionNumber: a.number, v: doc.current.v,
      passesRead: p.passes.filter((x) => x.readThisVersion).length, toRun: p.price.forPasses.length, pence: p.price.pence, unmeasured: p.price.forPasses.length > 0 && p.price.pence == null,
    })
  }
  const toRun = drafts.reduce((n, d) => n + d.toRun, 0)
  const pence = drafts.some((d) => d.unmeasured) ? null : Math.round(drafts.reduce((n, d) => n + (d.toRun ? d.pence ?? 0 : 0), 0) * 10) / 10
  return { drafts, movedOn, passes: PASSES.length, pence, toRun }
}

async function costSection(ideaId: string): Promise<CostSection> {
  const [actions, headings, deflator] = await Promise.all([
    prisma.lexCoherentAction.findMany({ where: { ideaId }, select: { id: true, status: true, headingId: true, foldedIntoId: true, noCostReason: true } }),
    prisma.actionHeading.findMany({ where: { ideaId }, orderBy: { orderIndex: 'asc' }, select: { id: true, name: true } }),
    prisma.deflatorSeries.findMany({ select: { year: true, index: true } }),
  ])
  const byId = new Map(actions.map((a) => [a.id, a]))
  // as computeCostSummary (198): a line on a LIVE action, or on a component FOLDED into one (it counts under the mechanism's heading)
  const counted = actions.filter((a) => a.status === 'LIVE' || a.foldedIntoId)
  const lines = await prisma.costLine.findMany({
    where: { actionId: { in: counted.map((a) => a.id) } },
    select: { id: true, actionId: true, low: true, high: true, priceYear: true, recurrence: true, durationMonths: true },
  })
  const { uprate, targetYear } = uprater(deflator)
  const headingOf = (actionId: string): string | null => {
    const a = byId.get(actionId)
    const home = a?.foldedIntoId ? byId.get(a.foldedIntoId) ?? a : a
    return home?.headingId ?? null
  }
  const table = costTable(lines.map((l) => ({
    id: l.id, headingId: headingOf(l.actionId),
    low: l.low == null ? null : uprate(l.low, l.priceYear), high: l.high == null ? null : uprate(l.high, l.priceYear),
    recurrence: l.recurrence === 'ONE_OFF' || l.recurrence === 'PER_YEAR' ? l.recurrence : null, durationMonths: l.durationMonths,
  })), headings.map((h) => h.id))
  const live = actions.filter((a) => a.status === 'LIVE')
  const withLines = new Set(lines.map((l) => l.actionId))
  return {
    table, headings: Object.fromEntries(headings.map((h) => [h.id, h.name])),
    pricesOf: targetYear, noPriceYear: lines.filter((l) => (l.low != null || l.high != null) && l.priceYear == null).length,
    noCostActions: live.filter((a) => a.noCostReason?.trim()).length,
    uncosted: live.filter((a) => !withLines.has(a.id) && !a.noCostReason?.trim()).length,
  }
}

