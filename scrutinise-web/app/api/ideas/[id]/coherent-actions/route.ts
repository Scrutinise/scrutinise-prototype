import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

const CoherentActionSchema = z.object({
  title: z.string().min(1).max(200),
  summarySnippet: z.string().optional(),
  detailedDescription: z.string().optional(),
  actionType: z.string().optional(),
  legislationDraftWording: z.string().optional(),
  organisationalChangeDraftWording: z.string().optional(),
  proposedWording: z.string().optional(),
  costBenefitAnalysis: z.string().optional(),
  costFinancial: z.string().optional(),
  costSocial: z.string().optional(),
  costOngoing: z.string().optional(),
  benefits: z.string().optional(),
  practicalExecution: z.string().optional(),
  implementationPlan: z.string().optional(),
  implementationSubQuestions: z.record(z.string(), z.unknown()).optional(),
  accountability: z.string().optional(),
  successMeasurement: z.string().optional(),
  keyRisks: z.string().optional(),
  potentialHarm: z.string().optional(),
  keyChallenges: z.string().optional(),
  sourcesOfOpposition: z.string().optional(),
  oppositionWho: z.string().optional(),
  oppositionWhy: z.string().optional(),
  oppositionAnswers: z.string().optional(),
  orderIndex: z.number().int().min(0).default(0),
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

  const { implementationSubQuestions, ...rest } = parsed.data
  const createData: Prisma.CoherentActionUncheckedCreateInput = {
    ideaId,
    ...rest,
    implementationSubQuestions: implementationSubQuestions as Prisma.InputJsonValue | undefined,
  }

  const action = await prisma.coherentAction.create({ data: createData })

  return NextResponse.json(action, { status: 201 })
}
