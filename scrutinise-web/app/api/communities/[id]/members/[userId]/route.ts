import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CommunityRuleError, canManageCommunity, getRootCommunityId, setMemberRole } from '@/lib/community'
import { archiveMembership } from '@/lib/community-permissions'

type Params = { params: Promise<{ id: string; userId: string }> }

// ⚠ 25-A §7e — `role` is the platform-shaped membership role; `titleId` is the
// Community's own title. They are set through the same route because they sit
// on the same row, and they are deliberately separate fields: a title never
// changes what somebody is on Scrutinise.
const RoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  titleId: z.string().min(1).nullable().optional(),
})

// PATCH /api/communities/[id]/members/[userId]
// Promote MEMBER→ADMIN or demote ADMIN→MEMBER on this node. Manage rights.
// OWNER is fixed and refused by setMemberRole — a co-admin must not be able to
// demote the owner and take the node.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, userId: targetUserId } = await params
  if (!(await canManageCommunity(user.id, communityId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    if (parsed.data.titleId !== undefined) {
      // The title must be one this Community actually defined — an id from
      // somewhere else is not a title here.
      if (parsed.data.titleId !== null) {
        const rootId = await getRootCommunityId(communityId)
        const title = await prisma.communityTitle.findUnique({
          where: { id: parsed.data.titleId },
          select: { communityId: true },
        })
        if (!title || title.communityId !== rootId) {
          return NextResponse.json({ error: 'That title does not belong to this Community' }, { status: 422 })
        }
      }
      await prisma.communityMember.update({
        where: { communityId_userId: { communityId, userId: targetUserId } },
        data: { titleId: parsed.data.titleId },
      })
    }
    const membership = parsed.data.role
      ? await setMemberRole(communityId, targetUserId, parsed.data.role)
      : await prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId, userId: targetUserId } },
        })
    return NextResponse.json({ membership })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}

// DELETE /api/communities/[id]/members/[userId]
// Remove someone from this node. Manage rights; the OWNER cannot be removed.
//
// ⚠ CENTRAL 25-A §3c — this ARCHIVES the membership rather than deleting it,
// and touches none of their contributions: a removed member loses access, and
// what they wrote stays where it is, attributed to them. An optional `reason`
// is recorded with it.
const RemoveSchema = z.object({ reason: z.string().max(500).optional() })

export async function DELETE(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, userId: targetUserId } = await params
  if (!(await canManageCommunity(user.id, communityId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = RemoveSchema.safeParse(await req.json().catch(() => ({})))
  const reason = parsed.success ? parsed.data.reason : undefined

  try {
    const { archiveId } = await archiveMembership(communityId, targetUserId, user.id, reason)
    return NextResponse.json({ removed: true, archived: true, archiveId })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
