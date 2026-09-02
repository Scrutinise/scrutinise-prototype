import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'
import { getCommunityBranding } from '@/lib/approval'
import CommunitySettingsClient from './CommunitySettingsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Community settings' }

type Props = { params: Promise<{ id: string }> }

/**
 * CENTRAL item 12 — Community settings.
 *
 * ⚠ ROOT ONLY, AND THE ROUTE ENFORCES IT BY REDIRECTING, not by refusing. A
 * branch admin who reaches `/communities/{branch}/settings` is not doing
 * anything wrong — they are looking for settings that exist one level up. Sending
 * them there is the honest answer; a 404 would suggest the page does not exist.
 *
 * ⚠ NOTHING PARTY-SPECIFIC IS HARD-CODED ANYWHERE BEHIND THIS PAGE. Reform UK's
 * name and colour are a seeded row, and a second Community sets its own here
 * without a deploy.
 */
export default async function CommunitySettingsPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/settings`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/settings`)

  const rootId = await getRootCommunityId(id)
  if (rootId !== id) redirect(`/communities/${rootId}/settings`)

  if (!(await canManageCommunity(user.id, rootId))) notFound()

  const [community, branding, members] = await Promise.all([
    prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { id: true, name: true } }),
    getCommunityBranding(rootId),
    // The NAMED picker's candidates. Members of the ROOT, which everyone in a
    // branch also holds — so this is every person in the Community.
    prisma.communityMember.findMany({
      where: { communityId: rootId },
      select: { user: { select: { id: true, name: true, username: true } } },
      orderBy: { user: { username: 'asc' } },
      take: 500,
    }),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-2 text-xs text-muted-foreground">
          <Link href={`/communities/${rootId}?tab=teams`} className="hover:underline">
            ← {community.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Community settings</h1>
        <p className="mt-1 text-sm text-muted-foreground pretty">
          These apply across {community.name} and every branch under it.
        </p>

        <CommunitySettingsClient
          communityId={rootId}
          communityName={community.name}
          initial={{
            organisationName: branding.organisationName,
            organisationColour: branding.organisationColour,
            approvalFeatureEnabled: branding.approvalFeatureEnabled,
            approvalMode: branding.approvalMode,
            namedApproverIds: branding.namedApproverIds,
            inviteRights: branding.inviteRights,
          }}
          members={members.map((m) => m.user)}
        />
      </main>
    </div>
  )
}
