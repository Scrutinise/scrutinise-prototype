import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const ALL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

// POST /api/communities/[id]/read
// Bumps the caller's lastReadAt for this Community's bulletin board — clears
// the unread count shown on the My Communities list.
export async function POST(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  await prisma.communityMember.update({
    where: { communityId_userId: { communityId, userId: user.id } },
    data: { lastReadAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
