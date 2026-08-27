import { prisma } from '@/lib/prisma'
import { CommunityRuleError, canManageCommunity, getRootCommunityId, getSubtreeIds } from '@/lib/community'
import { recordPointsEvent, type ResolvedTariff } from '@/lib/central-points'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL — the content soft-delete pattern (27 Aug 2026).
//
// ⚠ THIS IS THE PATTERN THE REST OF THE SPRINT MATCHES. Branch delete/restore
// layers on top of it: same four columns, same cascade marker, same points rule,
// same deleted-items view. If something here is wrong it is wrong in three more
// places by the end of the sprint, which is why it is one module rather than a
// habit repeated per entity.
//
// THE FOUR RULES:
//
//  1. SOFT. `deletedAt` and the content stays. A hard delete across votes,
//     favourites, flags, suggestions and the ledger is not reversible at all,
//     and the brief asks for the cheapest thing to reverse.
//
//  2. THE CASCADE IS MARKED, NOT INFERRED. Deleting a question takes its answers
//     with it, and each of those is stamped `deletedWithParent: true`. Restoring
//     the question brings back exactly those and never resurrects an answer its
//     own author had deleted a week earlier. Without the flag those two rows are
//     indistinguishable, and no amount of timestamp arithmetic recovers the
//     difference.
//
//  3. POINTS REVERSE AT THE VALUE THEY WERE AWARDED. Not today's tariff — the
//     same rule as `reverseActivityClaim` and `recordMarkEvents`. The ledger
//     only ever appends: deletion writes a negative event, restore writes the
//     positive one back, and both rows stay so the history reads truthfully.
//
//  4. A MANAGER DELETING SOMEBODY ELSE'S CONTENT MUST SAY WHY. Your own content
//     needs no reason. Somebody else's does — the same rule Stage 2e applied to
//     reversing an activity claim, for the same reason: an unaccountable removal
//     is what this must not become.
//
// ⚠ ONE KNOWN ASYMMETRY, stated rather than hidden: referral bonuses minted from
// an award are NOT clawed back when the content is deleted. That matches what
// `MARK_REMOVED` already does for a withdrawn mark — a bonus, once minted,
// stays. Changing it would mean unwinding a fractional accrual across a chain,
// and doing that here while the withdrawn-mark path does something else would be
// worse than the asymmetry.
// ─────────────────────────────────────────────────────────────────────────────

export const CONTENT_KINDS = ['question', 'answer', 'post', 'resource'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** The `where` fragment every read of live content must carry. */
export const LIVE = { deletedAt: null } as const

/** What the ledger calls a deletion and a restore. */
const DELETE_TARIFF = (points: number): ResolvedTariff => ({
  id: null,
  actionKey: 'CONTENT_DELETED',
  points,
})

// ── the ledger side ──────────────────────────────────────────────────────────

/**
 * The net points a piece of content has earned its author, summed from the
 * ledger rather than recomputed from tariffs.
 *
 * ⚠ SUMMED, NOT RE-PRICED. A mark may already have been withdrawn, in which case
 * the award and its `MARK_REMOVED` cancel and the net is zero — reversing each
 * `MARK_RECEIVED` individually would take points the author no longer has.
 */
async function netEarned(sourceType: string, sourceId: string): Promise<number> {
  const agg = await prisma.pointsEvent.aggregate({
    where: { sourceType, sourceId },
    _sum: { points: true },
  })
  return agg._sum.points ?? 0
}

const SOURCE_TYPE: Record<ContentKind, string | null> = {
  // A question earns nothing directly — QuestionVote records frequency, not
  // quality, and was never wired to the ledger. Its answers earn, and they are
  // reversed individually as the cascade reaches them.
  question: null,
  answer: 'ANSWER_VOTE',
  post: 'BULLETIN_MARK',
  resource: 'RESOURCE_VOTE',
}

/**
 * Reverse whatever this content has earned. Returns the amount taken back.
 * Zero is a normal answer — most content has never been marked.
 */
export async function reverseContentPoints(params: {
  kind: ContentKind
  contentId: string
  authorId: string
  communityId: string
  actorUserId: string
}): Promise<number> {
  const sourceType = SOURCE_TYPE[params.kind]
  if (!sourceType) return 0

  const net = await netEarned(sourceType, params.contentId)
  if (net === 0) return 0

  const rootId = await getRootCommunityId(params.communityId)
  await recordPointsEvent({
    userId: params.authorId,
    communityId: rootId,
    sourceCommunityId: params.communityId,
    type: 'CONTENT_DELETED',
    points: -net,
    sourceType,
    sourceId: params.contentId,
    actorUserId: params.actorUserId,
    tariff: DELETE_TARIFF(-net),
  })
  return net
}

/**
 * Put back exactly what the deletion took, by reading the deletion event rather
 * than re-deriving it. Symmetry is the point: if the two ever disagree, the
 * author's total is silently wrong and nothing says so.
 */
export async function restoreContentPoints(params: {
  kind: ContentKind
  contentId: string
  authorId: string
  communityId: string
  actorUserId: string
}): Promise<number> {
  const sourceType = SOURCE_TYPE[params.kind]
  if (!sourceType) return 0

  const reversal = await prisma.pointsEvent.findFirst({
    where: { sourceType, sourceId: params.contentId, type: 'CONTENT_DELETED' },
    orderBy: { createdAt: 'desc' },
  })
  if (!reversal) return 0

  // Already restored: a CONTENT_RESTORED newer than the reversal means the
  // points are back, and paying again would mint them from nothing.
  const restored = await prisma.pointsEvent.findFirst({
    where: {
      sourceType,
      sourceId: params.contentId,
      type: 'CONTENT_RESTORED',
      createdAt: { gt: reversal.createdAt },
    },
  })
  if (restored) return 0

  const amount = -reversal.points
  if (amount === 0) return 0

  const rootId = await getRootCommunityId(params.communityId)
  await recordPointsEvent({
    userId: params.authorId,
    communityId: rootId,
    sourceCommunityId: params.communityId,
    type: 'CONTENT_RESTORED',
    points: amount,
    sourceType,
    sourceId: params.contentId,
    actorUserId: params.actorUserId,
    tariff: { id: null, actionKey: 'CONTENT_RESTORED', points: amount },
  })
  return amount
}

// ── permission ───────────────────────────────────────────────────────────────

/**
 * Who may remove a piece of content: its author, or anyone with manage rights
 * over the node it lives on (which cascades from every ancestor).
 *
 * A manager removing somebody else's content must give a reason. The author
 * removing their own need not — nobody has to justify withdrawing their own
 * words.
 */
async function assertMayDelete(params: {
  authorId: string
  communityId: string
  actorUserId: string
  reason?: string
}): Promise<{ isOwnContent: boolean }> {
  const isOwnContent = params.authorId === params.actorUserId
  if (isOwnContent) return { isOwnContent }

  if (!(await canManageCommunity(params.actorUserId, params.communityId))) {
    throw new CommunityRuleError('You can only delete your own content here', 403)
  }
  if (!params.reason?.trim()) {
    throw new CommunityRuleError(
      'Say why you are removing someone else’s content — they are told the reason',
      422,
    )
  }
  return { isOwnContent }
}

// ── delete ───────────────────────────────────────────────────────────────────

export type DeletionResult = {
  kind: ContentKind
  id: string
  /** Rows taken down with it, by kind. */
  cascaded: { answers: number; replies: number }
  /** Points taken back from authors, summed across everything removed. */
  pointsReversed: number
}

/**
 * Delete a question, and every answer under it.
 *
 * ⚠ THE ANSWERS ARE OTHER PEOPLE'S. Deleting a question you asked removes
 * answers you did not write and takes back points their authors earned, so each
 * of them is notified and each cascaded row is marked `deletedWithParent` so a
 * restore is exact.
 */
export async function deleteQuestion(params: {
  questionId: string
  actorUserId: string
  reason?: string
}): Promise<DeletionResult> {
  const question = await prisma.question.findUnique({
    where: { id: params.questionId },
    include: { answers: { where: LIVE, select: { id: true, authorId: true } } },
  })
  if (!question) throw new CommunityRuleError('Question not found', 404)
  if (question.deletedAt) throw new CommunityRuleError('That question is already deleted', 409)

  await assertMayDelete({
    authorId: question.authorId,
    communityId: question.communityId,
    actorUserId: params.actorUserId,
    reason: params.reason,
  })

  const now = new Date()
  let pointsReversed = 0

  for (const answer of question.answers) {
    pointsReversed += await reverseContentPoints({
      kind: 'answer',
      contentId: answer.id,
      authorId: answer.authorId,
      communityId: question.communityId,
      actorUserId: params.actorUserId,
    })
    await notifyAuthor({
      authorId: answer.authorId,
      actorUserId: params.actorUserId,
      communityId: question.communityId,
      title: 'An answer of yours was removed with its question',
      reason: params.reason,
    })
  }

  await prisma.answer.updateMany({
    where: { questionId: question.id, ...LIVE },
    data: {
      deletedAt: now,
      deletedByUserId: params.actorUserId,
      deletionReason: params.reason?.trim() || null,
      deletedWithParent: true,
    },
  })

  await prisma.question.update({
    where: { id: question.id },
    data: {
      deletedAt: now,
      deletedByUserId: params.actorUserId,
      deletionReason: params.reason?.trim() || null,
      deletedWithParent: false,
    },
  })

  if (question.authorId !== params.actorUserId) {
    await notifyAuthor({
      authorId: question.authorId,
      actorUserId: params.actorUserId,
      communityId: question.communityId,
      title: 'A question of yours was removed',
      reason: params.reason,
    })
  }

  return {
    kind: 'question',
    id: question.id,
    cascaded: { answers: question.answers.length, replies: 0 },
    pointsReversed,
  }
}

/** Delete one answer. Its votes stay, so a restore puts the score back intact. */
export async function deleteAnswer(params: {
  answerId: string
  actorUserId: string
  reason?: string
}): Promise<DeletionResult> {
  const answer = await prisma.answer.findUnique({
    where: { id: params.answerId },
    include: { question: { select: { communityId: true } } },
  })
  if (!answer) throw new CommunityRuleError('Answer not found', 404)
  if (answer.deletedAt) throw new CommunityRuleError('That answer is already deleted', 409)

  await assertMayDelete({
    authorId: answer.authorId,
    communityId: answer.question.communityId,
    actorUserId: params.actorUserId,
    reason: params.reason,
  })

  const pointsReversed = await reverseContentPoints({
    kind: 'answer',
    contentId: answer.id,
    authorId: answer.authorId,
    communityId: answer.question.communityId,
    actorUserId: params.actorUserId,
  })

  await prisma.answer.update({
    where: { id: answer.id },
    data: {
      deletedAt: new Date(),
      deletedByUserId: params.actorUserId,
      deletionReason: params.reason?.trim() || null,
      deletedWithParent: false,
    },
  })

  if (answer.authorId !== params.actorUserId) {
    await notifyAuthor({
      authorId: answer.authorId,
      actorUserId: params.actorUserId,
      communityId: answer.question.communityId,
      title: 'An answer of yours was removed',
      reason: params.reason,
    })
  }

  return { kind: 'answer', id: answer.id, cascaded: { answers: 0, replies: 0 }, pointsReversed }
}

/** Delete a bulletin post, and every reply under it. */
export async function deletePost(params: {
  postId: string
  actorUserId: string
  reason?: string
}): Promise<DeletionResult> {
  const post = await prisma.bulletinPost.findUnique({
    where: { id: params.postId },
    include: { replies: { where: LIVE, select: { id: true, authorId: true } } },
  })
  if (!post) throw new CommunityRuleError('Post not found', 404)
  if (post.deletedAt) throw new CommunityRuleError('That post is already deleted', 409)

  await assertMayDelete({
    authorId: post.authorId,
    communityId: post.communityId,
    actorUserId: params.actorUserId,
    reason: params.reason,
  })

  const now = new Date()
  let pointsReversed = await reverseContentPoints({
    kind: 'post',
    contentId: post.id,
    authorId: post.authorId,
    communityId: post.communityId,
    actorUserId: params.actorUserId,
  })

  for (const reply of post.replies) {
    pointsReversed += await reverseContentPoints({
      kind: 'post',
      contentId: reply.id,
      authorId: reply.authorId,
      communityId: post.communityId,
      actorUserId: params.actorUserId,
    })
  }

  await prisma.bulletinPost.updateMany({
    where: { parentId: post.id, ...LIVE },
    data: {
      deletedAt: now,
      deletedByUserId: params.actorUserId,
      deletionReason: params.reason?.trim() || null,
      deletedWithParent: true,
    },
  })
  await prisma.bulletinPost.update({
    where: { id: post.id },
    data: {
      deletedAt: now,
      deletedByUserId: params.actorUserId,
      deletionReason: params.reason?.trim() || null,
      deletedWithParent: false,
    },
  })

  if (post.authorId !== params.actorUserId) {
    await notifyAuthor({
      authorId: post.authorId,
      actorUserId: params.actorUserId,
      communityId: post.communityId,
      title: 'A post of yours was removed',
      reason: params.reason,
    })
  }

  return {
    kind: 'post',
    id: post.id,
    cascaded: { answers: 0, replies: post.replies.length },
    pointsReversed,
  }
}

// ── restore ──────────────────────────────────────────────────────────────────

export type RestoreResult = {
  kind: ContentKind
  id: string
  restored: { answers: number; replies: number }
  pointsRestored: number
}

/**
 * Restore a question and the answers that went down WITH it.
 *
 * ⚠ `deletedWithParent: true` is the whole filter. An answer its own author
 * deleted before the question was removed carries `false`, and stays deleted —
 * restoring the question must not undo somebody else's separate decision.
 */
export async function restoreQuestion(params: {
  questionId: string
  actorUserId: string
}): Promise<RestoreResult> {
  const question = await prisma.question.findUnique({
    where: { id: params.questionId },
    include: {
      answers: {
        where: { deletedAt: { not: null }, deletedWithParent: true },
        select: { id: true, authorId: true },
      },
    },
  })
  if (!question) throw new CommunityRuleError('Question not found', 404)
  if (!question.deletedAt) throw new CommunityRuleError('That question is not deleted', 409)
  await assertMayRestore(question.authorId, question.communityId, params.actorUserId)

  let pointsRestored = 0
  for (const answer of question.answers) {
    pointsRestored += await restoreContentPoints({
      kind: 'answer',
      contentId: answer.id,
      authorId: answer.authorId,
      communityId: question.communityId,
      actorUserId: params.actorUserId,
    })
  }

  await prisma.answer.updateMany({
    where: { questionId: question.id, deletedAt: { not: null }, deletedWithParent: true },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null, deletedWithParent: false },
  })
  await prisma.question.update({
    where: { id: question.id },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null, deletedWithParent: false },
  })

  return {
    kind: 'question',
    id: question.id,
    restored: { answers: question.answers.length, replies: 0 },
    pointsRestored,
  }
}

export async function restoreAnswer(params: {
  answerId: string
  actorUserId: string
}): Promise<RestoreResult> {
  const answer = await prisma.answer.findUnique({
    where: { id: params.answerId },
    include: { question: { select: { communityId: true, deletedAt: true } } },
  })
  if (!answer) throw new CommunityRuleError('Answer not found', 404)
  if (!answer.deletedAt) throw new CommunityRuleError('That answer is not deleted', 409)
  // Restoring an answer under a deleted question would leave it unreachable and
  // paying points for something nobody can see.
  if (answer.question.deletedAt) {
    throw new CommunityRuleError('Restore the question first — this answer sits under a deleted one', 409)
  }
  await assertMayRestore(answer.authorId, answer.question.communityId, params.actorUserId)

  const pointsRestored = await restoreContentPoints({
    kind: 'answer',
    contentId: answer.id,
    authorId: answer.authorId,
    communityId: answer.question.communityId,
    actorUserId: params.actorUserId,
  })
  await prisma.answer.update({
    where: { id: answer.id },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null, deletedWithParent: false },
  })
  return { kind: 'answer', id: answer.id, restored: { answers: 0, replies: 0 }, pointsRestored }
}

export async function restorePost(params: {
  postId: string
  actorUserId: string
}): Promise<RestoreResult> {
  const post = await prisma.bulletinPost.findUnique({
    where: { id: params.postId },
    include: {
      replies: {
        where: { deletedAt: { not: null }, deletedWithParent: true },
        select: { id: true, authorId: true },
      },
    },
  })
  if (!post) throw new CommunityRuleError('Post not found', 404)
  if (!post.deletedAt) throw new CommunityRuleError('That post is not deleted', 409)
  await assertMayRestore(post.authorId, post.communityId, params.actorUserId)

  let pointsRestored = await restoreContentPoints({
    kind: 'post',
    contentId: post.id,
    authorId: post.authorId,
    communityId: post.communityId,
    actorUserId: params.actorUserId,
  })
  for (const reply of post.replies) {
    pointsRestored += await restoreContentPoints({
      kind: 'post',
      contentId: reply.id,
      authorId: reply.authorId,
      communityId: post.communityId,
      actorUserId: params.actorUserId,
    })
  }

  await prisma.bulletinPost.updateMany({
    where: { parentId: post.id, deletedAt: { not: null }, deletedWithParent: true },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null, deletedWithParent: false },
  })
  await prisma.bulletinPost.update({
    where: { id: post.id },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null, deletedWithParent: false },
  })

  return {
    kind: 'post',
    id: post.id,
    restored: { answers: 0, replies: post.replies.length },
    pointsRestored,
  }
}

/**
 * Delete a resource. Stage 2g.
 *
 * ⚠ THE R2 OBJECT IS LEFT WHERE IT IS. A soft delete is reversible by
 * definition, and deleting the file would make `restoreResource` a lie — the row
 * would come back pointing at a key that no longer resolves. Purging objects
 * belongs to whatever eventually hard-deletes the rows, not here.
 */
export async function deleteResource(params: {
  resourceId: string
  userId: string
  reason?: string
}): Promise<DeletionResult> {
  const resource = await prisma.resource.findUnique({
    where: { id: params.resourceId },
    select: { id: true, authorId: true, communityId: true, deletedAt: true },
  })
  if (!resource) throw new CommunityRuleError('Resource not found', 404)
  if (resource.deletedAt) throw new CommunityRuleError('That resource is already deleted', 409)

  await assertMayDelete({
    authorId: resource.authorId,
    communityId: resource.communityId,
    actorUserId: params.userId,
    reason: params.reason,
  })

  const pointsReversed = await reverseContentPoints({
    kind: 'resource',
    contentId: resource.id,
    authorId: resource.authorId,
    communityId: resource.communityId,
    actorUserId: params.userId,
  })

  await prisma.resource.update({
    where: { id: resource.id },
    data: {
      deletedAt: new Date(),
      deletedByUserId: params.userId,
      deletionReason: params.reason?.trim() || null,
      deletedWithParent: false,
    },
  })

  await notifyAuthor({
    authorId: resource.authorId,
    actorUserId: params.userId,
    communityId: resource.communityId,
    title: 'A resource of yours was removed',
    reason: params.reason,
  })

  return { kind: 'resource', id: resource.id, cascaded: { answers: 0, replies: 0 }, pointsReversed }
}

export async function restoreResource(params: {
  resourceId: string
  userId: string
}): Promise<RestoreResult> {
  const resource = await prisma.resource.findUnique({
    where: { id: params.resourceId },
    select: { id: true, authorId: true, communityId: true, deletedAt: true },
  })
  if (!resource) throw new CommunityRuleError('Resource not found', 404)
  if (!resource.deletedAt) throw new CommunityRuleError('That resource is not deleted', 409)

  await assertMayRestore(resource.authorId, resource.communityId, params.userId)

  const pointsRestored = await restoreContentPoints({
    kind: 'resource',
    contentId: resource.id,
    authorId: resource.authorId,
    communityId: resource.communityId,
    actorUserId: params.userId,
  })
  await prisma.resource.update({
    where: { id: resource.id },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null, deletedWithParent: false },
  })
  return { kind: 'resource', id: resource.id, restored: { answers: 0, replies: 0 }, pointsRestored }
}

/** Restoring is a manager's act, or the author's own. Same shape as deleting. */
async function assertMayRestore(authorId: string, communityId: string, actorUserId: string) {
  if (authorId === actorUserId) return
  if (!(await canManageCommunity(actorUserId, communityId))) {
    throw new CommunityRuleError('You can only restore your own content here', 403)
  }
}

// ── the deleted-items view ───────────────────────────────────────────────────

export type DeletedItem = {
  kind: ContentKind
  id: string
  preview: string
  deletedAt: Date
  deletionReason: string | null
  deletedWithParent: boolean
  author: { id: string; name: string | null; username: string }
  deletedBy: { id: string; name: string | null; username: string } | null
  communityName: string
  /** Where to go to put it back. */
  parentId: string | null
}

/**
 * Everything removed across a manager's subtree, newest first.
 *
 * ⚠ CASCADED ROWS ARE INCLUDED AND LABELLED. Hiding them would make the counts
 * lie ("one question deleted" when nine answers went with it); listing them
 * unlabelled would invite someone to restore a child on its own. They carry
 * `deletedWithParent` so the view can say "went with its question" and offer the
 * parent instead.
 */
export async function listDeletedContent(
  communityId: string,
  limit = 100,
): Promise<DeletedItem[]> {
  const nodeIds = await getSubtreeIds(communityId)
  const rootId = await getRootCommunityId(communityId)

  const who = { select: { id: true, name: true, username: true } }

  const [questions, answers, posts, resources] = await Promise.all([
    prisma.question.findMany({
      where: { communityId: rootId, deletedAt: { not: null } },
      include: { author: who, deletedBy: who, community: { select: { name: true } } },
      orderBy: { deletedAt: 'desc' },
      take: limit,
    }),
    prisma.answer.findMany({
      where: { deletedAt: { not: null }, question: { communityId: rootId } },
      include: {
        author: who,
        deletedBy: who,
        question: { select: { id: true, communityId: true, community: { select: { name: true } } } },
      },
      orderBy: { deletedAt: 'desc' },
      take: limit,
    }),
    prisma.bulletinPost.findMany({
      where: { communityId: { in: nodeIds }, deletedAt: { not: null } },
      include: { author: who, deletedBy: who, community: { select: { name: true } } },
      orderBy: { deletedAt: 'desc' },
      take: limit,
    }),
    // Stage 2g. A resource is scoped to the ROOT like a question, with an
    // optional branch, so the root filter is the right one here.
    prisma.resource.findMany({
      where: { communityId: rootId, deletedAt: { not: null } },
      include: { author: who, deletedBy: who, community: { select: { name: true } } },
      orderBy: { deletedAt: 'desc' },
      take: limit,
    }),
  ])

  const items: DeletedItem[] = [
    ...questions.map((q) => ({
      kind: 'question' as const,
      id: q.id,
      preview: q.text,
      deletedAt: q.deletedAt!,
      deletionReason: q.deletionReason,
      deletedWithParent: q.deletedWithParent,
      author: q.author,
      deletedBy: q.deletedBy,
      communityName: q.community.name,
      parentId: null,
    })),
    ...answers.map((a) => ({
      kind: 'answer' as const,
      id: a.id,
      preview: a.body.slice(0, 160) + (a.body.length > 160 ? '…' : ''),
      deletedAt: a.deletedAt!,
      deletionReason: a.deletionReason,
      deletedWithParent: a.deletedWithParent,
      author: a.author,
      deletedBy: a.deletedBy,
      communityName: a.question.community.name,
      parentId: a.question.id,
    })),
    ...posts.map((p) => ({
      kind: 'post' as const,
      id: p.id,
      preview: p.title ?? p.body.slice(0, 160) + (p.body.length > 160 ? '…' : ''),
      deletedAt: p.deletedAt!,
      deletionReason: p.deletionReason,
      deletedWithParent: p.deletedWithParent,
      author: p.author,
      deletedBy: p.deletedBy,
      communityName: p.community.name,
      parentId: p.parentId,
    })),
    ...resources.map((r) => ({
      kind: 'resource' as const,
      id: r.id,
      preview: r.title,
      deletedAt: r.deletedAt!,
      deletionReason: r.deletionReason,
      deletedWithParent: r.deletedWithParent,
      author: r.author,
      deletedBy: r.deletedBy,
      communityName: r.community.name,
      parentId: null,
    })),
  ]

  return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime()).slice(0, limit)
}

// ── notification ─────────────────────────────────────────────────────────────

async function notifyAuthor(params: {
  authorId: string
  actorUserId: string
  communityId: string
  title: string
  reason?: string
}) {
  if (params.authorId === params.actorUserId) return
  await prisma.notification.create({
    data: {
      userId: params.authorId,
      type: 'SYSTEM',
      title: params.title,
      message: params.reason?.trim() || 'No reason was given.',
      linkUrl: `/communities/${params.communityId}`,
    },
  })
}
