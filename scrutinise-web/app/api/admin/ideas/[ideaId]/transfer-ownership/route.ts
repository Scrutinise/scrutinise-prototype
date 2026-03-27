import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const BodySchema = z.object({
  newOwnerUserId: z.string().uuid(),
})

// POST /api/admin/ideas/[ideaId]/transfer-ownership
// Auth: SUPER_ADMIN only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ideaId: string }> },
) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (authUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ideaId } = await params

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, title: true, creatorId: true, creator: { select: { id: true, name: true } } },
  })
  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  const newOwner = await prisma.user.findUnique({
    where: { id: body.newOwnerUserId },
    select: { id: true, name: true },
  })
  if (!newOwner) return NextResponse.json({ error: 'New owner not found' }, { status: 404 })

  const oldOwnerName = idea.creator.name
  const newOwnerName = newOwner.name

  await prisma.$transaction([
    prisma.idea.update({
      where: { id: ideaId },
      data: { creatorId: body.newOwnerUserId },
    }),
    prisma.activityLog.create({
      data: {
        userId: authUser.id,
        ideaId,
        activityType: 'ADMIN_ACTION',
        accessType: 'ADMIN_ACCESS',
        accessedByUserId: authUser.id,
        description: `Ownership transferred from ${oldOwnerName} to ${newOwnerName} by SuperAdmin ${authUser.name}`,
        metadata: {
          ideaId,
          fromUserId: idea.creatorId,
          toUserId: body.newOwnerUserId,
        },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    ideaTitle: idea.title,
    fromOwnerName: oldOwnerName,
    toOwnerName: newOwnerName,
  })
}
