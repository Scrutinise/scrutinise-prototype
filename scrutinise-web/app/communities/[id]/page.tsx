import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import {
  getCommunityTree,
  getRootCommunityId,
  canManageCommunity,
  getCommunityMembership,
  getCommunityTreeIds,
} from '@/lib/community'
import { getUserPoints } from '@/lib/central-points'
import CommunityDashboardClient from './CommunityDashboardClient'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ joined?: string; panel?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const community = await prisma.community.findUnique({ where: { id }, select: { name: true } })
  return { title: community?.name ?? 'Community' }
}

export default async function CommunityDashboardPage({ params, searchParams }: Props) {
  const { id } = await params
  const { joined, panel } = await searchParams
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}`)

  const rootId = await getRootCommunityId(id)

  const [membership, canManage, rootMembership] = await Promise.all([
    getCommunityMembership(user.id, id),
    canManageCommunity(user.id, id),
    getCommunityMembership(user.id, rootId),
  ])

  // Who reaches this page (Stage 1.2):
  //  · members of the node — the full thing
  //  · anyone with manage rights here, including an ancestor admin who never
  //    joined: the Requests and Members panels are management surfaces they are
  //    responsible for
  //  · members of the COMMUNITY looking at one of its branches — they need the
  //    branch page to ask to join it (brief item 2: tree AND branch page)
  // Everyone else gets 404 rather than 403, so a Community's shape is not
  // leaked to outsiders (docs/SCRUTINISE_CENTRAL_SPEC.md §1).
  //
  // The BOARD is withheld from the last two below — reaching the page is not
  // reading the branch.
  if (!membership && !canManage && !rootMembership) notFound()

  const community = await prisma.community.findUnique({
    where: { id },
    include: { parent: { select: { id: true, name: true } } },
  })
  if (!community) notFound()

  const root =
    rootId === id
      ? { id: community.id, name: community.name }
      : await prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { id: true, name: true } })

  const tree = await getCommunityTree(id, user.id)

  // The other branches this person is in, WITHIN THIS COMMUNITY — a branch of
  // some unrelated Community is neither something to offer leaving in the
  // switch-or-add chooser nor a reason to hide "Find your branch" here.
  const otherBranches = (
    await prisma.communityMember.findMany({
      where: {
        userId: user.id,
        communityId: { in: await getCommunityTreeIds(id), not: id },
        community: { parentCommunityId: { not: null } },
      },
      include: { community: { select: { id: true, name: true } } },
    })
  ).map((m) => ({ id: m.community.id, name: m.community.name, role: m.role }))

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
        myRole={membership?.role ?? null}
        canManage={canManage}
        tree={tree}
        otherBranches={otherBranches}
        // `?joined=1` is set by the branch-invite redemption and by the
        // approval notification, and is what raises the switch-or-add chooser.
        // A query flag rather than a "was this their first visit" guess: it is
        // deterministic, and the same link can be followed again if they
        // dismiss it. Leaving is available from the page at any time regardless.
        showSwitchChooser={joined === '1' && otherBranches.length > 0}
        openPanel={
          panel === 'requests' ? 'requests' : panel === 'members' ? 'members' : panel === 'claims' ? 'claims' : null
        }
        isCommunityMember={rootMembership !== null}
        hasPendingRequest={tree.viewerHasPendingRequest}
        myPoints={await getUserPoints(user.id, rootId)}
      />
    </div>
  )
}
