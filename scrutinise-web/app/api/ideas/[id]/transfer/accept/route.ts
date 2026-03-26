import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const BodySchema = z.object({
  token: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentUser = await prisma.user.findUnique({ where: { clerkId } })
  if (!currentUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  const body = BodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { token } = body.data

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      creatorId: true,
      ownershipTransferToken: true,
      ownershipTransferToId: true,
      ownershipTransferExpiry: true,
    },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (idea.ownershipTransferToken !== token) {
    return NextResponse.json({ error: 'Invalid or expired transfer token' }, { status: 400 })
  }

  if (idea.ownershipTransferToId !== currentUser.id) {
    return NextResponse.json({ error: 'Forbidden — this transfer is not addressed to you' }, { status: 403 })
  }

  if (!idea.ownershipTransferExpiry || idea.ownershipTransferExpiry < new Date()) {
    return NextResponse.json({ error: 'Transfer offer has expired' }, { status: 400 })
  }

  const previousOwnerId = idea.creatorId

  await prisma.$transaction(async tx => {
    // Transfer ownership
    await tx.idea.update({
      where: { id: idea.id },
      data: {
        creatorId: currentUser.id,
        ownershipTransferToken: null,
        ownershipTransferToId: null,
        ownershipTransferExpiry: null,
      },
    })

    // Add previous owner as collaborator (EDITOR) if not already
    await tx.ideaCollaborator.upsert({
      where: { ideaId_userId: { ideaId: idea.id, userId: previousOwnerId } },
      update: {},
      create: {
        ideaId: idea.id,
        userId: previousOwnerId,
        invitedByUserId: currentUser.id,
        acceptedAt: new Date(),
      },
    })

    // Notify old owner
    await tx.notification.create({
      data: {
        userId: previousOwnerId,
        relatedIdeaId: idea.id,
        type: 'SYSTEM',
        message: `Ownership of "${idea.title}" has been transferred to ${currentUser.name}.`,
      },
    })
  })

  return NextResponse.json({ success: true, ideaTitle: idea.title })
}
