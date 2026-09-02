/**
 * CENTRAL 25-A §3 — who may invite, what a link arrival does, and what removal
 * leaves behind. Charlie's decisions of 1 September 2026.
 *
 * These live beside `lib/community.ts` rather than inside it because they are
 * the three rules 25-A changed, and a check that wants to prove them should be
 * able to import exactly those three.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAncestorIds, getRootCommunityId, removeMember } from '@/lib/community'
import {
  DEFAULT_INVITE_RIGHTS,
  parseInviteRights,
  type InviteRightRole,
} from '@/lib/invite-rights'

const ADMIN_ROLES = ['OWNER', 'ADMIN'] as const

/** The rights an owner has granted, read from the ROOT — settings are root-only. */
export async function getInviteRights(communityId: string): Promise<InviteRightRole[]> {
  const rootId = await getRootCommunityId(communityId)
  const settings = await prisma.communitySettings.findUnique({
    where: { communityId: rootId },
    select: { inviteRights: true },
  })
  // ⚠ NO SETTINGS ROW IS NOT NO RIGHTS. Most Communities have never opened the
  // settings page, and reading an absent row as an empty list would silently
  // stop everyone but the owner from inviting.
  if (!settings) return DEFAULT_INVITE_RIGHTS
  return parseInviteRights(settings.inviteRights)
}

export type InviteRightReason =
  | 'OWNER'
  | 'COMMUNITY_ADMIN'
  | 'BRANCH_MANAGER'
  /** CENTRAL 25-A §7e — a title this Community defined, carrying the right. */
  | 'TITLE'
  | 'NOT_GRANTED'
  | 'NO_STANDING'

/**
 * May this person invite people to this node — and why?
 *
 * The reason is returned, not just the verdict, because "you are not an admin
 * here" and "admins here are not allowed to invite" are different sentences and
 * an owner narrowing the setting needs to see which one they caused.
 *
 * ⚠ §3d — SCOPE. A branch manager's right reaches their own branch and the
 * branches under it, and no further: it is derived from an OWNER/ADMIN row on
 * this node or an ancestor of it, and a branch manager holds no such row on the
 * root or on a sibling branch. A COMMUNITY_ADMIN's reaches the whole tree.
 */
export async function inviteRightFor(
  userId: string,
  communityId: string,
): Promise<{ allowed: boolean; reason: InviteRightReason }> {
  const rootId = await getRootCommunityId(communityId)
  const rights = await getInviteRights(communityId)

  const scopeIds = [communityId, ...(await getAncestorIds(communityId))]

  // ⚠⚠ CENTRAL 25-A §7e — A TITLE IS CHECKED FIRST, AND IT IS NOT A ROLE.
  // A Community may give somebody the right to invite by titling them, without
  // making them an admin of anything and without touching `User.role`, which
  // governs the PLATFORM and is never written by any of this. The title has to
  // be held on this node or one above it, exactly like a role, so "rights only
  // within it" means what it says.
  const titled = await prisma.communityMember.findFirst({
    where: {
      userId,
      communityId: { in: scopeIds },
      title: { grantsInvite: true },
    },
    select: { id: true },
  })
  if (titled) return { allowed: true, reason: 'TITLE' }

  const rows = await prisma.communityMember.findMany({
    where: { userId, communityId: { in: scopeIds }, role: { in: [...ADMIN_ROLES] } },
    select: { communityId: true, role: true },
  })
  if (rows.length === 0) return { allowed: false, reason: 'NO_STANDING' }

  // The owner of the Community always holds the right.
  if (rows.some((r) => r.communityId === rootId && r.role === 'OWNER')) {
    return { allowed: true, reason: 'OWNER' }
  }
  // So does the owner of the branch being invited to — they own this node.
  if (rows.some((r) => r.communityId === communityId && r.role === 'OWNER')) {
    if (rights.includes('BRANCH_MANAGER') || communityId === rootId) {
      return { allowed: true, reason: communityId === rootId ? 'OWNER' : 'BRANCH_MANAGER' }
    }
    return { allowed: false, reason: 'NOT_GRANTED' }
  }

  const isCommunityAdmin = rows.some((r) => r.communityId === rootId)
  if (isCommunityAdmin) {
    return rights.includes('COMMUNITY_ADMIN')
      ? { allowed: true, reason: 'COMMUNITY_ADMIN' }
      : { allowed: false, reason: 'NOT_GRANTED' }
  }

  // Everything left is an OWNER/ADMIN row on this branch or one above it.
  return rights.includes('BRANCH_MANAGER')
    ? { allowed: true, reason: 'BRANCH_MANAGER' }
    : { allowed: false, reason: 'NOT_GRANTED' }
}

export async function canInvite(userId: string, communityId: string): Promise<boolean> {
  return (await inviteRightFor(userId, communityId)).allowed
}

/** Route guard. 404 for someone with no standing at all, so a tree's shape is not leaked. */
export async function requireInviteRight(
  userId: string,
  communityId: string,
): Promise<NextResponse | null> {
  const { allowed, reason } = await inviteRightFor(userId, communityId)
  if (allowed) return null
  if (reason === 'NO_STANDING') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(
    {
      error:
        'The owner of this Community has not given your role the right to invite people. Ask them to change it in Community settings.',
    },
    { status: 403 },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// §3b — arriving through a link asks; it does not join.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Someone opened a shared invite link and pressed Join.
 *
 * ⚠ NOBODY JOINS ON CLICK. This writes a PENDING request naming the link they
 * came through, and returns it. Membership is created only by
 * `decideJoinRequest`, by somebody who holds the invitation right.
 *
 * It deliberately does NOT go through `createJoinRequest`: that one is the
 * "ask from inside the Community to join a branch" path and refuses on the root
 * and for non-members, which is exactly who arrives on a link.
 */
export async function requestJoinViaInvite(
  userId: string,
  invite: { id: string; communityId: string },
): Promise<{ requestId: string; alreadyPending: boolean }> {
  const existing = await prisma.communityJoinRequest.findFirst({
    where: { communityId: invite.communityId, userId, status: 'PENDING' },
  })
  if (existing) return { requestId: existing.id, alreadyPending: true }

  const created = await prisma.communityJoinRequest.create({
    data: { communityId: invite.communityId, userId, inviteId: invite.id },
    select: { id: true },
  })
  return { requestId: created.id, alreadyPending: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// §3c — removal archives the membership; the contributions stay.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove somebody from a node, keeping the record of their having been in it.
 *
 * ⚠ WHAT THIS DOES NOT TOUCH, DELIBERATELY: their bulletin posts, questions,
 * answers, resources, activity and ideas. A removed member loses ACCESS; their
 * own writing stays where it is, attributed to them. Archiving hides somebody
 * from the product without un-giving them their own words.
 */
export async function archiveMembership(
  communityId: string,
  targetUserId: string,
  removedByUserId: string,
  reason?: string,
): Promise<{ archiveId: string }> {
  // ⚠ ONE IMPLEMENTATION. `removeMember` is where removal has always lived and
  // is what the other checks drive; it archives as of 25-A §3c. This is the
  // named entry point, not a second copy of the rule.
  return removeMember(communityId, targetUserId, removedByUserId, reason)
}

/** Everyone who was removed from this node, most recent first. */
export async function listArchivedMemberships(communityId: string) {
  const rows = await prisma.communityMembershipArchive.findMany({
    where: { communityId },
    orderBy: { removedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, username: true } },
      removedBy: { select: { name: true, username: true } },
      invitedByArchived: { select: { name: true, username: true } },
    },
  })
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    username: r.user.username,
    role: r.role,
    joinedAt: r.joinedAt,
    removedAt: r.removedAt,
    removedByName: r.removedBy?.name ?? r.removedBy?.username ?? null,
    reason: r.reason,
    // §7h — who brought them in, still readable after they have gone.
    invitedByName: r.invitedByArchived?.name ?? r.invitedByArchived?.username ?? null,
  }))
}
