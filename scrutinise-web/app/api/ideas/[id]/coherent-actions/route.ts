import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const CoherentActionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  orderIndex: z.number().int().min(0),
})

// POST /api/ideas/[id]/coherent-actions
// Auth required. Owner or collaborator only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: { collaborators: { select: { userId: true } } },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = idea.creatorId === user.id
  const isCollaborator = idea.collaborators.some(c => c.userId === user.id)

  if (!isOwner && !isCollaborator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CoherentActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { title, description, orderIndex } = parsed.data

  const action = await prisma.coherentAction.create({
    data: {
      ideaId,
      title,
      detailedDescription: description,
      orderIndex,
    },
  })

  return NextResponse.json(action, { status: 201 })
}
