import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  CommunityRuleError,
  getRootCommunityId,
  canManageCommunity,
  getSubtreeIds,
  applyBulletinVote,
} from '@/lib/community'

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
  'REFERRAL_BONUS',
] as const
export type PointsEventType = (typeof POINTS_EVENT_TYPES)[number]

export const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'DECLINED'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

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
export async function assertCanMark(userId: string, post: { authorId: string; id: string }): Promise<void> {
  if (post.authorId === userId) {
    throw new CommunityRuleError('You cannot mark your own post', 403)
  }

  const budget = await getConfig('DAILY_MARK_BUDGET')
  const since = new Date()
  since.setHours(0, 0, 0, 0)

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
    select: { id: true, authorId: true, communityId: true },
  })
  if (!post) throw new CommunityRuleError('Post not found', 404)

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
}): Promise<boolean> {
  const { communityId, inviterUserId, inviteeUserId } = params
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

  await prisma.communityReferral.create({ data: { communityId, inviterUserId, inviteeUserId } })
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
    // Rounded down: a bonus is a share, never a rounding-up gift.
    const points = Math.floor(source.points * rates[layer] * multiplier)

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

export async function createActivityClaim(params: {
  userId: string
  communityId: string
  activityType: string
  occurredAt: Date
  evidenceUrl?: string | null
  note?: string | null
}) {
  const { userId, communityId, activityType, occurredAt } = params

  if (!ACTIVITY_TYPES.some((a) => a.key === activityType)) {
    throw new CommunityRuleError('Unknown activity type', 422)
  }
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

  const duplicate = await prisma.activityClaim.findFirst({
    where: {
      userId,
      activityType,
      status: { not: 'DECLINED' },
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
  })
  if (duplicate) {
    throw new CommunityRuleError(
      'You have already logged that activity for that day',
      409,
    )
  }

  return prisma.activityClaim.create({
    data: {
      userId,
      communityId,
      activityType,
      occurredAt,
      evidenceUrl: params.evidenceUrl?.trim() || null,
      note: params.note?.trim() || null,
    },
    include: { user: { select: { id: true, name: true, username: true } } },
  })
}

/** Approve or decline. Approval pays the tariff; a decline pays nothing. Both
 *  land in the Community activity log, which is the anti-abuse mechanism. */
export async function decideActivityClaim(
  claimId: string,
  deciderId: string,
  decision: 'APPROVED' | 'DECLINED',
) {
  const claim = await prisma.activityClaim.findUnique({
    where: { id: claimId },
    include: { community: { select: { id: true, name: true } } },
  })
  if (!claim) throw new CommunityRuleError('Claim not found', 404)
  if (claim.status !== 'PENDING') {
    throw new CommunityRuleError(`This claim was already ${claim.status.toLowerCase()}`, 409)
  }
  if (!(await canManageCommunity(deciderId, claim.communityId))) {
    throw new CommunityRuleError('You cannot decide claims for this branch', 403)
  }
  if (claim.userId === deciderId) {
    throw new CommunityRuleError('You cannot approve your own claim', 403)
  }

  let awarded = 0
  if (decision === 'APPROVED') {
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
      actorUserId: deciderId,
      tariff,
    })
    awarded = tariff.points
  }

  const updated = await prisma.activityClaim.update({
    where: { id: claimId },
    data: { status: decision, decidedByUserId: deciderId, decidedAt: new Date() },
  })

  await prisma.notification.create({
    data: {
      userId: claim.userId,
      type: 'SYSTEM',
      title: decision === 'APPROVED' ? 'Activity approved' : 'Activity declined',
      message:
        decision === 'APPROVED'
          ? `Your ${claim.activityType.toLowerCase().replace(/_/g, ' ')} in ${claim.community.name} was approved — ${awarded} points`
          : `Your ${claim.activityType.toLowerCase().replace(/_/g, ' ')} claim in ${claim.community.name} was declined`,
      linkUrl: `/communities/${claim.communityId}/activity`,
    },
  })

  return { claim: updated, awarded }
}

export async function listActivityClaims(communityId: string, status: ClaimStatus = 'PENDING') {
  return prisma.activityClaim.findMany({
    where: { communityId, status },
    include: { user: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * The Community activity log: every decided claim across the whole tree, who
 * decided it and what it paid. Visible to every member of the Community — the
 * point is that approvals are witnessed, not private.
 */
export async function getCommunityActivityLog(rootCommunityId: string, limit = 100) {
  const nodeIds = await getSubtreeIds(rootCommunityId)
  const claims = await prisma.activityClaim.findMany({
    where: { communityId: { in: nodeIds }, status: { not: 'PENDING' } },
    include: {
      user: { select: { id: true, name: true, username: true } },
      decidedBy: { select: { id: true, name: true, username: true } },
      community: { select: { id: true, name: true } },
    },
    orderBy: { decidedAt: 'desc' },
    take: limit,
  })

  const events = await prisma.pointsEvent.findMany({
    where: { sourceType: 'ACTIVITY_CLAIM', sourceId: { in: claims.map((c) => c.id) } },
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
    community: c.community,
    pointsAwarded: pointsByClaim.get(c.id) ?? 0,
  }))
}
