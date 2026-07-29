import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Stage 1 default bulletin categories — "Training — offers & requests" is the
// Stage 2c training-marketplace workaround (docs/SCRUTINISE_CENTRAL_SPEC.md §3
// "Explicitly NOT in Stage 1"): seeded here so the behaviour can start as
// ordinary posts before the structured marketplace exists.
export const BULLETIN_CATEGORIES = [
  'General',
  'Announcements',
  'Training — offers & requests',
  'Questions',
] as const

export type CommunityRole = 'OWNER' | 'ADMIN' | 'MEMBER'
const ADMIN_ROLES: CommunityRole[] = ['OWNER', 'ADMIN']

/** Membership row for (userId, communityId), or null if not a member. */
export async function getCommunityMembership(userId: string, communityId: string) {
  return prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  })
}

/**
 * Loads the membership and returns a 403/404 NextResponse if the caller isn't
 * at least the given role — 404 (not 403) when the caller isn't a member at
 * all, so membership itself isn't leaked to non-members.
 */
export async function requireCommunityRole(
  userId: string,
  communityId: string,
  roles: CommunityRole[] = ADMIN_ROLES,
): Promise<{ error: NextResponse; membership: null } | { error: null; membership: NonNullable<Awaited<ReturnType<typeof getCommunityMembership>>> }> {
  const membership = await getCommunityMembership(userId, communityId)
  if (!membership) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), membership: null }
  }
  if (!roles.includes(membership.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), membership: null }
  }
  return { error: null, membership }
}

/** Unread bulletin-post count for a member: posts/replies since their lastReadAt. */
export async function countUnreadBulletin(communityId: string, lastReadAt: Date): Promise<number> {
  return prisma.bulletinPost.count({
    where: { communityId, createdAt: { gt: lastReadAt } },
  })
}

export type CommunityTreeNode = {
  id: string
  name: string
  managerId: string | null
  managerName: string | null
  memberCount: number
  children: CommunityTreeNode[]
}

/**
 * Full branch subtree rooted at communityId, for the "Teams & branches"
 * expandable-tree region. Community counts are small at Stage 1 scale, so a
 * plain recursive fetch (no CTE) is fine.
 */
export async function getCommunityTree(communityId: string): Promise<CommunityTreeNode> {
  const node = await prisma.community.findUniqueOrThrow({
    where: { id: communityId },
    include: {
      manager: { select: { name: true } },
      children: { select: { id: true } },
      _count: { select: { members: true } },
    },
  })

  const children = await Promise.all(node.children.map((c) => getCommunityTree(c.id)))

  return {
    id: node.id,
    name: node.name,
    managerId: node.managerId,
    managerName: node.manager?.name ?? null,
    memberCount: node._count.members,
    children,
  }
}
