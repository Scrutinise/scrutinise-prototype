/**
 * CENTRAL 25-C §1h/§1i — THE CORRECTION SURFACE.
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
 * ⚠ Everything here is a plain read. No writes, no side effects, nothing that
 * arranges the state it then reports (docs/CLAUDE.md §26).
 */
import { prisma } from '@/lib/prisma'
import { getCommunityTreeIds, getRootCommunityId } from '@/lib/community'
import type { MembershipTier } from '@/lib/membership-tier'

export type GroupLevelMember = {
  userId: string
  name: string
  username: string
  /** Their tier on the ROOT membership — the one that governs. */
  tier: MembershipTier
  /** Their role on the ROOT node. */
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  joinedAt: Date
  /** §1h — who invited them. Null for somebody who arrived of their own accord. */
  invitedByName: string | null
  /** Which node the invitation they came through belonged to, where there was one. */
  invitedViaNodeName: string | null
  /** 25-A §7c/§7j — they never clicked anything; we accepted for them. */
  acceptedOnBehalf: boolean
  /** §1h — which branches they manage, by name. */
  managesBranches: { id: string; name: string }[]
  /** §1h — THE ANOMALY COLUMN. A group member with this false is the thing to look at. */
  managesAnyBranch: boolean
  /** Which branches they are merely a member of. */
  memberOfBranchCount: number
}

export type VacantBranch = {
  id: string
  name: string
  memberCount: number
  /** §2i — a nomination waiting on a decision, which is the action to take. */
  pendingNomineeName: string | null
  pendingNominationId: string | null
}

export type GroupLevelView = {
  rootId: string
  rootName: string
  members: GroupLevelMember[]
  vacantBranches: VacantBranch[]
  /** §1h — the count the view exists to make visible, computed once, server-side. */
  groupMembersManagingNoBranch: number
}

/**
 * Everyone at group level, with the four facts §1h asks for and the anomaly
 * flag, plus §1i's vacant branches in the same view.
 *
 * ⚠ ONE PASS OVER THE TREE, not a query per person. The membership rows for the
 * whole Community are small and the alternative is a query storm on a list that
 * is meant to be opened often.
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
        tier: m.tier as MembershipTier,
        role: m.role as 'OWNER' | 'ADMIN' | 'MEMBER',
        joinedAt: m.joinedAt,
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

// ─────────────────────────────────────────────────────────────────────────────
// The sort. ⚠ A SHARED FUNCTION, NOT A COPY IN THE COMPONENT (docs/CLAUDE.md
// §26.5): the check imports this and sorts the same rows the panel sorts, so a
// change to the ordering cannot pass a check that still holds the old rule.
// ─────────────────────────────────────────────────────────────────────────────

export const GROUP_SORTS = ['anomaly', 'name', 'joined', 'invitedBy', 'branches'] as const
export type GroupSort = (typeof GROUP_SORTS)[number]

export const GROUP_SORT_LABEL: Record<GroupSort, string> = {
  anomaly: 'Managing no branch first',
  name: 'Name',
  joined: 'Joined (newest first)',
  invitedBy: 'Who invited them',
  branches: 'Most branches managed',
}

/**
 * ⚠ `anomaly` IS THE DEFAULT AND THAT IS THE POINT OF §1h. The list opens on
 * the people Charlie is watching for — group members managing no branch — and
 * he does not have to know to sort for them.
 */
export function sortGroupMembers(rows: GroupLevelMember[], sort: GroupSort): GroupLevelMember[] {
  const out = [...rows]
  switch (sort) {
    case 'anomaly':
      return out.sort(
        (a, b) =>
          Number(a.tier !== 'GROUP') - Number(b.tier !== 'GROUP') ||
          Number(a.managesAnyBranch) - Number(b.managesAnyBranch) ||
          a.name.localeCompare(b.name),
      )
    case 'joined':
      return out.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
    case 'invitedBy':
      return out.sort(
        (a, b) =>
          (a.invitedByName ?? '￿').localeCompare(b.invitedByName ?? '￿') ||
          a.name.localeCompare(b.name),
      )
    case 'branches':
      return out.sort(
        (a, b) => b.managesBranches.length - a.managesBranches.length || a.name.localeCompare(b.name),
      )
    case 'name':
    default:
      return out.sort((a, b) => a.name.localeCompare(b.name))
  }
}
