// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-AC part (a) (BRIEF_26AC §3; decisions 368, 370, 374): SCRUTINY EDITIONS, THE DATABASE HALF. Server only.
//
//   createEdition    "Create scrutiny edition" (owner only): mints a ProposalVersion (the frozen snapshot) and numbers the edition 1, 2, 3
//                    per idea. The previous edition's author's notes are carried into the new draft (374), as new rows.
//   refreshDraft     a DRAFT edition re-freezes the idea as it is now (a new ProposalVersion when anything changed). Never a PUBLISHED one.
//   setInclude / setBlind / notes   edit a DRAFT: which sections to include, the blind round, the author's notes (set aside, never deleted)
//   publishEdition   the checklist is shown first (§3); publishing anyway is RECORDED on the edition. A published edition never changes.
//   answerLink / addOwnerLink       the source-linking exercise's answers (proposals beside, never over); on a DRAFT only
//
// ⚠ A PUBLISHED EDITION NEVER CHANGES, TWICE OVER: every write here refuses it in words (PUBLISHED_REFUSED), and the database's triggers
//   (prisma/lex_26ac_a.sql) refuse it too, so a bug in this file cannot change what reviewers were shown.
// ⚠ EVERY CALL IS SCOPED BY ideaId: an edition id from another idea is "not found", whatever the caller's rights on that other idea.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { mintVersion } from '@/lib/documents/proposal-version'
import type { ProposalSnapshot } from '@/lib/documents/proposal-snapshot'
import { LIMITS } from './input-limits'
import type { Result } from './action-structure'
import {
  editionView, prePublishChecklist, checklistCount, parseInclude, editionName, PUBLISHED_REFUSED, NOTE_TARGETS, SECTION_KEY,
  type Checklist, type EditionView, type EditionStatus, type LinkRow, type NoteRow, type NoteTarget, type LinkTarget, type PublishedChecklist,
} from './scrutiny-edition-pure'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const NOT_FOUND = 'That scrutiny edition is not on this idea. Nothing was changed.'

export interface EditionSummary {
  id: string; number: number; status: EditionStatus; versionNumber: number; createdAt: string; publishedAt: string | null; blind: boolean
  publishedAnyway: boolean; checklist: PublishedChecklist | null
}

export async function listEditions(ideaId: string): Promise<EditionSummary[]> {
  const rows = await prisma.scrutinyEdition.findMany({ where: { ideaId }, orderBy: { number: 'desc' }, include: { proposalVersion: { select: { versionNumber: true } } } })
  return rows.map((r) => {
    const c = (r.checklist ?? null) as unknown as PublishedChecklist | null
    return {
      id: r.id, number: r.number, status: r.status as EditionStatus, versionNumber: r.proposalVersion.versionNumber, createdAt: r.createdAt.toISOString(),
      publishedAt: r.publishedAt?.toISOString() ?? null, blind: r.blind, publishedAnyway: !!c?.publishedAnyway, checklist: c,
    }
  })
}

async function editionOf(ideaId: string, editionId: string) {
  const e = await prisma.scrutinyEdition.findFirst({ where: { id: editionId, ideaId } })
  return e
}
async function draftOf(ideaId: string, editionId: string): Promise<Result<NonNullable<Awaited<ReturnType<typeof editionOf>>>>> {
  const e = await editionOf(ideaId, editionId)
  if (!e) return fail(NOT_FOUND)
  if (e.status !== 'DRAFT') return fail(PUBLISHED_REFUSED(e.number))
  return { ok: true, data: e }
}

/** "Create scrutiny edition". One draft at a time: a second is refused while one is unpublished, in words. */
export async function createEdition(ideaId: string, userId: string): Promise<Result<{ id: string; number: number; versionNumber: number; carriedNotes: number }>> {
  const open = await prisma.scrutinyEdition.findFirst({ where: { ideaId, status: 'DRAFT' }, select: { number: true } })
  if (open) return fail(`${editionName(open.number)} is still a draft. Publish it, or keep preparing it, before creating another. Nothing was created.`)
  let minted
  try { minted = await mintVersion(ideaId, userId, { userNote: 'frozen for a scrutiny edition' }) } catch (e) { return fail(`The idea could not be frozen for an edition: ${(e as Error).message}. Nothing was created.`) }
  const prev = await prisma.scrutinyEdition.findFirst({ where: { ideaId }, orderBy: { number: 'desc' }, include: { notes: { where: { archivedAt: null }, orderBy: { orderIndex: 'asc' } } } })
  const number = (prev?.number ?? 0) + 1
  const id = randomUUID()
  try {
    await prisma.$transaction([
      prisma.scrutinyEdition.create({ data: { id, ideaId, number, proposalVersionId: minted.version.id, createdBy: userId, include: prev ? (prev.include as object) : {} } }),
      ...(prev?.notes ?? []).map((n) => prisma.scrutinyAuthorNote.create({ data: { id: randomUUID(), editionId: id, targetKind: n.targetKind, targetId: n.targetId, body: n.body, orderIndex: n.orderIndex } })),
    ])
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return fail('Another edition was created at the same moment. Look again; nothing more was created.')
    throw e
  }
  return { ok: true, data: { id, number, versionNumber: minted.version.versionNumber, carriedNotes: prev?.notes.length ?? 0 } }
}

/** A DRAFT edition re-freezes the idea as it is now. */
export async function refreshDraft(ideaId: string, editionId: string, userId: string): Promise<Result<{ versionNumber: number; changed: boolean }>> {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  const minted = await mintVersion(ideaId, userId, { userNote: `brought up to date for ${editionName(d.data.number)}` })
  const changed = minted.version.id !== d.data.proposalVersionId
  if (changed) await prisma.scrutinyEdition.update({ where: { id: editionId }, data: { proposalVersionId: minted.version.id } })
  return { ok: true, data: { versionNumber: minted.version.versionNumber, changed } }
}

export interface LoadedEdition {
  id: string; ideaId: string; number: number; status: EditionStatus; publishedAt: string | null; blind: boolean; versionNumber: number
  snapshot: ProposalSnapshot; notes: NoteRow[]; links: LinkRow[]; include: ReturnType<typeof parseInclude>; checklist: PublishedChecklist | null
}

export async function loadEdition(editionId: string): Promise<LoadedEdition | null> {
  const e = await prisma.scrutinyEdition.findUnique({
    where: { id: editionId },
    include: {
      proposalVersion: { select: { versionNumber: true, snapshot: true } },
      notes: { orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] },
      sourceLinks: { orderBy: { createdAt: 'asc' }, include: { source: { select: { number: true, title: true } } } },
    },
  })
  if (!e) return null
  return {
    id: e.id, ideaId: e.ideaId, number: e.number, status: e.status as EditionStatus, publishedAt: e.publishedAt?.toISOString() ?? null, blind: e.blind,
    versionNumber: e.proposalVersion.versionNumber, snapshot: e.proposalVersion.snapshot as unknown as ProposalSnapshot,
    notes: e.notes.map((n) => ({ id: n.id, targetKind: n.targetKind as NoteTarget, targetId: n.targetId, body: n.body, orderIndex: n.orderIndex, archivedAt: n.archivedAt?.toISOString() ?? null })),
    links: e.sourceLinks.map((l) => ({
      id: l.id, targetKind: l.targetKind as LinkTarget, targetId: l.targetId, claim: l.claim, sourceId: l.sourceId, sourceNumber: l.source.number, sourceTitle: l.source.title,
      status: l.status as LinkRow['status'], proposedBy: l.proposedBy as LinkRow['proposedBy'], reason: l.reason,
    })),
    include: parseInclude(e.include), checklist: (e.checklist ?? null) as unknown as PublishedChecklist | null,
  }
}

export function viewOf(e: LoadedEdition): EditionView {
  return editionView(e.snapshot, { number: e.number, status: e.status, publishedAt: e.publishedAt, blind: e.blind, include: e.include }, e.notes, e.links)
}
/** The checklist runs over the page reviewers will read: a heading left out is not in the edition, so it is not on the list. */
export function checklistOf(e: LoadedEdition): Checklist {
  return prePublishChecklist(viewOf(e), e.snapshot)
}

// ── editing a DRAFT ──────────────────────────────────────────────────────────────────────────────────────────

/** The section keys this edition's snapshot actually has (a hidden key must name one). */
function sectionKeys(s: ProposalSnapshot): Set<string> {
  const keys = new Set<string>([SECTION_KEY.summary, SECTION_KEY.setAside, SECTION_KEY.sources, SECTION_KEY.heading(null)])
  for (const h of s.actionsPack?.headings ?? []) keys.add(SECTION_KEY.heading(h.id))
  return keys
}

export async function setInclude(ideaId: string, editionId: string, hidden: string[]): Promise<Result<{ hidden: string[] }>> {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  const e = await loadEdition(editionId)
  const known = sectionKeys(e!.snapshot)
  const bad = hidden.filter((k) => !known.has(k))
  if (bad.length) return fail(`This edition has no section called “${bad[0]}”. Nothing was changed.`)
  const clean = [...new Set(hidden)]
  await prisma.scrutinyEdition.update({ where: { id: editionId }, data: { include: { hidden: clean } } })
  return { ok: true, data: { hidden: clean } }
}

export async function setBlind(ideaId: string, editionId: string, blind: boolean): Promise<Result<{ blind: boolean }>> {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  await prisma.scrutinyEdition.update({ where: { id: editionId }, data: { blind } })
  return { ok: true, data: { blind } }
}

function targetOk(s: ProposalSnapshot, kind: NoteTarget, id: string | null): string | null {
  if (!(NOTE_TARGETS as readonly string[]).includes(kind)) return 'A note sits at the top, or against a heading or an action.'
  if (kind === 'TOP') return id == null ? null : 'A note at the top is not against anything.'
  const ok = kind === 'HEADING' ? (s.actionsPack?.headings ?? []).some((h) => h.id === id) : (s.actionsPack?.actions ?? []).some((a) => a.id === id)
  return ok ? null : `That ${kind === 'HEADING' ? 'heading' : 'action'} is not in this edition.`
}

export async function addNote(ideaId: string, editionId: string, n: { targetKind: NoteTarget; targetId: string | null; body: string }): Promise<Result<{ id: string }>> {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  const body = n.body.trim()
  if (!body) return fail('Write the note first. Nothing was added.')
  if (body.length > LIMITS.authorNote) return fail(`A note is at most ${LIMITS.authorNote.toLocaleString('en-GB')} characters; this one is ${body.length.toLocaleString('en-GB')}. Nothing was added.`)
  const e = await loadEdition(editionId)
  const bad = targetOk(e!.snapshot, n.targetKind, n.targetKind === 'TOP' ? null : n.targetId)
  if (bad) return fail(`${bad} Nothing was added.`)
  const last = await prisma.scrutinyAuthorNote.aggregate({ where: { editionId }, _max: { orderIndex: true } })
  const id = randomUUID()
  await prisma.scrutinyAuthorNote.create({ data: { id, editionId, targetKind: n.targetKind, targetId: n.targetKind === 'TOP' ? null : n.targetId, body, orderIndex: (last._max.orderIndex ?? -1) + 1 } })
  return { ok: true, data: { id } }
}

async function noteOf(ideaId: string, editionId: string, noteId: string) {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  const n = await prisma.scrutinyAuthorNote.findFirst({ where: { id: noteId, editionId } })
  return n ? ({ ok: true, data: n } as const) : fail('That note is not on this edition. Nothing was changed.')
}

export async function editNote(ideaId: string, editionId: string, noteId: string, body: string): Promise<Result<{ id: string }>> {
  const n = await noteOf(ideaId, editionId, noteId)
  if (!n.ok) return fail((n as { error: string }).error)
  const b = body.trim()
  if (!b) return fail('A note cannot be emptied: set it aside instead. Nothing was changed.')
  if (b.length > LIMITS.authorNote) return fail(`A note is at most ${LIMITS.authorNote.toLocaleString('en-GB')} characters; this one is ${b.length.toLocaleString('en-GB')}. Nothing was changed.`)
  await prisma.scrutinyAuthorNote.update({ where: { id: noteId }, data: { body: b } })
  return { ok: true, data: { id: noteId } }
}

/** Set aside (archive) or restore. Nothing deletes. */
export async function archiveNote(ideaId: string, editionId: string, noteId: string, archived: boolean): Promise<Result<{ id: string; archived: boolean }>> {
  const n = await noteOf(ideaId, editionId, noteId)
  if (!n.ok) return fail((n as { error: string }).error)
  await prisma.scrutinyAuthorNote.update({ where: { id: noteId }, data: { archivedAt: archived ? new Date() : null } })
  return { ok: true, data: { id: noteId, archived } }
}

// ── the source-linking exercise's answers ────────────────────────────────────────────────────────────────────

export async function answerLink(ideaId: string, editionId: string, linkId: string, answer: 'ACCEPTED' | 'REJECTED' | 'PROPOSED'): Promise<Result<{ id: string; status: string }>> {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  const l = await prisma.scrutinySourceLink.findFirst({ where: { id: linkId, editionId } })
  if (!l) return fail('That proposed link is not on this edition. Nothing was changed.')
  await prisma.scrutinySourceLink.update({ where: { id: linkId }, data: { status: answer, answeredAt: answer === 'PROPOSED' ? null : new Date() } })
  return { ok: true, data: { id: linkId, status: answer } }
}

/** The owner links a section to a filed source by hand (accepted at once: it is their own). */
export async function addOwnerLink(ideaId: string, editionId: string, l: { targetKind: LinkTarget; targetId: string | null; sourceNumber: number; claim?: string | null }): Promise<Result<{ id: string }>> {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  const src = await prisma.ideaSource.findFirst({ where: { ideaId, number: l.sourceNumber, archivedAt: null }, select: { id: true } })
  if (!src) return fail(`There is no filed source [Ref: ${l.sourceNumber}] on this idea. Nothing was linked.`)
  const e = await loadEdition(editionId)
  const s = e!.snapshot
  const ok = l.targetKind === 'SUMMARY' ? l.targetId == null
    : l.targetKind === 'HEADING' ? (s.actionsPack?.headings ?? []).some((h) => h.id === l.targetId)
    : l.targetKind === 'ACTION' || l.targetKind === 'DRAFT' ? (s.actionsPack?.actions ?? []).some((a) => a.id === l.targetId)
    : false
  if (!ok) return fail('That section is not in this edition. Nothing was linked.')
  const id = randomUUID()
  await prisma.scrutinySourceLink.create({ data: { id, editionId, targetKind: l.targetKind, targetId: l.targetId, claim: l.claim?.trim() || null, sourceId: src.id, status: 'ACCEPTED', proposedBy: 'OWNER', answeredAt: new Date() } })
  return { ok: true, data: { id } }
}

// ── publishing ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * §3: the checklist first. With anything on it, publishing needs `anyway: true` (the owner saw the list and chose to publish); the list as
 * it stood is recorded on the edition either way, so "published anyway" is shown to the owner afterwards, never hidden.
 */
export async function publishEdition(ideaId: string, editionId: string, userId: string, anyway: boolean): Promise<Result<{ number: number; published: true; checklist: PublishedChecklist } | { number: number; published: false; checklist: Checklist }>> {
  const d = await draftOf(ideaId, editionId)
  if (!d.ok) return fail((d as { error: string }).error)
  const e = (await loadEdition(editionId))!
  const list = checklistOf(e)
  if (checklistCount(list) && !anyway) return { ok: true, data: { number: e.number, published: false, checklist: list } }
  const rec: PublishedChecklist = { ...list, publishedAnyway: checklistCount(list) > 0, at: new Date().toISOString() }
  const n = await prisma.scrutinyEdition.updateMany({ where: { id: editionId, ideaId, status: 'DRAFT' }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedBy: userId, checklist: rec as unknown as object } })
  if (n.count !== 1) return fail(`${editionName(e.number)} was published a moment ago by another tab. Nothing more was changed.`)
  return { ok: true, data: { number: e.number, published: true, checklist: rec } }
}
