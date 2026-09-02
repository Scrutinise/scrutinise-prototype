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
  listJoinRequests,
} from '@/lib/community'
import { getUserPoints } from '@/lib/central-points'
import { getTags, listQuestions } from '@/lib/question-library'
import CommunityDashboardClient, { type CentralTab } from './CommunityDashboardClient'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ joined?: string; panel?: string; tab?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const community = await prisma.community.findUnique({ where: { id }, select: { name: true } })
  return { title: community?.name ?? 'Community' }
}

const TAB_KEYS: CentralTab[] = ['questions', 'board', 'training', 'resources', 'leaderboard', 'teams']

export default async function CommunityDashboardPage({ params, searchParams }: Props) {
  const { id } = await params
  const { joined, panel, tab: rawTab } = await searchParams
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}`)

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, name: true, username: true },
  })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}`)

  const rootId = await getRootCommunityId(id)

  const [membership, canManage, rootMembership, isCommunityAdmin] = await Promise.all([
    getCommunityMembership(user.id, id),
    canManageCommunity(user.id, id),
    getCommunityMembership(user.id, rootId),
    canManageCommunity(user.id, rootId),
  ])

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

  // Stage 2e — what is actually waiting for a manager on this node. With
  // pre-approval gone there is no claims queue, so this is join requests, plus
  // any claim left PENDING by the old model. A count nobody can act on is worse
  // than no count, so it is only computed for someone who can manage the node.
  const pendingForManager = canManage
    ? (await listJoinRequests(id, 'PENDING')).length +
      (await prisma.activityClaim.count({ where: { communityId: id, status: 'PENDING' } }))
    : 0

  // Questions is the default sub-tab — EXCEPT for a member of the Community who
  // is in no branch at all. Stage 2d moved “Find your branch” into the Teams tab,
  // and a prompt nobody is shown is not a prompt; so with no tab asked for, that
  // member lands on Teams until they are in one.
  //
  // A `?panel=` deep link also lands on Teams, because that is where the panel
  // it names now lives. Those links are already out in people's notifications
  // (lib/community.ts writes `?panel=requests` on every join request), so a
  // Teams-tab move that did not do this would quietly break every one of them.
  const inAnyBranch = otherBranches.length > 0
  const isRoot = community.parentCommunityId === null
  const defaultTab: CentralTab = panel
    ? 'teams'
    : isRoot && membership !== null && !inAnyBranch
      ? 'teams'
      : 'questions'
  const tab: CentralTab = TAB_KEYS.includes(rawTab as CentralTab) ? (rawTab as CentralTab) : defaultTab

  // Server-render the first page of the library so the tab is not a spinner;
  // the client re-fetches as soon as a filter moves.
  const canSeeContent = membership !== null || canManage
  const [questionTags, initialQuestions] = canSeeContent
    ? await Promise.all([
        getTags(rootId),
        listQuestions(id, user.id, { side: 'external', sort: 'top-month' }),
      ])
    : [{ contextExternal: [], contextInternal: [], topics: [] }, []]

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
        isCommunityAdmin={isCommunityAdmin}
        tree={tree}
        otherBranches={otherBranches}
        showSwitchChooser={joined === '1' && otherBranches.length > 0}
        openPanel={
          panel === 'requests'
            ? 'requests'
            : panel === 'members'
              ? 'members'
              : panel === 'claims'
                ? 'claims'
                : panel === 'invitations'
                  ? 'invitations'
                  : null
        }
        isCommunityMember={rootMembership !== null}
        hasPendingRequest={tree.viewerHasPendingRequest}
        myPoints={await getUserPoints(user.id, rootId)}
        tab={tab}
        questionTags={questionTags}
        initialQuestions={initialQuestions}
        myName={user.name ?? user.username}
        pendingForManager={pendingForManager}
      />
    </div>
  )
}
