import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { canManageCommunity } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/members
// The node's Members panel. Manage rights, NOT membership — the same carve-out
// as the Requests panel: a member list is a management surface, and an ancestor
// admin needs it to promote, demote or remove. The node's board is unaffected
// and stays membership-gated.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params
  if (!(await canManageCommunity(user.id, communityId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const members = await prisma.communityMember.findMany({
    where: { communityId },
    include: { user: { select: { id: true, name: true, username: true } } },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  })

  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      username: m.user.username,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  })
}
