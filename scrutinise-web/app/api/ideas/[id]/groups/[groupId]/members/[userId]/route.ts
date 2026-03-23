import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; groupId: string; userId: string }> }

// DELETE /api/ideas/[id]/groups/[groupId]/members/[userId]
// Removes a member from the group. Owner only, or member removing themselves.
export async function DELETE(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId, groupId, userId: targetUserId } = await params

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, ideaId: true, ownerId: true },
  })

  if (!group || group.ideaId !== ideaId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isGroupOwner = group.ownerId === user.id
  const isSelf = user.id === targetUserId

  if (!isGroupOwner && !isSelf) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const deleted = await prisma.groupMember.deleteMany({
    where: { groupId, userId: targetUserId },
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { memberCount: { decrement: 1 } },
  })

  return new NextResponse(null, { status: 204 })
}
