import { prisma } from './prisma'

export const POINTS_SCHEDULE = {
  IDEA_STARTED:              { points: 10,  category: 'STRATEGIST',   cap: { type: 'idea_count', max: 5 } },
  STAGE_2_ADVANCE:           { points: 10,  category: 'STRATEGIST',   cap: { type: 'idea_count', max: 5 } },
  DIAGNOSIS_COMPLETE:        { points: 12,  category: 'STRATEGIST',   cap: { type: 'idea_count', max: 3 } },
  GUIDING_POLICY_COMPLETE:   { points: 12,  category: 'STRATEGIST',   cap: { type: 'idea_count', max: 3 } },
  FIRST_COHERENT_ACTION:     { points: 12,  category: 'STRATEGIST',   cap: { type: 'idea_count', max: 3 } },
  RESEARCH_ADDED:            { points: 3,   category: 'STRATEGIST',   cap: { type: 'per_idea', max: 6, ideaMax: 3 } },
  STAGE_3_ADVANCE:           { points: 35,  category: 'STRATEGIST',   cap: { type: 'idea_count', max: 3 } },
  STAGE_4_ADVANCE:           { points: 75,  category: 'STRATEGIST',   cap: { type: 'idea_count', max: 3 } },
  STAGE_5_ADVANCE:           { points: 150, category: 'STRATEGIST',   cap: { type: 'idea_count', max: 3 } },
  CONTRIBUTION_SUBMITTED:    { points: 4,   category: 'THINKER',      cap: null },
  CONTRIBUTION_RATED_3:      { points: 4,   category: 'THINKER',      cap: null },
  CONTRIBUTION_RATED_4:      { points: 8,   category: 'THINKER',      cap: null },
  CONTRIBUTION_RATED_5:      { points: 12,  category: 'THINKER',      cap: null },
  CONTRIBUTION_RATED_1_2:    { points: -4,  category: 'THINKER',      cap: null },
  IDEA_RATED:                { points: 2,   category: 'THINKER',      cap: { type: 'once_per_idea' } },
  IDEA_VOTED:                { points: 3,   category: 'STRATEGIST',   cap: { type: 'once_per_idea' } },
  AMENDMENT_ACCEPTED:        { points: 100, category: 'THINKER',      cap: null },
  REFERRAL_JOIN:             { points: 10,  category: 'RALLYMASTER',  cap: null },
  REFERRAL_QUALIFIED:        { points: 75,  category: 'RALLYMASTER',  cap: null },
} as const

type ActionType = keyof typeof POINTS_SCHEDULE
type Category = 'STRATEGIST' | 'THINKER' | 'RALLYMASTER' | 'RAINMAKER' | 'TEAMBUILDER'

async function checkCap(userId: string, actionType: string, relatedIdeaId?: string): Promise<boolean> {
  const schedule = POINTS_SCHEDULE[actionType as ActionType]
  if (!schedule?.cap) return false

  const cap = schedule.cap

  if (cap.type === 'once_per_idea') {
    if (!relatedIdeaId) return false
    const existing = await prisma.pointsLedger.count({
      where: { userId, actionType, relatedIdeaId },
    })
    return existing > 0
  }

  if (cap.type === 'idea_count') {
    const existingIdeas = await prisma.pointsLedger.findMany({
      where: { userId, actionType },
      select: { relatedIdeaId: true },
      distinct: ['relatedIdeaId'],
    })
    const alreadyAwardedForThisIdea = existingIdeas.some(e => e.relatedIdeaId === relatedIdeaId)
    if (alreadyAwardedForThisIdea) return true
    return existingIdeas.length >= (cap as { type: string; max: number }).max
  }

  if (cap.type === 'per_idea') {
    if (!relatedIdeaId) return false
    const perIdeaCount = await prisma.pointsLedger.count({
      where: { userId, actionType, relatedIdeaId },
    })
    if (perIdeaCount >= (cap as { type: string; max: number }).max) return true
    const distinctIdeas = await prisma.pointsLedger.findMany({
      where: { userId, actionType },
      select: { relatedIdeaId: true },
      distinct: ['relatedIdeaId'],
    })
    const alreadyAwardedForThisIdea = distinctIdeas.some(e => e.relatedIdeaId === relatedIdeaId)
    if (!alreadyAwardedForThisIdea && distinctIdeas.length >= (cap as { type: string; ideaMax: number }).ideaMax) return true
    return false
  }

  return false
}

async function awardPointsDirect(params: {
  userId: string
  category: Category
  points: number
  reason: string
  relatedIdeaId?: string | null
  relatedUserId?: string | null
}): Promise<void> {
  const repField = `reputationPoints${params.category.charAt(0) + params.category.slice(1).toLowerCase()}` as
    | 'reputationPointsStrategist'
    | 'reputationPointsThinker'
    | 'reputationPointsRallymaster'
    | 'reputationPointsRainmaker'
    | 'reputationPointsTeambuilder'

  await prisma.$transaction([
    prisma.pointsLedger.create({
      data: {
        userId: params.userId,
        category: params.category as Parameters<typeof prisma.pointsLedger.create>[0]['data']['category'],
        pointsDelta: params.points,
        actionType: params.reason,
        reason: params.reason as Parameters<typeof prisma.pointsLedger.create>[0]['data']['reason'],
        relatedIdeaId: params.relatedIdeaId ?? null,
        relatedUserId: params.relatedUserId ?? null,
      },
    }),
    prisma.reputation.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        [repField]: params.points,
      },
      update: {
        [repField]: { increment: params.points },
      },
    }),
  ])
}

export async function awardPoints(params: {
  userId: string
  actionType: ActionType
  relatedIdeaId?: string
  relatedUserId?: string
}): Promise<boolean> {
  const schedule = POINTS_SCHEDULE[params.actionType]
  if (!schedule) return false

  const cappedOut = await checkCap(params.userId, params.actionType, params.relatedIdeaId)
  if (cappedOut) return false

  await awardPointsDirect({
    userId: params.userId,
    category: schedule.category,
    points: schedule.points,
    reason: params.actionType,
    relatedIdeaId: params.relatedIdeaId ?? null,
    relatedUserId: params.relatedUserId ?? null,
  })

  // Cascade Teambuilder points for Strategist/Thinker awards
  if (schedule.category === 'STRATEGIST' || schedule.category === 'THINKER') {
    await cascadeTeambuilderPoints(params.userId, schedule.points)
  }

  return true
}

export async function cascadeTeambuilderPoints(earnerUserId: string, pointsEarned: number): Promise<void> {
  const earner = await prisma.user.findUnique({
    where: { id: earnerUserId },
    select: { referredByUserId: true },
  })
  if (!earner?.referredByUserId) return

  const level1Points = Math.floor(pointsEarned * 0.3)
  if (level1Points > 0) {
    await awardPointsDirect({
      userId: earner.referredByUserId,
      category: 'TEAMBUILDER',
      points: level1Points,
      reason: 'TEAMBUILDER_CASCADE',
      relatedUserId: earnerUserId,
    })
  }

  const referrer = await prisma.user.findUnique({
    where: { id: earner.referredByUserId },
    select: { referredByUserId: true },
  })
  if (!referrer?.referredByUserId) return
  const level2Points = Math.floor(pointsEarned * 0.1)
  if (level2Points > 0) {
    await awardPointsDirect({
      userId: referrer.referredByUserId,
      category: 'TEAMBUILDER',
      points: level2Points,
      reason: 'TEAMBUILDER_CASCADE',
      relatedUserId: earnerUserId,
    })
  }
}
