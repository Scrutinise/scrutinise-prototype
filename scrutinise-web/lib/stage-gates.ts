import { prisma } from './prisma'
import type { Idea } from '../generated/prisma/client'

/**
 * Stage 1→2: AUTOMATIC
 * Fires on every idea PATCH when title + summaryDescription are both non-empty.
 * Sends Lex achievement notification.
 */
export async function checkAndAdvanceStage(ideaId: string, ownerId: string): Promise<void> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      stage: true,
      title: true,
      summaryDescription: true,
      diagnosis: true,
      guidingPolicy: true,
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
    },
  })

  if (!idea) return

  // Stage 1 → 2: automatic when title + summaryDescription non-empty
  if (
    idea.stage === 'STAGE_1' &&
    idea.title?.trim() &&
    idea.summaryDescription?.trim()
  ) {
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
          transitionReason: 'Automatic: title and summaryDescription completed',
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
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
    },
  })

  if (!idea) return 'Idea not found'

  const errors: string[] = []

  if (!idea.diagnosis?.trim()) errors.push('Challenge / diagnosis must be completed')
  if (!idea.guidingPolicy?.trim()) errors.push('Guiding policy must be completed')
  if (idea.coherentActions.length < 1) errors.push('At least 1 coherent action required')
  if (idea.research.length < 3) errors.push(`At least 3 research items required (currently ${idea.research.length})`)

  return errors.length > 0 ? errors.join('; ') : null
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
}
