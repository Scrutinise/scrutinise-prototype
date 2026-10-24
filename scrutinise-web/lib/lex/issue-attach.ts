// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2c (BRIEF_26V §7) — the server half of re-attaching the open issues. See issue-attach-pure.ts.
//
//   attachContext       — the live actions (with heading and its kind), the documents with their parts, and the open issues not yet placed.
//   composeAttachments  — the model calls, in batches, and the checks; writes NOTHING (the measurement on a scratch copy calls this alone).
//   applyAttachments    — writes each placement onto its issue (attachedBy LEX, with the reason). Never touches an issue the owner placed, and
//                         never re-words, re-states or deletes one. PROPOSAL placements write nothing: the issue stays as it was.
//   attachmentCounts    — the before / after line.
//   undoLexAttachments  — takes every placement Lex made on this idea back off (the owner's stay).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { DRAFT_MODEL } from './action-draft'
import { partsOf, type DocumentKind } from './action-documents-pure'
import {
  ATTACH_BATCH, ATTACH_SCHEMA, ATTACH_SYSTEM, NO_FALLS, attachIndex, attachUser, checkPlacements,
  type AttachAction, type AttachAnswer, type AttachDocument, type AttachFalls, type AttachIssue, type Placement,
} from './issue-attach-pure'
import type { Result } from './action-structure'

export * from './issue-attach-pure'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
type Call = typeof callModelJson
const PASS = 'issues.reattach'

export interface AttachContext { actions: AttachAction[]; docs: AttachDocument[]; issues: AttachIssue[] }

export async function attachContext(ideaId: string): Promise<AttachContext> {
  const [acts, heads, docs, issues] = await Promise.all([
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE', number: { not: null } }, select: { id: true, number: true, title: true, practicalStep: true, headingId: true }, orderBy: { number: 'asc' } }),
    prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true, kind: true } }),
    prisma.actionDocument.findMany({ where: { ideaId, status: { not: 'SUPERSEDED' } }, include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' }, take: 1 } }, orderBy: [{ number: 'asc' }] }),
    prisma.deepeningIssue.findMany({ where: { ideaId, status: 'OPEN', attachedBy: null }, select: { id: true, title: true, text: true, passKey: true }, orderBy: { createdAt: 'asc' } }),
  ])
  const head = new Map(heads.map((h) => [h.id, h]))
  const actions: AttachAction[] = acts.map((a) => ({ id: a.id, number: a.number!, title: a.title?.trim() || a.practicalStep, heading: a.headingId ? head.get(a.headingId)?.name ?? null : null, headingKind: a.headingId ? head.get(a.headingId)?.kind ?? null : null }))
  const num = new Map(actions.map((a) => [a.id, a.number]))
  return {
    actions,
    docs: docs.filter((d) => num.has(d.actionId)).map((d) => ({
      id: d.id, actionId: d.actionId, action: num.get(d.actionId)!, number: d.number, kind: d.kind, title: d.title,
      parts: d.versions[0] ? partsOf(d.kind as DocumentKind, d.versions[0].body).map((p) => ({ n: p.n, title: p.title })) : [],
    })),
    issues: issues.map((i, k) => ({ key: `i${k + 1}`, id: i.id, title: i.title, text: i.text, passKey: i.passKey })),
  }
}

export interface AttachRun { placements: Placement[]; falls: AttachFalls; pence: number | null; calls: number; failedBatches: number; seconds: number }

/** The model calls and the checks, in batches; writes nothing. A failed batch leaves its issues where they were, and is counted. */
export async function composeAttachments(ctx: AttachContext, opts: { spendIdeaId: string; userId: string | null; call?: Call; limit?: number }): Promise<Result<AttachRun>> {
  const started = Date.now()
  const issues = opts.limit ? ctx.issues.slice(0, opts.limit) : ctx.issues
  if (!issues.length) return fail('There are no open issues waiting to be placed. Nothing was asked.')
  if (!ctx.actions.length) return fail('There are no numbered live actions to place issues on. Nothing was asked.')
  const index = attachIndex(ctx.actions, ctx.docs)
  const call = opts.call ?? callModelJson
  const placements: Placement[] = []
  const falls = { ...NO_FALLS }
  let pence: number | null = 0, calls = 0, failedBatches = 0
  for (let at = 0; at < issues.length; at += ATTACH_BATCH) {
    const batch = issues.slice(at, at + ATTACH_BATCH)
    const res = await call<AttachAnswer>({
      model: DRAFT_MODEL, system: ATTACH_SYSTEM, user: attachUser(index, batch), schema: ATTACH_SCHEMA as never, maxOutputTokens: 8_000, timeoutMs: 180_000,
      reasoningEffort: 'low', label: 'issue-attach', stream: 'lex', pass: PASS, ideaId: opts.spendIdeaId, userId: opts.userId,
    })
    calls++
    const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: PASS, ideaId: opts.spendIdeaId, userId: opts.userId, failed: !res.ok }))
    pence = pence == null || priced.pence == null ? null : pence + priced.pence
    if (!res.ok) { failedBatches++; continue } // those issues stay exactly where they were
    const c = checkPlacements(batch, res.value, ctx.actions, ctx.docs)
    placements.push(...c.placements)
    for (const k of Object.keys(falls) as Array<keyof AttachFalls>) falls[k] += c.falls[k]
  }
  return { ok: true, data: { placements, falls, pence, calls, failedBatches, seconds: Math.round((Date.now() - started) / 100) / 10 } }
}

/** Writes the placements. Only onto issues still unplaced (attachedBy null) — the owner's placements are never overwritten. */
export async function applyAttachments(ideaId: string, placements: Placement[]): Promise<{ onDocument: number; onAction: number; stayed: number; skipped: number }> {
  const now = new Date()
  let onDocument = 0, onAction = 0, stayed = 0, skipped = 0
  for (const p of placements) {
    if (p.place === 'PROPOSAL') { stayed++; continue }
    const data = p.place === 'DOCUMENT'
      ? { actionId: p.actionId, documentId: p.documentId, partN: p.partN, attachedBy: 'LEX', attachReason: p.reason || null, attachedAt: now }
      : { actionId: p.actionId, documentId: null, partN: null, attachedBy: 'LEX', attachReason: p.reason || null, attachedAt: now }
    const r = await prisma.deepeningIssue.updateMany({ where: { id: p.issueId, ideaId, attachedBy: null }, data })
    if (!r.count) { skipped++; continue }
    if (p.place === 'DOCUMENT') onDocument++; else onAction++
  }
  return { onDocument, onAction, stayed, skipped }
}

export async function attachmentCounts(ideaId: string): Promise<{ open: number; onDocument: number; onAction: number; onProposal: number }> {
  const g = await prisma.deepeningIssue.groupBy({ by: ['actionId', 'documentId'], where: { ideaId, status: 'OPEN' }, _count: true })
  const sum = (f: (x: (typeof g)[number]) => boolean) => g.filter(f).reduce((a, x) => a + x._count, 0)
  return { open: sum(() => true), onDocument: sum((x) => !!x.documentId), onAction: sum((x) => !!x.actionId && !x.documentId), onProposal: sum((x) => !x.actionId) }
}

export async function undoLexAttachments(ideaId: string): Promise<number> {
  // 26-V2d: an issue a document review raised (reviewId set) sits where it was raised — that is not a placement, so Undo leaves it.
  const r = await prisma.deepeningIssue.updateMany({ where: { ideaId, attachedBy: 'LEX', reviewId: null }, data: { actionId: null, documentId: null, partN: null, attachedBy: null, attachReason: null, attachedAt: null } })
  return r.count
}

/** Compose and apply, on one idea, with the before / after counts. */
export async function reattachIssues(ideaId: string, userId: string | null, opts: { call?: Call } = {}): Promise<Result<AttachRun & { before: Awaited<ReturnType<typeof attachmentCounts>>; after: Awaited<ReturnType<typeof attachmentCounts>>; applied: Awaited<ReturnType<typeof applyAttachments>> }>> {
  const before = await attachmentCounts(ideaId)
  const r = await composeAttachments(await attachContext(ideaId), { spendIdeaId: ideaId, userId, call: opts.call })
  if (!r.ok) return fail((r as { error: string }).error)
  const applied = await applyAttachments(ideaId, r.data.placements)
  return { ok: true, data: { ...r.data, before, after: await attachmentCounts(ideaId), applied } }
}

/** The issues on one document (by part) or on one action, for the document's Issues tab and the action's record. */
export async function issuesOn(ideaId: string, where: { documentId: string } | { actionId: string; documentId: null }) {
  return prisma.deepeningIssue.findMany({
    where: { ideaId, status: 'OPEN', ...where },
    select: { id: true, title: true, text: true, passKey: true, partN: true, attachedBy: true, attachReason: true, sourceModel: true, reviewId: true },
    orderBy: [{ partN: 'asc' }, { createdAt: 'asc' }],
  })
}
