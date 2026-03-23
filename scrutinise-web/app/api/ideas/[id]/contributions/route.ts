import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const ContributionSchema = z.object({
  content: z.string().min(1).max(5000),
  contributionType: z.enum([
    'NEW_INFORMATION',
    'RED_TEAM_CHALLENGE',
    'MINOR_ADJUSTMENT',
    'ADDITIONAL_COHERENT_ACTION',
    'AMENDMENT',
    'OTHER',
  ]),
  stance: z.enum(['SUPPORTIVE', 'CRITICAL', 'NEUTRAL', 'QUESTION']),
})

// GET /api/ideas/[id]/contributions
// Public for LINK_ONLY/PLATFORM_LISTED ideas. Owner sees all; others see non-hidden only.
export async function GET(_req: Request, { params }: Params) {
  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true, stage: true, visibility: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Require Stage 3+ for contributions to be visible
  const publicStages = ['STAGE_3', 'STAGE_4', 'STAGE_5']
  const isPublicStage = publicStages.includes(idea.stage)

  // Determine if current user is owner (for full visibility)
  const { userId: clerkUserId } = await auth()
  let currentUserId: string | null = null
  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    })
    currentUserId = dbUser?.id ?? null
  }

  const isOwner = currentUserId === idea.creatorId

  // Non-owners without auth can't see contributions on private/draft ideas
  if (!isPublicStage && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where = {
    ideaId,
    parentId: null, // top-level only — replies fetched inline
    ...(isOwner ? {} : { isHidden: false }),
  }

  const contributions = await prisma.comment.findMany({
    where,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          credibilityScore: { select: { totalScore: true } },
        },
      },
      replies: {
        where: { isOwnerReply: true },
        include: {
          author: { select: { id: true, name: true, username: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'asc' }],
    take: 50,
  })

  return NextResponse.json({ contributions })
}

// POST /api/ideas/[id]/contributions — requires auth, Stage 3+
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true, stage: true, commentCount: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Contributions only allowed at Stage 3+
  const allowedStages = ['STAGE_3', 'STAGE_4', 'STAGE_5']
  if (!allowedStages.includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Contributions are only open at Stage 3 and above' },
      { status: 422 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ContributionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { content, contributionType, stance } = parsed.data

  // Sequential comment number per idea
  const commentNumber = idea.commentCount + 1

  const [contribution] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        ideaId,
        authorId: user.id,
        content,
        contributionType,
        stance,
        commentNumber,
      },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    }),
    prisma.idea.update({
      where: { id: ideaId },
      data: { commentCount: { increment: 1 } },
    }),
    // Notify idea owner (skip self-contributions)
    ...(user.id !== idea.creatorId
      ? [
          prisma.notification.create({
            data: {
              userId: idea.creatorId,
              type: 'COMMENT_POSTED',
              relatedIdeaId: ideaId,
              message: `${user.name} left a Contribution on your idea.`,
              linkUrl: `/ideas/${ideaId}?tab=contributions`,
            },
          }),
        ]
      : []),
  ])

  return NextResponse.json(contribution, { status: 201 })
}
