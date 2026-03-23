import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import IdeaDetailClient from './IdeaDetailClient'
import { getStage3GateData } from '@/lib/stage-gates'

interface Props {
  params: Promise<{ id: string }>
}

export default async function IdeaDetailPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          username: true,
          referralCode: true,
          credibilityScore: { select: { totalScore: true, phase: true } },
        },
      },
      coherentActions: { orderBy: { orderIndex: 'asc' } },
      research: { orderBy: { createdAt: 'asc' } },
      collaborators: {
        include: { user: { select: { id: true, name: true, username: true } } },
      },
    },
  })

  if (!idea) notFound()

  // PRIVATE ideas require auth + ownership/collaboration
  if (idea.visibility === 'PRIVATE') {
    if (!clerkUserId) {
      redirect(`/sign-in?redirect_url=/ideas/${id}`)
    }
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, role: true },
    })
    if (!dbUser) redirect(`/sign-in?redirect_url=/ideas/${id}`)

    const isOwner = idea.creatorId === dbUser.id
    const isCollaborator = idea.collaborators.some(c => c.userId === dbUser.id)
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(dbUser.role)
    if (!isOwner && !isCollaborator && !isAdmin) notFound()
  }

  // Get current user context for UI decisions
  let currentUserId: string | null = null
  let currentUserReferralCode: string | null = null

  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, referralCode: true },
    })
    if (dbUser) {
      currentUserId = dbUser.id
      currentUserReferralCode = dbUser.referralCode
    }
  }

  const isOwner = currentUserId === idea.creatorId
  const isCollaborator = idea.collaborators.some(c => c.userId === currentUserId)

  // Priority 3: Create IdeaReview(VIEWED) for authenticated visitors at Stage 3+
  if (currentUserId && ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage)) {
    await prisma.ideaReview
      .upsert({
        where: { ideaId_userId: { ideaId: id, userId: currentUserId } },
        update: {},
        create: { ideaId: id, userId: currentUserId, outcome: 'VIEWED' },
      })
      .catch(() => {})
  }

  // Stage 3→4 gate data (owner-only, Stage 3 only)
  let ideaReviewCount = 0
  let avgQualityRating = 0
  if (idea.stage === 'STAGE_3' && isOwner) {
    const gateData = await getStage3GateData(id)
    ideaReviewCount = gateData.reviewCount
    avgQualityRating = gateData.avgQualityRating
  }

  // Serialise for client (Prisma Decimal → string, Date → string)
  const serialised = {
    ...idea,
    maturityIndex: idea.maturityIndex.toString(),
    passionScore: idea.passionScore?.toString() ?? null,
    credibilityWeightedRating: idea.credibilityWeightedRating?.toString() ?? null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
    publishedAt: idea.publishedAt?.toISOString() ?? null,
    withdrawnAt: idea.withdrawnAt?.toISOString() ?? null,
    stageEligibleSince: idea.stageEligibleSince?.toISOString() ?? null,
    maturityLastUpdated: idea.maturityLastUpdated?.toISOString() ?? null,
    creator: {
      ...idea.creator,
      credibilityScore: idea.creator.credibilityScore
        ? {
            totalScore: idea.creator.credibilityScore.totalScore?.toString() ?? null,
            phase: idea.creator.credibilityScore.phase,
          }
        : null,
    },
    coherentActions: idea.coherentActions.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    research: idea.research.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    collaborators: idea.collaborators.map(c => ({
      ...c,
      invitedAt: c.invitedAt.toISOString(),
      acceptedAt: c.acceptedAt?.toISOString() ?? null,
    })),
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <IdeaDetailClient
        idea={serialised}
        isOwner={isOwner}
        isCollaborator={isCollaborator}
        currentUserId={currentUserId}
        currentUserReferralCode={currentUserReferralCode}
        ideaReviewCount={ideaReviewCount}
        avgQualityRating={avgQualityRating}
      />
    </div>
  )
}
