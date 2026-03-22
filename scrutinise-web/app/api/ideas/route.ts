import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const CreateIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  summaryDescription: z.string().min(1).max(280),
  summaryDiagnosis: z.string().max(500).optional(),
  summaryGuidingPolicy: z.string().max(500).optional(),
  summaryCoherentActions: z.string().max(500).optional(),
  ideaType: z.enum(['LEGISLATION', 'ORGANISATION']).default('LEGISLATION'),
  govtArea: z.string().min(1),
  govtLevel: z.enum(['LOCAL', 'DEVOLVED', 'NATIONAL', 'INTERNATIONAL']).default('NATIONAL'),
  connectedIdeaIds: z.array(z.string().uuid()).optional(),
})

// POST /api/ideas — create a new idea
export async function POST(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateIdeaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const {
    title,
    summaryDescription,
    summaryDiagnosis,
    summaryGuidingPolicy,
    summaryCoherentActions,
    ideaType,
    govtArea,
    govtLevel,
    connectedIdeaIds,
  } = parsed.data

  const idea = await prisma.idea.create({
    data: {
      creatorId: user.id,
      title,
      summaryDescription,
      summaryDiagnosis,
      summaryGuidingPolicy,
      summaryCoherentActions,
      ideaType,
      govtArea,
      govtLevel,
      connectedIdeaIds: connectedIdeaIds ?? [],
      stage: 'STAGE_1',
      visibility: 'PRIVATE',
      status: 'DRAFT',
    },
    select: {
      id: true,
      stage: true,
      title: true,
      summaryDescription: true,
      createdAt: true,
    },
  })

  return NextResponse.json(idea, { status: 201 })
}
