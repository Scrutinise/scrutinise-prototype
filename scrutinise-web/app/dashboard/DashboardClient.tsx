'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { stageToLabel } from '@/lib/display-utils'
import NotificationList from '@/components/NotificationCard'

const STAGE_BADGE: Record<string, string> = {
  STAGE_1: 'bg-zinc-100 text-zinc-600',
  STAGE_2: 'bg-blue-100 text-blue-700',
  STAGE_3: 'bg-amber-100 text-amber-700',
  STAGE_4: 'bg-green-100 text-green-700',
  STAGE_5: 'bg-purple-100 text-purple-700',
}

interface IdeaSummary {
  id: string
  title: string | null
  stage: string
  updatedAt: string
  _count: { comments: number; research: number }
}

interface NotificationSummary {
  id: string
  type: string
  title: string | null
  message: string
  linkUrl: string | null
  relatedIdeaId: string | null
  ideaTitle: string | null
  isRead: boolean
  createdAt: string
}

interface GroupSummary {
  kind: 'COMMUNITY' | 'IDEA_TEAM'
  id: string
  name: string
  subtitle: string | null
  role: string
  href: string
}

interface Props {
  userName: string | null
  ideas: IdeaSummary[]
  notifications: NotificationSummary[]
  myGroups: GroupSummary[]
  contributionCount: number
  credibilityScore: number
}

const KIND_BADGE: Record<GroupSummary['kind'], string> = {
  COMMUNITY: 'bg-purple-100 text-purple-700',
  IDEA_TEAM: 'bg-zinc-100 text-zinc-600',
}
const KIND_LABEL: Record<GroupSummary['kind'], string> = {
  COMMUNITY: 'Community',
  IDEA_TEAM: 'Idea-team',
}

export default function DashboardClient({
  userName,
  ideas,
  notifications,
  myGroups,
  contributionCount,
  credibilityScore,
}: Props) {
  const [feedTab, setFeedTab] = useState<'feed' | 'upcoming'>('feed')
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {userName ? `Welcome back, ${userName}` : 'Dashboard'}
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

          {/* My Communities and teams */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">My Communities and teams</h2>
              <Link href="/communities" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                View all
              </Link>
            </div>
            {myGroups.length === 0 ? (
              <div className="rounded-lg border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  You&apos;re not in any Communities or teams yet.
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/communities">Find a Community</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {myGroups.map((g) => (
                  <Link
                    key={`${g.kind}-${g.id}`}
                    href={g.href}
                    className="flex items-start justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="truncate text-sm font-medium">{g.name}</p>
                      {g.subtitle && <p className="truncate text-xs text-muted-foreground mt-0.5">{g.subtitle}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE[g.kind]}`}>
                      {KIND_LABEL[g.kind]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feed / Upcoming */}
        <div>
          <div className="mb-4 flex items-center gap-1 rounded-md border border-border p-0.5 w-fit">
            <button
              onClick={() => setFeedTab('feed')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                feedTab === 'feed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Feed
            </button>
            <button
              onClick={() => setFeedTab('upcoming')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                feedTab === 'upcoming' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Upcoming
            </button>
          </div>

          {feedTab === 'feed' ? (
            <NotificationList notifications={notifications} />
          ) : (
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No upcoming events yet — Community events are coming soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
