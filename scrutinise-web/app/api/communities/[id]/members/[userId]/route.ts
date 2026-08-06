import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, canManageCommunity, removeMember, setMemberRole } from '@/lib/community'

type Params = { params: Promise<{ id: string; userId: string }> }

const RoleSchema = z.object({ role: z.enum(['ADMIN', 'MEMBER']) })

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
    const membership = await setMemberRole(communityId, targetUserId, parsed.data.role)
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
export async function DELETE(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, userId: targetUserId } = await params
  if (!(await canManageCommunity(user.id, communityId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await removeMember(communityId, targetUserId)
    return NextResponse.json({ removed: true })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
