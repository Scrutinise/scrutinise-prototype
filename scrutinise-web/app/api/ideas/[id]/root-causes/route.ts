import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const RootCauseSchema = z.object({
  rootCauseTitle: z.string().optional(),
  text: z.string().optional(),
  rootCauseMechanism: z.string().optional(),
  whyNotSolved: z.string().optional(),
  incentiveDrivers: z.string().optional(),
  structureDrivers: z.string().optional(),
})

async function getIdeaWithAuth(ideaId: string, userId: string) {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!idea) return { idea: null, authorized: false }
  const authorized = idea.creatorId === userId || idea.collaborators.some(c => c.userId === userId)
  return { idea, authorized }
}

// GET /api/ideas/[id]/root-causes — list all RootCause records for this idea
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params
  const { idea, authorized } = await getIdeaWithAuth(ideaId, user.id)

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rootCauses = await prisma.rootCause.findMany({
    where: { ideaId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(rootCauses)
}

// POST /api/ideas/[id]/root-causes — create a new RootCause record
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params
  const { idea, authorized } = await getIdeaWithAuth(ideaId, user.id)

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RootCauseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const rootCause = await prisma.rootCause.create({
    data: { ideaId, ...parsed.data },
  })

  return NextResponse.json(rootCause, { status: 201 })
}
