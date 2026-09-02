import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { joinCommunityAndRoot, getNodeManagerIds } from '@/lib/community'
import { requestJoinViaInvite } from '@/lib/community-permissions'
import { redemptionRefusal } from '@/lib/community-invitations'
import { recordReferral } from '@/lib/central-points'

const JoinSchema = z.object({ code: z.string().min(1) })

// POST /api/communities/join
// Redeems a CommunityInvite code. Requires an explicit call from the caller
// (the invite screen shows name/rules/points-info first and blocks joining
// until the user clicks Join — no auto-accept-on-view, since a reusable code
// isn't a targeted 1:1 invite the way a UserInvite magic link is).
export async function POST(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = JoinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const invite = await prisma.communityInvite.findUnique({
    where: { inviteCode: parsed.data.code },
    include: { community: { select: { id: true, name: true, parentCommunityId: true } } },
  })

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }
  // ⚠ CENTRAL 25-A §2d — withdrawn, expired and used up are all REFUSED HERE,
  // by the one function the owner's list and the check also read. A revoke that
  // merely removed a row from a list would not be a revoke at all, and the
  // difference is invisible until somebody uses a link that was called off.
  const refusal = redemptionRefusal(invite)
  if (refusal) {
    return NextResponse.json({ error: refusal.error }, { status: refusal.status })
  }
  if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invite.email} — sign in with that address to accept.` },
      { status: 403 },
    )
  }

  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: invite.communityId, userId: user.id } },
  })
  if (existing) {
    return NextResponse.json({ community: invite.community, alreadyMember: true })
  }

  // ⚠⚠ CENTRAL 25-A §3b — A SHARED LINK ASKS. IT DOES NOT JOIN.
  //
  // An invitation addressed to one person is a decision the inviter has already
  // made, so it still admits them. A link with no address is a decision nobody
  // has made about the person holding it — Charlie's rule is that only the
  // people with invitation rights admit anybody, and a link that anyone can pass
  // on made that unenforceable. So a link arrival becomes a PENDING request, and
  // somebody with the right approves it.
  if (!invite.email) {
    const { requestId, alreadyPending } = await requestJoinViaInvite(user.id, invite)
    const managerIds = await getNodeManagerIds(invite.communityId)
    if (!alreadyPending && managerIds.length > 0) {
      await prisma.notification.createMany({
        data: managerIds.map((managerId) => ({
          userId: managerId,
          type: 'SYSTEM' as const,
          title: 'Someone arrived through your invite link',
          message: `${user.name} used an invite link to ${invite.community.name} and is waiting to be let in`,
          linkUrl: `/communities/${invite.communityId}?panel=requests`,
        })),
      })
    }
    return NextResponse.json(
      {
        community: invite.community,
        alreadyMember: false,
        pending: true,
        alreadyPending,
        requestId,
        isBranch: invite.community.parentCommunityId !== null,
      },
      { status: 202 },
    )
  }

  // A branch invite makes you a member of that branch AND of the Community it
  // sits in (Stage 1.2) — otherwise a branch invitee would never see the
  // Community-wide board or the rest of the tree.
  // ⚠ 25-A §7h — the membership carries who brought them in, permanently.
  const { rootId } = await joinCommunityAndRoot(user.id, invite.communityId, 'MEMBER', {
    invitedByUserId: invite.createdByUserId,
    invitedViaInviteId: invite.id,
  })

  // Stage 2: redeeming a specific person's invite is what creates the referral
  // chain, per Community. A join request creates none, because nobody
  // introduced them. Recorded against the ROOT, since that is the scope points
  // and bonuses are computed in.
  await recordReferral({
    communityId: rootId,
    inviterUserId: invite.createdByUserId,
    inviteeUserId: user.id,
    // 25-A §2b — the link they actually came through, so an arrival is a fact
    // rather than an inference from "matches no direct invitation".
    inviteId: invite.id,
  })

  await prisma.communityInvite.update({
    where: { id: invite.id },
    data: { usedCount: { increment: 1 } },
  })

  return NextResponse.json(
    {
      community: invite.community,
      alreadyMember: false,
      // Drives where JoinButton sends them: a branch invite raises the
      // switch-or-add chooser, a Community invite lands on "Find your branch".
      isBranch: invite.community.parentCommunityId !== null,
      rootId,
    },
    { status: 201 },
  )
}
