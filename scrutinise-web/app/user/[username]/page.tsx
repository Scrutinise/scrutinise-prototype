import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const user = await prisma.user.findUnique({
    where: { username },
    select: { name: true, bio: true },
  })
  if (!user) return {}
  return {
    title: user.name ?? username,
    description: user.bio ?? 'Policy developer on Scrutinise.',
  }
}

const STAGE_LABELS: Record<string, string> = {
  STAGE_3: 'Develop',
  STAGE_4: 'Campaign',
  STAGE_5: 'Legislate',
}

const STAGE_BADGE: Record<string, string> = {
  STAGE_3: 'bg-amber-100 text-amber-700',
  STAGE_4: 'bg-green-100 text-green-700',
  STAGE_5: 'bg-purple-100 text-purple-700',
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      joinDate: true,
      credibilityScore: {
        select: { totalScore: true, phase: true },
      },
      ideas: {
        where: {
          stage: { in: ['STAGE_3', 'STAGE_4', 'STAGE_5'] },
          visibility: { in: ['LINK_ONLY', 'PLATFORM_LISTED'] },
          status: { not: 'WITHDRAWN' },
        },
        select: {
          id: true,
          title: true,
          summaryDescription: true,
          stage: true,
          commentCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { comments: true },
      },
    },
  })

  if (!user) notFound()

  const joinYear = user.joinDate.getFullYear()
  const credScore = user.credibilityScore?.totalScore
    ? Number(user.credibilityScore.totalScore).toFixed(0)
    : null
  const credPhase = user.credibilityScore?.phase ?? 'BUILDING'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Profile header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{user.name}</h1>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            {user.bio && (
              <p className="mt-2 text-sm text-muted-foreground">{user.bio}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Joined {joinYear}</span>
              <span>{user._count.comments} Contributions</span>
              {credScore && (
                <span>
                  Credibility score:{' '}
                  <strong className="text-foreground">{credScore}</strong>
                  {credPhase === 'BUILDING' && (
                    <span className="ml-1 text-muted-foreground">(building)</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Public ideas */}
        <section>
          <h2 className="mb-4 text-base font-semibold">Public ideas</h2>
          {user.ideas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No public ideas yet. Ideas appear here once they reach the Develop stage.
            </p>
          )}
          <ul className="space-y-3">
            {user.ideas.map(idea => {
              const stageLabel = STAGE_LABELS[idea.stage] ?? idea.stage
              const badgeClass = STAGE_BADGE[idea.stage] ?? 'bg-muted text-muted-foreground'
              return (
                <li key={idea.id}>
                  <Link
                    href={`/ideas/${idea.id}`}
                    className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium">{idea.title}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                      >
                        {stageLabel}
                      </span>
                    </div>
                    {idea.summaryDescription && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {idea.summaryDescription}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {idea.commentCount} Contribution{idea.commentCount !== 1 ? 's' : ''} ·{' '}
                      {new Date(idea.createdAt).toLocaleDateString('en-GB', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
    </div>
  )
}
