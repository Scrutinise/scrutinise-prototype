import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { getSubtreeIds } from '@/lib/community'
import { getTags, requireLibraryAccess } from '@/lib/question-library'
import PackBuilder from './PackBuilder'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Build a pack' }

export default async function PackBuilderPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/packs/new`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/packs/new`)

  let rootId: string
  try {
    rootId = await requireLibraryAccess(user.id, id)
  } catch {
    notFound()
  }

  const root = await prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { name: true } })

  const standingOn = await prisma.community.findUnique({
    where: { id },
    select: { name: true, parentCommunityId: true },
  })
  let branchName: string | null = standingOn?.parentCommunityId ? standingOn.name : null
  if (!branchName) {
    const membership = await prisma.communityMember.findFirst({
      where: {
        userId: user.id,
        communityId: { in: await getSubtreeIds(rootId) },
        community: { parentCommunityId: { not: null } },
      },
      orderBy: { joinedAt: 'asc' },
      include: { community: { select: { name: true } } },
    })
    branchName = membership?.community.name ?? null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <PackBuilder
          communityId={id}
          communityName={root.name}
          branchName={branchName}
          tags={await getTags(rootId)}
        />
      </main>
    </div>
  )
}
