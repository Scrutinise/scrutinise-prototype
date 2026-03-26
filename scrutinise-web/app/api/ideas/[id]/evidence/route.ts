import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const EvidenceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  comparablePolicy: z.string().optional(),
  successFailure: z.enum(['SUCCESS', 'FAILURE', 'MIXED']).optional(),
  whatWorked: z.string().optional(),
  whatFailed: z.string().optional(),
  resultCauses: z.string().optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceType: z.enum(['ACADEMIC', 'GOVERNMENT', 'NEWS', 'CASE_STUDY', 'LEGISLATION', 'OTHER']),
})

// POST /api/ideas/[id]/evidence — create Evidence record
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

  const parsed = EvidenceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { sourceUrl, ...rest } = parsed.data

  const evidence = await prisma.evidence.create({
    data: {
      ideaId,
      sourceUrl: sourceUrl || null,
      ...rest,
    },
  })

  return NextResponse.json(evidence, { status: 201 })
}
