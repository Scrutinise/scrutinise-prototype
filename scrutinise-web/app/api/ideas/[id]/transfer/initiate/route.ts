import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendOwnershipTransferEmail } from '@/lib/email'

const BodySchema = z.object({
  newOwnerUserId: z.string().min(1),
})

export async function POST(
  req: NextRequest,
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
      title: true,
      creatorId: true,
      collaborators: {
        include: { user: { select: { id: true, name: true, preferredName: true, email: true } } },
      },
    },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.creatorId !== currentUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = BodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { newOwnerUserId } = body.data

  if (newOwnerUserId === currentUser.id) {
    return NextResponse.json({ error: 'Cannot transfer ownership to yourself' }, { status: 400 })
  }

  const collaborator = idea.collaborators.find(c => c.user.id === newOwnerUserId)
  if (!collaborator) {
    return NextResponse.json({ error: 'New owner must be an existing collaborator' }, { status: 400 })
  }

  const token = crypto.randomUUID()
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await prisma.idea.update({
    where: { id: idea.id },
    data: {
      ownershipTransferToken: token,
      ownershipTransferToId: newOwnerUserId,
      ownershipTransferExpiry: expiry,
    },
  })

  const newOwner = collaborator.user
  const toEmail = newOwner.email
  if (toEmail) {
    await sendOwnershipTransferEmail({
      toEmail,
      toFirstName: newOwner.preferredName ?? newOwner.name.split(' ')[0],
      fromOwnerName: currentUser.name,
      ideaTitle: idea.title,
      ideaId: idea.id,
      token,
    })
  }

  return NextResponse.json({ success: true })
}
