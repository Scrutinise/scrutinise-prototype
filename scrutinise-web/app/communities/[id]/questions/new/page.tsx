import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { getSubtreeIds } from '@/lib/community'
import { getTags, requireLibraryAccess } from '@/lib/question-library'
import AddQuestion from './AddQuestion'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Add a question' }

export default async function AddQuestionPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/questions/new`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/questions/new`)

  let rootId: string
  try {
    rootId = await requireLibraryAccess(user.id, id)
  } catch {
    notFound()
  }

  // The branch the "…only" scope option would apply to. Null when they are not
  // in a branch yet, in which case that option is disabled rather than hidden —
  // hiding it would make the choice look like it does not exist.
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
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <AddQuestion communityId={id} tags={await getTags(rootId)} branchName={branchName} />
      </main>
    </div>
  )
}
