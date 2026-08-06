import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { getCommunityTree, getRootCommunityId, canManageCommunity } from '@/lib/community'
import CommunityDashboardClient from './CommunityDashboardClient'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const community = await prisma.community.findUnique({ where: { id }, select: { name: true } })
  return { title: community?.name ?? 'Community' }
}

export default async function CommunityDashboardPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}`)

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: id, userId: user.id } },
  })
  // Invite-only — a non-member gets 404, not 403, so membership itself isn't
  // leaked (docs/SCRUTINISE_CENTRAL_SPEC.md §1 "Communities are invite-only").
  if (!membership) notFound()

  const community = await prisma.community.findUnique({
    where: { id },
    include: { parent: { select: { id: true, name: true } } },
  })
  if (!community) notFound()

  const rootId = await getRootCommunityId(id)
  const root =
    rootId === id
      ? { id: community.id, name: community.name }
      : (await prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { id: true, name: true } }))

  const [tree, canManage] = await Promise.all([
    getCommunityTree(id),
    canManageCommunity(user.id, id),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <CommunityDashboardClient
        community={{
          id: community.id,
          name: community.name,
          description: community.description,
          parent: community.parent,
          managerId: community.managerId,
        }}
        root={root}
        myRole={membership.role}
        canManage={canManage}
        tree={tree}
      />
    </div>
  )
}
