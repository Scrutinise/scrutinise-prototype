import { prisma } from './prisma'
import type { Idea } from '@prisma/client'
import { awardPoints } from './points'

// Quality score mapping for IdeaReview outcomes (Stage 3→4 gate)
const REVIEW_OUTCOME_SCORE: Record<string, number> = {
  VIEWED: 3,
  ENDORSED: 5,
  BELOW_STANDARD: 0,
}

/**
 * Stage 1→2: AUTOMATIC
 * Fires on every field-approval write when all 7 Page 1 (Initial Information) fields
 * are complete: title, summaryDescription, summaryDiagnosis, backgroundResearch,
 * ideaLegislation (≥1 link), initialThoughts, govtArea.
 *
 * Previously fired after title + summaryDescription only — fixed in L6-C Task 8.
 * Consumers of idea.stage affected by this change:
 *   - app/api/ai/[ideaId]/route.ts: isStage1 / currentStage passed to buildSystemPrompt.
 *     Effect: Lex prompt will correctly show STAGE_1 context for the full Page 1 journey.
 *     Was showing STAGE_2 from field 3 onwards. Now fixed.
 *   - app/api/ideas/[id]/route.ts: awards IDEA_STARTED points when idea is blank at STAGE_1.
 *     Effect: no change — IDEA_STARTED is guarded by content being blank, not by stage alone.
 *   - app/api/ideas/[id]/contributions/route.ts: isStage2 flag used for comment visibility.
 *     Effect: ideas with only 2 fields filled stayed STAGE_1 — minor; not user-facing yet.
 *   - app/api/ideas/[id]/vote/route.ts: gates voting to STAGE_4+. Not affected.
 *   - app/sitemap.ts: filters STAGE_3+. Not affected.
 *   - All endorsement/review routes: gate STAGE_4+. Not affected.
 */
export async function checkAndAdvanceStage(ideaId: string, ownerId: string): Promise<void> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      stage: true,
      title: true,
      summaryDescription: true,
      summaryDiagnosis: true,
      backgroundResearch: true,
      initialThoughts: true,
      govtArea: true,
      diagnosis: true,
      guidingPolicy: true,
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
      legislationLinks: { select: { id: true } },
    },
  })

  if (!idea) return

  // Stage 1 → 2: all 7 Page 1 (Initial Information) fields must be complete.
  // ideaLegislation requires ≥1 linked legislation row — a skip (zero rows) keeps
  // the gate closed; the user must link at least one Act to advance.
  const page1Complete =
    idea.stage === 'STAGE_1' &&
    !!idea.title?.trim() &&
    !!idea.summaryDescription?.trim() &&
    !!idea.summaryDiagnosis?.trim() &&
    !!idea.backgroundResearch?.trim() &&
    (idea.legislationLinks?.length ?? 0) > 0 &&
    idea.initialThoughts != null &&
    !!idea.govtArea?.trim()

  if (page1Complete) {
    await prisma.$transaction([
      prisma.idea.update({
        where: { id: ideaId },
        data: { stage: 'STAGE_2' },
      }),
      prisma.stageTransition.create({
        data: {
          ideaId,
          fromStage: 'STAGE_1',
          toStage: 'STAGE_2',
          triggeredByUserId: ownerId,
          transitionReason: 'Automatic: all 7 Page 1 (Initial Information) fields completed',
        },
      }),
      prisma.notification.create({
        data: {
          userId: ownerId,
          type: 'STAGE_ELIGIBLE',
          relatedIdeaId: ideaId,
          title: 'Your idea has advanced to Draft!',
          message: 'Lex has captured your strategic kernel. Your idea is now in the Draft stage — time to refine it with a small trusted team.',
        },
      }),
    ])
    await awardPoints({ userId: ownerId, actionType: 'STAGE_2_ADVANCE', relatedIdeaId: ideaId })
  }
}

/**
 * Stage 2→3 gate check (manual — "Take Public")
 * Returns null if gate passes, or an error message if blocked.
 */
export async function checkStage2to3Gate(ideaId: string): Promise<string | null> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      diagnosis: true,
      guidingPolicy: true,
      summaryCoherentActions: true,
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
    },
  })

  if (!idea) return 'Idea not found'

  const errors: string[] = []

  if (!idea.diagnosis?.trim()) errors.push('Problem / diagnosis must be completed')
  if (!idea.guidingPolicy?.trim()) errors.push('Guiding policy must be completed')
  const hasCoherentAction =
    idea.coherentActions.length >= 1 || !!idea.summaryCoherentActions?.trim()
  if (!hasCoherentAction) errors.push('At least 1 coherent action required')
  if (idea.research.length < 3) errors.push(`At least 3 research items required (currently ${idea.research.length})`)

  return errors.length > 0 ? errors.join('; ') : null
}

/**
 * Stage 3→4 gate check (manual — "Begin Campaign")
 * Returns null if gate passes, or an error message if blocked.
 */
export async function checkStage3to4Gate(ideaId: string): Promise<string | null> {
  const reviews = await prisma.ideaReview.findMany({
    where: { ideaId },
    select: { outcome: true },
  })

  const reviewCount = reviews.length
  const avgQualityRating =
    reviewCount === 0
      ? 0
      : reviews.reduce((sum, r) => sum + (REVIEW_OUTCOME_SCORE[r.outcome] ?? 3), 0) / reviewCount

  const errors: string[] = []
  if (reviewCount < 12)
    errors.push(`At least 12 unique reviews required (currently ${reviewCount})`)
  if (avgQualityRating < 2.5)
    errors.push(`Average quality rating must be ≥ 2.5 (currently ${avgQualityRating.toFixed(1)})`)

  return errors.length > 0 ? errors.join('; ') : null
}

/**
 * Returns review count + average quality rating for Stage 3→4 gate display.
 */
export async function getStage3GateData(
  ideaId: string,
): Promise<{ reviewCount: number; avgQualityRating: number }> {
  const reviews = await prisma.ideaReview.findMany({
    where: { ideaId },
    select: { outcome: true },
  })

  const reviewCount = reviews.length
  const avgQualityRating =
    reviewCount === 0
      ? 0
      : reviews.reduce((sum, r) => sum + (REVIEW_OUTCOME_SCORE[r.outcome] ?? 3), 0) / reviewCount

  return { reviewCount, avgQualityRating }
}

/**
 * Advance idea from Stage 3 to Stage 4 (manual).
 * Call after checkStage3to4Gate() returns null.
 */
export async function advanceStage3to4(ideaId: string, ownerId: string): Promise<void> {
  await prisma.$transaction([
    prisma.idea.update({
      where: { id: ideaId },
      data: {
        stage: 'STAGE_4',
        visibility: 'PLATFORM_LISTED',
      },
    }),
    prisma.stageTransition.create({
      data: {
        ideaId,
        fromStage: 'STAGE_3',
        toStage: 'STAGE_4',
        triggeredByUserId: ownerId,
        transitionReason: 'Manual: owner began campaign',
      },
    }),
  ])
  await awardPoints({ userId: ownerId, actionType: 'STAGE_4_ADVANCE', relatedIdeaId: ideaId })
}

/**
 * Stage 4→5 gate check (manual — "Submit to Parliament")
 * Gate: ≥3 MP endorsements, ≥3 Peer endorsements, ≥1 DraftsmanEndorsement,
 *       all proposedWording fields non-empty.
 * Returns null if gate passes, or an error message if blocked.
 */
export async function checkStage4to5Gate(ideaId: string): Promise<string | null> {
  const [idea, mpCount, peerCount, draftsmanCount] = await Promise.all([
    prisma.idea.findUnique({
      where: { id: ideaId },
      select: {
        proposedWording: true,
        coherentActions: { select: { proposedWording: true } },
      },
    }),
    prisma.endorsement.count({
      where: { ideaId, endorserRole: 'MP', status: 'ACTIVE' },
    }),
    prisma.endorsement.count({
      where: { ideaId, endorserRole: 'PEER', status: 'ACTIVE' },
    }),
    prisma.draftsmanEndorsement.count({
      where: { ideaId, status: 'ACTIVE' },
    }),
  ])

  if (!idea) return 'Idea not found'

  const errors: string[] = []

  if (mpCount < 3)
    errors.push(`At least 3 MP endorsements required (currently ${mpCount})`)
  if (peerCount < 3)
    errors.push(`At least 3 Peer endorsements required (currently ${peerCount})`)
  if (draftsmanCount < 1)
    errors.push('A Parliamentary Draftsman endorsement is required')

  const mainWordingEmpty = !idea.proposedWording?.trim()
  const actionWordingEmpty = idea.coherentActions.some(a => !a.proposedWording?.trim())
  if (mainWordingEmpty || actionWordingEmpty)
    errors.push('All proposed wording fields must be completed')

  return errors.length > 0 ? errors.join('; ') : null
}

/**
 * Returns gate data for Stage 4→5 display.
 */
export async function getStage4GateData(ideaId: string): Promise<{
  mpCount: number
  peerCount: number
  draftsmanCount: number
  wordingComplete: boolean
}> {
  const [idea, mpCount, peerCount, draftsmanCount] = await Promise.all([
    prisma.idea.findUnique({
      where: { id: ideaId },
      select: {
        proposedWording: true,
        coherentActions: { select: { proposedWording: true } },
      },
    }),
    prisma.endorsement.count({
      where: { ideaId, endorserRole: 'MP', status: 'ACTIVE' },
    }),
    prisma.endorsement.count({
      where: { ideaId, endorserRole: 'PEER', status: 'ACTIVE' },
    }),
    prisma.draftsmanEndorsement.count({
      where: { ideaId, status: 'ACTIVE' },
    }),
  ])

  const wordingComplete = !!idea?.proposedWording?.trim() &&
    (idea?.coherentActions.every(a => !!a.proposedWording?.trim()) ?? true)

  return { mpCount, peerCount, draftsmanCount, wordingComplete }
}

/**
 * Advance idea from Stage 4 to Stage 5 (manual).
 * Call after checkStage4to5Gate() returns null.
 * Notifies all IdeaAlert holders with STAGE_CHANGE.
 */
export async function advanceStage4to5(ideaId: string, ownerId: string): Promise<void> {
  // Fetch all STAGE_CHANGE alert holders for this idea
  const alerts = await prisma.ideaAlert.findMany({
    where: { ideaId, alertType: 'STAGE_CHANGE' },
    select: { userId: true },
  })

  await prisma.$transaction([
    prisma.idea.update({
      where: { id: ideaId },
      data: {
        stage: 'STAGE_5',
        visibility: 'PLATFORM_LISTED',
      },
    }),
    prisma.stageTransition.create({
      data: {
        ideaId,
        fromStage: 'STAGE_4',
        toStage: 'STAGE_5',
        triggeredByUserId: ownerId,
        transitionReason: 'Manual: owner submitted to Parliament',
      },
    }),
    // Notify all STAGE_CHANGE alert holders
    ...alerts.map(a =>
      prisma.notification.create({
        data: {
          userId: a.userId,
          type: 'STAGE_ELIGIBLE',
          relatedIdeaId: ideaId,
          title: 'An idea you follow has reached Legislate',
          message: 'This idea has been submitted to Parliament and is now in the Legislate stage.',
          linkUrl: `/ideas/${ideaId}`,
        },
      }),
    ),
  ])
  await awardPoints({ userId: ownerId, actionType: 'STAGE_5_ADVANCE', relatedIdeaId: ideaId })
}

/**
 * Advance idea from Stage 2 to Stage 3 (manual).
 * Call after checkStage2to3Gate() returns null.
 */
export async function advanceStage2to3(ideaId: string, ownerId: string): Promise<void> {
  await prisma.$transaction([
    prisma.idea.update({
      where: { id: ideaId },
      data: {
        stage: 'STAGE_3',
        visibility: 'LINK_ONLY',
        referralLinkActive: true,
      },
    }),
    prisma.stageTransition.create({
      data: {
        ideaId,
        fromStage: 'STAGE_2',
        toStage: 'STAGE_3',
        triggeredByUserId: ownerId,
        transitionReason: 'Manual: owner took idea public',
      },
    }),
  ])
  await awardPoints({ userId: ownerId, actionType: 'STAGE_3_ADVANCE', relatedIdeaId: ideaId })
}
