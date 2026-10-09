// ─────────────────────────────────────────────────────────────────────────────
// 26-R — THE RESEARCH NOTEBOOK. A quote, a source and a comment; author, status and a private layer from the first row.
//
// THE RULES THIS FILE ENFORCES (BRIEF_26R §6 and §8 — they are in the data layer so no route or tool can forget them):
//   · A NOTE CITES A REGISTRY SOURCE. Always. A thought with no document behind it cites "my own observation", which is itself
//     an entry (so even that has a number). Nothing enters a document without one.
//   · NOBODY EDITS ANOTHER PERSON'S COMMENT. The author edits it; everyone else replies beneath it. A note keeps the arc of one
//     person's thinking, and the discussion sits alongside.
//   · STATUS FOLLOWS THE AUTHOR: the idea owner's own notes are IN_RECORD; anyone else's arrive UNREVIEWED. Only IN_RECORD reaches a
//     document (sprint 2 makes that the filter; sprint 1 records it).
//   · NOTHING DELETES. A note is SET_ASIDE with a reason — "the reason is itself research" — and can be brought back.
//   · "MINE ONLY": a note is invisible to everyone else until its author shares it.
//   · LEX'S FINDINGS ARE IN THE SAME NOTEBOOK, LABELLED LEX'S, and read-only here (they are `EvidenceItem` rows; the notebook
//     does not copy or mutate them). The default view is the user's own notes; Lex's are a toggle away (decision 129).
// ⚠ EVERY failure returns a sentence naming what was refused and why (CLAUDE.md §30).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import {
  syncRegistry, addSource, ownObservationSource, listRegistry, refIndex, urlKey, type RegistrySource,
} from './source-registry'
import { normalise, MAX_TEXT_CHARS, runMaterialFindings } from './user-material'
import type { NotebookRequest, Stance, NoteStatus, BearsOnRef } from './research-notebook-schema'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
const fail = <T = never>(error: string): Result<T> => ({ ok: false, error })
/** Re-wrap a failed Result for a different success type (this package is strict: false, so !r.ok does not narrow a union). */
const bad = <T = never>(r: { ok: boolean }): Result<T> => fail<T>((r as unknown as { error: string }).error)

export interface Viewer { id: string; isOwner: boolean }

export interface ReplyView { id: string; authorId: string; authorName: string; text: string; createdAt: string }
export interface NoteView {
  id: string
  /** `lex:<evidenceId>` for a Lex finding. */
  lex: boolean
  source: RegistrySource | null
  sourceId: string | null
  quote: string | null
  quoteLocation: string | null
  comment: string | null
  stance: Stance
  bearsOn: BearsOnRef[]
  tags: string[]
  heading: string | null
  importance: number | null
  authorId: string
  authorName: string
  authorKind: 'USER' | 'LEX'
  status: NoteStatus
  setAsideReason: string | null
  mineOnly: boolean
  /** Written by the person looking. */
  mine: boolean
  createdAt: string
  replies: ReplyView[]
}

const displayName = (u: { preferredName: string | null; name: string | null } | undefined) => u?.preferredName?.trim() || u?.name?.trim() || 'A team member'

export function canSeeNote(note: { mineOnly: boolean; authorId: string }, viewerId: string): boolean {
  return !note.mineOnly || note.authorId === viewerId
}

export async function readNotebook(ideaId: string, viewer: Viewer, opts: { includeLex?: boolean; includeSetAside?: boolean } = {}): Promise<{
  notes: NoteView[]; sources: RegistrySource[]; lexCount: number; ownCount: number; setAsideCount: number
}> {
  // Reading the notebook is a user-facing surface where numbers must exist, so the registry is synced here (idempotent).
  await syncRegistry(ideaId)
  const [rows, sources, evidence] = await Promise.all([
    prisma.researchNote.findMany({ where: { ideaId }, include: { replies: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } }),
    listRegistry(ideaId, { includeArchived: true }),
    opts.includeLex
      ? prisma.evidenceItem.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true, body: true, kind: true, sourceId: true, url: true, citation: true, createdAt: true, status: true } })
      : Promise.resolve([]),
  ])
  const visible = rows.filter((n) => canSeeNote(n, viewer.id))
  const userIds = [...new Set([...visible.map((n) => n.authorId), ...visible.flatMap((n) => n.replies.map((r) => r.authorId))])]
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, preferredName: true, name: true } })
  const nameOf = new Map(users.map((u) => [u.id, displayName(u)]))
  const byId = new Map(sources.map((s) => [s.id, s]))

  const notes: NoteView[] = visible.map((n) => ({
    id: n.id, lex: false, source: byId.get(n.sourceId) ?? null, sourceId: n.sourceId, quote: n.quote, quoteLocation: n.quoteLocation, comment: n.comment,
    stance: n.stance as Stance, bearsOn: (Array.isArray(n.bearsOn) ? n.bearsOn : []) as unknown as BearsOnRef[], tags: n.tags, heading: n.heading, importance: n.importance,
    authorId: n.authorId, authorName: nameOf.get(n.authorId) ?? 'A team member', authorKind: n.authorKind === 'LEX' ? 'LEX' : 'USER',
    status: n.status as NoteStatus, setAsideReason: n.setAsideReason, mineOnly: n.mineOnly, mine: n.authorId === viewer.id, createdAt: n.createdAt.toISOString(),
    replies: n.replies.map((r) => ({ id: r.id, authorId: r.authorId, authorName: nameOf.get(r.authorId) ?? 'A team member', text: r.text, createdAt: r.createdAt.toISOString() })),
  }))

  if (opts.includeLex) {
    const idx = await refIndex(ideaId)
    const bySourceNumber = new Map(sources.map((s) => [s.number, s]))
    for (const e of evidence) {
      const num = (e.sourceId ? idx.byCorpusKey.get(e.sourceId) ?? idx.byMaterialId.get(e.sourceId) : undefined) ?? (e.url ? idx.byUrlKey.get(urlKey(e.url)) : undefined)
      notes.push({
        id: `lex:${e.id}`, lex: true, source: num ? bySourceNumber.get(num) ?? null : null, sourceId: num ? bySourceNumber.get(num)?.id ?? null : null,
        quote: null, quoteLocation: null, comment: `${e.title}\n\n${e.body}`.trim(),
        stance: e.kind === 'SUPPORTS' ? 'SUPPORTS' : e.kind === 'CONTRADICTS' ? 'CONTRADICTS' : e.kind === 'FINDING' ? 'CONTEXT' : 'UNDECIDED',
        bearsOn: [], tags: [], heading: null, importance: null, authorId: 'lex', authorName: 'Lex', authorKind: 'LEX',
        status: e.status === 'REJECTED' ? 'SET_ASIDE' : 'IN_RECORD', setAsideReason: e.status === 'REJECTED' ? 'rejected on the research panel' : null,
        mineOnly: false, mine: false, createdAt: e.createdAt.toISOString(), replies: [],
      })
    }
  }
  const own = notes.filter((n) => !n.lex)
  const shown = opts.includeSetAside ? notes : notes.filter((n) => n.status !== 'SET_ASIDE')
  return { notes: shown, sources, lexCount: notes.filter((n) => n.lex).length, ownCount: own.length, setAsideCount: own.filter((n) => n.status === 'SET_ASIDE').length }
}

/**
 * What a note can BEAR ON — the idea's own causes, policies, actions, challenges and decisions, each with the words the screen uses
 * for it. Read-only. Ruled-out / archived rows are left out (a note bears on what is live); numbers are the screen's own.
 */
export async function bearsOnOptions(ideaId: string): Promise<BearsOnRef[]> {
  const [causes, policies, actions, issues, forks] = await Promise.all([
    prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: [{ number: 'asc' }], select: { id: true, number: true, cause: true } }),
    prisma.policyOption.findMany({ where: { ideaId, status: { not: 'RULED_OUT' }, kind: 'GUIDING_POLICY' }, orderBy: [{ number: 'asc' }], select: { id: true, number: true, approach: true } }),
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, orderBy: [{ number: 'asc' }], select: { id: true, number: true, title: true, practicalStep: true } }),
    prisma.deepeningIssue.findMany({ where: { ideaId, status: 'OPEN' }, orderBy: [{ createdAt: 'asc' }], take: 60, select: { id: true, title: true, text: true } }),
    prisma.buildFork.findMany({ where: { ideaId, resolved: false }, distinct: ['forkKey'], select: { id: true, forkKey: true, chosen: true } }),
  ])
  const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
  return [
    ...causes.map((c): BearsOnRef => ({ kind: 'cause', id: c.id, label: `Cause ${c.number ?? '?'}: ${clip(c.cause)}` })),
    ...policies.map((p): BearsOnRef => ({ kind: 'policy', id: p.id, label: `Policy ${p.number ?? '?'}: ${clip(p.approach)}` })),
    ...actions.map((a): BearsOnRef => ({ kind: 'action', id: a.id, label: `Action ${a.number ?? '?'}: ${clip(a.title?.trim() || a.practicalStep)}` })),
    ...issues.map((i): BearsOnRef => ({ kind: 'challenge', id: i.id, label: `Challenge: ${clip(i.title?.trim() || i.text)}` })),
    ...forks.map((f): BearsOnRef => ({ kind: 'decision', id: f.id, label: `Decision: ${clip(f.chosen)}` })),
  ]
}

// ── writing ────────────────────────────────────────────────────────────────────────────────────────────────

type Add = Extract<NotebookRequest, { op: 'addNote' }>

/** The registry source a new note will cite. Exactly one of the three ways of naming it. */
async function resolveSource(ideaId: string, userId: string, input: Add, opts: { readIntoFindings: boolean }): Promise<Result<RegistrySource>> {
  const ways = [input.sourceId ? 1 : 0, input.newSource ? 1 : 0, input.ownObservation ? 1 : 0].reduce((a, b) => a + b, 0)
  if (ways !== 1) {
    return fail(ways === 0
      ? 'Every note needs a source: pick one from the list, add a new one, or choose “my own observation”. Nothing was saved.'
      : 'A note can cite only one source: you chose more than one of “pick one”, “add a new one” and “my own observation”. Nothing was saved.')
  }
  if (input.sourceId) {
    const row = await prisma.ideaSource.findFirst({ where: { id: input.sourceId, ideaId } })
    if (!row) return fail('That source is not on this idea’s list, so the note was not saved. Pick another, or add it as a new source.')
    const all = await listRegistry(ideaId, { includeArchived: true })
    return { ok: true, data: all.find((s) => s.id === row.id)! }
  }
  if (input.ownObservation) return { ok: true, data: await ownObservationSource(ideaId, userId) }

  const ns = input.newSource!
  if (ns.fullText && ns.fullText.trim()) {
    // §25.6 — filing a document is an assertion that the user may share it. Never defaulted to true on their behalf.
    if (!ns.rightsConfirmed) return fail('To keep the text of a document, tick “I may share this” — it is your assertion that you are allowed to. Nothing was saved. (You can still save a quote with the address alone.)')
    // A pasted document / fetched page: kept as the source's text and READ INTO FINDINGS as uploads are, so Lex has it too.
    const text = normalise(ns.fullText).slice(0, MAX_TEXT_CHARS)
    const material = await prisma.ideaUserMaterial.create({
      data: {
        ideaId, kind: ns.url ? 'LINK' : 'FILE', status: 'READY', label: ns.title.slice(0, 300), filename: ns.url ? null : 'Added as research', mimeType: ns.url ? null : 'text/plain',
        url: ns.url ?? null, text, charCount: text.length, sourceBytes: Buffer.byteLength(ns.fullText, 'utf8'), rightsConfirmed: true /* asserted above */, addedBy: userId,
      },
      select: { id: true },
    })
    await syncRegistry(ideaId)
    const reg = await prisma.ideaSource.findFirst({ where: { ideaId, materialId: material.id } })
    if (reg) {
      await prisma.ideaSource.update({ where: { id: reg.id }, data: { author: ns.author ?? null, publishedAt: ns.publishedAt ?? null } })
      if (opts.readIntoFindings) { try { await runMaterialFindings(material.id) } catch (err) { console.error('[research-notes] findings pass failed', err instanceof Error ? err.message : err) } }
      const all = await listRegistry(ideaId, { includeArchived: true })
      return { ok: true, data: all.find((s) => s.id === reg.id)! }
    }
  }
  const made = await addSource(ideaId, userId, {
    kind: ns.kind, title: ns.title, url: ns.url ?? null, author: ns.author ?? null, publishedAt: ns.publishedAt ?? null, sourceType: ns.sourceType ?? null,
    readStatus: ns.readStatus ?? (ns.kind === 'OWN_OBSERVATION' ? 'READ' : 'NOT_READ'),
    readNote: ns.readNote ?? (ns.kind === 'URL' && !ns.readStatus ? 'the address was saved; the page itself was not read' : null),
  })
  return { ok: true, data: made.source }
}

export async function addNote(ideaId: string, user: { id: string }, viewer: Viewer, input: Add, opts: { readIntoFindings?: boolean; authorKind?: 'USER' | 'LEX' } = {}): Promise<Result<{ noteId: string | null; sourceId: string; ref: number; status: NoteStatus }>> {
  const quote = input.quote?.trim() || null
  const comment = input.comment?.trim() || null
  // DECISION 133 — everything but the source is optional, so a file, a link or some text on its own is a valid thing to add: it
  // becomes a numbered source with no note written. What cannot be saved is nothing at all.
  if (!quote && !comment && !input.newSource) {
    return fail('There is nothing to save: add a quote or a comment, or give a new source (a file, a link or some text). Nothing was saved.')
  }
  const src = await resolveSource(ideaId, user.id, input, { readIntoFindings: opts.readIntoFindings ?? true })
  if (!src.ok) return bad(src)
  // A note LEX wrote (at the user's instruction) is never in the record until the owner puts it there: the record is what reaches
  // the documents, and Lex's drafting is a proposal until someone has read it. A person's own note by the owner is the record.
  const authorKind = opts.authorKind ?? 'USER'
  const status: NoteStatus = authorKind === 'LEX' ? 'UNREVIEWED' : viewer.isOwner ? 'IN_RECORD' : 'UNREVIEWED'
  if (!quote && !comment) return { ok: true, data: { noteId: null, sourceId: src.data.id, ref: src.data.number, status } }
  const row = await prisma.researchNote.create({
    data: {
      ideaId, sourceId: src.data.id, quote, quoteLocation: input.quoteLocation?.trim() || null, comment,
      stance: input.stance ?? 'UNDECIDED', bearsOn: (input.bearsOn ?? []) as never, tags: dedupe(input.tags ?? []), heading: input.heading?.trim() || null,
      importance: input.importance ?? null, authorId: user.id, authorKind, status, mineOnly: input.mineOnly ?? false,
    },
    select: { id: true },
  })
  return { ok: true, data: { noteId: row.id, sourceId: src.data.id, ref: src.data.number, status } }
}

/** Tags are the same tag whatever the case (\Ownership\ = \ownership\): the first spelling given is kept. */
const dedupe = (a: string[]) => { const seen = new Set<string>(); const out: string[] = []; for (const t of a.map((x) => x.trim()).filter(Boolean)) { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t) } } return out }

async function loadMany(ideaId: string, noteIds: string[], viewer: Viewer & { userId?: string }): Promise<Result<Array<NonNullable<Awaited<ReturnType<typeof prisma.researchNote.findFirst>>>>>> {
  const rows = await prisma.researchNote.findMany({ where: { ideaId, id: { in: noteIds } } })
  const seen = rows.filter((n) => canSeeNote(n, viewer.id))
  const missing = noteIds.length - seen.length
  if (missing > 0) return fail(`${missing} of the ${noteIds.length} selected note${noteIds.length === 1 ? '' : 's'} could not be found on this idea (or ${missing === 1 ? 'is' : 'are'} another person’s private note). Nothing was changed.`)
  return { ok: true, data: seen }
}

/** Author or the idea's owner. */
function mayHandle(n: { authorId: string }, viewer: Viewer): boolean { return n.authorId === viewer.id || viewer.isOwner }

export async function updateNote(ideaId: string, viewer: Viewer, input: Extract<NotebookRequest, { op: 'updateNote' }>): Promise<Result<{ noteId: string }>> {
  const l = await loadMany(ideaId, [input.noteId], viewer)
  if (!l.ok) return bad(l)
  const n = l.data[0]
  if (!mayHandle(n, viewer)) return fail('Only the person who wrote a note, or the idea’s owner, can change it. You can reply beneath it instead. Nothing was changed.')
  if (input.comment !== undefined && input.comment !== n.comment && n.authorId !== viewer.id) {
    return fail('That comment is someone else’s words, and nobody edits another person’s comment. Reply beneath it instead. Nothing was changed.')
  }
  const data: Record<string, unknown> = {}
  if (input.quote !== undefined) data.quote = input.quote?.trim() || null
  if (input.quoteLocation !== undefined) data.quoteLocation = input.quoteLocation?.trim() || null
  if (input.comment !== undefined) data.comment = input.comment?.trim() || null
  if (input.stance) data.stance = input.stance
  if (input.bearsOn) data.bearsOn = input.bearsOn
  if (input.tags) data.tags = dedupe(input.tags)
  if (input.heading !== undefined) data.heading = input.heading?.trim() || null
  if (input.importance !== undefined) data.importance = input.importance
  if (!Object.keys(data).length) return fail('Nothing was given to change.')
  const nextQuote = ('quote' in data ? data.quote : n.quote) as string | null
  const nextComment = ('comment' in data ? data.comment : n.comment) as string | null
  if (!nextQuote && !nextComment) return fail('A note needs a quote or a comment; this change would have left it with neither. Nothing was changed.')
  await prisma.researchNote.update({ where: { id: n.id }, data: data as never })
  return { ok: true, data: { noteId: n.id } }
}

async function bulk(ideaId: string, viewer: Viewer, noteIds: string[], what: string, apply: (ids: string[]) => Promise<unknown>): Promise<Result<{ changed: number }>> {
  const l = await loadMany(ideaId, noteIds, viewer)
  if (!l.ok) return bad(l)
  const blocked = l.data.filter((n) => !mayHandle(n, viewer))
  if (blocked.length) return fail(`${what}: ${blocked.length} of the selected notes are someone else’s, and only their author or the idea’s owner can change them. Nothing was changed.`)
  await apply(l.data.map((n) => n.id))
  return { ok: true, data: { changed: l.data.length } }
}

export const setStance = (ideaId: string, viewer: Viewer, noteIds: string[], stance: Stance) =>
  bulk(ideaId, viewer, noteIds, 'Setting the stance', (ids) => prisma.researchNote.updateMany({ where: { ideaId, id: { in: ids } }, data: { stance } }))
export const setHeading = (ideaId: string, viewer: Viewer, noteIds: string[], heading: string | null) =>
  bulk(ideaId, viewer, noteIds, 'Setting the heading', (ids) => prisma.researchNote.updateMany({ where: { ideaId, id: { in: ids } }, data: { heading: heading?.trim() || null } }))
export async function addTags(ideaId: string, viewer: Viewer, noteIds: string[], tags: string[]) {
  return bulk(ideaId, viewer, noteIds, 'Adding the tags', async (ids) => {
    const rows = await prisma.researchNote.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true } })
    for (const r of rows) await prisma.researchNote.update({ where: { id: r.id }, data: { tags: dedupe([...r.tags, ...tags]) } })
  })
}
export const setAside = (ideaId: string, viewer: Viewer, userId: string, noteIds: string[], reason: string) =>
  bulk(ideaId, viewer, noteIds, 'Setting aside', (ids) => prisma.researchNote.updateMany({
    where: { ideaId, id: { in: ids } }, data: { status: 'SET_ASIDE', setAsideReason: reason.trim(), setAsideBy: userId, setAsideAt: new Date() },
  }))
/** Restoring returns a note to where its author's standing puts it: the owner's own to IN_RECORD, anyone else's to UNREVIEWED. */
export async function restore(ideaId: string, viewer: Viewer, ownerId: string, noteIds: string[]) {
  return bulk(ideaId, viewer, noteIds, 'Bringing back', async (ids) => {
    const rows = await prisma.researchNote.findMany({ where: { id: { in: ids } }, select: { id: true, authorId: true } })
    for (const r of rows) await prisma.researchNote.update({ where: { id: r.id }, data: { status: r.authorId === ownerId ? 'IN_RECORD' : 'UNREVIEWED', setAsideReason: null, setAsideBy: null, setAsideAt: null } })
  })
}

/** Owner only. Moves UNREVIEWED notes into the record (sprint 2 adds triage controls and the digest around this same act). */
export async function putInRecord(ideaId: string, viewer: Viewer, noteIds: string[]): Promise<Result<{ changed: number }>> {
  if (!viewer.isOwner) return fail('Only the idea’s owner can put a note in the record — it is what lets a note reach the documents. Nothing was changed.')
  const l = await loadMany(ideaId, noteIds, viewer)
  if (!l.ok) return bad(l)
  const r = await prisma.researchNote.updateMany({ where: { ideaId, id: { in: l.data.map((n) => n.id) }, status: 'UNREVIEWED' }, data: { status: 'IN_RECORD' } })
  return { ok: true, data: { changed: r.count } }
}

export async function reply(ideaId: string, viewer: Viewer, noteId: string, text: string): Promise<Result<{ replyId: string }>> {
  const l = await loadMany(ideaId, [noteId], viewer)
  if (!l.ok) return bad(l)
  const row = await prisma.researchNoteReply.create({ data: { noteId, authorId: viewer.id, text: text.trim() }, select: { id: true } })
  return { ok: true, data: { replyId: row.id } }
}

/** Author only — a private note is the author's to share, and the owner cannot make someone else's note visible. */
async function ownOnly(ideaId: string, viewer: Viewer, noteIds: string[], mineOnly: boolean): Promise<Result<{ changed: number }>> {
  const l = await loadMany(ideaId, noteIds, viewer)
  if (!l.ok) return bad(l)
  const notMine = l.data.filter((n) => n.authorId !== viewer.id)
  if (notMine.length) return fail(`${notMine.length} of the selected notes are not yours, and only a note’s author can ${mineOnly ? 'make it private' : 'share it'}. Nothing was changed.`)
  await prisma.researchNote.updateMany({ where: { ideaId, id: { in: l.data.map((n) => n.id) } }, data: { mineOnly } })
  return { ok: true, data: { changed: l.data.length } }
}
export const share = (ideaId: string, viewer: Viewer, noteIds: string[]) => ownOnly(ideaId, viewer, noteIds, false)
export const makeMineOnly = (ideaId: string, viewer: Viewer, noteIds: string[]) => ownOnly(ideaId, viewer, noteIds, true)
