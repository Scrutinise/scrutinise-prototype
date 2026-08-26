import { prisma } from '@/lib/prisma'
import {
  CommunityRuleError,
  canManageCommunity,
  getCommunityMembership,
  getRootCommunityId,
  getSubtreeIds,
} from '@/lib/community'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2b — the question library.
//
// The three vote-ish mechanisms are separate on purpose and must stay separate:
//   · a QUESTION vote records frequency ("I get asked this too") — up only,
//     self-voting allowed, because the asker demonstrably was asked;
//   · an ANSWER vote records quality — up or down, mutually exclusive, and
//     self-voting refused under the Stage 2 no-marking-own-content rule;
//   · a FAVOURITE is private — never counted, never ranked, never exposed.
//
// docs/SCRUTINISE_CENTRAL_SPEC.md §5.
// ─────────────────────────────────────────────────────────────────────────────

export const QUESTION_SCOPES = ['COMMUNITY', 'BRANCH'] as const
export type QuestionScope = (typeof QUESTION_SCOPES)[number]

export const VOTE_DIRECTIONS = ['UP', 'DOWN'] as const
export type VoteDirection = (typeof VOTE_DIRECTIONS)[number]

export const FLAG_LEVELS = ['DO_NOT_USE', 'USE_WITH_CARE'] as const
export type FlagLevel = (typeof FLAG_LEVELS)[number]

export const SUGGESTION_STATUSES = ['PENDING', 'APPLIED', 'DISMISSED'] as const

export const TAG_KINDS = ['CONTEXT_EXTERNAL', 'CONTEXT_INTERNAL', 'TOPIC'] as const
export type TagKind = (typeof TAG_KINDS)[number]

export const OUTPUT_FORMATS = ['GLANCE', 'FLASHCARD', 'LIST', 'PRINT'] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export const SORT_MODES = ['top-month', 'top-all', 'newest'] as const
export type SortMode = (typeof SORT_MODES)[number]

/** The line every pack output carries, without exception. */
export const PACK_DISCLAIMER = 'Community-rated answers, not official positions.'

// ── visibility ───────────────────────────────────────────────────────────────

/**
 * Which questions a viewer standing at `communityId` may see.
 *
 * COMMUNITY-scoped questions are visible everywhere in the Community.
 * BRANCH-scoped questions are visible only within that branch's tree — so from
 * a branch you see your own and your descendants', and from the root you see
 * everything, because the root's subtree is the whole Community.
 */
export async function getQuestionVisibilityFilter(viewerCommunityId: string) {
  const rootId = await getRootCommunityId(viewerCommunityId)
  const visibleBranchIds = await getSubtreeIds(viewerCommunityId)
  return {
    communityId: rootId,
    OR: [
      { scope: 'COMMUNITY' },
      { scope: 'BRANCH', branchId: { in: visibleBranchIds } },
    ],
  }
}

/** Promoting a branch question to the whole Community: its author, or anyone
 *  with manage rights over the Community. */
export async function canPromoteQuestion(userId: string, questionId: string): Promise<boolean> {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: { authorId: true, communityId: true },
  })
  if (!q) return false
  if (q.authorId === userId) return true
  return canManageCommunity(userId, q.communityId)
}

// ── near-match lookup ────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'you', 'your',
  'we', 'our', 'i', 'my', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'but', 'with',
  'what', 'why', 'how', 'when', 'who', 'that', 'this', 'it', 'be', 'will', 'would',
  'about', 'have', 'has', 'not', 'so', 'if', 'at', 'as', 'by', 'from', 'me', 'they',
])

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  )
}

/**
 * "Three people have already been asked this."
 *
 * Jaccard overlap on content words. Deliberately not the corpus search stack:
 * this runs on every keystroke against one Community's questions — tens or
 * hundreds of rows — and needs to be instant and dependency-free, not good at
 * legal retrieval.
 *
 * The result is a SHORTCUT, never a block. The caller always offers "carry on
 * and post yours as new".
 */
export async function findNearMatches(
  viewerCommunityId: string,
  text: string,
  limit = 3,
): Promise<{ id: string; text: string; voteCount: number; answerCount: number; similarity: number }[]> {
  const tokens = tokenise(text)
  if (tokens.size === 0) return []

  const where = await getQuestionVisibilityFilter(viewerCommunityId)
  const candidates = await prisma.question.findMany({
    where,
    select: {
      id: true,
      text: true,
      _count: { select: { votes: true, answers: true } },
    },
    take: 500,
    orderBy: { createdAt: 'desc' },
  })

  return candidates
    .map((q) => {
      const other = tokenise(q.text)
      let shared = 0
      for (const t of tokens) if (other.has(t)) shared++
      const union = tokens.size + other.size - shared
      return {
        id: q.id,
        text: q.text,
        voteCount: q._count.votes,
        answerCount: q._count.answers,
        similarity: union === 0 ? 0 : shared / union,
      }
    })
    // 0.3 keeps "how do we pay for it" against "how are you going to pay for
    // all this" while dropping questions that merely share a topic word.
    .filter((q) => q.similarity >= 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

// ── ranking ──────────────────────────────────────────────────────────────────

export type ScoredAnswer = {
  id: string
  /** MEMBER | AI — Stage 2e. Every surface that renders an answer must render
   *  this too; check:central greps for it. */
  authorType: string
  aiModel: string | null
  body: string
  sources: string[]
  localExample: string | null
  hidden: boolean
  createdAt: Date
  author: { id: string; name: string | null; username: string }
  branchName: string | null
  score: number
  upCount: number
  downCount: number
  myVote: VoteDirection | null
  myFavourite: boolean
  flag: { level: string; reason: string } | null
}

/**
 * Answers to one question, ranked by net weighted vote.
 *
 * `voteWeight` is multiplied in even though every row is 1.0 today — the sort
 * is where weighting would take effect, so applying it now means switching
 * weighting on later is a data change rather than a code change.
 *
 * Favourites are read ONLY for the viewer's own rows and never counted.
 */
export async function getRankedAnswers(
  questionId: string,
  viewerId: string,
  opts: { includeHidden?: boolean } = {},
): Promise<ScoredAnswer[]> {
  const answers = await prisma.answer.findMany({
    where: { questionId, ...(opts.includeHidden ? {} : { hidden: false }) },
    include: {
      author: { select: { id: true, name: true, username: true } },
      votes: { select: { direction: true, voteWeight: true, userId: true } },
      favourites: { where: { userId: viewerId }, select: { id: true } },
      flags: { select: { level: true, reason: true } },
    },
  })

  // The answering member's branch, for the "Riverside branch · 3 days ago" line.
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { communityId: true },
  })
  const branchNameByUser = new Map<string, string>()
  if (question) {
    const nodeIds = await getSubtreeIds(question.communityId)
    const memberships = await prisma.communityMember.findMany({
      where: {
        userId: { in: answers.map((a) => a.authorId) },
        communityId: { in: nodeIds },
        community: { parentCommunityId: { not: null } },
      },
      include: { community: { select: { name: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    for (const m of memberships) {
      if (!branchNameByUser.has(m.userId)) branchNameByUser.set(m.userId, m.community.name)
    }
  }

  return answers
    .map((a) => {
      let score = 0
      let upCount = 0
      let downCount = 0
      let myVote: VoteDirection | null = null
      for (const v of a.votes) {
        if (v.direction === 'UP') { score += v.voteWeight; upCount++ }
        else { score -= v.voteWeight; downCount++ }
        if (v.userId === viewerId) myVote = v.direction as VoteDirection
      }
      return {
        id: a.id,
        authorType: a.authorType,
        aiModel: a.aiModel,
        body: a.body,
        sources: a.sources,
        localExample: a.localExample,
        hidden: a.hidden,
        createdAt: a.createdAt,
        author: a.author,
        branchName: branchNameByUser.get(a.authorId) ?? null,
        score,
        upCount,
        downCount,
        myVote,
        myFavourite: a.favourites.length > 0,
        flag: a.flags[0] ? { level: a.flags[0].level, reason: a.flags[0].reason } : null,
      }
    })
    .sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime())
}

// ── the library list ─────────────────────────────────────────────────────────

export type QuestionListItem = {
  id: string
  text: string
  scope: string
  contextTags: string[]
  topicTags: string[]
  createdAt: Date
  voteCount: number
  answerCount: number
  myVote: boolean
  branchName: string | null
  answerPreview: string | null
  /** Whether the previewed answer was written by AI. The list must say so, or
   *  a Claude-written answer reads as a member's work in the one place most
   *  people ever look. */
  answerPreviewIsAI: boolean
  hasSources: boolean
  hasLocalExample: boolean
}

export async function listQuestions(
  viewerCommunityId: string,
  viewerId: string,
  opts: {
    search?: string
    context?: string
    topic?: string
    side?: 'external' | 'internal'
    sort?: SortMode
    limit?: number
  } = {},
): Promise<QuestionListItem[]> {
  const visibility = await getQuestionVisibilityFilter(viewerCommunityId)
  const sort = opts.sort ?? 'top-month'

  // The two-way toggle filters by which KIND the context tag belongs to, so the
  // chip row only ever shows one side's chips.
  let sideTags: string[] | null = null
  if (opts.side) {
    const kind = opts.side === 'external' ? 'CONTEXT_EXTERNAL' : 'CONTEXT_INTERNAL'
    const tags = await prisma.questionTag.findMany({
      where: { communityId: visibility.communityId, kind },
      select: { label: true },
    })
    sideTags = tags.map((t) => t.label)
  }

  const questions = await prisma.question.findMany({
    where: {
      ...visibility,
      ...(opts.search ? { text: { contains: opts.search, mode: 'insensitive' as const } } : {}),
      ...(opts.context ? { contextTags: { has: opts.context } } : sideTags ? { contextTags: { hasSome: sideTags } } : {}),
      ...(opts.topic ? { topicTags: { has: opts.topic } } : {}),
    },
    include: {
      branch: { select: { name: true } },
      votes: { select: { userId: true, createdAt: true } },
      answers: {
        where: { hidden: false },
        select: {
          body: true, sources: true, localExample: true, authorType: true,
          votes: { select: { direction: true, voteWeight: true } },
        },
      },
    },
    take: opts.limit ?? 200,
    orderBy: { createdAt: 'desc' },
  })

  // "Top this month" filters on WHEN THE VOTE WAS CAST rather than decaying old
  // votes — a question that was asked constantly last year and not since should
  // drop out of the monthly view, not linger at a discount.
  const monthAgo = new Date()
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const rows = questions.map((q) => {
    const countedVotes = sort === 'top-month' ? q.votes.filter((v) => v.createdAt >= monthAgo) : q.votes
    const best = q.answers
      .map((a) => ({
        a,
        score: a.votes.reduce((s, v) => s + (v.direction === 'UP' ? v.voteWeight : -v.voteWeight), 0),
      }))
      .sort((x, y) => y.score - x.score)[0]

    return {
      id: q.id,
      text: q.text,
      scope: q.scope,
      contextTags: q.contextTags,
      topicTags: q.topicTags,
      createdAt: q.createdAt,
      voteCount: countedVotes.length,
      answerCount: q.answers.length,
      myVote: q.votes.some((v) => v.userId === viewerId),
      branchName: q.branch?.name ?? null,
      // Missing previews are a real state, not an oversight — a question with
      // no answers yet renders without one.
      answerPreview: best ? best.a.body.slice(0, 160) + (best.a.body.length > 160 ? '…' : '') : null,
      answerPreviewIsAI: best?.a.authorType === 'AI',
      hasSources: q.answers.some((a) => a.sources.length > 0),
      hasLocalExample: q.answers.some((a) => Boolean(a.localExample)),
    }
  })

  if (sort === 'newest') return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return rows.sort((a, b) => b.voteCount - a.voteCount || b.createdAt.getTime() - a.createdAt.getTime())
}

// ── writes ───────────────────────────────────────────────────────────────────

/** Up only, one per member, and self-voting IS allowed: the asker demonstrably
 *  was asked. Clicking again withdraws. */
export async function toggleQuestionVote(questionId: string, userId: string): Promise<{ voted: boolean; count: number }> {
  const existing = await prisma.questionVote.findUnique({
    where: { questionId_userId: { questionId, userId } },
  })
  if (existing) await prisma.questionVote.delete({ where: { id: existing.id } })
  else await prisma.questionVote.create({ data: { questionId, userId } })

  const count = await prisma.questionVote.count({ where: { questionId } })
  return { voted: !existing, count }
}

/**
 * Up or down, mutually exclusive. Voting the same direction again clears it;
 * switching direction REPLACES rather than stacks, so the visible count moves
 * by two. Self-voting is refused, consistent with Stage 2.
 */
export async function setAnswerVote(
  answerId: string,
  userId: string,
  direction: VoteDirection,
): Promise<{ myVote: VoteDirection | null; score: number; previousVote: VoteDirection | null }> {
  const answer = await prisma.answer.findUnique({ where: { id: answerId }, select: { authorId: true } })
  if (!answer) throw new CommunityRuleError('Answer not found', 404)
  if (answer.authorId === userId) {
    throw new CommunityRuleError('You cannot vote on your own answer', 403)
  }

  const existing = await prisma.answerVote.findUnique({
    where: { answerId_userId: { answerId, userId } },
  })
  // Stage 2e: the caller needs to know what this replaced, because the ledger
  // reverses the old award before writing the new one.
  const previousVote = (existing?.direction as VoteDirection | undefined) ?? null

  let myVote: VoteDirection | null = direction
  if (existing && existing.direction === direction) {
    await prisma.answerVote.delete({ where: { id: existing.id } })
    myVote = null
  } else if (existing) {
    await prisma.answerVote.update({ where: { id: existing.id }, data: { direction } })
  } else {
    await prisma.answerVote.create({ data: { answerId, userId, direction } })
  }

  const votes = await prisma.answerVote.findMany({
    where: { answerId },
    select: { direction: true, voteWeight: true },
  })
  const score = votes.reduce((s, v) => s + (v.direction === 'UP' ? v.voteWeight : -v.voteWeight), 0)
  return { myVote, score, previousVote }
}

/** Private to the owner. Returns only their own state — never a count. */
export async function toggleFavourite(answerId: string, userId: string): Promise<{ favourited: boolean }> {
  const existing = await prisma.answerFavourite.findUnique({
    where: { answerId_userId: { answerId, userId } },
  })
  if (existing) {
    await prisma.answerFavourite.delete({ where: { id: existing.id } })
    return { favourited: false }
  }
  await prisma.answerFavourite.create({ data: { answerId, userId } })
  return { favourited: true }
}

/** Flag an answer. Managers only, and the reason is required — a flag without a
 *  stated reason is an unaccountable veto. One flag per answer; re-flagging
 *  replaces it. */
export async function setAnswerFlag(params: {
  answerId: string
  userId: string
  level: FlagLevel
  reason: string
}) {
  const { answerId, userId, level, reason } = params
  if (!reason.trim()) throw new CommunityRuleError('A flag needs a reason', 422)

  const communityId = await getCommunityIdForAnswer(answerId)
  if (!(await canManageCommunity(userId, communityId))) {
    throw new CommunityRuleError('Only branch managers and Community admins can flag answers', 403)
  }

  const flag = await prisma.answerFlag.upsert({
    where: { answerId },
    create: { answerId, level, reason: reason.trim(), setByUserId: userId },
    update: { level, reason: reason.trim(), setByUserId: userId, setAt: new Date() },
  })

  // The author is told, and told why — the reason is the accountability.
  const answer = await prisma.answer.findUniqueOrThrow({
    where: { id: answerId },
    select: { authorId: true, questionId: true },
  })
  if (answer.authorId !== userId) {
    await prisma.notification.create({
      data: {
        userId: answer.authorId,
        type: 'SYSTEM',
        title: level === 'DO_NOT_USE' ? 'Answer flagged: do not use' : 'Answer flagged: use with care',
        message: reason.trim(),
        linkUrl: `/communities/${communityId}/questions/${answer.questionId}`,
      },
    })
  }
  return flag
}

export async function clearAnswerFlag(answerId: string, userId: string) {
  const communityId = await getCommunityIdForAnswer(answerId)
  if (!(await canManageCommunity(userId, communityId))) {
    throw new CommunityRuleError('Only branch managers and Community admins can clear flags', 403)
  }
  await prisma.answerFlag.deleteMany({ where: { answerId } })
}

/** Hide or unhide an answer outright — the heavier alternative to a flag. */
export async function setAnswerHidden(answerId: string, userId: string, hidden: boolean) {
  const communityId = await getCommunityIdForAnswer(answerId)
  if (!(await canManageCommunity(userId, communityId))) {
    throw new CommunityRuleError('Only branch managers and Community admins can hide answers', 403)
  }
  return prisma.answer.update({ where: { id: answerId }, data: { hidden } })
}

export async function getCommunityIdForAnswer(answerId: string): Promise<string> {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: { question: { select: { communityId: true } } },
  })
  if (!answer) throw new CommunityRuleError('Answer not found', 404)
  return answer.question.communityId
}

/**
 * Suggest a rewording. Goes to the answer's AUTHOR, who applies or dismisses.
 * There is deliberately no admin path — this is a conversation between two
 * members, not a moderation action.
 */
export async function createEditSuggestion(answerId: string, userId: string, suggestedBody: string) {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: { authorId: true, questionId: true, question: { select: { communityId: true } } },
  })
  if (!answer) throw new CommunityRuleError('Answer not found', 404)
  if (answer.authorId === userId) {
    throw new CommunityRuleError('You can edit your own answer directly', 409)
  }

  const suggestion = await prisma.editSuggestion.create({
    data: { answerId, suggestedByUserId: userId, suggestedBody: suggestedBody.trim() },
  })

  await prisma.notification.create({
    data: {
      userId: answer.authorId,
      type: 'SYSTEM',
      title: 'Suggested edit to your answer',
      message: 'Someone has suggested a rewording. You can apply it or dismiss it.',
      linkUrl: `/communities/${answer.question.communityId}/questions/${answer.questionId}?suggestion=${suggestion.id}`,
    },
  })
  return suggestion
}

export async function decideEditSuggestion(
  suggestionId: string,
  userId: string,
  decision: 'APPLIED' | 'DISMISSED',
) {
  const suggestion = await prisma.editSuggestion.findUnique({
    where: { id: suggestionId },
    include: { answer: { select: { id: true, authorId: true } } },
  })
  if (!suggestion) throw new CommunityRuleError('Suggestion not found', 404)
  // Only the answer's author decides. Not an admin, by design.
  if (suggestion.answer.authorId !== userId) {
    throw new CommunityRuleError('Only the answer’s author can decide a suggested edit', 403)
  }
  if (suggestion.status !== 'PENDING') {
    throw new CommunityRuleError(`Already ${suggestion.status.toLowerCase()}`, 409)
  }

  if (decision === 'APPLIED') {
    await prisma.answer.update({
      where: { id: suggestion.answerId },
      data: { body: suggestion.suggestedBody },
    })
  }
  return prisma.editSuggestion.update({
    where: { id: suggestionId },
    data: { status: decision, decidedAt: new Date() },
  })
}

// ── packs ────────────────────────────────────────────────────────────────────

export type PackEntry = {
  questionId: string
  text: string
  contextTags: string[]
  topicTags: string[]
  voteCount: number
  answer: {
    body: string
    sources: string[]
    localExample: string | null
    flag: { level: string; reason: string } | null
    isFavourite: boolean
    /** MEMBER | AI. A pack is the output people carry into a room, so it is the
     *  LAST place an AI-written answer may pass as a member's. */
    authorType: string
    aiModel: string | null
  } | null
  /** Present when the member has favourited a DIFFERENT answer to the top one. */
  favouriteAnswer: {
    body: string
    sources: string[]
    localExample: string | null
    flag: { level: string; reason: string } | null
    authorType: string
    aiModel: string | null
  } | null
  pinned: boolean
}

/**
 * Build the pack contents from a filter.
 *
 * Two rules that the design is explicit about and that are easy to get wrong:
 *
 *  1. DO_NOT_USE answers are EXCLUDED. USE_WITH_CARE answers stay in, and their
 *     flag and reason travel with them into the output.
 *  2. Favourites are ADDITIVE, not substitutive. Where the member has
 *     favourited a different answer, the pack carries BOTH the community's
 *     top-voted answer and theirs. It never silently replaces the community's
 *     choice with a private one — that would make two members' packs differ
 *     without either knowing why.
 */
export async function buildPack(params: {
  viewerCommunityId: string
  viewerId: string
  filter?: { search?: string; context?: string; topic?: string; side?: 'external' | 'internal'; sort?: SortMode }
  size?: number
  pinnedQuestionIds?: string[]
  removedQuestionIds?: string[]
  includeFavourites?: boolean
}): Promise<{ entries: PackEntry[]; available: number; requested: number }> {
  const {
    viewerCommunityId, viewerId, filter = {}, size = 10,
    pinnedQuestionIds = [], removedQuestionIds = [], includeFavourites = true,
  } = params

  const all = await listQuestions(viewerCommunityId, viewerId, filter)
  const kept = all.filter((q) => !removedQuestionIds.includes(q.id))

  // Pinned questions hold their position when the ranking moves — that is the
  // whole point of pinning, so they are lifted out and re-inserted at the front
  // in their pinned order rather than re-sorted with everything else.
  const pinnedSet = new Set(pinnedQuestionIds)
  const pinned = pinnedQuestionIds
    .map((id) => kept.find((q) => q.id === id))
    .filter((q): q is QuestionListItem => q !== undefined)
  const rest = kept.filter((q) => !pinnedSet.has(q.id))
  const chosen = [...pinned, ...rest].slice(0, size)

  const entries: PackEntry[] = []
  for (const q of chosen) {
    const answers = await getRankedAnswers(q.id, viewerId)
    const packable = answers.filter((a) => a.flag?.level !== 'DO_NOT_USE')
    const top = packable[0] ?? null
    const favourite = includeFavourites ? packable.find((a) => a.myFavourite) ?? null : null

    entries.push({
      questionId: q.id,
      text: q.text,
      contextTags: q.contextTags,
      topicTags: q.topicTags,
      voteCount: q.voteCount,
      answer: top
        ? {
            body: top.body,
            sources: top.sources,
            localExample: top.localExample,
            flag: top.flag,
            isFavourite: top.myFavourite,
            authorType: top.authorType,
            aiModel: top.aiModel,
          }
        : null,
      // Only carried when it is a DIFFERENT answer — otherwise the pack would
      // print the same text twice.
      favouriteAnswer:
        favourite && favourite.id !== top?.id
          ? {
              body: favourite.body,
              sources: favourite.sources,
              localExample: favourite.localExample,
              flag: favourite.flag,
              authorType: favourite.authorType,
              aiModel: favourite.aiModel,
            }
          : null,
      pinned: pinnedSet.has(q.id),
    })
  }

  return { entries, available: kept.length, requested: size }
}

// ── across branches (Community admins) ───────────────────────────────────────

/**
 * What each branch is valuing. PARTICIPATION COUNTS ONLY — no per-member
 * activity is computed here, let alone returned, and favourites are not read at
 * all. That constraint is the reason this function exists rather than the page
 * querying freely.
 */
export async function getAcrossBranches(rootCommunityId: string, since: Date | null) {
  const nodeIds = await getSubtreeIds(rootCommunityId)
  const created = since ? { gte: since } : undefined

  const branches = await prisma.community.findMany({
    where: { id: { in: nodeIds }, parentCommunityId: { not: null } },
    select: { id: true, name: true, _count: { select: { members: true } } },
  })

  const results = await Promise.all(
    branches.map(async (b) => {
      const questions = await prisma.question.findMany({
        where: { communityId: rootCommunityId, branchId: b.id, ...(created ? { createdAt: created } : {}) },
        select: {
          id: true, text: true, createdAt: true,
          votes: { select: { createdAt: true, userId: true } },
          answers: { select: { id: true, createdAt: true } },
        },
      })

      const voters = new Set<string>()
      let answerCount = 0
      for (const q of questions) {
        q.votes.forEach((v) => voters.add(v.userId))
        answerCount += q.answers.length
      }

      const ranked = [...questions].sort((x, y) => y.votes.length - x.votes.length)
      // "Rising" = votes cast recently, which is why QuestionVote carries its
      // own createdAt: recency is a property of the vote, not of the question.
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const rising = [...questions]
        .map((q) => ({ q, recent: q.votes.filter((v) => v.createdAt >= weekAgo).length }))
        .filter((r) => r.recent > 0)
        .sort((a, b) => b.recent - a.recent)[0]

      return {
        communityId: b.id,
        name: b.name,
        memberCount: b._count.members,
        questionCount: questions.length,
        answerCount,
        // A COUNT of distinct voters, never who they were.
        votingMemberCount: voters.size,
        topVoted: ranked[0] ? { id: ranked[0].id, text: ranked[0].text, votes: ranked[0].votes.length } : null,
        rising: rising ? { id: rising.q.id, text: rising.q.text, recentVotes: rising.recent } : null,
        quiet: questions.length === 0 && answerCount === 0,
      }
    }),
  )

  return {
    branches: results.sort((a, b) => b.questionCount - a.questionCount),
    totals: {
      branchesActive: results.filter((r) => !r.quiet).length,
      questionsLive: results.reduce((s, r) => s + r.questionCount, 0),
      answersPosted: results.reduce((s, r) => s + r.answerCount, 0),
      membersVoting: results.reduce((s, r) => s + r.votingMemberCount, 0),
    },
  }
}

// ── tags ─────────────────────────────────────────────────────────────────────

export async function getTags(communityId: string) {
  const tags = await prisma.questionTag.findMany({
    where: { communityId },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  })
  return {
    contextExternal: tags.filter((t) => t.kind === 'CONTEXT_EXTERNAL'),
    contextInternal: tags.filter((t) => t.kind === 'CONTEXT_INTERNAL'),
    topics: tags.filter((t) => t.kind === 'TOPIC'),
  }
}

// ── the admin topic view ─────────────────────────────────────────────────────

export type TopicUsage = {
  label: string
  /** true = one of the nineteen subjects; false = one of the three about doing
   *  the job. See DEFAULT_QUESTION_TAGS. */
  subject: boolean
  sortOrder: number
  questionCount: number
}

export type UntaggedQuestion = {
  id: string
  text: string
  contextTags: string[]
  createdAt: Date
  answerCount: number
  branchName: string | null
}

/**
 * What each topic is actually carrying, and what has no topic at all.
 *
 * ⚠ THIS EXISTS BECAUSE THERE IS NO "OTHER" TOPIC (Charlie, 26 Aug 2026). A
 * catch-all absorbs precisely the questions that would have told you which topic
 * is missing — they go in, and the list never has to change again. The topic
 * field is optional instead, and THIS VIEW IS THE EVIDENCE BASE: a cluster of
 * untagged questions about the same thing is the argument for adding a topic,
 * and a topic sitting at zero for months is the argument for removing one.
 *
 * Counts are over the whole Community, because the tag set lives on the root and
 * is inherited — a per-branch count would answer a question nobody asked and
 * would make the same topic look different depending on where you stood.
 */
export async function getTopicUsage(communityId: string): Promise<TopicUsage[]> {
  const rootId = await getRootCommunityId(communityId)
  const tags = await prisma.questionTag.findMany({
    where: { communityId: rootId, kind: 'TOPIC' },
    orderBy: [{ promoted: 'desc' }, { sortOrder: 'asc' }],
  })
  const questions = await prisma.question.findMany({
    where: { communityId: rootId },
    select: { topicTags: true },
  })

  const counts = new Map<string, number>()
  for (const q of questions) {
    for (const t of q.topicTags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }

  return tags.map((t) => ({
    label: t.label,
    subject: t.promoted,
    sortOrder: t.sortOrder,
    questionCount: counts.get(t.label) ?? 0,
  }))
}

/** Questions carrying no topic at all — the list that argues for a new one. */
export async function getUntaggedQuestions(
  communityId: string,
  limit = 200,
): Promise<UntaggedQuestion[]> {
  const rootId = await getRootCommunityId(communityId)
  const questions = await prisma.question.findMany({
    where: { communityId: rootId, topicTags: { isEmpty: true } },
    include: {
      branch: { select: { name: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    contextTags: q.contextTags,
    createdAt: q.createdAt,
    answerCount: q._count.answers,
    branchName: q.branch?.name ?? null,
  }))
}

/**
 * A question carrying a topic the tag set no longer has.
 *
 * ⚠ `Question.topicTags` is a string array, not a foreign key, so a topic can be
 * renamed or deleted out from under a question and nothing complains — the
 * question simply stops matching the filter that ought to find it. The 26 Aug
 * taxonomy change renamed four labels across live questions for exactly this
 * reason, and this is what notices if it ever happens again.
 */
export async function getOrphanedTopicTags(communityId: string): Promise<{ label: string; questionCount: number }[]> {
  const rootId = await getRootCommunityId(communityId)
  const known = new Set(
    (
      await prisma.questionTag.findMany({
        where: { communityId: rootId, kind: 'TOPIC' },
        select: { label: true },
      })
    ).map((t) => t.label),
  )
  const questions = await prisma.question.findMany({
    where: { communityId: rootId },
    select: { topicTags: true },
  })
  const counts = new Map<string, number>()
  for (const q of questions) {
    for (const t of q.topicTags) if (!known.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts].map(([label, questionCount]) => ({ label, questionCount }))
}

/** Membership of the Community is the entry ticket to its library. */
export async function requireLibraryAccess(userId: string, communityId: string): Promise<string> {
  const rootId = await getRootCommunityId(communityId)
  if (!(await getCommunityMembership(userId, rootId))) {
    throw new CommunityRuleError('Not found', 404)
  }
  return rootId
}
