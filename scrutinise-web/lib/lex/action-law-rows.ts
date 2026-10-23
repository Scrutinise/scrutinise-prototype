// ─────────────────────────────────────────────────────────────────────────────
// 26-U §5 (decisions 223, 226) — A DRAFTING INSTRUCTION WRITES ITS JOIN ROWS. Each provision line of an action's CURRENT version becomes
// one `idea_law_link` row (source 'drafting_instruction', action_id set, relation as given); each precedent becomes a 'precedent' row.
//
// ⚠ ONLY AN OWNER'S VERSION WRITES ROWS. A proposal from Lex is not the instruction until it is accepted, so it never reaches the panel.
// ⚠ EVERY TARGET GOES THROUGH GRAPH 7's resolveLawTarget() FIRST (its constraint a). A target that is not held is NOT written — it is
//   returned, with its state, so the caller can say so. "What this touches" already shows those states beside the clause.
// ⚠ NEVER DELETED. A row of the previous version whose target and relation reappear is superseded by the new row. A row whose target is
//   GONE from the new version is WITHDRAWN (GRAPH's withdrawn_at + withdrawn_detail, together — GRAPH confirmed its reader live on Main,
//   23 Oct). Only a live row is ever withdrawn (the CHECK refuses a superseded one), and a target that comes back later gets a NEW row;
//   the withdrawn one is never un-withdrawn.
// ⚠ A hand row (GRAPH 7's attach script) is never touched or duplicated by this: it carries action_id NULL and source 'hand'.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { resolveLawTarget } from '@/lib/lex/statutory-graph'
import { targetKindOf, type LawRelation, type LawResolutionState } from '@/lib/lex/idea-law-pure'
import type { DraftVersion } from './action-draft-pure'

export interface LawRowsReport {
  version: number
  written: number
  superseded: number
  /** Already live for this action and version (re-run): not written twice. */
  unchanged: number
  /** Named in the instruction but not held: not written. */
  notHeld: Array<{ docUri: string; provisionPath: string | null; relation: LawRelation; state: LawResolutionState }>
  /** Rows of an earlier version whose target is gone from this one: withdrawn, with the reason. */
  withdrawn: number
}

const keyOf = (relation: string, docUri: string, provisionPath: string | null) => `${relation}|${docUri}|${provisionPath ?? ''}`

/** The lines a version writes: its provisions, then its precedents as `precedent`. Duplicates within the version are written once. */
export function linesOf(v: Pick<DraftVersion, 'provisions' | 'precedents'>): Array<{ relation: LawRelation; docUri: string; provisionPath: string | null }> {
  const all = [
    ...v.provisions.map((p) => ({ relation: p.relation as LawRelation, docUri: p.docUri, provisionPath: p.provisionPath })),
    ...v.precedents.map((p) => ({ relation: 'precedent' as LawRelation, docUri: p.docUri, provisionPath: p.provisionPath })),
  ]
  const seen = new Set<string>()
  return all.filter((l) => { const k = keyOf(l.relation, l.docUri, l.provisionPath); if (seen.has(k)) return false; seen.add(k); return true })
}

/** `as_at`: the effects data's load date where the reader gave one, else the day the version was saved. */
export async function writeInstructionRows(
  ideaId: string, actionId: string, v: DraftVersion, opts: { asAt?: string } = {},
): Promise<LawRowsReport> {
  const asAt = opts.asAt ?? v.at.slice(0, 10)
  const detail = `${actionId} v${v.v}`
  const live = await prisma.ideaLawLink.findMany({
    // Live = neither superseded nor withdrawn (GRAPH 09e8939). A withdrawn row is never superseded — its CHECK refuses it.
    where: { actionId, source: 'drafting_instruction', supersededById: null, withdrawnAt: null },
    select: { id: true, relation: true, docUri: true, provisionPath: true, sourceDetail: true },
  })
  const report: LawRowsReport = { version: v.v, written: 0, superseded: 0, unchanged: 0, notHeld: [], withdrawn: 0 }
  const lines = linesOf(v)
  const wanted = new Set(lines.map((l) => keyOf(l.relation, l.docUri, l.provisionPath)))
  // A vanished target is WITHDRAWN, never left live and never deleted. `live` holds only rows neither superseded nor withdrawn, so the
  // CHECK (no withdrawing a superseded row) cannot be met here.
  const gone = live.filter((r) => r.sourceDetail !== detail && !wanted.has(keyOf(r.relation, r.docUri, r.provisionPath)))
  if (gone.length) {
    const at = new Date()
    await prisma.$transaction(gone.map((r) => prisma.ideaLawLink.update({
      where: { id: r.id }, data: { withdrawnAt: at, withdrawnDetail: `${actionId} instruction v${v.v}: target absent` },
    })))
    report.withdrawn = gone.length
  }

  for (const l of lines) {
    const k = keyOf(l.relation, l.docUri, l.provisionPath)
    if (live.some((r) => r.sourceDetail === detail && keyOf(r.relation, r.docUri, r.provisionPath) === k)) { report.unchanged++; continue }
    const targetKind = targetKindOf(l.docUri, l.provisionPath)
    const res = await resolveLawTarget(targetKind, l.docUri, l.provisionPath)
    if (res.state !== 'held') { report.notHeld.push({ ...l, state: res.state }); continue }
    const older = live.filter((r) => r.sourceDetail !== detail && keyOf(r.relation, r.docUri, r.provisionPath) === k)
    await prisma.$transaction(async (tx) => {
      const row = await tx.ideaLawLink.create({
        data: {
          ideaId, actionId, targetKind, docUri: l.docUri, provisionPath: l.provisionPath, relation: l.relation,
          source: 'drafting_instruction', sourceDetail: detail, note: v.purpose.trim() || null, asAt: new Date(`${asAt}T00:00:00Z`),
        },
      })
      for (const o of older) await tx.ideaLawLink.update({ where: { id: o.id }, data: { supersededById: row.id } })
    })
    report.written++
    report.superseded += older.length
  }
  return report
}
