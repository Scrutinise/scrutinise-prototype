import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'

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

  const [members, titles] = await Promise.all([
    prisma.communityMember.findMany({
      where: { communityId },
      include: {
        user: { select: { id: true, name: true, username: true } },
        // ⚠ 25-A §7h — who brought them in, on the members list itself. §7g asked
        // what a branch chair can actually see; before this, "who invited whom"
        // was derivable only from a root-scoped referral table they never look at.
        invitedBy: { select: { name: true, username: true } },
        title: { select: { id: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    }),
    // The titles this Community defines, so the panel can offer them.
    prisma.communityTitle.findMany({
      where: { communityId: await getRootCommunityId(communityId) },
      select: { id: true, name: true, grantsInvite: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      username: m.user.username,
      role: m.role,
      joinedAt: m.joinedAt,
      // ⚠ Null is a real answer here and the panel says so in words: somebody
      // who asked to join was brought in by nobody, which is not the same as a
      // record we failed to keep.
      invitedByName: m.invitedBy?.name ?? m.invitedBy?.username ?? null,
      titleId: m.titleId,
      titleName: m.title?.name ?? null,
    })),
    titles,
  })
}
