'use client'

import Link from 'next/link'
import { Plus, ArrowRight, Bell, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MOCK_IDEAS, MOCK_NOTIFICATIONS, MOCK_GROUPS, Stage } from '@/lib/mockData'
import { useUser } from '@/context/UserContext'

const stageBadgeStyle: Record<Stage, React.CSSProperties> = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Parliament: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
}

const notificationTypeIcon: Record<string, string> = {
  amendment: '✏️',
  vote: '🗳️',
  stage: '🚀',
  moderation: '🚩',
}

export default function PrototypeDashboardPage() {
  const { currentUser } = useUser()

  const myIdeas = MOCK_IDEAS.filter(idea => idea.ownerId === currentUser.id)
  const recentNotifications = [...MOCK_NOTIFICATIONS]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

      {/* Welcome */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Welcome back, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening with your ideas.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 flex flex-wrap gap-2 sm:mb-8 sm:gap-3">
        <Button size="sm" asChild className="gap-2">
          <Link href="/prototype/create/stage1">
            <Plus className="size-4" />
            New Idea
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href="/prototype/browse">
            Browse Ideas
            <ArrowRight className="size-3" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href="/prototype/notifications">
            <Bell className="size-4" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/prototype/settings">
            Settings
          </Link>
        </Button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">

        {/* My Ideas — full width */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">My Ideas</CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
              <Link href="/prototype/create/stage1">
                <Plus className="size-3" />
                New Idea
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {myIdeas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                You haven't created any ideas yet.{' '}
                <Link href="/prototype/create/stage1" className="text-primary hover:underline">
                  Start now →
                </Link>
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {myIdeas.map(idea => {
                  return (
                    <div
                      key={idea.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 sm:p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-md font-medium"
                            style={stageBadgeStyle[idea.stage]}
                          >
                            {idea.stage}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate mb-1">{idea.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="text-green-600 font-medium">{idea.voteCount.for} FOR</span>
                          <span className="text-red-600 font-medium">{idea.voteCount.against} AGAINST</span>
                          <span>{idea.voteCount.undecided} UNDECIDED</span>
                          <span>Passion: {idea.passionScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild className="shrink-0 gap-1">
                        <Link href={`/prototype/idea/${idea.id}`}>
                          View
                          <ChevronRight className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4 sm:gap-6">

          {/* Recent Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notifications</CardTitle>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/prototype/notifications">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {recentNotifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-2.5 rounded-md border p-2.5 text-xs transition-colors ${
                      !notif.read ? 'border-primary/20 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <span className="text-sm flex-shrink-0 mt-0.5">
                      {notificationTypeIcon[notif.type] ?? '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-snug line-clamp-2">{notif.message}</p>
                      <p className="text-muted-foreground mt-0.5">{notif.createdAt}</p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Following/Watching */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Following / Watching
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ideas you're watching will appear here.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-3 gap-1">
                <Link href="/prototype/browse">
                  Browse Ideas
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Groups */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Groups</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/prototype/groups">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {MOCK_GROUPS.map(group => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between rounded-md border border-border p-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.type} · {group.memberCount} members
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="shrink-0 h-7 px-2">
                      <Link href={`/prototype/groups/${group.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </main>
  )
}
