import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const AssignManagerSchema = z.object({ userId: z.string().min(1).nullable() })

// PATCH /api/communities/[id]/manager
// Assign (or clear, userId: null) the manager for this node. OWNER/ADMIN only.
// The target must already be a member of this exact node — a manager governs
// the members of the sub-group they head (docs/SCRUTINISE_CENTRAL_SPEC.md §4),
// so they have to be in it first.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  const roleCheck = await requireCommunityRole(user.id, id)
  if (roleCheck.error) return roleCheck.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AssignManagerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { userId: managerId } = parsed.data

  if (managerId) {
    const targetMembership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId: managerId } },
    })
    if (!targetMembership) {
      return NextResponse.json({ error: 'Target user is not a member of this node' }, { status: 400 })
    }
  }

  const community = await prisma.community.update({
    where: { id },
    data: { managerId },
    include: { manager: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ community })
}
