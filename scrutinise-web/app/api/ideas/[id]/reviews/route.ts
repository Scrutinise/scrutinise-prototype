import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const ReviewSchema = z.object({
  qualityRating: z.number().int().min(1).max(5),
})

// POST /api/ideas/[id]/reviews
// Upserts an IdeaReview record for the current user with a qualityRating (1–5).
// Available at Stage 3+. Creates VIEWED outcome if no existing record.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, stage: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowedStages = ['STAGE_3', 'STAGE_4', 'STAGE_5']
  if (!allowedStages.includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Quality ratings are available at Stage 3 and above' },
      { status: 422 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { qualityRating } = parsed.data

  const review = await prisma.ideaReview.upsert({
    where: { ideaId_userId: { ideaId, userId: user.id } },
    update: { qualityRating },
    create: {
      ideaId,
      userId: user.id,
      outcome: 'VIEWED',
      qualityRating,
    },
    select: { id: true, qualityRating: true, outcome: true },
  })

  return NextResponse.json(review)
}
