// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2d (BRIEF_26V §7) — the server half of the five review passes reading documents. See document-review-pure.ts.
//
//   reviewTarget   — one document's current version, its parts, its action (heading and kind), the guiding policy. A document with no
//                    version (only Lex's proposal waiting) is refused in words: a review reads a version, never a proposal.
//   composeReview  — one pass's model call over one document, and the checks; writes NOTHING (the measurement on a scratch copy calls this).
//   applyReview    — the document_review row and its issues, in one transaction. Each issue carries action, document, part and the review.
//   reviewDocument — the passes asked for, in parallel, each composed and applied on its own (a failed pass is recorded as FAILED, in words,
//                    and costs the others nothing). A pass that has already reviewed THIS version is not run again unless asked (`again`).
//   reviewsOf      — the latest review per pass of a document (the Issues tab, the tree, the ask before a review).
//   risksView      — every issue on the idea grouped by document, then by action, then the proposal as a whole (225, §7).
//
// ⚠ Nothing deletes: a review issue raised against an earlier version stays open, saying the version it read, until the owner answers it.
// ⚠ undoLexAttachments (issue-attach.ts) never touches a review issue: where it sits is where it was raised, not a placement.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { DRAFT_MODEL } from './action-draft'
import { PASSES, passDef, type PassKey } from './deepening-config'
import { GENERATED_KINDS, STATUS_WORD, KIND_WORD, dNumber, partNumber, partsOf, type DocumentKind, type DocumentStatus } from './action-documents-pure'
import {
  REVIEW_SCHEMA, checkReview, raisedByWords, reviewFallsWords, reviewPassKey, reviewPrice, reviewSystem, reviewUser, producerWords, passOfReviewKey,
  type CheckedIssue, type ReviewAnswer, type ReviewFalls, type ReviewTarget,
} from './document-review-pure'

export * from './document-review-pure'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }
type Call = typeof callModelJson
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const SPEND_PASS = 'documents.review'

export async function reviewTarget(ideaId: string, documentId: string): Promise<Result<ReviewTarget>> {
  const doc = await prisma.actionDocument.findFirst({
    where: { id: documentId, ideaId },
    include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' }, take: 1 } },
  })
  if (!doc) return fail('That document is not on this idea.')
  const action = await prisma.lexCoherentAction.findUnique({ where: { id: doc.actionId }, select: { number: true, title: true, practicalStep: true, commentary: true, headingId: true } })
  const d = dNumber(action?.number ?? null, doc.number)
  if (doc.status === 'SUPERSEDED') return fail(`${d} is superseded, so it is not reviewed. Review the document that replaced it.`)
  const cur = doc.versions[0]
  if (!cur) {
    const waiting = await prisma.actionDocumentVersion.count({ where: { documentId, role: 'PROPOSAL', answer: null } })
    return fail(`${d} has no version yet${waiting ? ' — only Lex’s proposal, waiting for your Accept or Set aside' : ''}. A review reads a version, so nothing was reviewed.`)
  }
  const parts = partsOf(doc.kind as DocumentKind, cur.body)
  if (!parts.length) return fail(`${d} version ${cur.v} has no text to review. Nothing was reviewed.`)
  // A generated document with no rows says only that it is empty: there is nothing of the proposal's in it to review (measured 24 Oct: five
  // passes over an empty schedule raised 21 issues, nearly all about how the platform builds schedules).
  const rows = (cur.payload as { rows?: unknown } | null)?.rows
  if (GENERATED_KINDS.has(doc.kind as DocumentKind) && Array.isArray(rows) && rows.length === 0) {
    return fail(`${d} holds no rows yet (it is generated, and its data has nothing in it), so there is nothing in it to review. Nothing was reviewed.`)
  }
  const [heading, idea] = await Promise.all([
    action?.headingId ? prisma.actionHeading.findUnique({ where: { id: action.headingId }, select: { name: true, kind: true } }) : null,
    prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true } }),
  ])
  return {
    ok: true,
    data: {
      documentId, actionId: doc.actionId, ideaId, actionNumber: action?.number ?? null, docNumber: doc.number, kind: doc.kind as DocumentKind,
      title: doc.title, status: doc.status as DocumentStatus, v: cur.v, author: cur.author, body: cur.body, parts,
      action: { title: action?.title ?? null, statement: action?.practicalStep ?? '', commentary: action?.commentary ?? null, heading: heading?.name ?? null, headingKind: heading?.kind ?? null },
      policy: idea?.chosenApproach ?? null,
    },
  }
}

export interface ComposedReview { passKey: PassKey; issues: CheckedIssue[]; heldUp: string; falls: ReviewFalls; pence: number | null; seconds: number }

/** One pass over one document: the call and the checks. Writes nothing. `spendIdeaId`: where the spend is recorded (a measurement charges its scratch copy). */
export async function composeReview(t: ReviewTarget, passKey: PassKey, opts: { userId: string | null; spendIdeaId?: string; call?: Call }): Promise<Result<ComposedReview>> {
  const def = passDef(passKey)
  if (!def) return fail(`There is no review pass called “${passKey}”. Nothing was reviewed.`)
  const started = Date.now()
  const call = opts.call ?? callModelJson
  const res = await call<ReviewAnswer>({
    model: DRAFT_MODEL, system: reviewSystem(def), user: reviewUser(t), schema: REVIEW_SCHEMA as never,
    maxOutputTokens: 8_000, timeoutMs: 240_000, reasoningEffort: 'medium', label: `document-review-${passKey.toLowerCase()}`,
    stream: 'lex', pass: SPEND_PASS, ideaId: opts.spendIdeaId ?? t.ideaId, userId: opts.userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: SPEND_PASS, ideaId: opts.spendIdeaId ?? t.ideaId, userId: opts.userId, failed: !res.ok }))
  const seconds = Math.round((Date.now() - started) / 100) / 10
  if (!res.ok) {
    const why = (res as { detail?: string }).detail ?? (res as { reason?: string }).reason ?? 'no reason given'
    return fail(`the model did not complete the review (${why})${priced.pence ? `; it cost ${priced.pence.toFixed(1)}p` : ''}`)
  }
  const c = checkReview(res.value, t.parts)
  return { ok: true, data: { passKey, issues: c.issues, heldUp: c.heldUp, falls: c.falls, pence: priced.pence ?? null, seconds } }
}

/** The review row and its issues, together. */
export async function applyReview(t: ReviewTarget, r: ComposedReview, userId: string | null): Promise<{ reviewId: string; issues: number }> {
  const def = passDef(r.passKey)!
  const d = dNumber(t.actionNumber, t.docNumber)
  const reviewId = randomUUID()
  const now = new Date()
  const falls = reviewFallsWords(r.falls)
  await prisma.$transaction([
    prisma.documentReview.create({
      data: {
        id: reviewId, ideaId: t.ideaId, documentId: t.documentId, v: t.v, passKey: r.passKey, status: 'RUN', issues: r.issues.length,
        heldUp: r.heldUp || null, falls: falls.length ? falls.join('; ') : null, pence: r.pence, seconds: r.seconds, byUserId: userId,
      },
    }),
    ...r.issues.map((i) => prisma.deepeningIssue.create({
      data: {
        ideaId: t.ideaId, passKey: reviewPassKey(r.passKey), runVersion: 0, title: i.title, text: i.text, status: 'OPEN',
        actionId: t.actionId, documentId: t.documentId, partN: i.partN, attachedBy: 'LEX', attachReason: raisedByWords(def.label, d, t.v), attachedAt: now, reviewId,
      },
    })),
  ])
  return { reviewId, issues: r.issues.length }
}

async function recordFailure(t: ReviewTarget, passKey: PassKey, reason: string, userId: string | null, seconds: number): Promise<void> {
  await prisma.documentReview.create({ data: { id: randomUUID(), ideaId: t.ideaId, documentId: t.documentId, v: t.v, passKey, status: 'FAILED', issues: 0, failureReason: reason.slice(0, 600), seconds, byUserId: userId } })
}

export interface PassOutcome { passKey: PassKey; label: string; status: 'RUN' | 'FAILED' | 'NOT_RUN'; issues: number; heldUp: string | null; pence: number | null; words: string }

/** Review one document with the passes asked for (all five by default), in parallel. Each pass is composed and saved on its own, as it finishes. */
export async function reviewDocument(ideaId: string, documentId: string, opts: { userId: string | null; passes?: PassKey[]; again?: boolean; call?: Call }): Promise<Result<{ d: string; v: number; outcomes: PassOutcome[]; pence: number | null }>> {
  const target = await reviewTarget(ideaId, documentId)
  if ('error' in target) return fail(target.error)
  const t = target.data
  const d = dNumber(t.actionNumber, t.docNumber)
  const asked = opts.passes?.length ? PASSES.filter((p) => opts.passes!.includes(p.key)) : PASSES
  const done = await prisma.documentReview.findMany({ where: { documentId, v: t.v, status: 'RUN', passKey: { in: asked.map((p) => p.key) } }, select: { passKey: true, createdAt: true, issues: true } })
  const outcomes = await Promise.all(asked.map(async (def): Promise<PassOutcome> => {
    const already = done.find((x) => x.passKey === def.key)
    if (already && !opts.again) {
      return { passKey: def.key, label: def.label, status: 'NOT_RUN', issues: 0, heldUp: null, pence: 0, words: `${def.label}: already reviewed version ${t.v} on ${already.createdAt.toISOString().slice(0, 10)} (${already.issues} issue${already.issues === 1 ? '' : 's'}); not run again.` }
    }
    const started = Date.now()
    try {
      const r = await composeReview(t, def.key, { userId: opts.userId, call: opts.call })
      if ('error' in r) {
        await recordFailure(t, def.key, r.error, opts.userId, Math.round((Date.now() - started) / 100) / 10)
        return { passKey: def.key, label: def.label, status: 'FAILED', issues: 0, heldUp: null, pence: null, words: `${def.label}: not done — ${r.error}. Nothing was written but the record that it failed.` }
      }
      await applyReview(t, r.data, opts.userId)
      return {
        passKey: def.key, label: def.label, status: 'RUN', issues: r.data.issues.length, heldUp: r.data.heldUp || null, pence: r.data.pence,
        words: `${def.label}: ${r.data.issues.length} issue${r.data.issues.length === 1 ? '' : 's'} raised${r.data.pence != null ? ` (${r.data.pence.toFixed(1)}p)` : ''}.`,
      }
    } catch (err) {
      const why = err instanceof Error ? err.message.slice(0, 300) : String(err)
      await recordFailure(t, def.key, `the review could not be saved (${why})`, opts.userId, Math.round((Date.now() - started) / 100) / 10).catch(() => {})
      return { passKey: def.key, label: def.label, status: 'FAILED', issues: 0, heldUp: null, pence: null, words: `${def.label}: not done — ${why}.` }
    }
  }))
  const priced = outcomes.filter((o) => o.status !== 'NOT_RUN')
  const pence = priced.some((o) => o.pence == null && o.status === 'RUN') ? null : priced.reduce((a, o) => a + (o.pence ?? 0), 0)
  return { ok: true, data: { d, v: t.v, outcomes, pence } }
}

export interface ReviewRow { passKey: PassKey; label: string; v: number; status: 'RUN' | 'FAILED'; issues: number; heldUp: string | null; falls: string | null; failureReason: string | null; pence: number | null; at: string }

/** The latest review per pass of one document (any version), newest first per pass. */
export async function reviewsOf(documentId: string): Promise<ReviewRow[]> {
  const rows = await prisma.documentReview.findMany({ where: { documentId }, orderBy: { createdAt: 'desc' } })
  const out: ReviewRow[] = []
  for (const p of PASSES) {
    const r = rows.find((x) => x.passKey === p.key)
    if (!r) continue
    out.push({ passKey: p.key, label: p.label, v: r.v, status: r.status as 'RUN' | 'FAILED', issues: r.issues, heldUp: r.heldUp, falls: r.falls, failureReason: r.failureReason, pence: r.pence == null ? null : Number(r.pence), at: r.createdAt.toISOString() })
  }
  return out
}

export interface ReviewPlan {
  d: string; v: number | null
  /** Null when it can be reviewed; otherwise why not, in words. */
  notReviewable: string | null
  /** Per pass: whether it has already read THIS version, and the latest review it made (any version). */
  passes: Array<{ passKey: PassKey; label: string; strapline: string; readThisVersion: boolean; latest: ReviewRow | null }>
  /** The measured price of the passes that have not read this version (all five when `again`), for a document of this length. */
  price: { pence: number | null; n: number; forPasses: PassKey[]; again: { pence: number | null } }
}

/** What "Review this document" would do and cost. Spends nothing, writes nothing. */
export async function reviewPlan(ideaId: string, documentId: string): Promise<Result<ReviewPlan>> {
  const target = await reviewTarget(ideaId, documentId)
  const doc = await prisma.actionDocument.findFirst({ where: { id: documentId, ideaId }, select: { number: true, actionId: true } })
  if (!doc) return fail('That document is not on this idea.')
  const num = (await prisma.lexCoherentAction.findUnique({ where: { id: doc.actionId }, select: { number: true } }))?.number ?? null
  const d = dNumber(num, doc.number)
  const latest = await reviewsOf(documentId)
  if ('error' in target) {
    return { ok: true, data: { d, v: null, notReviewable: target.error, passes: PASSES.map((p) => ({ passKey: p.key, label: p.label, strapline: p.strapline, readThisVersion: false, latest: latest.find((r) => r.passKey === p.key) ?? null })), price: { pence: null, n: 0, forPasses: [], again: { pence: null } } } }
  }
  const t = target.data
  const read = new Set((await prisma.documentReview.findMany({ where: { documentId, v: t.v, status: 'RUN' }, select: { passKey: true } })).map((r) => r.passKey))
  const todo = PASSES.filter((p) => !read.has(p.key)).map((p) => p.key)
  const p = reviewPrice(todo, t.body.length)
  return {
    ok: true,
    data: {
      d, v: t.v, notReviewable: null,
      passes: PASSES.map((x) => ({ passKey: x.key, label: x.label, strapline: x.strapline, readThisVersion: read.has(x.key), latest: latest.find((r) => r.passKey === x.key) ?? null })),
      price: { pence: todo.length ? p.pence : 0, n: p.n, forPasses: todo, again: { pence: reviewPrice(PASSES.map((x) => x.key), t.body.length).pence } },
    },
  }
}

/** How many of the five passes have reviewed each document at its CURRENT version (RUN), for the tree. */
export async function reviewedCounts(ideaId: string, current: Map<string, number>): Promise<Map<string, number>> {
  const rows = await prisma.documentReview.findMany({ where: { ideaId, status: 'RUN' }, select: { documentId: true, v: true, passKey: true } })
  const out = new Map<string, number>()
  for (const [docId, v] of current) out.set(docId, new Set(rows.filter((r) => r.documentId === docId && r.v === v).map((r) => r.passKey)).size)
  return out
}

// ── the Risks view (225; §7: "answered in the Risks view … grouped by document") ─────────────────────────────────────────────────

export interface RiskIssue {
  id: string; title: string | null; text: string; status: string; dismissReason: string | null; resolutionNote: string | null
  /** Who raised it, in words ("Lex’s legal review", "the specificity check"). */
  by: string
  /** Where on the document: "38.1.3", or null for the document as a whole / not on a document. */
  part: string | null
  /** For a review issue: the version it read, when the document has moved on since ("raised against version 1; now at version 2"). */
  olderVersion: string | null
  /** Why it sits where it sits (Lex's placement reason, or the review line). */
  placed: string | null
}
export interface RisksView {
  documents: Array<{ id: string; d: string; title: string; kind: string; status: string; v: number | null; reviews: ReviewRow[]; issues: RiskIssue[] }>
  actions: Array<{ id: string; number: number | null; title: string; issues: RiskIssue[] }>
  proposal: RiskIssue[]
  counts: { open: number; onDocument: number; onAction: number; onProposal: number }
}

export async function risksView(ideaId: string): Promise<RisksView> {
  const [issues, docs, actions, reviews] = await Promise.all([
    prisma.deepeningIssue.findMany({
      where: { ideaId },
      select: { id: true, title: true, text: true, status: true, dismissReason: true, resolutionNote: true, passKey: true, actionId: true, documentId: true, partN: true, attachReason: true, reviewId: true },
      orderBy: [{ partN: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.actionDocument.findMany({ where: { ideaId }, include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' }, take: 1, select: { v: true } } }, orderBy: [{ number: 'asc' }] }),
    prisma.lexCoherentAction.findMany({ where: { ideaId }, select: { id: true, number: true, title: true, practicalStep: true, status: true } }),
    prisma.documentReview.findMany({ where: { ideaId }, orderBy: { createdAt: 'desc' } }),
  ])
  const act = new Map(actions.map((a) => [a.id, a]))
  const reviewV = new Map(reviews.map((r) => [r.id, r.v]))
  const docById = new Map(docs.map((x) => [x.id, x]))
  const toRisk = (i: (typeof issues)[number]): RiskIssue => {
    const doc = i.documentId ? docById.get(i.documentId) : undefined
    const num = doc ? act.get(doc.actionId)?.number ?? null : null
    const readV = i.reviewId ? reviewV.get(i.reviewId) ?? null : null
    const nowV = doc?.versions[0]?.v ?? null
    return {
      id: i.id, title: i.title, text: i.text, status: i.status, dismissReason: i.dismissReason, resolutionNote: i.resolutionNote,
      by: producerWords(i.passKey), part: doc && i.partN != null ? partNumber(num, doc.number, i.partN) : null,
      olderVersion: readV != null && nowV != null && readV !== nowV ? `raised against version ${readV}; the document is now at version ${nowV}` : null,
      placed: i.attachReason,
    }
  }
  const byDoc = (id: string) => issues.filter((i) => i.documentId === id).map(toRisk)
  const documents = docs
    .filter((x) => x.status !== 'SUPERSEDED' || issues.some((i) => i.documentId === x.id))
    .map((x) => {
      const a = act.get(x.actionId)
      const rows: ReviewRow[] = []
      for (const p of PASSES) {
        const r = reviews.find((y) => y.documentId === x.id && y.passKey === p.key)
        if (r) rows.push({ passKey: p.key, label: p.label, v: r.v, status: r.status as 'RUN' | 'FAILED', issues: r.issues, heldUp: r.heldUp, falls: r.falls, failureReason: r.failureReason, pence: r.pence == null ? null : Number(r.pence), at: r.createdAt.toISOString() })
      }
      return { id: x.id, d: dNumber(a?.number ?? null, x.number), title: x.title, kind: KIND_WORD[x.kind as DocumentKind] ?? x.kind, status: STATUS_WORD[x.status as DocumentStatus] ?? x.status, v: x.versions[0]?.v ?? null, reviews: rows, issues: byDoc(x.id), number: a?.number ?? 0, docN: x.number }
    })
    .sort((p, q) => p.number - q.number || p.docN - q.docN)
    .map(({ number: _n, docN: _d, ...rest }) => { void _n; void _d; return rest })
  const actionIds = [...new Set(issues.filter((i) => i.actionId && !i.documentId).map((i) => i.actionId!))]
  const actionGroups = actionIds
    .map((id) => { const a = act.get(id); return { id, number: a?.number ?? null, title: a?.title?.trim() || a?.practicalStep.slice(0, 120) || 'an action', issues: issues.filter((i) => i.actionId === id && !i.documentId).map(toRisk) } })
    .sort((p, q) => (p.number ?? 1e9) - (q.number ?? 1e9))
  const open = issues.filter((i) => i.status === 'OPEN')
  return {
    documents, actions: actionGroups, proposal: issues.filter((i) => !i.actionId).map(toRisk),
    counts: { open: open.length, onDocument: open.filter((i) => i.documentId).length, onAction: open.filter((i) => i.actionId && !i.documentId).length, onProposal: open.filter((i) => !i.actionId).length },
  }
}

/** True for an issue a document review raised (its passKey says so). */
export const isReviewIssue = (passKey: string) => passOfReviewKey(passKey) != null
