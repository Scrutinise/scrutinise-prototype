import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { getCommunityMembership, getCommunityTree, requireCommunityAdmin, canManageCommunity } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]
// Community dashboard data — header, caller's role, branch tree, member list.
// Members only (invite-only per docs/SCRUTINISE_CENTRAL_SPEC.md §1).
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  const membership = await getCommunityMembership(user.id, id)
  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const community = await prisma.community.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, username: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })
  if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tree = await getCommunityTree(id)

  return NextResponse.json({
    community: {
      id: community.id,
      name: community.name,
      description: community.description,
      parent: community.parent,
      managerId: community.managerId,
      bulletinCategories: community.bulletinCategories,
    },
    myRole: membership.role,
    canManage: await canManageCommunity(user.id, id),
    members: community.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      username: m.user.username,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    tree,
  })
}

const UpdateCommunitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
}).strict()

// PATCH /api/communities/[id]
// Rename / update description. OWNER or ADMIN only.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  // Admin of this node OR of any node above it — the tree's per-node "Rename"
  // button has to work on descendants the caller didn't create.
  const denied = await requireCommunityAdmin(user.id, id)
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateCommunitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const community = await prisma.community.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json({ community })
}
