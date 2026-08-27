import { prisma } from '@/lib/prisma'
import { CommunityRuleError, canManageCommunity, getCommunityMembership, getRootCommunityId } from '@/lib/community'
import { reverseContentPoints, restoreContentPoints } from '@/lib/content-deletion'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL item 11 — delete and restore a branch (27 Aug 2026).
//
// Layered on the content pattern deliberately: the same three columns, the same
// cascade marker on what goes down with it, the same points rule, the same
// deleted-items view. A reader who understands one understands this.
//
// THREE REFUSALS, each for its own reason:
//
//   · THE ROOT IS NEVER DELETABLE. A Community without its root is not a
//     recoverable state — every question, tag and membership hangs off it — and
//     "delete the Community" is not a feature anybody asked for.
//   · A BRANCH WITH LIVE CHILDREN IS REFUSED. Delete bottom-up. A recursive
//     cascade would make one press remove an arbitrary depth of structure, and
//     the confirmation dialog could not honestly say what it was about to do.
//   · SOMEBODY WITHOUT RIGHTS IS REFUSED. The branch OWNER, or anyone with
//     manage rights above it, which already cascades from every ancestor.
//
// ⚠ MEMBERSHIPS ARE NOT RESTORED, AND THAT IS THE ONE ASYMMETRY IN THE WHOLE
// PATTERN. Deleting a branch removes people from it; restoring brings back the
// branch and its content, and people rejoin. Restoring memberships would put
// somebody back into a group they may have been glad to leave, silently. The
// confirmation dialog says so in as many words — see `describeBranchDeletion`,
// which exists so the dialog cannot drift from what the code does.
// ─────────────────────────────────────────────────────────────────────────────

export type BranchDeletionPreview = {
  branchId: string
  branchName: string
  /** Non-empty means the delete will be refused; each entry is a live child. */
  blockingChildren: string[]
  isRoot: boolean
  memberCount: number
  /** Members who are ONLY in this branch keep their root membership regardless —
   *  this counts the branch rows that will go. */
  questionCount: number
  postCount: number
  pointsAtRisk: number
}

/**
 * Exactly what deleting this branch would do, in numbers.
 *
 * ⚠ THE DIALOG READS THIS, IT DOES NOT COUNT FOR ITSELF. A confirmation that
 * says "3 members and 12 items" while the delete touches something else is worse
 * than no confirmation, because it is trusted.
 */
export async function describeBranchDeletion(branchId: string): Promise<BranchDeletionPreview> {
  const branch = await prisma.community.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, parentCommunityId: true, deletedAt: true },
  })
  if (!branch) throw new CommunityRuleError('Branch not found', 404)

  const children = await prisma.community.findMany({
    where: { parentCommunityId: branchId, deletedAt: null },
    select: { name: true },
  })

  const [memberCount, questions, posts] = await Promise.all([
    prisma.communityMember.count({ where: { communityId: branchId } }),
    prisma.question.findMany({
      where: { branchId, scope: 'BRANCH', deletedAt: null },
      select: { id: true },
    }),
    prisma.bulletinPost.findMany({
      where: { communityId: branchId, scope: 'BRANCH', deletedAt: null },
      select: { id: true },
    }),
  ])

  // Points at risk: what the content under this branch has actually earned,
  // read from the ledger rather than re-priced.
  const answers = await prisma.answer.findMany({
    where: { questionId: { in: questions.map((q) => q.id) }, deletedAt: null },
    select: { id: true },
  })
  const sourced = await prisma.pointsEvent.groupBy({
    by: ['sourceId'],
    where: {
      OR: [
        { sourceType: 'ANSWER_VOTE', sourceId: { in: answers.map((a) => a.id) } },
        { sourceType: 'BULLETIN_MARK', sourceId: { in: posts.map((p) => p.id) } },
      ],
    },
    _sum: { points: true },
  })
  const pointsAtRisk = sourced.reduce((s, r) => s + (r._sum.points ?? 0), 0)

  return {
    branchId: branch.id,
    branchName: branch.name,
    blockingChildren: children.map((c) => c.name),
    isRoot: branch.parentCommunityId === null,
    memberCount,
    questionCount: questions.length,
    postCount: posts.length,
    pointsAtRisk,
  }
}

async function assertMayDeleteBranch(branchId: string, actorUserId: string) {
  const branch = await prisma.community.findUnique({
    where: { id: branchId },
    select: { parentCommunityId: true, deletedAt: true },
  })
  if (!branch) throw new CommunityRuleError('Branch not found', 404)
  if (branch.parentCommunityId === null) {
    throw new CommunityRuleError(
      'The Community itself cannot be deleted — only branches within it',
      403,
    )
  }
  if (branch.deletedAt) throw new CommunityRuleError('That branch is already deleted', 409)

  const children = await prisma.community.findMany({
    where: { parentCommunityId: branchId, deletedAt: null },
    select: { name: true },
  })
  if (children.length) {
    throw new CommunityRuleError(
      `Delete its ${children.length} branch${children.length === 1 ? '' : 'es'} first — ` +
        `${children.map((c) => c.name).join(', ')}. Branches come down from the bottom up.`,
      409,
    )
  }

  // The branch OWNER, or manage rights from anywhere above it.
  const membership = await getCommunityMembership(actorUserId, branchId)
  if (membership?.role === 'OWNER') return
  if (!(await canManageCommunity(actorUserId, branchId))) {
    throw new CommunityRuleError('You cannot delete this branch', 403)
  }
}

export type BranchDeletionResult = {
  branchId: string
  membershipsRemoved: number
  questionsDeleted: number
  postsDeleted: number
  pointsReversed: number
}

/**
 * Delete a branch: its members leave it (and keep their root membership), its
 * branch-scoped content goes down marked as collateral, and the points that
 * content earned come back off.
 *
 * ⚠ BRANCH-SCOPED ONLY. A question written on this branch but posted to the
 * whole Community (`scope: 'COMMUNITY'`) belongs to the Community, not the
 * branch, and stays. Taking it would delete something the author addressed to
 * everybody because of where they happened to be standing when they wrote it.
 */
export async function deleteBranch(params: {
  branchId: string
  actorUserId: string
  reason?: string
}): Promise<BranchDeletionResult> {
  const { branchId, actorUserId } = params
  await assertMayDeleteBranch(branchId, actorUserId)

  const branch = await prisma.community.findUniqueOrThrow({
    where: { id: branchId },
    select: { id: true, name: true, parentCommunityId: true },
  })
  const rootId = branch.parentCommunityId!
  const now = new Date()
  const reason = params.reason?.trim() || null

  // ── the content, and its points ──────────────────────────────────────────
  const questions = await prisma.question.findMany({
    where: { branchId, scope: 'BRANCH', deletedAt: null },
    select: { id: true, communityId: true, answers: { where: { deletedAt: null }, select: { id: true, authorId: true } } },
  })
  const posts = await prisma.bulletinPost.findMany({
    where: { communityId: branchId, scope: 'BRANCH', deletedAt: null },
    select: { id: true, authorId: true },
  })

  let pointsReversed = 0
  for (const q of questions) {
    for (const a of q.answers) {
      pointsReversed += await reverseContentPoints({
        kind: 'answer', contentId: a.id, authorId: a.authorId,
        communityId: q.communityId, actorUserId,
      })
    }
  }
  for (const p of posts) {
    pointsReversed += await reverseContentPoints({
      kind: 'post', contentId: p.id, authorId: p.authorId,
      communityId: branchId, actorUserId,
    })
  }

  const stamp = {
    deletedAt: now,
    deletedByUserId: actorUserId,
    deletionReason: reason,
    deletedWithParent: true,
  }
  await prisma.answer.updateMany({
    where: { questionId: { in: questions.map((q) => q.id) }, deletedAt: null },
    data: stamp,
  })
  await prisma.question.updateMany({
    where: { id: { in: questions.map((q) => q.id) } },
    data: stamp,
  })
  await prisma.bulletinPost.updateMany({
    where: { communityId: branchId, deletedAt: null, scope: 'BRANCH' },
    data: stamp,
  })

  // ── the memberships ──────────────────────────────────────────────────────
  // ⚠ The root membership is untouched, by construction: this deletes rows for
  // THIS branch only. Somebody whose only branch this was stays in the
  // Community, which is the difference between removing a group and removing a
  // person.
  const members = await prisma.communityMember.findMany({
    where: { communityId: branchId },
    select: { userId: true },
  })
  const { count: membershipsRemoved } = await prisma.communityMember.deleteMany({
    where: { communityId: branchId },
  })

  await prisma.community.update({
    where: { id: branchId },
    data: { deletedAt: now, deletedByUserId: actorUserId, deletionReason: reason },
  })

  for (const m of members) {
    if (m.userId === actorUserId) continue
    await prisma.notification.create({
      data: {
        userId: m.userId,
        type: 'SYSTEM',
        title: `${branch.name} has been closed`,
        message:
          `${reason ?? 'No reason was given.'} You are still a member of the Community — ` +
          `you can join another branch at any time.`,
        linkUrl: `/communities/${rootId}?tab=teams`,
      },
    })
  }

  return {
    branchId,
    membershipsRemoved,
    questionsDeleted: questions.length,
    postsDeleted: posts.length,
    pointsReversed,
  }
}

export type BranchRestoreResult = {
  branchId: string
  questionsRestored: number
  postsRestored: number
  pointsRestored: number
  /** Always 0. Named in the result so the UI cannot imply otherwise. */
  membershipsRestored: 0
}

/**
 * Restore a branch and everything that went down with it.
 *
 * ⚠ MEMBERSHIPS DO NOT COME BACK. People rejoin. `membershipsRestored` is in the
 * result as a literal zero so a caller rendering the result cannot imply
 * otherwise by omission.
 */
export async function restoreBranch(params: {
  branchId: string
  actorUserId: string
}): Promise<BranchRestoreResult> {
  const { branchId, actorUserId } = params
  const branch = await prisma.community.findUnique({
    where: { id: branchId },
    select: { id: true, parentCommunityId: true, deletedAt: true },
  })
  if (!branch) throw new CommunityRuleError('Branch not found', 404)
  if (!branch.deletedAt) throw new CommunityRuleError('That branch is not deleted', 409)
  if (branch.parentCommunityId && (await isDeleted(branch.parentCommunityId))) {
    throw new CommunityRuleError('Restore its parent branch first', 409)
  }
  if (!(await canManageCommunity(actorUserId, branchId))) {
    throw new CommunityRuleError('You cannot restore this branch', 403)
  }

  const questions = await prisma.question.findMany({
    where: { branchId, deletedAt: { not: null }, deletedWithParent: true },
    select: { id: true, communityId: true, answers: { where: { deletedAt: { not: null }, deletedWithParent: true }, select: { id: true, authorId: true } } },
  })
  const posts = await prisma.bulletinPost.findMany({
    where: { communityId: branchId, deletedAt: { not: null }, deletedWithParent: true },
    select: { id: true, authorId: true },
  })

  let pointsRestored = 0
  for (const q of questions) {
    for (const a of q.answers) {
      pointsRestored += await restoreContentPoints({
        kind: 'answer', contentId: a.id, authorId: a.authorId,
        communityId: q.communityId, actorUserId,
      })
    }
  }
  for (const p of posts) {
    pointsRestored += await restoreContentPoints({
      kind: 'post', contentId: p.id, authorId: p.authorId,
      communityId: branchId, actorUserId,
    })
  }

  const clear = { deletedAt: null, deletedByUserId: null, deletionReason: null, deletedWithParent: false }
  await prisma.answer.updateMany({
    where: { questionId: { in: questions.map((q) => q.id) }, deletedAt: { not: null }, deletedWithParent: true },
    data: clear,
  })
  await prisma.question.updateMany({ where: { id: { in: questions.map((q) => q.id) } }, data: clear })
  await prisma.bulletinPost.updateMany({
    where: { communityId: branchId, deletedAt: { not: null }, deletedWithParent: true },
    data: clear,
  })
  await prisma.community.update({
    where: { id: branchId },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null },
  })

  return {
    branchId,
    questionsRestored: questions.length,
    postsRestored: posts.length,
    pointsRestored,
    membershipsRestored: 0,
  }
}

async function isDeleted(communityId: string): Promise<boolean> {
  const c = await prisma.community.findUnique({
    where: { id: communityId },
    select: { deletedAt: true },
  })
  return c?.deletedAt != null
}

/**
 * Deleted branches in THIS Community's tree, for the deleted-items view.
 *
 * ⚠ Scoped by walking down from the root over LIVE and DELETED nodes alike.
 * `getSubtreeIds` cannot be used: it skips deleted branches by design, so asking
 * it for deleted branches returns none. And a filter of merely
 * `parentCommunityId IS NOT NULL` would list every deleted branch on the
 * platform, in every Community.
 */
export async function listDeletedBranches(communityId: string) {
  const rootId = await getRootCommunityId(communityId)

  // Walk the whole tree including deleted nodes, so a branch under a deleted
  // parent is still reachable.
  const all = await prisma.community.findMany({
    select: { id: true, parentCommunityId: true },
  })
  const childrenOf = new Map<string, string[]>()
  for (const c of all) {
    if (!c.parentCommunityId) continue
    childrenOf.set(c.parentCommunityId, [...(childrenOf.get(c.parentCommunityId) ?? []), c.id])
  }
  const inTree: string[] = []
  const stack = [rootId]
  let guard = 0
  while (stack.length && guard++ < 500) {
    const id = stack.pop()!
    inTree.push(id)
    stack.push(...(childrenOf.get(id) ?? []))
  }

  return prisma.community.findMany({
    where: { id: { in: inTree }, deletedAt: { not: null } },
    select: {
      id: true, name: true, deletedAt: true, deletionReason: true,
      deletedBy: { select: { id: true, name: true, username: true } },
      parent: { select: { id: true, name: true } },
    },
    orderBy: { deletedAt: 'desc' },
  })
}
