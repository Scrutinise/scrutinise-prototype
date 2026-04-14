import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import DashboardClient from './DashboardClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect('/sign-in?redirect_url=/dashboard')

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: {
      id: true,
      name: true,
      preferredName: true,
      credibilityScore: { select: { totalScore: true } },
    },
  })

  if (!user) redirect('/sign-in?redirect_url=/dashboard')

  const [ideas, notifications, contributionCount] = await Promise.all([
    prisma.idea.findMany({
      where: { creatorId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        stage: true,
        updatedAt: true,
        _count: {
          select: { comments: true, research: true },
        },
      },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        linkUrl: true,
        relatedIdeaId: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.comment.count({ where: { authorId: user.id } }),
  ])

  const credibilityScore = user.credibilityScore?.totalScore
    ? Math.round(Number(user.credibilityScore.totalScore))
    : 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <DashboardClient
        userName={user.preferredName ?? null}
        ideas={ideas.map((idea) => ({
          ...idea,
          updatedAt: idea.updatedAt.toISOString(),
        }))}
        notifications={notifications.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        }))}
        contributionCount={contributionCount}
        credibilityScore={credibilityScore}
      />
    </div>
  )
}
