import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'
import { getAcrossBranches } from '@/lib/question-library'
import AcrossBranches from './AcrossBranches'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}

export const metadata: Metadata = { title: 'Across branches' }

export default async function AcrossBranchesPage({ params, searchParams }: Props) {
  const { id } = await params
  const { period: rawPeriod } = await searchParams
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/across-branches`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/across-branches`)

  const rootId = await getRootCommunityId(id)
  // Community admins only — manage rights on the ROOT, not merely on a branch.
  if (!(await canManageCommunity(user.id, rootId))) notFound()

  const root = await prisma.community.findUniqueOrThrow({
    where: { id: rootId },
    select: { id: true, name: true },
  })

  const period = rawPeriod === 'month' || rawPeriod === 'quarter' ? rawPeriod : 'week'
  const since = new Date()
  since.setDate(since.getDate() - (period === 'week' ? 7 : period === 'month' ? 30 : 90))

  const { branches, totals } = await getAcrossBranches(rootId, since)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <AcrossBranches
          communityId={root.id}
          communityName={root.name}
          period={period}
          branches={branches}
          totals={totals}
        />
      </main>
    </div>
  )
}
