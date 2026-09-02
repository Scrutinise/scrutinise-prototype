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
import {
  CommunityRuleError,
  canManageCommunity,
  getAncestorIds,
  getRootCommunityId,
  removeMember,
} from '@/lib/community'
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

// ──────────────────────────────────────────────────────────────────────────────
// CENTRAL 25-B §5 / decision 44 — BRANCH OWNERSHIP IS TRANSFERABLE AND VACATABLE.
//
// ⚠⚠ THE GOVERNING PRINCIPLE, IN CHARLIE'S WORDS: who the branch manager is sits
// OUTSIDE this system. It is a matter for the party. The product reflects that
// reality; it does not decide it, and it does not require the person's consent
// to record it (decision 50).
//
// ⚠⚠ WHAT WAS ACTUALLY WRONG, AND §8h GOT IT HALF RIGHT. It reported this as
// unbuildable because `removeMember` and `setMemberRole` refuse to touch an
// OWNER. The refusals were never the problem:
//
//   · a Community has NO owner column — ownership is one CommunityMember row
//     with role OWNER, with no constraint that a node has one;
//   · a vacant branch is ALREADY a representable state: canManageCommunity walks
//     ancestors, so the Community's owner and admins still manage it, still
//     decide its join requests and can still delete it;
//   · but ONLY TWO code paths in the whole application ever wrote OWNER —
//     creating a Community and creating a branch. **Nothing could make an
//     existing member the owner of anything.** Ownership was granted once, at
//     creation, and never again, so a branch chair who left, went quiet or was
//     removed could never be replaced.
//
// ⚠ THE TWO GUARDS STAY. `setMemberRole` and `removeMember` still refuse an
// OWNER, and `check:central` still asserts that they do. Relaxing them would
// make a node takeable by any co-admin, which is exactly what they are for.
// These are deliberate, separately-named acts instead.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The audit trail for both acts.
 *
 * ⚠ `ActivityLog`, deliberately, and not a new table: its only reader filters on
 * `ideaId` AND `accessType: 'ADMIN_ACCESS'`, so a row with neither is invisible
 * to it. A first-class table would be cleaner and would cost a migration; if one
 * is ever added, these rows are the backfill.
 */
async function recordOwnershipEvent(params: {
  actorUserId: string
  subjectUserId: string
  communityId: string
  kind: 'VACATED' | 'APPOINTED'
  reason: string
  communityName: string
}) {
  await prisma.activityLog.create({
    data: {
      userId: params.actorUserId,
      activityType: `BRANCH_OWNERSHIP_${params.kind}`,
      entityType: 'Community',
      entityId: params.communityId,
      description:
        params.kind === 'VACATED'
          ? `Branch manager of “${params.communityName}” stood down or was stood down — ${params.reason}`
          : `Appointed branch manager of “${params.communityName}” — ${params.reason}`,
      metadata: { subjectUserId: params.subjectUserId, reason: params.reason },
    },
  })
}

/** A node whose ownership may move: a branch, never the Community itself. */
async function requireBranch(communityId: string) {
  const node = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, parentCommunityId: true, deletedAt: true },
  })
  if (!node || node.deletedAt) throw new CommunityRuleError('Not found', 404)
  // ⚠ THE ROOT IS NOT VACATABLE. A Community with no owner would leave
  // `inviteRightFor`'s "the owner always holds the right" with nobody, and there
  // is no one above the root to manage it. Handing over a whole Community is a
  // different act and is not built.
  if (!node.parentCommunityId) {
    throw new CommunityRuleError(
      'The Community itself cannot be left without an owner — this is for branches.',
      409,
    )
  }
  return node
}

/**
 * Stand a branch manager down. The branch is NOT deleted and does NOT change
 * hands: the position becomes vacant and stays vacant until somebody is
 * appointed (§5b). They remain an ordinary member of the branch (§5a).
 *
 * ⚠ A REASON IS REQUIRED (decision 51). A vacancy with no recorded reason later
 * reads as a bug rather than a decision — and branch chairs are accountable, so
 * why one was stood down is part of that record.
 */
export async function vacateBranchOwnership(params: {
  communityId: string
  actorUserId: string
  reason: string
}): Promise<{ vacatedUserId: string }> {
  const node = await requireBranch(params.communityId)

  const reason = params.reason?.trim()
  if (!reason) {
    throw new CommunityRuleError('Say why the branch manager is standing down', 422)
  }

  const owner = await prisma.communityMember.findFirst({
    where: { communityId: node.id, role: 'OWNER' },
    select: { userId: true },
  })
  if (!owner) throw new CommunityRuleError('This branch has no manager to stand down', 409)

  // ⚠ DECISION 50 — an admin may do this WITHOUT the person's agreement. The
  // product records what the party has decided; it does not adjudicate it. The
  // person themselves may also stand down, which is the same act.
  const isSelf = owner.userId === params.actorUserId
  if (!isSelf && !(await canManageCommunity(params.actorUserId, node.id))) {
    throw new CommunityRuleError('You cannot change who manages this branch', 403)
  }

  await prisma.$transaction([
    prisma.communityMember.update({
      where: { communityId_userId: { communityId: node.id, userId: owner.userId } },
      data: { role: 'MEMBER' },
    }),
    // The manager pointer is informational and must not outlive the role.
    prisma.community.updateMany({
      where: { id: node.id, managerId: owner.userId },
      data: { managerId: null },
    }),
  ])

  await recordOwnershipEvent({
    actorUserId: params.actorUserId,
    subjectUserId: owner.userId,
    communityId: node.id,
    kind: 'VACATED',
    reason,
    communityName: node.name,
  })

  if (!isSelf) {
    await prisma.notification.create({
      data: {
        userId: owner.userId,
        type: 'SYSTEM',
        title: 'You are no longer the branch manager',
        message: `${node.name} — ${reason}. You are still a member of the branch.`,
        linkUrl: `/communities/${node.id}`,
      },
    })
  }

  return { vacatedUserId: owner.userId }
}

/**
 * Appoint a branch manager. Works whether the position is vacant or held.
 *
 * ⚠ THE INCUMBENT IS DEMOTED IN THE SAME TRANSACTION. Nothing in the schema
 * forbids two OWNER rows on one node, and several reads would show both — a
 * promotion that is not also a demotion silently creates that state.
 */
export async function appointBranchOwner(params: {
  communityId: string
  targetUserId: string
  actorUserId: string
  reason: string
}): Promise<{ replacedUserId: string | null }> {
  const node = await requireBranch(params.communityId)

  const reason = params.reason?.trim()
  if (!reason) throw new CommunityRuleError('Say why they are being appointed', 422)

  if (!(await canManageCommunity(params.actorUserId, node.id))) {
    throw new CommunityRuleError('You cannot change who manages this branch', 403)
  }

  const target = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: node.id, userId: params.targetUserId } },
    select: { role: true },
  })
  // ⚠ A branch manager has to be IN the branch. Appointing somebody who is not
  // a member would create a manager the members list does not show.
  if (!target) {
    throw new CommunityRuleError('They have to be a member of the branch first', 409)
  }
  if (target.role === 'OWNER') {
    throw new CommunityRuleError('They already manage this branch', 409)
  }

  const incumbent = await prisma.communityMember.findFirst({
    where: { communityId: node.id, role: 'OWNER' },
    select: { userId: true },
  })

  await prisma.$transaction([
    ...(incumbent
      ? [
          prisma.communityMember.update({
            where: { communityId_userId: { communityId: node.id, userId: incumbent.userId } },
            data: { role: 'MEMBER' },
          }),
        ]
      : []),
    prisma.communityMember.update({
      where: { communityId_userId: { communityId: node.id, userId: params.targetUserId } },
      data: { role: 'OWNER' },
    }),
    prisma.community.updateMany({
      where: { id: node.id },
      data: { managerId: params.targetUserId },
    }),
  ])

  if (incumbent) {
    await recordOwnershipEvent({
      actorUserId: params.actorUserId,
      subjectUserId: incumbent.userId,
      communityId: node.id,
      kind: 'VACATED',
      reason: `replaced — ${reason}`,
      communityName: node.name,
    })
  }
  await recordOwnershipEvent({
    actorUserId: params.actorUserId,
    subjectUserId: params.targetUserId,
    communityId: node.id,
    kind: 'APPOINTED',
    reason,
    communityName: node.name,
  })

  await prisma.notification.create({
    data: {
      userId: params.targetUserId,
      type: 'SYSTEM',
      title: 'You are now the branch manager',
      message: `${node.name} — ${reason}`,
      linkUrl: `/communities/${node.id}`,
    },
  })

  return { replacedUserId: incumbent?.userId ?? null }
}

/** Is this branch without a manager? §5d's action item, and §5b's representable state. */
export async function branchIsVacant(communityId: string): Promise<boolean> {
  const owner = await prisma.communityMember.findFirst({
    where: { communityId, role: 'OWNER' },
    select: { id: true },
  })
  return owner === null
}
