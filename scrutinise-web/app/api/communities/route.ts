import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { countUnreadBulletin } from '@/lib/community'

const CreateCommunitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
})

// GET /api/communities
// "My Communities" landing list — every Community the caller belongs to.
export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const memberships = await prisma.communityMember.findMany({
    where: { userId: user.id },
    include: {
      community: {
        include: { _count: { select: { members: true, children: true } } },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  const communities = await Promise.all(
    memberships.map(async (m) => ({
      id: m.community.id,
      name: m.community.name,
      description: m.community.description,
      role: m.role,
      memberCount: m.community._count.members,
      branchCount: m.community._count.children,
      isBranch: m.community.parentCommunityId !== null,
      unreadCount: await countUnreadBulletin(m.community.id, m.lastReadAt),
    })),
  )

  return NextResponse.json({ communities })
}

// POST /api/communities
// Any signed-in user can create a top-level Community; creator becomes OWNER.
export async function POST(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateCommunitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, description } = parsed.data

  const community = await prisma.$transaction(async (tx) => {
    const created = await tx.community.create({
      data: { name, description },
    })
    await tx.communityMember.create({
      data: { communityId: created.id, userId: user.id, role: 'OWNER' },
    })
    return created
  })

  return NextResponse.json({ community }, { status: 201 })
}
