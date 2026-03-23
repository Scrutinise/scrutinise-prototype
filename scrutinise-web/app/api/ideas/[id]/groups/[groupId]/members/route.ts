import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; groupId: string }> }

const MemberSchema = z.object({
  userId: z.string().min(1),
})

// POST /api/ideas/[id]/groups/[groupId]/members
// Adds a member to the group. Owner only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId, groupId } = await params

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, ideaId: true, ownerId: true },
  })

  if (!group || group.ideaId !== ideaId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (group.ownerId !== user.id) {
    return NextResponse.json({ error: 'Only the group owner can add members' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = MemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const member = await prisma.groupMember.create({
      data: { groupId, userId: parsed.data.userId },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    })

    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: { increment: 1 } },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }
    throw e
  }
}
