import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import PublicNav from '@/components/PublicNav'
import IdeaCard, { type IdeaCardData } from '@/components/IdeaCard'
import { prisma } from '@/lib/prisma'

export const metadata = {
  title: 'Browse Ideas — Scrutinise',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

// Serialise a Prisma idea row into IdeaCardData (all Dates → strings)
function serialise(idea: {
  id: string
  title: string
  summaryDescription: string | null
  stage: string
  govtArea: string
  createdAt: Date
  commentCount: number
  creator: { displayName: string | null; firstName: string; username: string }
  _count: { votes: number }
}): IdeaCardData {
  return {
    id: idea.id,
    title: idea.title,
    summaryDescription: idea.summaryDescription,
    stage: idea.stage,
    govtArea: idea.govtArea,
    createdAt: idea.createdAt.toISOString(),
    voteCount: idea._count.votes,
    commentCount: idea.commentCount,
    creator: {
      displayName: idea.creator.displayName ?? idea.creator.firstName,
      username: idea.creator.username,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ cursor?: string }>
}

export default async function BrowseIdeasPage({ searchParams }: Props) {
  const { cursor } = await searchParams
  const { userId: clerkUserId } = await auth()

  // Fetch public ideas: Stage 3+ and ACTIVE
  const publicIdeas = await prisma.idea.findMany({
    where: {
      stage: { in: ['STAGE_3', 'STAGE_4', 'STAGE_5'] },
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
    take: PAGE_SIZE + 1, // take one extra to detect next page
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      title: true,
      summaryDescription: true,
      stage: true,
      govtArea: true,
      createdAt: true,
      commentCount: true,
      creator: { select: { displayName: true, firstName: true, username: true } },
      _count: { select: { votes: true } },
    },
  })

  const hasNextPage = publicIdeas.length > PAGE_SIZE
  const items = hasNextPage ? publicIdeas.slice(0, PAGE_SIZE) : publicIdeas
  const nextCursor = hasNextPage ? items[items.length - 1]?.id : null
  const cards: IdeaCardData[] = items.map(serialise)

  // Fetch current user's own ideas (max 3) if authenticated
  let myIdeas: IdeaCardData[] = []
  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    })
    if (dbUser) {
      const raw = await prisma.idea.findMany({
        where: { creatorId: dbUser.id, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          summaryDescription: true,
          stage: true,
          govtArea: true,
          createdAt: true,
          commentCount: true,
          creator: { select: { displayName: true, firstName: true, username: true } },
          _count: { select: { votes: true } },
        },
      })
      myIdeas = raw.map(serialise)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Browse Ideas</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Policy ideas developed by citizens and reviewed by the Scrutinise community.
        </p>

        {/* Your Ideas section — authenticated only */}
        {myIdeas.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your Ideas</h2>
              <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myIdeas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          </section>
        )}

        {/* Public ideas listing */}
        <section className="mt-10">
          {myIdeas.length > 0 && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Community Ideas
            </h2>
          )}

          {cards.length === 0 && !cursor ? (
            <div className="py-16 text-center">
              <p className="text-base text-muted-foreground">No public ideas yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Be the first —{' '}
                <Link href="/ideas/create" className="underline hover:text-foreground">
                  develop your idea
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map(idea => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>

              {/* Pagination */}
              {(cursor || hasNextPage) && (
                <div className="mt-8 flex items-center justify-center gap-4">
                  {cursor && (
                    <Link
                      href="/ideas"
                      className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      ← Newer
                    </Link>
                  )}
                  {nextCursor && (
                    <Link
                      href={`/ideas?cursor=${nextCursor}`}
                      className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      Older →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
