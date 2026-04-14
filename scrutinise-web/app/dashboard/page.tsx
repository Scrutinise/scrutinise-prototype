import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { Button } from '@/components/ui/button'
import { stageToLabel } from '@/lib/display-utils'
import NotificationList from '@/components/NotificationCard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

const STAGE_BADGE: Record<string, string> = {
  STAGE_1: 'bg-zinc-100 text-zinc-600',
  STAGE_2: 'bg-blue-100 text-blue-700',
  STAGE_3: 'bg-amber-100 text-amber-700',
  STAGE_4: 'bg-green-100 text-green-700',
  STAGE_5: 'bg-purple-100 text-purple-700',
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
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.preferredName ? `Welcome back, ${user.preferredName}` : 'Dashboard'}
          </h1>
          <Button asChild>
            <Link href="/ideas/create">Create new idea</Link>
          </Button>
        </div>

        {/* Quick stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold">{ideas.length}</p>
            <p className="text-xs text-muted-foreground">Ideas created</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold">{contributionCount}</p>
            <p className="text-xs text-muted-foreground">Contributions made</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold">{credibilityScore}</p>
            <p className="text-xs text-muted-foreground">Credibility score</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Ideas list */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-base font-semibold">Your ideas</h2>
            {ideas.length === 0 ? (
              <div className="rounded-lg border border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  You have not created any ideas yet.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/ideas/create">Start your first idea</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <Link
                    key={idea.id}
                    href={`/ideas/${idea.id}`}
                    className="flex items-start justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="truncate text-sm font-medium">{idea.title || 'Untitled idea'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {idea._count.comments} contribution{idea._count.comments !== 1 ? 's' : ''}
                        {' · '}
                        {idea._count.research} research item{idea._count.research !== 1 ? 's' : ''}
                        {' · '}
                        updated{' '}
                        {new Date(idea.updatedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[idea.stage] ?? 'bg-zinc-100 text-zinc-600'}`}
                    >
                      {stageToLabel(idea.stage)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div>
            <h2 className="mb-4 text-base font-semibold">Notifications</h2>
            <NotificationList notifications={notifications} />
          </div>
        </div>
      </main>
    </div>
  )
}
