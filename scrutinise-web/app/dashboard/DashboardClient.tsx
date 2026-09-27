'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { stageToLabel } from '@/lib/display-utils'
import NotificationList from '@/components/NotificationCard'
import { IDEA_SORT_LABEL, sortIdeasByMode, useIdeaSortMode, type IdeaSortMode } from '@/lib/idea-sort'

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
  /** 26-H §3a — needed for the "Date created" sort option. */
  createdAt: string
  /** 26-H §3b — mirrors the Ideas page's grouping onto the Dashboard. */
  group: { id: string; name: string; hidden: boolean } | null
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
  memberCount: number
  href: string
}

// How many rows each dashboard section shows before the "Show all" toggle —
// both sections stay scannable as the counts grow (Stage 1.1, 6 Aug 2026).
const IDEAS_COLLAPSED = 3
const GROUPS_COLLAPSED = 4

function ShowAllToggle({
  expanded,
  total,
  onToggle,
  label,
}: {
  expanded: boolean
  total: number
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-3 w-full rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
    >
      {expanded ? `Show fewer ${label}` : `Show all (${total})`}
    </button>
  )
}

interface Props {
  userName: string | null
  ideas: IdeaSummary[]
  notifications: NotificationSummary[]
  myGroups: GroupSummary[]
  contributionCount: number
  credibilityScore: number
  /** Central's own ledger. Displayed beside credibility, never summed with it. */
  centralPoints: number
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
  centralPoints,
}: Props) {
  const [feedTab, setFeedTab] = useState<'feed' | 'upcoming'>('feed')
  const [showAllIdeas, setShowAllIdeas] = useState(false)
  const [showAllGroups, setShowAllGroups] = useState(false)
  // 26-H §3a/§3b — one sort preference, shared with the Ideas page via `useIdeaSortMode`
  // (localStorage): whichever is picked on either surface is what both show.
  const [sortMode, setSortMode] = useIdeaSortMode()
  // 26-H §3c — a group can be hidden/shown from here too; this overrides the
  // server-rendered `group.hidden` optimistically until the next full load.
  const [groupHiddenOverride, setGroupHiddenOverride] = useState<Record<string, boolean>>({})
  const [groupBusy, setGroupBusy] = useState<string | null>(null)

  const toggleGroupHidden = async (groupId: string, hidden: boolean) => {
    setGroupBusy(groupId)
    setGroupHiddenOverride((o) => ({ ...o, [groupId]: hidden }))
    try {
      await fetch(`/api/ideas/groups/${groupId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden }),
      })
    } finally { setGroupBusy(null) }
  }

  const sortedIdeas = sortIdeasByMode(ideas, sortMode)
  const ungroupedIdeas = sortedIdeas.filter((i) => !i.group)
  // Same derivation MyIdeasList uses: a group's position is where its first idea falls
  // in the sorted order, and every group renders (hidden or not) — only whether its
  // ideas render depends on `hidden`, so the header never moves.
  const ideaGroupBuckets = new Map<string, { id: string; name: string; hidden: boolean; ideas: IdeaSummary[] }>()
  for (const i of sortedIdeas) {
    if (!i.group) continue
    const hidden = groupHiddenOverride[i.group.id] ?? i.group.hidden
    const bucket = ideaGroupBuckets.get(i.group.id) ?? { id: i.group.id, name: i.group.name, hidden, ideas: [] }
    bucket.ideas.push(i)
    ideaGroupBuckets.set(i.group.id, bucket)
  }
  const ideaGroups = Array.from(ideaGroupBuckets.values())
  const visibleIdeas = showAllIdeas ? ungroupedIdeas : ungroupedIdeas.slice(0, IDEAS_COLLAPSED)
  const visibleGroups = showAllGroups ? myGroups : myGroups.slice(0, GROUPS_COLLAPSED)

  const ideaCard = (idea: IdeaSummary) => (
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
  )
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {userName ? `Welcome back, ${userName}` : 'Dashboard'}
        </h1>
        <Button asChild>
          {/* 25-F §9 — the creation entry. `/ideas/new` reads the door switch and
              redirects; the flip is a PlatformConfig row, not a deploy. Editing links
              (which carry ?ideaId=) are untouched. */}
          <Link href="/ideas/new">Create new idea</Link>
        </Button>
      </div>

      {/* Quick stats. Central points sit BESIDE the credibility score, never
          inside it — two separate ledgers measuring different things. */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <div className="rounded-lg border border-border p-4 text-center">
          <p className={`text-2xl font-bold tabular-nums ${centralPoints < 0 ? 'text-red-600' : ''}`}>
            {centralPoints > 0 ? '+' : ''}{centralPoints}
          </p>
          <p className="text-xs text-muted-foreground">Central points</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Ideas list */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold">My ideas</h2>
            {/* 26-H §3a — default is most recent first; name/date created mirror onto
                the Ideas page (§3b) via the same shared preference. */}
            {ideas.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Sort
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as IdeaSortMode)}
                  className="text-xs rounded border border-border px-1.5 py-0.5"
                  aria-label="Sort ideas by"
                >
                  {(Object.keys(IDEA_SORT_LABEL) as IdeaSortMode[]).map((m) => (
                    <option key={m} value={m}>{IDEA_SORT_LABEL[m]}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {ideas.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                You have not created any ideas yet.
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/ideas/new">Start your first idea</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleIdeas.map((idea) => ideaCard(idea))}
              {ungroupedIdeas.length > IDEAS_COLLAPSED && (
                <ShowAllToggle
                  expanded={showAllIdeas}
                  total={ungroupedIdeas.length}
                  onToggle={() => setShowAllIdeas((v) => !v)}
                  label="ideas"
                />
              )}
              {/* 26-H §3b/§3c — the same groups the Ideas page shows, in the same
                  order, with a hidden group's header staying put and only its ideas
                  dropping out — the same rule §3c asked for on the Ideas page itself. */}
              {ideaGroups.map((g) => (
                <div key={g.id} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/30">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.name} <span className="font-normal normal-case text-muted-foreground/70">({g.ideas.length})</span>
                      {g.hidden && <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">— hidden</span>}
                    </h3>
                    <button
                      type="button"
                      disabled={groupBusy === g.id}
                      onClick={() => void toggleGroupHidden(g.id, !g.hidden)}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline disabled:opacity-40"
                    >
                      {g.hidden ? 'Show' : 'Hide'}
                    </button>
                  </div>
                  {!g.hidden && (
                    <div className="space-y-3 p-3">
                      {g.ideas.map((idea) => ideaCard(idea))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* My Communities and teams */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">My communities and teams</h2>
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
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleGroups.map((g) => (
                    <Link
                      key={`${g.kind}-${g.id}`}
                      href={g.href}
                      className="flex items-start justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="truncate text-sm font-medium">{g.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {g.subtitle ? `${g.subtitle} · ` : ''}
                          {g.memberCount} member{g.memberCount !== 1 ? 's' : ''} · {g.role.toLowerCase()}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE[g.kind]}`}>
                        {KIND_LABEL[g.kind]}
                      </span>
                    </Link>
                  ))}
                </div>
                {myGroups.length > GROUPS_COLLAPSED && (
                  <ShowAllToggle
                    expanded={showAllGroups}
                    total={myGroups.length}
                    onToggle={() => setShowAllGroups((v) => !v)}
                    label="Communities and teams"
                  />
                )}
              </>
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
