// ─────────────────────────────────────────────────────────────────────────────
// ATTACHING LAW TO AN IDEA — the verified write path into `idea_law_link` (GRAPH 7 §3).
//
// ⚠⚠ EVERY TARGET IS RESOLVED AGAINST THE CORPUS BEFORE ANYTHING IS WRITTEN, AND A MISS FAILS THE WRITE
// (BRIEF_GRAPH_7 constraint a). The ids in a law list are proposed from knowledge, not read from the corpus; a
// wrong id joins to the wrong Act and nothing visible goes wrong.
//
// ⚠ ALL OR NOTHING. If any row is not held, no row is written: a half-attached list reads as a complete one.
// The report still gives every row's state, so the one bad id can be fixed and the file run again.
// ⚠ RE-RUNNABLE. A row already attached (same idea, no action, same target and relation, not superseded) is
// reported as such and not written twice.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { resolveLawTarget, type LawFetch } from '@/lib/lex/statutory-graph'
import {
  LAW_RELATIONS, targetKindOf, type LawRelation, type LawResolution, type LawTargetKind,
} from '@/lib/lex/idea-law-pure'

export interface HandRow {
  line: number
  relation: LawRelation
  docUri: string
  provisionPath: string | null
  note: string
}

/**
 * One row per line: `relation, doc_uri, provision_path, note`. The note is everything after the third comma, so
 * it may contain commas. An empty provision_path means the whole Act. `#` starts a comment line.
 */
export function parseHandFile(text: string): { rows: HandRow[]; errors: string[] } {
  const rows: HandRow[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    const s = raw.trim()
    if (!s || s.startsWith('#')) return
    const parts = s.split(',')
    if (parts.length < 4) { errors.push(`line ${line}: expected four fields (relation, doc_uri, provision_path, note), found ${parts.length}`); return }
    const [rel, uri, path] = parts.map((p) => p.trim())
    const note = parts.slice(3).join(',').trim()
    if (!(LAW_RELATIONS as readonly string[]).includes(rel)) { errors.push(`line ${line}: “${rel}” is not a relation (${LAW_RELATIONS.join(', ')})`); return }
    if (!uri) { errors.push(`line ${line}: doc_uri is empty`); return }
    if (/^https?:|^\//.test(uri)) { errors.push(`line ${line}: “${uri}” — store the id, with no host and no leading slash`); return }
    if (!note) { errors.push(`line ${line}: the note is empty — a hand row needs one line saying why it exists`); return }
    rows.push({ line, relation: rel as LawRelation, docUri: uri, provisionPath: path || null, note })
  })
  return { rows, errors }
}

export type AttachOutcome = 'would-insert' | 'inserted' | 'already-attached' | 'refused'

export interface AttachRowReport {
  row: HandRow
  targetKind: LawTargetKind
  resolution: LawResolution
  outcome: AttachOutcome
}

export interface AttachReport {
  ideaId: string
  ideaTitle: string
  asAt: string
  sourceDetail: string
  write: boolean
  rows: AttachRowReport[]
  /** True only when something was written. */
  wrote: number
  refusedReason: string | null
}

/**
 * Verify every row and, with `write`, insert them as `source='hand'` in one transaction.
 * `asAt` is the run date (UTC) unless given; `sourceDetail` is `"<by> <asAt>"`.
 */
export async function attachHandRows(
  ideaIdOrPrefix: string,
  rows: HandRow[],
  opts: { write: boolean; by: string; asAt?: string; external?: boolean; fetch?: LawFetch },
): Promise<AttachReport> {
  const ideas = await prisma.idea.findMany({
    where: { id: { startsWith: ideaIdOrPrefix }, deletedAt: null }, select: { id: true, title: true }, take: 2,
  })
  if (ideas.length !== 1) throw new Error(ideas.length ? `“${ideaIdOrPrefix}” matches more than one idea — give more of the id` : `no live idea has an id starting “${ideaIdOrPrefix}”`)
  const idea = ideas[0]
  const asAt = opts.asAt ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asAt)) throw new Error(`as_at “${asAt}” is not a date (YYYY-MM-DD)`)
  const sourceDetail = `${opts.by} ${asAt}`

  const live = await prisma.ideaLawLink.findMany({
    where: { ideaId: idea.id, actionId: null, supersededById: null, withdrawnAt: null },
    select: { docUri: true, provisionPath: true, relation: true },
  })
  const has = new Set(live.map((l) => `${l.relation}|${l.docUri}|${l.provisionPath ?? ''}`))

  const reports: AttachRowReport[] = []
  for (const row of rows) {
    const targetKind = targetKindOf(row.docUri, row.provisionPath)
    const resolution = await resolveLawTarget(targetKind, row.docUri, row.provisionPath, { external: opts.external, fetch: opts.fetch })
    const dup = has.has(`${row.relation}|${row.docUri}|${row.provisionPath ?? ''}`)
    const outcome: AttachOutcome = resolution.state !== 'held' ? 'refused' : dup ? 'already-attached' : 'would-insert'
    reports.push({ row, targetKind, resolution, outcome })
  }

  const refused = reports.filter((r) => r.outcome === 'refused')
  const toWrite = reports.filter((r) => r.outcome === 'would-insert')
  const report: AttachReport = {
    ideaId: idea.id, ideaTitle: idea.title, asAt, sourceDetail, write: opts.write, rows: reports, wrote: 0,
    refusedReason: refused.length
      ? `${refused.length} of ${reports.length} rows are not held, so nothing is written (all or nothing): lines ${refused.map((r) => r.row.line).join(', ')}`
      : null,
  }
  if (!opts.write || refused.length || !toWrite.length) return report

  await prisma.$transaction(toWrite.map((r) => prisma.ideaLawLink.create({
    data: {
      ideaId: idea.id, actionId: null, targetKind: r.targetKind, docUri: r.row.docUri, provisionPath: r.row.provisionPath,
      relation: r.row.relation, source: 'hand', sourceDetail, note: r.row.note, asAt: new Date(`${asAt}T00:00:00Z`),
    },
  })))
  for (const r of toWrite) r.outcome = 'inserted'
  report.wrote = toWrite.length
  return report
}
