import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  CommunityRuleError,
  getRootCommunityId,
  canManageCommunity,
  getSubtreeIds,
  applyBulletinVote,
} from '@/lib/community'
import { setAnswerVote } from '@/lib/question-library'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2 — the points engine.
//
// One rule governs everything here: THE LEDGER ONLY APPENDS. A withdrawn mark
// does not delete its event, it adds a negative one; a retuned tariff does not
// rewrite history, it changes what the next event stamps. Balances and
// leaderboards are always computed from the rows, never stored.
//
// Central points are deliberately NOT the main system's points. Nothing in this
// file touches Reputation, PointsLedger or CredibilityScore, and the two totals
// are never summed — see docs/SCRUTINISE_CENTRAL_SPEC.md §4.
// ─────────────────────────────────────────────────────────────────────────────

export const POINTS_EVENT_TYPES = [
  'MARK_RECEIVED',
  'MARK_REMOVED',
  'CLAIM_APPROVED',
  'CLAIM_REVERSED',
  // 27 Aug 2026 — content soft-delete. Distinct from MARK_REMOVED on purpose:
  // that means the VOTER withdrew, this means the content went away. Same effect
  // on a total, different cause, and an activity log that cannot tell them apart
  // cannot explain why somebody's score moved.
  'CONTENT_DELETED',
  'CONTENT_RESTORED',
  'REFERRAL_BONUS',
] as const
export type PointsEventType = (typeof POINTS_EVENT_TYPES)[number]

/**
 * ⚠ STAGE 2e — PRE-APPROVAL IS GONE (Charlie, 24 Aug 2026).
 *
 * A claim awards on submission and a manager may reverse it afterwards, with a
 * reason. PENDING / APPROVED / DECLINED are kept only so historical rows still
 * read; `central_stage2e.sql` awarded every PENDING row and renamed every
 * APPROVED one, so nothing new is ever written with them.
 */
export const CLAIM_STATUSES = ['AWARDED', 'REVERSED', 'PENDING', 'APPROVED', 'DECLINED'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

/** The statuses that mean "this claim is currently paying". */
export const LIVE_CLAIM_STATUSES = ['AWARDED', 'APPROVED'] as const

/**
 * Two surfaces mint marks now — bulletin posts and question-library answers —
 * and they share one daily budget, because the budget is about how much one
 * member can move other members' scores in a day, not about which page they
 * were on when they did it.
 */
export const MARK_SOURCE_TYPES = ['BULLETIN_MARK', 'ANSWER_VOTE'] as const

/** Offline activities a member can claim, and the tariff key each pays out on. */
export const ACTIVITY_TYPES = [
  { key: 'CANVASSING_SESSION', label: 'Canvassing session', tariffKey: 'CLAIM_CANVASSING_SESSION' },
  { key: 'RAN_EVENT', label: 'Organised & ran an event', tariffKey: 'CLAIM_RAN_EVENT' },
  { key: 'GAVE_TRAINING', label: 'Gave a training session', tariffKey: 'CLAIM_GAVE_TRAINING' },
  { key: 'COMPLETED_TRAINING', label: 'Completed training as a trainee', tariffKey: 'CLAIM_COMPLETED_TRAINING' },
] as const
export type ActivityTypeKey = (typeof ACTIVITY_TYPES)[number]['key']

export const LEADERBOARD_WINDOWS = ['month', 'quarter', 'all'] as const
export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number]

/**
 * The leaderboard window is a VIEWER control, not an admin setting — which the
 * event ledger gives for free, since a window is only a `createdAt` filter.
 */
export function windowStart(window: LeaderboardWindow, now = new Date()): Date | null {
  if (window === 'all') return null
  const d = new Date(now)
  d.setMonth(d.getMonth() - (window === 'month' ? 1 : 3))
  return d
}

// ── tariffs and config ───────────────────────────────────────────────────────

export type ResolvedTariff = { id: string | null; actionKey: string; points: number }

/**
 * The tariff in force for an action right now: the active row with the latest
 * effectiveFrom at or before this moment. Callers stamp the result into the
 * event, which is what makes a later retune affect only subsequent events.
 */
export async function resolveTariff(actionKey: string, at = new Date()): Promise<ResolvedTariff> {
  const row = await prisma.pointsTariff.findFirst({
    where: { actionKey, active: true, effectiveFrom: { lte: at } },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (!row) {
    throw new CommunityRuleError(`No active tariff for ${actionKey} — seed one before awarding it`, 500)
  }
  return { id: row.id, actionKey, points: row.points }
}

const CONFIG_FALLBACKS: Record<string, number> = {
  REFERRAL_RATE_L1: 0.1,
  REFERRAL_RATE_L2: 0.05,
  REFERRAL_RATE_L3: 0.025,
  REFERRAL_DECAY_MONTHS: 6,
  REFERRAL_DECAY_FLOOR: 0.25,
  REFERRAL_REBOOST_POINTS: 50,
  DAILY_MARK_BUDGET: 20,
  // Stage 2d — 1 = members may share a phone number on an accepted training
  // match, 0 = email only. Seeded at 1 by central_stage2d.sql; the fallback is
  // here so a database without the row behaves like a database with it.
  TRAINING_PHONE_SHARING: 1,
}

export async function getConfig(key: string): Promise<number> {
  const row = await prisma.pointsConfig.findUnique({ where: { key } })
  if (row) return row.numericValue
  const fallback = CONFIG_FALLBACKS[key]
  if (fallback === undefined) throw new CommunityRuleError(`No config for ${key}`, 500)
  return fallback
}

// ── writing to the ledger ────────────────────────────────────────────────────

type EventInput = {
  userId: string
  communityId: string
  sourceCommunityId?: string | null
  type: PointsEventType
  points: number
  sourceType: string
  sourceId: string
  actorUserId?: string | null
  tariff: ResolvedTariff
}

function eventData(e: EventInput): Prisma.PointsEventCreateManyInput {
  return {
    userId: e.userId,
    communityId: e.communityId,
    sourceCommunityId: e.sourceCommunityId ?? null,
    type: e.type,
    points: e.points,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    actorUserId: e.actorUserId ?? null,
    tariffKey: e.tariff.actionKey,
    tariffPoints: e.tariff.points,
    tariffId: e.tariff.id,
  }
}

/**
 * Append one event, then mint the referral bonuses it earns.
 *
 * Bonuses are MINTED, never taken out of the earner's own award — a referral
 * chain must never make producing points worth less to the producer.
 */
export async function recordPointsEvent(e: EventInput): Promise<{ eventId: string; bonuses: number }> {
  const created = await prisma.pointsEvent.create({ data: eventData(e) })
  const bonuses = await mintReferralBonuses(created.id)
  await maybeReboostReferral(e.userId, e.communityId)
  return { eventId: created.id, bonuses }
}

// ── balances and leaderboards, all computed ──────────────────────────────────

export async function getUserPoints(
  userId: string,
  communityId: string,
  window: LeaderboardWindow = 'all',
): Promise<number> {
  const from = windowStart(window)
  const agg = await prisma.pointsEvent.aggregate({
    where: { userId, communityId, ...(from ? { createdAt: { gte: from } } : {}) },
    _sum: { points: true },
  })
  return agg._sum.points ?? 0
}

/** A user's Central total across every Community, for the dashboard/profile chip. */
export async function getUserCentralTotal(userId: string): Promise<number> {
  const agg = await prisma.pointsEvent.aggregate({ where: { userId }, _sum: { points: true } })
  return agg._sum.points ?? 0
}

export type LeaderboardRow = {
  userId: string
  name: string | null
  username: string
  points: number
}

/** Individuals in one Community. Scores are signed and may be negative. */
export async function getIndividualLeaderboard(
  communityId: string,
  window: LeaderboardWindow = 'all',
  limit = 50,
): Promise<LeaderboardRow[]> {
  const from = windowStart(window)
  const grouped = await prisma.pointsEvent.groupBy({
    by: ['userId'],
    where: { communityId, ...(from ? { createdAt: { gte: from } } : {}) },
    _sum: { points: true },
  })
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, name: true, username: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))

  return grouped
    .map((g) => ({
      userId: g.userId,
      name: byId.get(g.userId)?.name ?? null,
      username: byId.get(g.userId)?.username ?? 'unknown',
      points: g._sum.points ?? 0,
    }))
    // Descending, negatives last — a negative score is ranked, not hidden.
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
}

export type BranchLeaderboardRow = {
  communityId: string
  name: string
  points: number
  memberCount: number
  averagePoints: number
}

/**
 * Branches in one Community, by total or by per-member average.
 *
 * Attribution is by `sourceCommunityId` — the node the activity happened on —
 * not by current membership. Membership-derived totals would double-count
 * anyone in two branches and would silently rewrite a branch's history whenever
 * someone joined or left it.
 */
export async function getBranchLeaderboard(
  rootCommunityId: string,
  window: LeaderboardWindow = 'all',
  sort: 'total' | 'average' = 'total',
): Promise<BranchLeaderboardRow[]> {
  const from = windowStart(window)
  const nodeIds = await getSubtreeIds(rootCommunityId)

  const [nodes, grouped] = await Promise.all([
    prisma.community.findMany({
      where: { id: { in: nodeIds }, parentCommunityId: { not: null } },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    prisma.pointsEvent.groupBy({
      by: ['sourceCommunityId'],
      where: {
        communityId: rootCommunityId,
        sourceCommunityId: { in: nodeIds },
        ...(from ? { createdAt: { gte: from } } : {}),
      },
      _sum: { points: true },
    }),
  ])

  const pointsByNode = new Map(grouped.map((g) => [g.sourceCommunityId ?? '', g._sum.points ?? 0]))

  const rows = nodes.map((n) => {
    const points = pointsByNode.get(n.id) ?? 0
    const memberCount = n._count.members
    return {
      communityId: n.id,
      name: n.name,
      points,
      memberCount,
      // Per-member average is derived, so offering both sorts costs nothing.
      averagePoints: memberCount > 0 ? Math.round((points / memberCount) * 10) / 10 : 0,
    }
  })

  return rows.sort((a, b) =>
    sort === 'average' ? b.averagePoints - a.averagePoints : b.points - a.points,
  )
}

// ── marks ────────────────────────────────────────────────────────────────────

/**
 * Guardrails v1, checked before a mark is allowed:
 *   · you cannot mark your own content
 *   · one mark per user per item (the BulletinVote unique already enforces it;
 *     changing it emits a reversal plus a new event)
 *   · a daily budget of DAILY_MARK_BUDGET distinct items
 *
 * The budget is counted from the LEDGER, not from live BulletinVote rows:
 * withdrawing a mark deletes its vote row, so counting votes would let anyone
 * refund their own budget. Distinct items, so changing your mind about a post
 * you already marked today does not cost a second slot.
 */
export async function assertCanMark(
  userId: string,
  post: { authorId: string; id: string },
  noun: 'post' | 'answer' = 'post',
): Promise<void> {
  if (post.authorId === userId) {
    throw new CommunityRuleError(`You cannot vote on your own ${noun}`, 403)
  }

  const budget = await getConfig('DAILY_MARK_BUDGET')
  const since = new Date()
  since.setHours(0, 0, 0, 0)

  // ⚠ Deliberately NOT filtered by sourceType: bulletin marks and answer votes
  // share one daily budget. The limit is on how far one member can move other
  // members' scores in a day, not on which page they did it from.
  const marksToday = await prisma.pointsEvent.findMany({
    where: { actorUserId: userId, type: 'MARK_RECEIVED', createdAt: { gte: since } },
    select: { sourceId: true },
    distinct: ['sourceId'],
  })
  const alreadyMarkedThisItem = marksToday.some((m) => m.sourceId === post.id)
  if (!alreadyMarkedThisItem && marksToday.length >= budget) {
    throw new CommunityRuleError(
      `You have marked ${budget} items today — the daily limit. Try again tomorrow.`,
      429,
    )
  }
}

/**
 * Turn a mark into ledger events.
 *
 * `previousValue` is what the marker had before (0 = none). A change from +1 to
 * -1 appends a MARK_REMOVED reversing the old award AND a MARK_RECEIVED for the
 * new one; nothing is ever updated in place.
 */
export async function recordMarkEvents(params: {
  post: { id: string; authorId: string; communityId: string }
  markerUserId: string
  previousValue: number
  newValue: number
}): Promise<void> {
  const { post, markerUserId, previousValue, newValue } = params
  if (previousValue === newValue) return

  const rootId = await getRootCommunityId(post.communityId)

  if (previousValue !== 0) {
    // Reverse at the value the ORIGINAL award used, not at today's tariff —
    // otherwise a retune would let someone bank the difference by re-marking.
    const original = await prisma.pointsEvent.findFirst({
      where: {
        sourceType: 'BULLETIN_MARK',
        sourceId: post.id,
        actorUserId: markerUserId,
        type: 'MARK_RECEIVED',
      },
      orderBy: { createdAt: 'desc' },
    })
    if (original) {
      await recordPointsEvent({
        userId: post.authorId,
        communityId: rootId,
        sourceCommunityId: post.communityId,
        type: 'MARK_REMOVED',
        points: -original.points,
        sourceType: 'BULLETIN_MARK',
        sourceId: post.id,
        actorUserId: markerUserId,
        tariff: { id: original.tariffId, actionKey: original.tariffKey, points: original.tariffPoints },
      })
    }
  }

  if (newValue !== 0) {
    const tariff = await resolveTariff(newValue > 0 ? 'MARK_CONSTRUCTIVE' : 'MARK_UNCONSTRUCTIVE')
    await recordPointsEvent({
      userId: post.authorId,
      communityId: rootId,
      sourceCommunityId: post.communityId,
      type: 'MARK_RECEIVED',
      points: tariff.points,
      sourceType: 'BULLETIN_MARK',
      sourceId: post.id,
      actorUserId: markerUserId,
      tariff,
    })
  }
}

/**
 * The whole mark path in one call: guardrails, then the vote, then the ledger.
 *
 * Composed here rather than inside applyBulletinVote so that lib/community.ts
 * never has to import the points engine — the engine already depends on it, and
 * a cycle between the two would be a fragile way to save one function.
 */
export async function applyBulletinMark(
  postId: string,
  markerUserId: string,
  value: 1 | -1,
): Promise<{ score: number; myVote: number; authorPoints: number }> {
  const post = await prisma.bulletinPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, communityId: true, deletedAt: true },
  })
  if (!post) throw new CommunityRuleError('Post not found', 404)
  if (post.deletedAt) throw new CommunityRuleError('That post has been removed', 404)

  await assertCanMark(markerUserId, post)

  const result = await applyBulletinVote(postId, markerUserId, value)

  await recordMarkEvents({
    post,
    markerUserId,
    previousValue: result.previousVote,
    newValue: result.myVote,
  })

  const rootId = await getRootCommunityId(post.communityId)
  return {
    score: result.score,
    myVote: result.myVote,
    authorPoints: await getUserPoints(post.authorId, rootId),
  }
}

// ── answer votes (Stage 2e — the library joins the ledger) ───────────────────

/**
 * ⚠ THE DEFECT THIS CLOSES: an answer vote was never wired to the ledger at
 * all. Stage 2b built the vote as a ranking signal, Stage 2 built the ledger for
 * bulletin marks, and nobody joined them — so a member could be upvoted all day
 * and stay on zero. It was never a regression; it was never built.
 *
 * Mirrors bulletin marks exactly, and on purpose: the same two tariffs
 * (MARK_CONSTRUCTIVE +4 / MARK_UNCONSTRUCTIVE −4), the same MARK_RECEIVED /
 * MARK_REMOVED event types, and the same daily budget — one budget across both
 * surfaces, because the budget is about how far one member can move other
 * members' scores in a day, not about which page they did it from. Only
 * `sourceType` differs, so the two are still tellable apart in the ledger.
 */
export async function recordAnswerVoteEvents(params: {
  answer: { id: string; authorId: string; authorType: string; communityId: string }
  voterUserId: string
  previousDirection: VoteDirectionValue
  newDirection: VoteDirectionValue
}): Promise<void> {
  const { answer, voterUserId, previousDirection, newDirection } = params
  if (previousDirection === newDirection) return

  // ⚠ AN AI-AUTHORED ANSWER MINTS NOTHING. The vote is still recorded and still
  // ranks the answer — members should be able to say which answer is best
  // regardless of what wrote it — but no PointsEvent is written, because the
  // seed account must not accrue points for content nobody wrote.
  if (answer.authorType === 'AI') return

  const rootId = await getRootCommunityId(answer.communityId)

  if (previousDirection !== 0) {
    const original = await prisma.pointsEvent.findFirst({
      where: {
        sourceType: 'ANSWER_VOTE',
        sourceId: answer.id,
        actorUserId: voterUserId,
        type: 'MARK_RECEIVED',
      },
      orderBy: { createdAt: 'desc' },
    })
    if (original) {
      await recordPointsEvent({
        userId: answer.authorId,
        communityId: rootId,
        sourceCommunityId: answer.communityId,
        type: 'MARK_REMOVED',
        // Reversed at the value the ORIGINAL award used, never today's tariff.
        points: -original.points,
        sourceType: 'ANSWER_VOTE',
        sourceId: answer.id,
        actorUserId: voterUserId,
        tariff: { id: original.tariffId, actionKey: original.tariffKey, points: original.tariffPoints },
      })
    }
  }

  if (newDirection !== 0) {
    const tariff = await resolveTariff(newDirection > 0 ? 'MARK_CONSTRUCTIVE' : 'MARK_UNCONSTRUCTIVE')
    await recordPointsEvent({
      userId: answer.authorId,
      communityId: rootId,
      sourceCommunityId: answer.communityId,
      type: 'MARK_RECEIVED',
      points: tariff.points,
      sourceType: 'ANSWER_VOTE',
      sourceId: answer.id,
      actorUserId: voterUserId,
      tariff,
    })
  }
}

type VoteDirectionValue = 1 | -1 | 0

/**
 * The whole answer-vote path in one call: guardrails, then the vote, then the
 * ledger — the same composition as `applyBulletinMark`, for the same reason.
 * `lib/question-library.ts` never imports the points engine; the engine imports
 * it, and a cycle between the two would be a fragile way to save one function.
 */
export async function applyAnswerVote(
  answerId: string,
  voterUserId: string,
  direction: 'UP' | 'DOWN',
): Promise<{ myVote: 'UP' | 'DOWN' | null; score: number; authorPoints: number; minted: boolean }> {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      authorId: true,
      authorType: true,
      deletedAt: true,
      question: { select: { communityId: true, deletedAt: true } },
    },
  })
  if (!answer) throw new CommunityRuleError('Answer not found', 404)
  // A removed answer is not votable, and neither is one whose question went.
  // Without this a stale tab keeps paying points into content nobody can see.
  if (answer.deletedAt || answer.question.deletedAt) {
    throw new CommunityRuleError('That answer has been removed', 404)
  }

  // The budget is only spent where a vote can actually pay. An AI answer mints
  // nothing, so voting on one must not use up the day's allowance either.
  const mints = answer.authorType !== 'AI'
  if (mints) await assertCanMark(voterUserId, { authorId: answer.authorId, id: answer.id }, 'answer')

  const result = await setAnswerVote(answerId, voterUserId, direction)

  const asValue = (v: 'UP' | 'DOWN' | null): VoteDirectionValue => (v === 'UP' ? 1 : v === 'DOWN' ? -1 : 0)
  await recordAnswerVoteEvents({
    answer: {
      id: answer.id,
      authorId: answer.authorId,
      authorType: answer.authorType,
      communityId: answer.question.communityId,
    },
    voterUserId,
    previousDirection: asValue(result.previousVote),
    newDirection: asValue(result.myVote),
  })

  const rootId = await getRootCommunityId(answer.question.communityId)
  return {
    myVote: result.myVote,
    score: result.score,
    authorPoints: await getUserPoints(answer.authorId, rootId),
    minted: mints,
  }
}

// ── referrals ────────────────────────────────────────────────────────────────

/**
 * Record who introduced whom, for this Community. Called when an invite is
 * redeemed; a join request creates no chain, because nobody introduced them.
 * Self-referral and an existing chain are both no-ops rather than errors — the
 * caller is a join path, not a place to fail.
 */
export async function recordReferral(params: {
  communityId: string
  inviterUserId: string
  inviteeUserId: string
  /** CENTRAL 25-A §2b — which invitation they came through, where it is known. */
  inviteId?: string
}): Promise<boolean> {
  const { communityId, inviterUserId, inviteeUserId, inviteId } = params
  if (inviterUserId === inviteeUserId) return false

  const existing = await prisma.communityReferral.findUnique({
    where: { communityId_inviteeUserId: { communityId, inviteeUserId } },
  })
  if (existing) return false

  // Refuse a cycle: if the proposed inviter is already downstream of the
  // invitee, the chain would loop and mint bonuses forever.
  let cursor: string | null = inviterUserId
  let guard = 0
  while (cursor && guard++ < 10) {
    if (cursor === inviteeUserId) return false
    const up: { inviterUserId: string } | null = await prisma.communityReferral.findUnique({
      where: { communityId_inviteeUserId: { communityId, inviteeUserId: cursor } },
      select: { inviterUserId: true },
    })
    cursor = up?.inviterUserId ?? null
  }

  await prisma.communityReferral.create({
    data: { communityId, inviterUserId, inviteeUserId, inviteId },
  })
  return true
}

/**
 * The decay multiplier on one link: starts at 100% and halves every
 * REFERRAL_DECAY_MONTHS from `decayFrom`, never below REFERRAL_DECAY_FLOOR.
 * A reboost resets `decayFrom`, which is what puts the link back to 100%.
 */
export async function referralMultiplier(decayFrom: Date, now = new Date()): Promise<number> {
  const months = await getConfig('REFERRAL_DECAY_MONTHS')
  const floor = await getConfig('REFERRAL_DECAY_FLOOR')
  const elapsedMonths =
    (now.getFullYear() - decayFrom.getFullYear()) * 12 +
    (now.getMonth() - decayFrom.getMonth()) -
    (now.getDate() < decayFrom.getDate() ? 1 : 0)
  const halvings = Math.floor(Math.max(0, elapsedMonths) / months)
  return Math.max(floor, Math.pow(0.5, halvings))
}

/**
 * Mint the up-chain bonuses for one earning event, three layers deep.
 *
 * Only positive, non-bonus events pay a chain: a bonus on a bonus would
 * compound the tree, and paying a chain on a deduction would punish an inviter
 * for their invitee's bad post.
 *
 * ⚠ HARD CONSTRAINT, recorded in the spec: referral layers apply to REPUTATION
 * POINTS ONLY. They must never be extended to anything monetisable — tokens,
 * credits, or anything in Stage 4.
 */
export async function mintReferralBonuses(eventId: string): Promise<number> {
  const source = await prisma.pointsEvent.findUnique({ where: { id: eventId } })
  if (!source) return 0
  if (source.type === 'REFERRAL_BONUS') return 0
  if (source.points <= 0) return 0

  const rates = [
    await getConfig('REFERRAL_RATE_L1'),
    await getConfig('REFERRAL_RATE_L2'),
    await getConfig('REFERRAL_RATE_L3'),
  ]

  let cursorUserId = source.userId
  let minted = 0

  for (let layer = 0; layer < rates.length; layer++) {
    const link = await prisma.communityReferral.findUnique({
      where: { communityId_inviteeUserId: { communityId: source.communityId, inviteeUserId: cursorUserId } },
    })
    if (!link) break

    const multiplier = await referralMultiplier(link.decayFrom)

    // ⚠ STAGE 2e — ACCRUE THE FRACTION, DO NOT THROW IT AWAY.
    //
    // This used to be `Math.floor(source.points * rate * multiplier)`, which
    // paid nothing at all for the events people actually generate: a
    // constructive mark is worth 4, and 10% of 4 floors to 0. The chain earned
    // zero from any number of marks, and raising the mark value would only have
    // moved the threshold rather than removing it.
    //
    // The link now carries a decimal balance. A whole PointsEvent is minted
    // when it crosses 1.0 and the remainder stays on the link, so ten 4-point
    // marks pay the L1 inviter exactly 4 — the same total the old arithmetic
    // was aiming at and never reached.
    const accrued = link.bonusBalance + source.points * rates[layer] * multiplier
    const points = Math.floor(accrued)
    const remainder = accrued - points

    await prisma.communityReferral.update({
      where: { id: link.id },
      data: { bonusBalance: remainder },
    })

    if (points > 0) {
      await prisma.pointsEvent.create({
        data: eventData({
          userId: link.inviterUserId,
          communityId: source.communityId,
          sourceCommunityId: source.sourceCommunityId,
          type: 'REFERRAL_BONUS',
          points,
          // Tagged with the event it derives from, so a bonus is always
          // traceable to the work that produced it.
          sourceType: 'POINTS_EVENT',
          sourceId: source.id,
          actorUserId: source.userId,
          tariff: {
            id: null,
            actionKey: `REFERRAL_L${layer + 1}`,
            // Stamp the EFFECTIVE rate, decay included, so a ledger row explains
            // its own value without re-deriving the decay clock.
            points: Math.round(rates[layer] * multiplier * 1000),
          },
        }),
      })
      minted++
    }

    cursorUserId = link.inviterUserId
  }

  return minted
}

/**
 * Reboost: when someone's own invitee first crosses REFERRAL_REBOOST_POINTS,
 * the link above that invitee — i.e. the inviter's link on them — goes back to
 * 100%. That rewards the person who recruited a producer, which is the point.
 * Fires once per link; `boostedAt` records it.
 */
export async function maybeReboostReferral(earnerUserId: string, communityId: string): Promise<boolean> {
  const link = await prisma.communityReferral.findUnique({
    where: { communityId_inviteeUserId: { communityId, inviteeUserId: earnerUserId } },
  })
  if (!link || link.boostedAt) return false

  const threshold = await getConfig('REFERRAL_REBOOST_POINTS')
  // The invitee's own earnings, excluding bonuses they received from further
  // down — a chain must not be able to reboost itself.
  const agg = await prisma.pointsEvent.aggregate({
    where: { userId: earnerUserId, communityId, type: { not: 'REFERRAL_BONUS' } },
    _sum: { points: true },
  })
  if ((agg._sum.points ?? 0) < threshold) return false

  await prisma.communityReferral.update({
    where: { id: link.id },
    data: { decayFrom: new Date(), boostedAt: new Date() },
  })
  return true
}

// ── activity claims ──────────────────────────────────────────────────────────

/**
 * Log an offline activity — and pay it, now.
 *
 * ⚠ STAGE 2e: THE APPROVAL GATE IS GONE (Charlie, 24 Aug 2026). It used to
 * create a PENDING row and wait for a manager. In a pilot that meant a member
 * did the work, logged it, and watched their score stay at zero — which reads
 * as the feature being broken rather than as a queue. Speed for members;
 * accountability kept through visibility plus `reverseActivityClaim`.
 */
export async function createActivityClaim(params: {
  userId: string
  communityId: string
  activityType: string
  occurredAt: Date
  evidenceUrl?: string | null
  note?: string | null
}) {
  const { userId, communityId, activityType, occurredAt } = params

  const activity = ACTIVITY_TYPES.find((a) => a.key === activityType)
  if (!activity) throw new CommunityRuleError('Unknown activity type', 422)
  if (occurredAt.getTime() > Date.now() + 60_000) {
    throw new CommunityRuleError('You cannot log an activity that has not happened yet', 422)
  }
  // Self-claims only: the userId is always the caller's, never a parameter the
  // client can choose. Enforced at the route; asserted here for the same reason.
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  })
  if (!membership) throw new CommunityRuleError('Join this branch before logging activity for it', 403)

  const dayStart = new Date(occurredAt)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  // A REVERSED claim frees the day again, exactly as a DECLINED one did: a
  // reversal says the claim should not have paid, so the member has to be able
  // to put it right. Mirrors the ActivityClaim_one_per_day index predicate.
  const duplicate = await prisma.activityClaim.findFirst({
    where: {
      userId,
      activityType,
      status: { notIn: ['DECLINED', 'REVERSED'] },
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
  })
  if (duplicate) {
    throw new CommunityRuleError(
      'You have already logged that activity for that day',
      409,
    )
  }

  const claim = await prisma.activityClaim.create({
    data: {
      userId,
      communityId,
      activityType,
      occurredAt,
      evidenceUrl: params.evidenceUrl?.trim() || null,
      note: params.note?.trim() || null,
      status: 'AWARDED',
    },
    include: { user: { select: { id: true, name: true, username: true } } },
  })

  return { ...claim, awarded: await awardClaimPoints(claim) }
}

/**
 * Pay one claim its tariff.
 *
 * ⚠ SHARED ON PURPOSE. `lib/training.ts` raises a claim for the OTHER
 * participant when a training session is logged, and it does so directly rather
 * than through `createActivityClaim` (that function is the self-claim path).
 * Under the old model that was harmless — both routes produced a PENDING row
 * and a manager paid it. With pre-approval gone, a claim that does not go
 * through here is a claim that never pays, silently. So both go through here.
 */
export async function awardClaimPoints(claim: {
  id: string
  userId: string
  communityId: string
  activityType: string
}): Promise<number> {
  const activity = ACTIVITY_TYPES.find((a) => a.key === claim.activityType)
  if (!activity) throw new CommunityRuleError('Unknown activity type on this claim', 422)

  const tariff = await resolveTariff(activity.tariffKey)
  const rootId = await getRootCommunityId(claim.communityId)
  await recordPointsEvent({
    userId: claim.userId,
    communityId: rootId,
    sourceCommunityId: claim.communityId,
    type: 'CLAIM_APPROVED',
    points: tariff.points,
    sourceType: 'ACTIVITY_CLAIM',
    sourceId: claim.id,
    // Nobody decided this — it was logged and it paid. An actor here would name
    // a manager who never touched it.
    actorUserId: null,
    tariff,
  })
  return tariff.points
}

/**
 * Reverse an awarded claim. Managers of that node, or of any node above it.
 *
 * ⚠ THE LEDGER ONLY EVER APPENDS. This writes a second event at the value the
 * ORIGINAL award used, read back from the ledger — never today's tariff, or a
 * retune between award and reversal would let the difference be banked. Both
 * rows stay, so the activity log shows that it was paid and then taken back.
 *
 * A reason is REQUIRED. An unaccountable clawback is precisely what
 * award-then-reverse must not become.
 */
export async function reverseActivityClaim(
  claimId: string,
  managerId: string,
  reason: string,
): Promise<{ claim: { id: string; status: string }; reversed: number }> {
  if (!reason.trim()) {
    throw new CommunityRuleError('Say why you are reversing this — the claimant is told the reason', 422)
  }

  const claim = await prisma.activityClaim.findUnique({
    where: { id: claimId },
    include: { community: { select: { id: true, name: true } } },
  })
  if (!claim) throw new CommunityRuleError('Claim not found', 404)
  if (claim.status === 'REVERSED') {
    throw new CommunityRuleError('That claim has already been reversed', 409)
  }
  if (!(LIVE_CLAIM_STATUSES as readonly string[]).includes(claim.status)) {
    throw new CommunityRuleError(`That claim is ${claim.status.toLowerCase()} and paid nothing`, 409)
  }
  if (!(await canManageCommunity(managerId, claim.communityId))) {
    throw new CommunityRuleError('You cannot reverse claims for this branch', 403)
  }

  const original = await prisma.pointsEvent.findFirst({
    where: { sourceType: 'ACTIVITY_CLAIM', sourceId: claim.id, type: 'CLAIM_APPROVED' },
    orderBy: { createdAt: 'desc' },
  })
  if (!original) {
    throw new CommunityRuleError('That claim never paid, so there is nothing to reverse', 409)
  }

  await recordPointsEvent({
    userId: claim.userId,
    communityId: original.communityId,
    sourceCommunityId: original.sourceCommunityId,
    type: 'CLAIM_REVERSED',
    points: -original.points,
    sourceType: 'ACTIVITY_CLAIM',
    sourceId: claim.id,
    actorUserId: managerId,
    tariff: { id: original.tariffId, actionKey: original.tariffKey, points: original.tariffPoints },
  })

  const updated = await prisma.activityClaim.update({
    where: { id: claimId },
    data: {
      status: 'REVERSED',
      reversedByUserId: managerId,
      reversedAt: new Date(),
      reversalReason: reason.trim(),
    },
  })

  await prisma.notification.create({
    data: {
      userId: claim.userId,
      type: 'SYSTEM',
      title: 'Activity reversed',
      message:
        `Your ${claim.activityType.toLowerCase().replace(/_/g, ' ')} in ${claim.community.name} ` +
        `was reversed — ${original.points} points taken back. Reason: ${reason.trim()}`,
      linkUrl: `/communities/${claim.communityId}/activity`,
    },
  })

  return { claim: { id: updated.id, status: updated.status }, reversed: original.points }
}

/**
 * Claims on this node a manager can act on.
 *
 * Defaults to AWARDED — the reversible ones — because after Stage 2e there is
 * no pending queue. PENDING is still a valid argument so that any row left over
 * from the old model is reachable rather than stranded.
 */
export async function listActivityClaims(communityId: string, status: ClaimStatus = 'AWARDED') {
  const claims = await prisma.activityClaim.findMany({
    where: { communityId, status },
    include: { user: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const events = await prisma.pointsEvent.findMany({
    where: {
      sourceType: 'ACTIVITY_CLAIM',
      sourceId: { in: claims.map((c) => c.id) },
      type: 'CLAIM_APPROVED',
    },
    select: { sourceId: true, points: true },
  })
  const paid = new Map(events.map((e) => [e.sourceId, e.points]))
  return claims.map((c) => ({ ...c, awarded: paid.get(c.id) ?? 0 }))
}

/**
 * The Community activity log: every claim across the whole tree, what it paid,
 * and — where one happened — who reversed it and why.
 *
 * ⚠ STAGE 2e: with pre-approval gone, THIS LOG IS THE ACCOUNTABILITY. There is
 * no longer a manager standing between the claim and the points, so the fact
 * that every award is witnessed by the whole Community, and reversible with a
 * stated reason, is the whole of the anti-abuse mechanism. Ordered by when the
 * claim was made, because an auto-awarded claim has no decision date.
 */
export async function getCommunityActivityLog(rootCommunityId: string, limit = 100) {
  const nodeIds = await getSubtreeIds(rootCommunityId)
  const claims = await prisma.activityClaim.findMany({
    where: { communityId: { in: nodeIds }, status: { not: 'PENDING' } },
    include: {
      user: { select: { id: true, name: true, username: true } },
      decidedBy: { select: { id: true, name: true, username: true } },
      reversedBy: { select: { id: true, name: true, username: true } },
      community: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Only the AWARD event, never the reversal — otherwise a reversed claim would
  // read as having paid nothing rather than as having paid and been taken back.
  const events = await prisma.pointsEvent.findMany({
    where: {
      sourceType: 'ACTIVITY_CLAIM',
      sourceId: { in: claims.map((c) => c.id) },
      type: 'CLAIM_APPROVED',
    },
    select: { sourceId: true, points: true },
  })
  const pointsByClaim = new Map(events.map((e) => [e.sourceId, e.points]))

  return claims.map((c) => ({
    id: c.id,
    activityType: c.activityType,
    label: ACTIVITY_TYPES.find((a) => a.key === c.activityType)?.label ?? c.activityType,
    occurredAt: c.occurredAt,
    status: c.status,
    note: c.note,
    evidenceUrl: c.evidenceUrl,
    claimant: c.user,
    decidedBy: c.decidedBy,
    decidedAt: c.decidedAt,
    reversedBy: c.reversedBy,
    reversedAt: c.reversedAt,
    reversalReason: c.reversalReason,
    community: c.community,
    pointsAwarded: pointsByClaim.get(c.id) ?? 0,
    createdAt: c.createdAt,
  }))
}
