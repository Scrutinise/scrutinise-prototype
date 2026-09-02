import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'
import { getGroupLevelView } from '@/lib/group-view'
import GroupLevel from './GroupLevel'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Group level' }

/**
 * CENTRAL 25-C §1h/§1i — the correction surface.
 *
 * ⚠ Community admins only — manage rights on the ROOT, not merely on a branch.
 * The list is of the Community's own membership, which is not a branch
 * manager's business.
 */
export default async function GroupLevelPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/group-level`)

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/group-level`)

  const rootId = await getRootCommunityId(id)
  if (!(await canManageCommunity(user.id, rootId))) notFound()

  const view = await getGroupLevelView(rootId)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* ⚠ The view is passed WHOLE, Dates included — the RSC payload carries
            Date across intact. That matters because the client sorts with
            `sortGroupMembers` from lib/group-view.ts, the same function this
            file's data shape is declared by; stringifying the dates here would
            have forced a second, copied sort in the component, which is the
            drift docs/CLAUDE.md §26.5 exists to stop. */}
        <GroupLevel view={view} myUserId={user.id} />
      </main>
    </div>
  )
}
