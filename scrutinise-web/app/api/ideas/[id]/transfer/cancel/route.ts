import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentUser = await prisma.user.findUnique({ where: { clerkId } })
  if (!currentUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  const idea = await prisma.idea.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      creatorId: true,
      ownershipTransferToId: true,
    },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = idea.creatorId === currentUser.id
  const isRecipient = idea.ownershipTransferToId === currentUser.id

  if (!isOwner && !isRecipient) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.idea.update({
    where: { id: idea.id },
    data: {
      ownershipTransferToken: null,
      ownershipTransferToId: null,
      ownershipTransferExpiry: null,
    },
  })

  return NextResponse.json({ success: true })
}
