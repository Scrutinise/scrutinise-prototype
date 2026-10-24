// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V1 — THE SERVER HALF OF DOCUMENTS ON ACTIONS. The ONE store (decision 240, "no second store"): 26-U's drafting instruction and
// clause now live here as document N.1, and `record.draft` is never written again (the old copy is kept, frozen, as `draftBefore26V`).
//
//   draftsFor            — 26-U's ActionDraft shape, rebuilt from the documents, so every reader of a draft reads this store.
//   writeDraftVersion / writeDraftProposal / answerDraftProposal — the writers lib/lex/action-draft.ts calls.
//   generateCollisionReport — 245/251/267: the clause's own lines, then two parts under each provision it changes (what depends on it;
//                          provisions that refer to it, for review), walked over GRAPH 8's onwardFrom() by strength; a GENERATED version,
//                          marked stale when the effects data or the clause has moved on.
//   generateSchedule     — 233/267: the drafted amendments in ACCEPTED drafting instructions only, on the schedule action's own document.
//   documentTree         — heading → action → document → part, with "needs N: M drafted" and the counts (§3).
//
// ⚠ NOTHING DELETES: versions append; a proposal is answered (ACCEPTED / DISMISSED) and kept; a document is superseded, never removed.
// ⚠ Plain words in every message the screen shows (§0, §30).
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseRecord } from './action-record'
import { parseDraft, currentVersion, type ActionDraft, type DraftInstruction, type DraftVersion, type DraftProposal } from './action-draft-pure'
import { touchesFor } from './action-touches'
import { onwardRows, type Walker } from './collision-walk'
import { effectsLoadDate } from './statutory-graph'
import {
  GENERATED_KINDS, KIND_WORD, collisionBody, dNumber, needsDocuments, partsOf, scheduleBody, scheduleRows,
  type DocumentKind, type DocumentStatus, type EffectRow, type Needs, type NeedsOverride, type ScheduleRow,
} from './action-documents-pure'

export * from './action-documents-pure'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
type Author = 'LEX' | 'OWNER' | 'COLLABORATOR' | 'GENERATED'
type Tx = Prisma.TransactionClient

const DRAFT_TITLE = (legislative: boolean) => (legislative ? 'Drafting instruction and clause' : 'Drafting instruction and wording')

// ── reading 26-U's shape out of the store ───────────────────────────────────────────────────────────────────────

const instructionOf = (payload: unknown): DraftInstruction => {
  // parseDraft is the one defensive reader of an instruction; reuse it on a one-version wrapper rather than copy it — and take off the
  // wrapper's own `v` / `by` / `at`, so a proposal never carries a version's fields.
  const { v: _v, by: _b, at: _a, ...ins } = parseDraft({ versions: [{ ...(payload as object), v: 1 }] })!.versions[0]
  void _v; void _b; void _a
  return ins
}

/** 26-U's ActionDraft for each action, from its live DRAFT_CLAUSE document. An action with none is absent from the map. */
export async function draftsFor(actionIds: string[]): Promise<Map<string, ActionDraft>> {
  const out = new Map<string, ActionDraft>()
  if (!actionIds.length) return out
  const docs = await prisma.actionDocument.findMany({
    where: { actionId: { in: actionIds }, kind: 'DRAFT_CLAUSE', status: { not: 'SUPERSEDED' } },
    include: { versions: { orderBy: [{ role: 'asc' }, { v: 'asc' }] } },
    orderBy: { number: 'asc' },
  })
  for (const d of docs) {
    if (out.has(d.actionId)) continue // one draft clause per action; a second would be a hand-added one of the same kind, read later in V2
    const versions: DraftVersion[] = d.versions.filter((x) => x.role === 'VERSION').map((x) => ({ ...instructionOf(x.payload), v: x.v, by: x.author === 'LEX' ? 'LEX' : 'USER', at: x.createdAt.toISOString() }))
    const pending = d.versions.filter((x) => x.role === 'PROPOSAL' && !x.answer).at(-1)
    const proposal: DraftProposal | undefined = pending ? { ...instructionOf(pending.payload), at: pending.createdAt.toISOString(), reason: pending.reason ?? '', pence: pending.pence == null ? null : Number(pending.pence) } : undefined
    if (versions.length || proposal) out.set(d.actionId, { versions, ...(proposal ? { proposal } : {}) })
  }
  return out
}
export async function draftFor(actionId: string): Promise<ActionDraft | undefined> { return (await draftsFor([actionId])).get(actionId) }

/**
 * Rows with `record.draft` set from the documents — the VIEW 26-U's readers expect (the screen, `specificTag`, Lex's get_action). The
 * stored record never carries it again; anything that writes `record` back starts from the database row, not from this.
 */
export async function withDrafts<T extends { id: string; record: unknown }>(rows: T[]): Promise<T[]> {
  const drafts = await draftsFor(rows.map((r) => r.id))
  return rows.map((r) => {
    const d = drafts.get(r.id)
    const rec = { ...(parseRecord(r.record) as Record<string, unknown>) }
    delete rec.draft
    if (d) rec.draft = d
    return { ...r, record: Object.keys(rec).length ? rec : null }
  })
}

// ── the documents themselves ─────────────────────────────────────────────────────────────────────────────────────

async function nextNumber(tx: Tx, actionId: string): Promise<number> {
  const top = await tx.actionDocument.aggregate({ where: { actionId }, _max: { number: true } })
  return (top._max.number ?? 0) + 1
}

async function documentOfKind(tx: Tx, ideaId: string, actionId: string, kind: DocumentKind, title: string) {
  const found = await tx.actionDocument.findFirst({ where: { actionId, kind, status: { not: 'SUPERSEDED' } }, orderBy: { number: 'asc' } })
  if (found) return found
  return tx.actionDocument.create({ data: { ideaId, actionId, kind, title, number: await nextNumber(tx, actionId) } })
}

async function appendVersion(tx: Tx, documentId: string, v: { author: Author; userId?: string | null; body: string; payload?: unknown; sources?: unknown[]; effectsLoadDate?: string | null; at?: Date }) {
  const top = await tx.actionDocumentVersion.aggregate({ where: { documentId, role: 'VERSION' }, _max: { v: true } })
  const row = await tx.actionDocumentVersion.create({
    data: {
      documentId, role: 'VERSION', v: (top._max.v ?? 0) + 1, author: v.author, authorUserId: v.userId ?? null, body: v.body,
      payload: (v.payload ?? Prisma.DbNull) as never, sources: (v.sources ?? []) as never,
      effectsLoadDate: v.effectsLoadDate ? new Date(`${v.effectsLoadDate}T00:00:00Z`) : null, ...(v.at ? { createdAt: v.at } : {}),
    },
  })
  // A new version is not the one the owner accepted: the document goes back to "drafted, not accepted" until accepted again.
  // 26-V1b 263 — a new version takes the document back to DRAFTED but KEEPS acceptedV, so the screen can say "accepted at version N, then changed".
  await tx.actionDocument.update({ where: { id: documentId }, data: { status: 'DRAFTED', staleAt: null, staleReason: null } })
  return row
}

const draftBody = (ins: DraftInstruction) => ins.clause || ins.plainWording

/** 26-U's saveVersion / acceptProposal: the instruction as a new VERSION of the action's draft-clause document. */
export async function writeDraftVersion(ideaId: string, actionId: string, ins: DraftInstruction, by: 'USER' | 'LEX', opts: { userId?: string | null; author?: Author; legislative: boolean; acceptProposal?: boolean }): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const doc = await documentOfKind(tx, ideaId, actionId, 'DRAFT_CLAUSE', DRAFT_TITLE(opts.legislative))
    if (opts.acceptProposal) {
      await tx.actionDocumentVersion.updateMany({ where: { documentId: doc.id, role: 'PROPOSAL', answer: null }, data: { answer: 'ACCEPTED', answeredAt: new Date() } })
    }
    const row = await appendVersion(tx, doc.id, { author: by === 'LEX' ? 'LEX' : (opts.author ?? 'OWNER'), userId: opts.userId, body: draftBody(ins), payload: ins, sources: ins.citations })
    return row.v
  })
}

/** 26-U's draftWithLex: a PROPOSAL beside the versions. An older unanswered proposal is answered DISMISSED (kept), never overwritten. */
export async function writeDraftProposal(ideaId: string, actionId: string, p: DraftProposal, legislative: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const doc = await documentOfKind(tx, ideaId, actionId, 'DRAFT_CLAUSE', DRAFT_TITLE(legislative))
    await tx.actionDocumentVersion.updateMany({ where: { documentId: doc.id, role: 'PROPOSAL', answer: null }, data: { answer: 'DISMISSED', answeredAt: new Date() } })
    const top = await tx.actionDocumentVersion.aggregate({ where: { documentId: doc.id, role: 'PROPOSAL' }, _max: { v: true } })
    const { at, reason, pence, ...ins } = p
    await tx.actionDocumentVersion.create({
      data: { documentId: doc.id, role: 'PROPOSAL', v: (top._max.v ?? 0) + 1, author: 'LEX', body: draftBody(ins), payload: ins as never, sources: ins.citations as never, reason, pence: pence ?? null, createdAt: new Date(at) },
    })
  })
}

/** 26-U's dismissProposal: the waiting proposal is answered DISMISSED and kept. */
export async function dismissDraftProposal(actionId: string): Promise<boolean> {
  const docs = await prisma.actionDocument.findMany({ where: { actionId, kind: 'DRAFT_CLAUSE', status: { not: 'SUPERSEDED' } }, select: { id: true } })
  const r = await prisma.actionDocumentVersion.updateMany({ where: { documentId: { in: docs.map((d) => d.id) }, role: 'PROPOSAL', answer: null }, data: { answer: 'DISMISSED', answeredAt: new Date() } })
  return r.count > 0
}

/** Accept a document as it stands (its latest version). A later version takes it back to "drafted, not accepted". */
export async function acceptDocument(ideaId: string, documentId: string): Promise<Result<{ d: string; v: number }>> {
  const doc = await prisma.actionDocument.findFirst({ where: { id: documentId, ideaId }, include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' }, take: 1 } } })
  if (!doc) return fail('That document is not on this idea. Nothing was changed.')
  if (doc.status === 'SUPERSEDED') return fail('That document has been superseded by another; accept the one that replaced it. Nothing was changed.')
  const v = doc.versions[0]?.v
  if (!v) return fail('That document has no version yet — only a proposal from Lex. Use the proposal first, then accept. Nothing was changed.')
  await prisma.actionDocument.update({ where: { id: doc.id }, data: { status: 'ACCEPTED', acceptedV: v } })
  const a = await prisma.lexCoherentAction.findUnique({ where: { id: doc.actionId }, select: { number: true } })
  return { ok: true, data: { d: dNumber(a?.number ?? null, doc.number), v } }
}

/** A document added by hand, of any kind (2d), with its first version. */
export async function addDocumentByHand(ideaId: string, actionId: string, input: { kind: DocumentKind; title: string; body: string }, by: { userId: string; author: Author }): Promise<Result<{ d: string }>> {
  const a = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true, number: true } })
  if (!a) return fail('That action is not on this idea’s live list. Nothing was added.')
  if (GENERATED_KINDS.has(input.kind)) return fail(`A ${KIND_WORD[input.kind]} is generated from the data, not written by hand. Use “Generate” on the action instead. Nothing was added.`)
  if (!input.title.trim()) return fail('A document needs a title. Nothing was added.')
  const doc = await prisma.$transaction(async (tx) => {
    const d = await tx.actionDocument.create({ data: { ideaId, actionId, kind: input.kind, title: input.title.trim(), number: await nextNumber(tx, actionId) } })
    await appendVersion(tx, d.id, { author: by.author, userId: by.userId, body: input.body })
    return d
  })
  return { ok: true, data: { d: dNumber(a.number, doc.number) } }
}

/** A new version of a hand-written document (any kind but the 26-U clause, whose editor is its own, and the generated kinds). */
export async function saveDocumentText(ideaId: string, documentId: string, body: string, by: { userId: string; author: Author }): Promise<Result<{ v: number }>> {
  const doc = await prisma.actionDocument.findFirst({ where: { id: documentId, ideaId } })
  if (!doc) return fail('That document is not on this idea. Nothing was saved.')
  if (doc.kind === 'DRAFT_CLAUSE') return fail('A draft clause is edited through its drafting instruction (the action’s “Draft text”), so the clause always traces to it. Nothing was saved.')
  if (GENERATED_KINDS.has(doc.kind as DocumentKind)) return fail(`A ${KIND_WORD[doc.kind as DocumentKind]} is generated; it cannot be typed over. Nothing was saved.`)
  const row = await prisma.$transaction((tx) => appendVersion(tx, doc.id, { author: by.author, userId: by.userId, body }))
  return { ok: true, data: { v: row.v } }
}

// ── 26-V1b §5 — Lex's proposal for a document that is not the clause (the explanatory note): beside the versions, never over them ──────

/** Lex's draft of a text document as a PROPOSAL. An older unanswered proposal is answered DISMISSED (kept), never overwritten. */
export async function writeTextProposal(ideaId: string, actionId: string, kind: DocumentKind, title: string, p: { body: string; reason: string; pence: number | null; sources: unknown[]; payload?: unknown }): Promise<{ documentId: string; d: string; v: number }> {
  return prisma.$transaction(async (tx) => {
    const doc = await documentOfKind(tx, ideaId, actionId, kind, title)
    await tx.actionDocumentVersion.updateMany({ where: { documentId: doc.id, role: 'PROPOSAL', answer: null }, data: { answer: 'DISMISSED', answeredAt: new Date() } })
    const top = await tx.actionDocumentVersion.aggregate({ where: { documentId: doc.id, role: 'PROPOSAL' }, _max: { v: true } })
    const v = (top._max.v ?? 0) + 1
    await tx.actionDocumentVersion.create({ data: { documentId: doc.id, role: 'PROPOSAL', v, author: 'LEX', body: p.body, payload: (p.payload ?? Prisma.DbNull) as never, sources: p.sources as never, reason: p.reason, pence: p.pence } })
    const a = await tx.lexCoherentAction.findUnique({ where: { id: actionId }, select: { number: true } })
    return { documentId: doc.id, d: dNumber(a?.number ?? null, doc.number), v }
  })
}

/** Use Lex's waiting proposal on a text document: it becomes the next VERSION (by LEX), and the proposal is answered ACCEPTED and kept. */
export async function useTextProposal(ideaId: string, documentId: string): Promise<Result<{ v: number }>> {
  const doc = await prisma.actionDocument.findFirst({ where: { id: documentId, ideaId } })
  if (!doc) return fail('That document is not on this idea. Nothing was changed.')
  if (doc.kind === 'DRAFT_CLAUSE') return fail('A draft clause’s proposal is used from its comparison (“Take all”, then Save), so its law rows are written. Nothing was changed.')
  const p = await prisma.actionDocumentVersion.findFirst({ where: { documentId, role: 'PROPOSAL', answer: null }, orderBy: { v: 'desc' } })
  if (!p) return fail('Lex has no proposal waiting on this document. Nothing was changed.')
  const row = await prisma.$transaction(async (tx) => {
    await tx.actionDocumentVersion.update({ where: { id: p.id }, data: { answer: 'ACCEPTED', answeredAt: new Date() } })
    return appendVersion(tx, doc.id, { author: 'LEX', body: p.body, payload: p.payload, sources: Array.isArray(p.sources) ? (p.sources as unknown[]) : [] })
  })
  return { ok: true, data: { v: row.v } }
}

/** Set Lex's waiting proposal aside: answered DISMISSED and kept (listed in Versions). */
export async function setAsideTextProposal(ideaId: string, documentId: string): Promise<Result<{ v: number }>> {
  const doc = await prisma.actionDocument.findFirst({ where: { id: documentId, ideaId }, select: { id: true } })
  if (!doc) return fail('That document is not on this idea. Nothing was changed.')
  const p = await prisma.actionDocumentVersion.findFirst({ where: { documentId, role: 'PROPOSAL', answer: null }, orderBy: { v: 'desc' } })
  if (!p) return fail('Lex has no proposal waiting on this document. Nothing was changed.')
  await prisma.actionDocumentVersion.update({ where: { id: p.id }, data: { answer: 'DISMISSED', answeredAt: new Date() } })
  return { ok: true, data: { v: p.v } }
}

// ── "needs a document": the override, recorded with its reason ───────────────────────────────────────────────────

export function needsOverrideOf(record: unknown): NeedsOverride | null {
  const o = (parseRecord(record) as { documentNeeds?: unknown }).documentNeeds as NeedsOverride | undefined
  return o && (o.mode === 'nothing' || o.mode === 'set') && typeof o.reason === 'string' ? o : null
}

export async function setNeeds(ideaId: string, actionId: string, o: { mode: 'derived' | 'nothing' | 'set'; kinds?: DocumentKind[]; reason?: string }, by: string): Promise<Result<{ number: number | null }>> {
  const a = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true, number: true, record: true } })
  if (!a) return fail('That action is not on this idea’s live list. Nothing was changed.')
  if (o.mode !== 'derived' && !o.reason?.trim()) return fail('Say why — the reason is recorded with the choice. Nothing was changed.')
  if (o.mode === 'set' && !o.kinds?.length) return fail('Choose at least one kind of document. Nothing was changed.')
  const rec = parseRecord(a.record) as Record<string, unknown>
  if (o.mode === 'derived') delete rec.documentNeeds
  else rec.documentNeeds = { mode: o.mode, ...(o.mode === 'set' ? { kinds: o.kinds } : {}), reason: o.reason!.trim(), by, at: new Date().toISOString() } satisfies NeedsOverride
  await prisma.lexCoherentAction.update({ where: { id: a.id }, data: { record: (Object.keys(rec).length ? rec : Prisma.DbNull) as never } })
  return { ok: true, data: { number: a.number } }
}

// ── generated documents ─────────────────────────────────────────────────────────────────────────────────────────

/** Depth-1 rows from a drafting instruction's own provision lines (what the clause itself amends, repeals, modifies, relies on). */
export async function depthOneRows(ins: DraftInstruction): Promise<EffectRow[]> {
  const { touches } = await touchesFor(ins)
  return touches.map((t, i) => ({
    i, depth: 1, parent: null, relation: t.line.relation, docUri: t.line.docUri, provisionPath: t.line.provisionPath, actTitle: t.actTitle,
    state: t.state, note: t.line.note || t.stateReason, effects: t.effects?.perType ?? [],
  }))
}

/** ⚠ jsonb stores an object's keys in ITS order, not ours, so a plain JSON.stringify of a stored row never equals the fresh one: compare
 *  with the keys sorted, or "unchanged" can never be true and every regeneration writes a version. */
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0))) : x))
const sameRows = (a: unknown, b: unknown[]) => stable(((a as { rows?: unknown } | null)?.rows) ?? null) === stable(b)

/**
 * The action's collision report (document N.2 beside the clause), generated from the CURRENT draft-clause version. A new GENERATED version
 * is written only when the rows or the effects load date changed; otherwise "unchanged". Free: no model call.
 */
export async function generateCollisionReport(ideaId: string, actionId: string, opts: { rows?: EffectRow[]; walk?: Walker } = {}): Promise<Result<{ d: string; v: number | null; rows: number; unchanged: boolean }>> {
  const a = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true, number: true } })
  if (!a) return fail('That action is not on this idea’s live list. Nothing was generated.')
  const draft = await draftFor(a.id)
  const cur = currentVersion(draft)
  if (!cur) return fail(`#${a.number ?? '?'} has no drafting instruction yet, so there is nothing for a collision report to read. Nothing was generated.`)
  const clause = opts.rows ?? (await depthOneRows(cur))
  // 267: the two parts, walked by strength over onwardFrom() (free: no model call)
  const onward = await onwardRows(clause.filter((r) => (r.part ?? 'clause') === 'clause'), opts.walk)
  const rows = [...clause, ...onward.rows]
  const loadDate = await effectsLoadDate().catch(() => null)
  const payload = { rows, notes: onward.notes, fromDraftVersion: cur.v, walk: 'onward-267' }
  const out = await prisma.$transaction(async (tx) => {
    const doc = await documentOfKind(tx, ideaId, a.id, 'COLLISION_REPORT', 'Collision report')
    const last = await tx.actionDocumentVersion.findFirst({ where: { documentId: doc.id, role: 'VERSION' }, orderBy: { v: 'desc' } })
    const lastLoad = last?.effectsLoadDate?.toISOString().slice(0, 10) ?? null
    if (last && sameRows(last.payload, rows) && lastLoad === loadDate && (last.payload as { fromDraftVersion?: number } | null)?.fromDraftVersion === cur.v) {
      if (doc.staleAt) await tx.actionDocument.update({ where: { id: doc.id }, data: { staleAt: null, staleReason: null } })
      return { doc, v: null as number | null, unchanged: true }
    }
    const row = await appendVersion(tx, doc.id, { author: 'GENERATED', body: collisionBody(rows, { loadDate, caveat: onward.caveat, notes: onward.notes }), payload, effectsLoadDate: loadDate })
    return { doc, v: row.v as number | null, unchanged: false }
  })
  return { ok: true, data: { d: dNumber(a.number, out.doc.number), v: out.v, rows: rows.length, unchanged: out.unchanged } }
}

/** The actions on an idea that hold the consequential schedule (233): those whose needs are set to include it. */
async function scheduleActions(ideaId: string) {
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { id: true, number: true, record: true } })
  return rows.filter((r) => needsOverrideOf(r.record)?.kinds?.includes('CONSEQUENTIAL_SCHEDULE'))
}

/** 267: every accepted drafting-instruction version on the idea, with its action number and D-number. Read by the schedule and the pack. */
export async function acceptedInstructions(ideaId: string): Promise<Array<{ actionId: string; action: number | null; d: string; v: number; ins: DraftInstruction }>> {
  const docs = await prisma.actionDocument.findMany({
    where: { ideaId, kind: 'DRAFT_CLAUSE', status: { not: 'SUPERSEDED' }, acceptedV: { not: null } },
    include: { versions: { where: { role: 'VERSION' } } }, orderBy: [{ number: 'asc' }],
  })
  const nums = new Map((await prisma.lexCoherentAction.findMany({ where: { id: { in: docs.map((d) => d.actionId) }, status: 'LIVE' }, select: { id: true, number: true } })).map((x) => [x.id, x.number]))
  return docs.flatMap((d) => {
    const v = d.versions.find((x) => x.v === d.acceptedV)
    if (!v || !nums.has(d.actionId)) return []
    const action = nums.get(d.actionId) ?? null
    return [{ actionId: d.actionId, action, d: dNumber(action, d.number), v: v.v, ins: instructionOf(v.payload) }]
  })
}

/** 233/267: the schedule action's document — the DRAFTED amendments in accepted instructions, counted and listed per Act. Never a collision row. */
export async function generateSchedule(ideaId: string): Promise<Result<{ d: string | null; v: number | null; rows: number; unchanged: boolean }>> {
  const holders = await scheduleActions(ideaId)
  if (!holders.length) return fail('No action on this idea is set to hold the consequential schedule. Set one (its documents: "needs a consequential schedule") first. Nothing was generated.')
  const rows: ScheduleRow[] = scheduleRows(await acceptedInstructions(ideaId))
  const h = holders[0]
  const out = await prisma.$transaction(async (tx) => {
    const doc = await documentOfKind(tx, ideaId, h.id, 'CONSEQUENTIAL_SCHEDULE', 'Consequential amendments and repeals — the schedule')
    const last = await tx.actionDocumentVersion.findFirst({ where: { documentId: doc.id, role: 'VERSION' }, orderBy: { v: 'desc' } })
    if (last && sameRows(last.payload, rows) && (last.payload as { from?: string } | null)?.from === SCHEDULE_FROM) return { doc, v: null as number | null, unchanged: true }
    const row = await appendVersion(tx, doc.id, { author: 'GENERATED', body: scheduleBody(rows), payload: { rows, from: SCHEDULE_FROM }, effectsLoadDate: null })
    return { doc, v: row.v as number | null, unchanged: false }
  })
  return { ok: true, data: { d: dNumber(h.number, out.doc.number), v: out.v, rows: rows.length, unchanged: out.unchanged } }
}
/** Marks a schedule version written from accepted instructions (267); an older one, written from collision rows, is out of date. */
export const SCHEDULE_FROM = 'accepted-instructions'

// ── staleness (251): said, and recorded ──────────────────────────────────────────────────────────────────────────

/** Why a generated document's latest version no longer matches its data, in words; null when it still does. Pure on its inputs. */
export function staleWhy(kind: string, last: { effectsLoadDate: Date | null; payload: unknown } | undefined, now: { loadDate: string | null; draftV: number | null; schedule?: ScheduleRow[] }): string | null {
  if (!last || !GENERATED_KINDS.has(kind as DocumentKind)) return null
  const p = last.payload as { fromDraftVersion?: number; walk?: string; from?: string; rows?: unknown } | null
  // 267 — the schedule reads accepted instructions, never the effects data: it is out of date when what was accepted has changed
  if (kind === 'CONSEQUENTIAL_SCHEDULE') {
    if (p?.from !== SCHEDULE_FROM) return 'this was generated from the collision reports, before the schedule became the drafted amendments in accepted instructions only (267)'
    return now.schedule && !sameRows(p, now.schedule) ? 'an accepted drafting instruction has changed since this was generated' : null
  }
  const was = last.effectsLoadDate?.toISOString().slice(0, 10) ?? null
  if (now.loadDate && was !== now.loadDate) return `the effects data was reloaded on ${now.loadDate}; this was generated from the load of ${was ?? 'an unknown date'}`
  if (kind === 'COLLISION_REPORT' && now.draftV != null && p?.fromDraftVersion != null && p.fromDraftVersion !== now.draftV) return `the clause now has version ${now.draftV}; this was generated from version ${p.fromDraftVersion}`
  if (kind === 'COLLISION_REPORT' && p?.walk !== 'onward-267') return 'this was generated before the report had its two parts — what depends on each provision, and what refers to it (267)'
  return null
}

// ── the tree (§3) ─────────────────────────────────────────────────────────────────────────────────────────────

export interface TreeDocument {
  id: string; number: number; d: string; kind: DocumentKind; title: string; status: DocumentStatus; acceptedV: number | null
  current: { v: number; author: string; at: string } | null; versions: number; proposalWaiting: boolean; parts: Array<{ n: number; title: string }>; stale: string | null
}
export interface TreeActionRow { id: string; number: number | null; title: string | null; statement: string; headingId: string | null; avenue: string | null; needs: Needs; documents: TreeDocument[]; missing: DocumentKind[] }
export interface DocumentTree { headings: Array<{ id: string | null; name: string; actions: TreeActionRow[] }>; loadDate: string | null }

export async function documentTree(ideaId: string, opts: { recordStale?: boolean } = {}): Promise<DocumentTree> {
  const [actions, headings, docs, loadDate] = await Promise.all([
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { id: true, number: true, title: true, practicalStep: true, headingId: true, avenue: true, record: true }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] }),
    prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true }, orderBy: [{ orderIndex: 'asc' }] }).catch(() => [] as Array<{ id: string; name: string }>),
    prisma.actionDocument.findMany({ where: { ideaId }, include: { versions: { orderBy: [{ role: 'asc' }, { v: 'asc' }] } }, orderBy: [{ number: 'asc' }] }),
    effectsLoadDate().catch(() => null),
  ])
  const drafts = await draftsFor(actions.map((a) => a.id))
  const schedule = docs.some((d) => d.kind === 'CONSEQUENTIAL_SCHEDULE') ? scheduleRows(await acceptedInstructions(ideaId)) : undefined
  const headingName = new Map(headings.map((h) => [h.id, h.name]))
  const staleWrites: Array<{ id: string; reason: string | null }> = []
  const rowOf = (a: (typeof actions)[number]): TreeActionRow => {
    const draftV = currentVersion(drafts.get(a.id))?.v ?? null
    const clauseAccepted = docs.some((d) => d.actionId === a.id && d.kind === 'DRAFT_CLAUSE' && d.status !== 'SUPERSEDED' && d.acceptedV != null)
    const needs = needsDocuments({ avenue: a.avenue, instrument: currentVersion(drafts.get(a.id))?.instrument ?? null, override: needsOverrideOf(a.record), clauseAccepted, headingName: headingName.get(a.headingId ?? '') ?? null })
    const documents: TreeDocument[] = docs.filter((d) => d.actionId === a.id).map((d) => {
      const vs = d.versions.filter((x) => x.role === 'VERSION')
      const last = vs.at(-1)
      const stale = staleWhy(d.kind, last, { loadDate, draftV, schedule })
      if (opts.recordStale && (stale ?? null) !== (d.staleReason ?? null)) staleWrites.push({ id: d.id, reason: stale })
      return {
        id: d.id, number: d.number, d: dNumber(a.number, d.number), kind: d.kind as DocumentKind, title: d.title, status: d.status as DocumentStatus, acceptedV: d.acceptedV,
        current: last ? { v: last.v, author: last.author, at: last.createdAt.toISOString() } : null, versions: vs.length,
        proposalWaiting: d.versions.some((x) => x.role === 'PROPOSAL' && !x.answer),
        parts: last ? partsOf(d.kind as DocumentKind, last.body).map((p) => ({ n: p.n, title: p.title })) : [], stale,
      }
    })
    const live = documents.filter((d) => d.status !== 'SUPERSEDED')
    return { id: a.id, number: a.number, title: a.title, statement: a.practicalStep, headingId: a.headingId, avenue: a.avenue, needs, documents, missing: needs.kinds.filter((k) => !live.some((d) => d.kind === k)) }
  }
  const rows = actions.map(rowOf)
  if (staleWrites.length) {
    const now = new Date()
    await prisma.$transaction(staleWrites.map((w) => prisma.actionDocument.update({ where: { id: w.id }, data: w.reason ? { staleAt: now, staleReason: w.reason } : { staleAt: null, staleReason: null } })))
  }
  const known = new Set(headings.map((h) => h.id))
  return {
    headings: [
      ...headings.map((h) => ({ id: h.id as string | null, name: h.name, actions: rows.filter((r) => r.headingId === h.id) })),
      { id: null, name: 'Not under a heading', actions: rows.filter((r) => !r.headingId || !known.has(r.headingId)) },
    ].filter((h) => h.actions.length),
    loadDate,
  }
}

/** §6 — what the Actions Pack prints after each action's record: its documents in number order, current version, with status words. */
export interface PackDocument { d: string; number: number; kind: DocumentKind; title: string; status: DocumentStatus; stale: string | null; v: number | null; author: string | null; at: string | null; body: string; sources: unknown[] }
export async function packDocuments(ideaId: string): Promise<Map<string, PackDocument[]>> {
  const docs = await prisma.actionDocument.findMany({
    where: { ideaId, status: { not: 'SUPERSEDED' } },
    include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' }, take: 1 } }, orderBy: [{ number: 'asc' }],
  })
  const nums = new Map((await prisma.lexCoherentAction.findMany({ where: { id: { in: [...new Set(docs.map((d) => d.actionId))] } }, select: { id: true, number: true } })).map((a) => [a.id, a.number]))
  const out = new Map<string, PackDocument[]>()
  for (const d of docs) {
    const v = d.versions[0]
    const row: PackDocument = {
      d: dNumber(nums.get(d.actionId) ?? null, d.number), number: d.number, kind: d.kind as DocumentKind, title: d.title, status: d.status as DocumentStatus, stale: d.staleReason,
      v: v?.v ?? null, author: v?.author ?? null, at: v?.createdAt.toISOString() ?? null, body: v?.body ?? '', sources: Array.isArray(v?.sources) ? (v!.sources as unknown[]) : [],
    }
    out.set(d.actionId, [...(out.get(d.actionId) ?? []), row])
  }
  // 26-V1b §5b — the explanatory note prints straight after its clause; the rest keep their number order.
  const rank = (k: DocumentKind) => (k === 'DRAFT_CLAUSE' ? 0 : k === 'EXPLANATORY_NOTE' ? 1 : 2)
  for (const [k, v] of out) out.set(k, [...v].sort((x, y) => rank(x.kind) - rank(y.kind) || x.number - y.number))
  return out
}

/** One document, opened in place (§3b): every version and proposal, its parts, its sources. */
export async function openDocument(ideaId: string, documentId: string) {
  const doc = await prisma.actionDocument.findFirst({ where: { id: documentId, ideaId }, include: { versions: { orderBy: [{ role: 'asc' }, { v: 'asc' }] } } })
  if (!doc) return fail('That document is not on this idea.')
  const a = await prisma.lexCoherentAction.findUnique({ where: { id: doc.actionId }, select: { number: true, title: true } })
  const vs = doc.versions.filter((x) => x.role === 'VERSION')
  const cur = vs.at(-1)
  return {
    ok: true as const,
    data: {
      id: doc.id, d: dNumber(a?.number ?? null, doc.number), number: doc.number, actionNumber: a?.number ?? null, actionTitle: a?.title ?? null,
      kind: doc.kind as DocumentKind, title: doc.title, status: doc.status as DocumentStatus, acceptedV: doc.acceptedV, stale: doc.staleReason,
      current: cur ? { v: cur.v, author: cur.author, at: cur.createdAt.toISOString(), body: cur.body, sources: cur.sources, parts: partsOf(doc.kind as DocumentKind, cur.body) } : null,
      versions: vs.map((x) => ({ v: x.v, author: x.author, at: x.createdAt.toISOString(), chars: x.body.length })),
      proposals: doc.versions.filter((x) => x.role === 'PROPOSAL').map((x) => ({ v: x.v, at: x.createdAt.toISOString(), answer: x.answer, reason: x.reason, pence: x.pence == null ? null : Number(x.pence), body: x.answer ? null : x.body })),
    },
  }
}
