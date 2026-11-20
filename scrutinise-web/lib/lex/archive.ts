// ─────────────────────────────────────────────────────────────────────────────
// 26-AA item 1 (decisions 183/196) — THE LAST HARD DELETES OF USER CONTENT BECOME ARCHIVE WITH RESTORE.
//
// Five paths, one shape. "Remove" stamps the row (archivedAt + archivedById + archiveReason) and keeps it; `lib/prisma.ts` then hides it
// from every direct read. "Restore" clears the stamp. The row's own status is never touched by either, so an ACCEPTED finding comes back
// ACCEPTED, and a policy keeps its number (every number writer reads archived rows: `INCLUDING_ARCHIVED`).
//
//   A1 PolicyOption           removePolicyOption / restorePolicyOption  (lib/lex/field-machine.ts — it owns the chosen-approach field)
//   A2 IdeaNote               archiveNote / restoreNote                 (private: always keyed on ideaId AND userId)
//   A3 CoherentActionSection  archiveLawLink / restoreLawLink           (always scoped to an action on THIS idea — the A3 security fix)
//   A4 EvidenceItem           archiveSourceFindings / restoreSourceFindings  (with the filed source)
//   B  IdeaGroup              ungroupArchive / restoreGroup             (My Ideas "Ungroup")
//
// ⚠ Excepted by Charlie's decision 320: cost lines stay deletable (`remove_cost_line`). Not here, on purpose.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { USER_MATERIAL_PASS_PREFIX } from '@/lib/lex/heading-map'

export const ARCHIVE_REASON = {
  /** The owner pressed "Remove (can be restored)", or asked Lex to. */
  REMOVED: 'REMOVED',
  /** EvidenceItem only: its filed source was archived. Restoring the source restores exactly these. */
  SOURCE_ARCHIVED: 'SOURCE_ARCHIVED',
  /** IdeaGroup only: "Ungroup". */
  UNGROUPED: 'UNGROUPED',
} as const
export type ArchiveReason = (typeof ARCHIVE_REASON)[keyof typeof ARCHIVE_REASON]

export const archiveStamp = (byId: string | null, reason: ArchiveReason) => ({ archivedAt: new Date(), archivedById: byId, archiveReason: reason })
export const ARCHIVE_CLEARED = { archivedAt: null, archivedById: null, archiveReason: null } as const
/** The where-clause half that finds archived rows (and, by naming `archivedAt`, gets past the live-only filter). */
export const ARCHIVED = { archivedAt: { not: null } } as const

// ── A2 · private notes ──────────────────────────────────────────────────────

/** ⚠ Keyed on (ideaId, userId) like every other note query: a collaborator cannot remove, see or restore the owner's notes. */
export async function archiveNote(ideaId: string, userId: string, noteId: string): Promise<boolean> {
  const r = await prisma.ideaNote.updateMany({ where: { id: noteId, ideaId, userId }, data: archiveStamp(userId, ARCHIVE_REASON.REMOVED) })
  return r.count === 1
}

export async function restoreNote(ideaId: string, userId: string, noteId: string): Promise<boolean> {
  const r = await prisma.ideaNote.updateMany({ where: { id: noteId, ideaId, userId, ...ARCHIVED }, data: ARCHIVE_CLEARED })
  return r.count === 1
}

export async function listArchivedNotes(ideaId: string, userId: string) {
  const rows = await prisma.ideaNote.findMany({
    where: { ideaId, userId, ...ARCHIVED }, orderBy: { archivedAt: 'desc' },
    select: { id: true, title: true, body: true, archivedAt: true },
  })
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body.slice(0, 160), archivedAt: r.archivedAt!.toISOString() }))
}

// ── A3 · law links ──────────────────────────────────────────────────────────

/** ⚠ The row must hang off an action on THIS idea (26-AA A3): owning some idea is not owning this link. */
export async function archiveLawLink(ideaId: string, linkId: string, byId: string): Promise<boolean> {
  const r = await prisma.coherentActionSection.updateMany({
    where: { id: linkId, coherentAction: { ideaId } }, data: archiveStamp(byId, ARCHIVE_REASON.REMOVED),
  })
  return r.count === 1
}

export async function restoreLawLink(ideaId: string, linkId: string): Promise<boolean> {
  const r = await prisma.coherentActionSection.updateMany({ where: { id: linkId, coherentAction: { ideaId }, ...ARCHIVED }, data: ARCHIVE_CLEARED })
  return r.count === 1
}

// ── A4 · a filed source's findings ─────────────────────────────────────────

const materialPass = (materialId: string) => `${USER_MATERIAL_PASS_PREFIX}${materialId}`

/** The write that archives a source's findings with it: returned unawaited so the caller puts it in the same transaction as the source. */
export function archiveSourceFindings(ideaId: string, materialId: string, byId: string | null) {
  return prisma.evidenceItem.updateMany({
    where: { ideaId, passKey: materialPass(materialId) }, data: archiveStamp(byId, ARCHIVE_REASON.SOURCE_ARCHIVED),
  })
}

/** Restores exactly the findings that went with the source (SOURCE_ARCHIVED), each with its own status. Returns how many. */
export async function restoreSourceFindings(ideaId: string, materialId: string): Promise<number> {
  const r = await prisma.evidenceItem.updateMany({
    where: { ideaId, passKey: materialPass(materialId), archiveReason: ARCHIVE_REASON.SOURCE_ARCHIVED, ...ARCHIVED }, data: ARCHIVE_CLEARED,
  })
  return r.count
}

// ── B · My Ideas groups ─────────────────────────────────────────────────────

/** "Ungroup": the ideas return to the ungrouped list, as before; the group is kept, with the ideas it held. */
export async function ungroupArchive(ownerId: string, groupId: string): Promise<boolean> {
  const group = await prisma.ideaGroup.findFirst({ where: { id: groupId, ownerId }, select: { id: true } })
  if (!group) return false
  const members = await prisma.idea.findMany({ where: { groupId }, select: { id: true } })
  // ⚠ IDEAS FIRST, THEN THE GROUP — in one transaction, so a crash between the two cannot leave ideas pointing at an archived group.
  await prisma.$transaction([
    prisma.idea.updateMany({ where: { groupId }, data: { groupId: null } }),
    prisma.ideaGroup.update({
      where: { id: groupId },
      data: { ...archiveStamp(ownerId, ARCHIVE_REASON.UNGROUPED), archivedIdeaIds: members.map((m) => m.id) },
    }),
  ])
  return true
}

/** Restore: the group comes back, and so does every idea it held that is still the owner's, still undeleted and still ungrouped. An
 *  idea filed in another group since is left where it is, and counted, so the screen can say so. */
export async function restoreGroup(ownerId: string, groupId: string): Promise<
  { ok: false } | { ok: true; group: { id: string; name: string; hidden: boolean }; returnedIdeaIds: string[]; leftWhereTheyAre: number }
> {
  const group = await prisma.ideaGroup.findFirst({
    where: { id: groupId, ownerId, ...ARCHIVED }, select: { id: true, name: true, hidden: true, archivedIdeaIds: true },
  })
  if (!group) return { ok: false }
  const back = { id: { in: group.archivedIdeaIds }, creatorId: ownerId, deletedAt: null, groupId: null }
  const returning = (await prisma.idea.findMany({ where: back, select: { id: true } })).map((i) => i.id)
  await prisma.$transaction([
    prisma.idea.updateMany({ where: { ...back, id: { in: returning } }, data: { groupId } }),
    prisma.ideaGroup.update({ where: { id: groupId }, data: { ...ARCHIVE_CLEARED, archivedIdeaIds: [] } }),
  ])
  return {
    ok: true, group: { id: group.id, name: group.name, hidden: group.hidden },
    returnedIdeaIds: returning, leftWhereTheyAre: group.archivedIdeaIds.length - returning.length,
  }
}

export async function listArchivedGroups(ownerId: string) {
  const rows = await prisma.ideaGroup.findMany({
    where: { ownerId, archiveReason: ARCHIVE_REASON.UNGROUPED, ...ARCHIVED }, orderBy: { archivedAt: 'desc' },
    select: { id: true, name: true, archivedAt: true, archivedIdeaIds: true },
  })
  return rows.map((r) => ({ id: r.id, name: r.name, archivedAt: r.archivedAt!.toISOString(), ideaCount: r.archivedIdeaIds.length }))
}
