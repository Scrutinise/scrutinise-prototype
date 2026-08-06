import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import CommunitiesClient from './CommunitiesClient'
import { countUnreadBulletin } from '@/lib/community'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Central',
}

export default async function CommunitiesPage() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect('/sign-in?redirect_url=/communities')

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  })
  if (!user) redirect('/sign-in?redirect_url=/communities')

  const memberships = await prisma.communityMember.findMany({
    where: { userId: user.id },
    include: {
      community: {
        include: { _count: { select: { members: true, children: true } } },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  const communities = await Promise.all(
    memberships.map(async (m) => ({
      id: m.community.id,
      name: m.community.name,
      description: m.community.description,
      role: m.role,
      memberCount: m.community._count.members,
      branchCount: m.community._count.children,
      isBranch: m.community.parentCommunityId !== null,
      // Counts what the board actually shows — this node's posts plus
      // Community-wide posts from elsewhere in the tree.
      unreadCount: await countUnreadBulletin(m.community.id, m.lastReadAt),
    })),
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <CommunitiesClient communities={communities} />
    </div>
  )
}
