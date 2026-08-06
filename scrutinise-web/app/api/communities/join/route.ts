import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { joinCommunityAndRoot } from '@/lib/community'

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
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }
  if (invite.usedCount >= invite.maxUses) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 })
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

  // A branch invite makes you a member of that branch AND of the Community it
  // sits in (Stage 1.2) — otherwise a branch invitee would never see the
  // Community-wide board or the rest of the tree.
  const { rootId } = await joinCommunityAndRoot(user.id, invite.communityId, 'MEMBER')

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
