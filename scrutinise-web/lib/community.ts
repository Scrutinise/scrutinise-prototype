import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Default bulletin-board category set, in display order (Stage 1.1, agreed
 * 6 Aug 2026 after the Stage 1 user test). "Announcements" was removed.
 *
 * Seeded onto `Community.bulletinCategories` at creation so a per-Community
 * set exists from day one; there is deliberately NO admin category-management
 * UI at this stage — defaults only.
 */
export const DEFAULT_BULLETIN_CATEGORIES = [
  'Canvassing',
  'Building Members',
  'Public Debates',
  'Training',
  'Running Councils',
  'Questions',
] as const

/**
 * One-line prompts shown under the category picker. "Training" carries its
 * description because it IS the Stage 2c training-marketplace workaround
 * (docs/SCRUTINISE_CENTRAL_SPEC.md §6) — the wording is what makes people use
 * it for that without being told.
 */
export const BULLETIN_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Canvassing: 'Doorstep and street campaigning — plans, patches, what worked.',
  'Building Members': 'Recruiting and keeping members.',
  'Public Debates': 'Hustings, panels and public argument.',
  Training: 'Offer or request interview/media training here.',
  'Running Councils': 'Running a council group, motions and local administration.',
  Questions: 'Anything else — ask the Community.',
}

/** Post reach, set by the composer's "Post to" selector. */
export const BULLETIN_SCOPES = ['BRANCH', 'COMMUNITY'] as const
export type BulletinScope = (typeof BULLETIN_SCOPES)[number]

/** Category set for a Community, falling back to the defaults if unseeded. */
export function categoriesFor(community: { bulletinCategories: string[] }): string[] {
  return community.bulletinCategories.length > 0
    ? community.bulletinCategories
    : [...DEFAULT_BULLETIN_CATEGORIES]
}

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

/** Ancestor chain for a node, nearest parent first (excludes the node itself). */
export async function getAncestorIds(communityId: string): Promise<string[]> {
  const ids: string[] = []
  let cursor = await prisma.community.findUnique({
    where: { id: communityId },
    select: { parentCommunityId: true },
  })
  // Depth is small at Central scale, and the guard stops a cycle from hanging
  // the request if a parent pointer is ever corrupted.
  let guard = 0
  while (cursor?.parentCommunityId && guard++ < 50) {
    const parentId: string = cursor.parentCommunityId
    ids.push(parentId)
    cursor = await prisma.community.findUnique({
      where: { id: parentId },
      select: { parentCommunityId: true },
    })
  }
  return ids
}

/** Root of the Community tree this node belongs to (itself, if top-level). */
export async function getRootCommunityId(communityId: string): Promise<string> {
  const ancestors = await getAncestorIds(communityId)
  return ancestors.length > 0 ? ancestors[ancestors.length - 1] : communityId
}

/** Every node id in the Community tree containing `communityId`, root included. */
export async function getCommunityTreeIds(communityId: string): Promise<string[]> {
  const rootId = await getRootCommunityId(communityId)
  const ids = [rootId]
  let frontier = [rootId]
  let guard = 0
  while (frontier.length > 0 && guard++ < 50) {
    const children = await prisma.community.findMany({
      where: { parentCommunityId: { in: frontier } },
      select: { id: true },
    })
    frontier = children.map((c) => c.id)
    ids.push(...frontier)
  }
  return ids
}

/**
 * The `where` a board at `communityId` renders: its own posts, plus every
 * Community-wide post from anywhere in the same tree (Stage 1.1 display rule —
 * without this a whole-Community post would only ever be seen at the node it
 * was written on, and the "Post to" option would be pointless).
 */
export async function getBoardScopeFilter(communityId: string): Promise<Prisma.BulletinPostWhereInput> {
  const treeIds = await getCommunityTreeIds(communityId)
  return {
    OR: [
      { communityId },
      { communityId: { in: treeIds }, scope: 'COMMUNITY' },
    ],
  }
}

/**
 * Resolves a post id against a board, honouring the Community-wide rule: a
 * post is reachable from board X if it lives on X, or if it is a
 * Community-wide post from anywhere in X's tree. Used by the detail, vote and
 * reply routes so that a Community-wide thread is not merely *displayed* on a
 * branch board but actually votable and repliable from it.
 */
export async function findBoardPost(
  postId: string,
  boardCommunityId: string,
  opts: { rootOnly?: boolean } = {},
) {
  const scope = await getBoardScopeFilter(boardCommunityId)
  return prisma.bulletinPost.findFirst({
    where: {
      AND: [{ id: postId }, scope, ...(opts.rootOnly ? [{ parentId: null }] : [])],
    },
    select: { id: true, communityId: true, title: true, authorId: true, scope: true },
  })
}

/**
 * True if the caller may administer `communityId`: OWNER/ADMIN on the node
 * itself, or on any ancestor of it. Hierarchy admin is what makes the Teams &
 * branches tree usable — the per-node add-branch / rename / assign-manager
 * buttons are otherwise dead on every node the caller didn't personally
 * create. This widens MANAGEMENT only; board and member visibility still
 * require a membership row on the node in question.
 */
export async function canManageCommunity(userId: string, communityId: string): Promise<boolean> {
  const scopeIds = [communityId, ...(await getAncestorIds(communityId))]
  const admin = await prisma.communityMember.findFirst({
    where: { userId, communityId: { in: scopeIds }, role: { in: ADMIN_ROLES } },
    select: { id: true },
  })
  return admin !== null
}

/** Hierarchy-aware guard for the admin routes. Mirrors requireCommunityRole's
 *  404-not-403 rule for a caller with no standing anywhere in the tree. */
export async function requireCommunityAdmin(
  userId: string,
  communityId: string,
): Promise<NextResponse | null> {
  if (await canManageCommunity(userId, communityId)) return null
  const membership = await getCommunityMembership(userId, communityId)
  return membership
    ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/** Unread bulletin-post count for a member: posts/replies since their lastReadAt. */
export async function countUnreadBulletin(communityId: string, lastReadAt: Date): Promise<number> {
  const scope = await getBoardScopeFilter(communityId)
  return prisma.bulletinPost.count({
    where: { ...scope, createdAt: { gt: lastReadAt } },
  })
}

/**
 * Cast (or change, or withdraw) a vote on a bulletin post or reply, keeping the
 * cached `score` in step. Voting the same value twice withdraws it.
 *
 * Lives here rather than inline in the route so it can be exercised directly by
 * scripts/check-central-stage1.ts — the route is unreachable from a script
 * (Clerk session), and a test that re-implements the transaction would prove
 * nothing about what actually runs.
 */
export async function applyBulletinVote(
  postId: string,
  userId: string,
  value: 1 | -1,
): Promise<{ score: number; myVote: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.bulletinVote.findUnique({
      where: { postId_userId: { postId, userId } },
    })

    if (existing && existing.value === value) {
      await tx.bulletinVote.delete({ where: { id: existing.id } })
      await tx.bulletinPost.update({ where: { id: postId }, data: { score: { decrement: value } } })
      return { myVote: 0 }
    }

    if (existing) {
      await tx.bulletinVote.update({ where: { id: existing.id }, data: { value } })
      await tx.bulletinPost.update({
        where: { id: postId },
        data: { score: { increment: value - existing.value } },
      })
      return { myVote: value }
    }

    await tx.bulletinVote.create({ data: { postId, userId, value } })
    await tx.bulletinPost.update({ where: { id: postId }, data: { score: { increment: value } } })
    return { myVote: value }
  })

  const updated = await prisma.bulletinPost.findUniqueOrThrow({
    where: { id: postId },
    select: { score: true },
  })

  return { score: updated.score, myVote: result.myVote }
}

/** A pragmatic address shape check — enough to decide whether to offer
 *  "invite this address anyway", not a deliverability test. */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type InviteCandidate = { id: string; name: string | null; username: string; isMember: boolean }

/**
 * Person lookup for the Community invite panel: an EXACT email match
 * (case-insensitive) OR a name/username substring.
 *
 * Email is never matched as a substring — that would let anyone enumerate
 * accounts by typing a common domain fragment — and is never returned.
 * `canInviteEmail` carries the address back when the query is a well-formed
 * address that matches nobody, so the caller can offer a real invite instead of
 * an empty list (the 6 Aug 2026 test's silent failure).
 */
export async function lookupInviteCandidates(
  communityId: string,
  term: string,
): Promise<{ users: InviteCandidate[]; canInviteEmail: string | null }> {
  const users = await prisma.user.findMany({
    where: {
      isHistoricalAccount: false,
      status: 'ACTIVE',
      OR: [
        { email: { equals: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, username: true },
    take: 8,
  })

  const existing = await prisma.communityMember.findMany({
    where: { communityId, userId: { in: users.map((u) => u.id) } },
    select: { userId: true },
  })
  const memberIds = new Set(existing.map((m) => m.userId))

  return {
    users: users.map((u) => ({ ...u, isMember: memberIds.has(u.id) })),
    canInviteEmail: EMAIL_SHAPE.test(term) && users.length === 0 ? term : null,
  }
}

export type CommunityTreeMember = { userId: string; name: string | null; username: string; role: CommunityRole }

export type CommunityTreeNode = {
  id: string
  name: string
  depth: number
  managerId: string | null
  managerName: string | null
  memberCount: number
  /** Members of THIS node — the assign-manager options for it. */
  members: CommunityTreeMember[]
  children: CommunityTreeNode[]
}

/**
 * Full branch subtree rooted at communityId, for the "Teams & branches"
 * expandable-tree region. Community counts are small at Stage 1 scale, so a
 * plain recursive fetch (no CTE) is fine.
 */
export async function getCommunityTree(communityId: string, depth = 0): Promise<CommunityTreeNode> {
  const node = await prisma.community.findUniqueOrThrow({
    where: { id: communityId },
    include: {
      manager: { select: { name: true } },
      children: { select: { id: true }, orderBy: { createdAt: 'asc' } },
      members: {
        include: { user: { select: { name: true, username: true } } },
        orderBy: { joinedAt: 'asc' },
      },
      _count: { select: { members: true } },
    },
  })

  const children = await Promise.all(node.children.map((c) => getCommunityTree(c.id, depth + 1)))

  return {
    id: node.id,
    name: node.name,
    depth,
    managerId: node.managerId,
    managerName: node.manager?.name ?? null,
    memberCount: node._count.members,
    members: node.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      username: m.user.username,
      role: m.role as CommunityRole,
    })),
    children,
  }
}
