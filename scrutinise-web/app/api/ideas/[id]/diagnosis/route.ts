import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const DiagnosisSchema = z.object({
  diagnosisTitle: z.string().optional(),
  text: z.string().optional(),
  obstacleDefined: z.string().optional(),
  whoAffected: z.string().optional(),
  howAffected: z.string().optional(),
  whyPersisted: z.string().optional(),
  impactDescription: z.string().optional(),
  impactCost: z.string().optional(),
})

// POST /api/ideas/[id]/diagnosis — upsert Diagnosis record (one per idea)
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

  const parsed = DiagnosisSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const diagnosis = await prisma.diagnosis.upsert({
    where: { ideaId },
    create: { ideaId, ...parsed.data },
    update: parsed.data,
  })

  return NextResponse.json(diagnosis)
}
