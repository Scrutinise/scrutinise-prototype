import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityAdmin, getRootCommunityId } from '@/lib/community'
import { sendCommunityInviteEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

const CreateInviteSchema = z.object({
  // Invite a specific existing account. Their address is resolved server-side
  // so the panel never has to see (or send back) somebody's email.
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  maxUses: z.number().int().min(1).max(10_000).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

// GET /api/communities/[id]/invites
// List invite codes for this community. OWNER/ADMIN only.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const denied = await requireCommunityAdmin(user.id, communityId)
  if (denied) return denied

  const invites = await prisma.communityInvite.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invites })
}

// POST /api/communities/[id]/invites
// Generate an invite. OWNER/ADMIN only. Three shapes, all landing on the same
// CommunityInvite row:
//   {}                — an open code to share by hand
//   { userId }        — invite an existing account; pinned to their address and
//                       announced to them in their Feed
//   { email }         — invite an address with no account yet, which is the
//                       normal case (Stage 1.1: this used to fail silently)
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const denied = await requireCommunityAdmin(user.id, communityId)
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    // Empty body is fine — every field is optional/defaulted.
    body = {}
  }

  const parsed = CreateInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { userId, maxUses, expiresInDays } = parsed.data
  let { email } = parsed.data
  let targetName: string | null = null

  if (userId) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, username: true },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const alreadyMember = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    })
    if (alreadyMember) {
      return NextResponse.json({ error: 'That person is already a member' }, { status: 409 })
    }

    email = target.email
    targetName = target.name ?? target.username
  }

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { name: true, parentCommunityId: true },
  })
  if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rootId = await getRootCommunityId(communityId)
  const rootName =
    rootId === communityId
      ? community.name
      : (await prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { name: true } })).name

  const invite = await prisma.communityInvite.create({
    data: {
      communityId,
      inviteCode: crypto.randomBytes(16).toString('hex'),
      email,
      // An invite pinned to one person is single-use by definition.
      maxUses: userId ? 1 : maxUses,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
      createdByUserId: user.id,
    },
  })

  // An invited existing user also gets it in their Feed.
  if (userId) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Community invitation',
        message: `${user.name} invited you to join ${community.name}`,
        linkUrl: `/community-invite/${invite.inviteCode}`,
      },
    })
  }

  // Email whenever the invite is tied to an address, registered or not
  // (Stage 1.2). The result is REPORTED, never assumed: the invite row is
  // already valid, so a mail failure must not lose it, and claiming "emailed"
  // when nothing left the building is the exact failure the invite work exists
  // to remove. The copy-link panel stays regardless.
  let emailed: { sent: boolean; reason?: string } | null = null
  if (email) {
    emailed = await sendCommunityInviteEmail({
      toEmail: email,
      invitedByName: user.name ?? 'Someone',
      communityName: community.name,
      isBranch: community.parentCommunityId !== null,
      rootName,
      inviteCode: invite.inviteCode,
    })
  }

  return NextResponse.json(
    { invite, targetName, notified: Boolean(userId), emailed },
    { status: 201 },
  )
}
