import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function resolveCallerRole(ideaId: string, creatorId: string) {
  const { userId: clerkUserId } = await auth()
  let currentUserId: string | null = null
  let isOwner = false
  let isCollaborator = false

  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    })
    currentUserId = dbUser?.id ?? null
  }

  if (currentUserId) {
    isOwner = currentUserId === creatorId
    if (!isOwner) {
      const collab = await prisma.ideaCollaborator.findFirst({
        where: { ideaId, userId: currentUserId },
        select: { id: true },
      })
      isCollaborator = !!collab
    }
  }

  return { currentUserId, isOwner, isCollaborator }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ideas/[id]/contributions
//
// Stage 2: owner + collaborators only — returns internal contributions
// Stage 3+: public non-internal; owner sees all; internal authors see own internals
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true, stage: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const publicStages = ['STAGE_3', 'STAGE_4', 'STAGE_5']
  const isStage2 = idea.stage === 'STAGE_2'
  const isPublicStage = publicStages.includes(idea.stage)

  if (!isStage2 && !isPublicStage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { currentUserId, isOwner, isCollaborator } = await resolveCallerRole(
    ideaId,
    idea.creatorId,
  )

  // Stage 2 — only owner and collaborators may see internal contributions
  if (isStage2 && !isOwner && !isCollaborator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Build the `where` filter based on caller role and stage
  let where: Prisma.CommentWhereInput

  if (isStage2) {
    // Owner/collaborators see all internal contributions at Stage 2
    where = { ideaId, parentId: null, isInternal: true }
  } else if (isOwner) {
    // Owner at Stage 3+ sees everything (internal + public, no hidden filter)
    where = { ideaId, parentId: null }
  } else if (currentUserId) {
    // Authenticated non-owner: public non-internal + own internal contributions
    where = {
      ideaId,
      parentId: null,
      isHidden: false,
      OR: [{ isInternal: false }, { authorId: currentUserId }],
    }
  } else {
    // Unauthenticated: public non-internal only
    where = { ideaId, parentId: null, isHidden: false, isInternal: false }
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ideas/[id]/contributions
//
// Stage 2: owner + collaborators only — sets isInternal: true
// Stage 3+: any authenticated user — sets isInternal: false
// ─────────────────────────────────────────────────────────────────────────────
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

  const publicStages = ['STAGE_3', 'STAGE_4', 'STAGE_5']
  const isStage2 = idea.stage === 'STAGE_2'
  const isPublicStage = publicStages.includes(idea.stage)

  if (!isStage2 && !isPublicStage) {
    return NextResponse.json(
      { error: 'Contributions are only open at Stage 2 and above' },
      { status: 422 },
    )
  }

  // At Stage 2, restrict to owner and collaborators
  if (isStage2) {
    const isOwner = user.id === idea.creatorId
    if (!isOwner) {
      const collab = await prisma.ideaCollaborator.findFirst({
        where: { ideaId, userId: user.id },
        select: { id: true },
      })
      if (!collab) {
        return NextResponse.json(
          { error: 'Only the owner and collaborators can contribute at this stage' },
          { status: 403 },
        )
      }
    }
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
  const isInternal = isStage2 // Stage 2 contributions are always internal

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
        isInternal,
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
