// LEX 26-AC part (a) — WHO MAY READ A SCRUTINY EDITION. Server only.
//
// Part (a): the idea's owner reads every edition of it (a draft as "Preview as a reviewer"); the team (EDITOR and VIEWER collaborators,
// who see the workspace anyway, 372) read the published ones. Reviewers are invited in part (b) and get their own grant, never a
// collaborator row (LEX_26AC_REPORT finding 1), so nothing here admits them yet.
// ⚠ One answer for "does not exist" and "may not read": the page says the same words for both, so an edition id reveals nothing.

import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ideaAccessOf, type IdeaAccess } from './authz'
import { loadEdition, type LoadedEdition } from './scrutiny-edition'

export type ReaderAccess = { ok: true; edition: LoadedEdition; access: IdeaAccess; userId: string } | { ok: false; signedIn: boolean }

/** PURE — may this access read an edition in this state? */
export function mayRead(access: IdeaAccess | null, status: 'DRAFT' | 'PUBLISHED'): boolean {
  if (!access) return false
  if (access === 'owner') return true
  return status === 'PUBLISHED'
}

export async function readerAccess(editionId: string): Promise<ReaderAccess> {
  const { user } = await getAuthenticatedUser()
  return readerAccessFor(user ? { id: user.id } : null, editionId)
}

/** The same, for a user already read (null = signed out). */
export async function readerAccessFor(user: { id: string } | null, editionId: string): Promise<ReaderAccess> {
  if (!user) return { ok: false, signedIn: false }
  const edition = await loadEdition(editionId)
  if (!edition) return { ok: false, signedIn: true }
  const idea = await prisma.idea.findUnique({ where: { id: edition.ideaId }, select: { creatorId: true, deletedAt: true, collaborators: { select: { userId: true, role: true } } } })
  if (!idea || idea.deletedAt) return { ok: false, signedIn: true }
  const access = ideaAccessOf(user.id, idea.creatorId, idea.collaborators)
  if (!mayRead(access, edition.status)) return { ok: false, signedIn: true }
  return { ok: true, edition, access: access!, userId: user.id }
}
