import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { awardPoints } from '@/lib/points'

type Params = { params: Promise<{ id: string; commentId: string }> }

const RateSchema = z.object({
  qualityRating: z.number().int().min(1).max(5),
})

// POST /api/ideas/[id]/contributions/[commentId]/rate
// Upserts a CommentRating record for the current user with qualityRating (1–5).
// Also updates the denormalised Comment.qualityRating with the new average.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId, commentId } = await params

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, ideaId: true, authorId: true },
  })

  if (!comment || comment.ideaId !== ideaId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { qualityRating } = parsed.data

  // Upsert the per-user rating
  await prisma.commentRating.upsert({
    where: { commentId_userId: { commentId, userId: user.id } },
    update: { qualityRating },
    create: { commentId, userId: user.id, qualityRating },
  })

  // Recalculate and denormalise the average quality rating on the comment
  const ratings = await prisma.commentRating.findMany({
    where: { commentId, qualityRating: { not: null } },
    select: { qualityRating: true },
  })

  const avgRating =
    ratings.length === 0
      ? null
      : Math.round(
          ratings.reduce((sum, r) => sum + (r.qualityRating ?? 0), 0) / ratings.length,
        )

  await prisma.comment.update({
    where: { id: commentId },
    data: { qualityRating: avgRating },
  })

  // Award points to the contribution author based on their new average rating
  if (avgRating !== null && comment.authorId !== user.id) {
    if (avgRating >= 5) {
      await awardPoints({ userId: comment.authorId, actionType: 'CONTRIBUTION_RATED_5', relatedIdeaId: ideaId })
    } else if (avgRating >= 4) {
      await awardPoints({ userId: comment.authorId, actionType: 'CONTRIBUTION_RATED_4', relatedIdeaId: ideaId })
    } else if (avgRating >= 3) {
      await awardPoints({ userId: comment.authorId, actionType: 'CONTRIBUTION_RATED_3', relatedIdeaId: ideaId })
    } else if (avgRating <= 2) {
      await awardPoints({ userId: comment.authorId, actionType: 'CONTRIBUTION_RATED_1_2', relatedIdeaId: ideaId })
    }
    // Award rater for reviewing an idea
    await awardPoints({ userId: user.id, actionType: 'IDEA_RATED', relatedIdeaId: ideaId })
  }

  return NextResponse.json({ qualityRating, avgRating })
}
