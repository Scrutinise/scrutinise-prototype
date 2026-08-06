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

  const [ideas, notifications, contributionCount, communityMemberships, groupMemberships] = await Promise.all([
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
        relatedIdea: {
          select: { title: true },
        },
      },
    }),
    prisma.comment.count({ where: { authorId: user.id } }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      include: {
        community: {
          select: { id: true, name: true, parentCommunityId: true, _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    }),
    // Idea teams. Matched on ownership OR membership: a team's creator was
    // never written in as a GroupMember, so a membership-only query returned
    // nothing and the section showed Communities alone (6 Aug 2026 user test).
    // New teams do get an owner row — this OR keeps the ones made before that
    // fix visible without a data migration.
    prisma.group.findMany({
      where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      select: {
        id: true,
        name: true,
        ideaId: true,
        ownerId: true,
        idea: { select: { title: true } },
        members: { where: { userId: user.id }, select: { role: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const credibilityScore = user.credibilityScore?.totalScore
    ? Math.round(Number(user.credibilityScore.totalScore))
    : 0

  // "My Communities and teams" — Community and Idea-team (Group) memberships
  // shown side by side, tagged by kind rather than merged into one concept
  // (docs/SCRUTINISE_CENTRAL_SPEC.md §3 item 7).
  const myGroups = [
    ...communityMemberships.map((m) => ({
      kind: 'COMMUNITY' as const,
      id: m.community.id,
      name: m.community.name,
      subtitle: m.community.parentCommunityId ? 'Branch' : null,
      role: m.role as string,
      memberCount: m.community._count.members,
      href: `/communities/${m.community.id}`,
    })),
    ...groupMemberships.map((g) => ({
      kind: 'IDEA_TEAM' as const,
      id: g.id,
      name: g.name,
      subtitle: g.idea?.title ?? null,
      role: g.members[0]?.role ?? (g.ownerId === user.id ? 'OWNER' : 'MEMBER'),
      memberCount: g._count.members,
      href: g.ideaId ? `/ideas/${g.ideaId}` : '/dashboard',
    })),
  ]

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
          ideaTitle: n.relatedIdea?.title ?? null,
        }))}
        myGroups={myGroups}
        contributionCount={contributionCount}
        credibilityScore={credibilityScore}
      />
    </div>
  )
}
