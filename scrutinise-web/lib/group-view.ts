/**
 * CENTRAL 25-C §1h/§1i — THE CORRECTION SURFACE, server half.
 *
 * ⚠⚠ CHARLIE'S MODEL DEPENDS ON THIS, NOT ON THE GATES. He has chosen
 * monitoring over locking the doors: a group member who manages no branch is
 * not forbidden, it is an ANOMALY — somebody who was invited at top level and
 * never did the thing top-level invitation is for. The gates cannot catch that,
 * because it is not a rule violation. Only a list somebody actually reads can.
 *
 * So the bar here is higher than "the data is available": it has to surface the
 * anomaly WITHOUT HUNTING (§1h), which is why `managesAnyBranch` is a computed
 * column the view sorts on rather than something a reader infers by scanning a
 * branches column for blanks.
 *
 * ⚠⚠ THE TYPES AND THE SORT LIVE IN `lib/group-view-types.ts`, WHICH IMPORTS
 * NOTHING. They were carved out because the client component imported the sort
 * from here, and this file imports `prisma` — which put the Postgres driver in
 * the browser bundle and broke every Vercel deploy. **This module is
 * server-only.** A client component must import from `group-view-types` and
 * receive the data as props.
 *
 * ⚠ Everything here is a plain read. No writes, no side effects, nothing that
 * arranges the state it then reports (docs/CLAUDE.md §26).
 */
import { prisma } from '@/lib/prisma'
import { getCommunityTreeIds, getRootCommunityId } from '@/lib/community'
import type {
  GroupLevelMember,
  GroupLevelView,
  MembershipTierName,
  VacantBranch,
} from '@/lib/group-view-types'

// Re-exported so server callers and the check have one import site.
export {
  GROUP_SORTS,
  GROUP_SORT_LABEL,
  sortGroupMembers,
  type GroupLevelMember,
  type GroupLevelView,
  type GroupSort,
  type VacantBranch,
} from '@/lib/group-view-types'

/**
 * Everyone at group level, with the four facts §1h asks for and the anomaly
 * flag, plus §1i's vacant branches in the same view.
 *
 * ⚠ ONE PASS OVER THE TREE, not a query per person. The membership rows for the
 * whole Community are small and the alternative is a query storm on a list that
 * is meant to be opened often.
 *
 * ⚠ RETURNS PLAIN SERIALISABLE DATA — `joinedAt` is an ISO string, not a
 * `Date`. The page hands this straight to a client component as props.
 */
export async function getGroupLevelView(communityId: string): Promise<GroupLevelView> {
  const rootId = await getRootCommunityId(communityId)
  const treeIds = await getCommunityTreeIds(rootId)

  const [root, rootRows, branchRows, branches, nominations] = await Promise.all([
    prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { name: true } }),
    prisma.communityMember.findMany({
      where: { communityId: rootId },
      include: {
        user: { select: { id: true, name: true, username: true } },
        invitedBy: { select: { name: true, username: true } },
        invitedVia: { select: { community: { select: { name: true } } } },
      },
    }),
    prisma.communityMember.findMany({
      where: { communityId: { in: treeIds.filter((id) => id !== rootId) } },
      select: {
        userId: true,
        role: true,
        communityId: true,
        community: { select: { id: true, name: true } },
      },
    }),
    prisma.community.findMany({
      where: { id: { in: treeIds }, parentCommunityId: { not: null }, deletedAt: null },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    prisma.branchOwnerNomination.findMany({
      where: { communityId: { in: treeIds }, status: 'PENDING' },
      select: {
        id: true,
        communityId: true,
        nominee: { select: { name: true, username: true } },
      },
    }),
  ])

  const managedByUser = new Map<string, { id: string; name: string }[]>()
  const memberOfCount = new Map<string, number>()
  for (const r of branchRows) {
    memberOfCount.set(r.userId, (memberOfCount.get(r.userId) ?? 0) + 1)
    if (r.role === 'OWNER' || r.role === 'ADMIN') {
      const list = managedByUser.get(r.userId) ?? []
      list.push({ id: r.community.id, name: r.community.name })
      managedByUser.set(r.userId, list)
    }
  }

  const members: GroupLevelMember[] = rootRows
    .map((m) => {
      const managesBranches = managedByUser.get(m.userId) ?? []
      return {
        userId: m.userId,
        name: m.user.name ?? m.user.username,
        username: m.user.username,
        tier: m.tier as MembershipTierName,
        role: m.role as 'OWNER' | 'ADMIN' | 'MEMBER',
        joinedAt: m.joinedAt.toISOString(),
        invitedByName: m.invitedBy?.name ?? m.invitedBy?.username ?? null,
        invitedViaNodeName: m.invitedVia?.community.name ?? null,
        acceptedOnBehalf: m.acceptedOnBehalfAt !== null,
        managesBranches,
        managesAnyBranch: managesBranches.length > 0,
        memberOfBranchCount: memberOfCount.get(m.userId) ?? 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const ownedBranchIds = new Set(
    branchRows.filter((r) => r.role === 'OWNER').map((r) => r.communityId),
  )
  const nominationByBranch = new Map(nominations.map((n) => [n.communityId, n]))

  const vacantBranches: VacantBranch[] = branches
    .filter((b) => !ownedBranchIds.has(b.id))
    .map((b) => {
      const nom = nominationByBranch.get(b.id)
      return {
        id: b.id,
        name: b.name,
        memberCount: b._count.members,
        pendingNomineeName: nom ? (nom.nominee.name ?? nom.nominee.username) : null,
        pendingNominationId: nom?.id ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    rootId,
    rootName: root.name,
    members,
    vacantBranches,
    groupMembersManagingNoBranch: members.filter(
      (m) => m.tier === 'GROUP' && !m.managesAnyBranch && m.role === 'MEMBER',
    ).length,
  }
}
