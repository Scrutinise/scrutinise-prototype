import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const FieldApprovalSchema = z.object({
  fieldKey: z.string().min(1),
  value: z.string(),
})

// Stage 1 Idea-level fields — written directly to Idea record
const IDEA_STAGE1_FIELDS = new Set([
  'title',
  'summaryDescription',
  'summaryDiagnosis',
  'summaryGuidingPolicy',
  'summaryCoherentActions',
  'govtArea',
])

// Legacy Stage 2 Idea-level fields
const IDEA_STAGE2_FIELDS = new Set([
  'diagnosis',
  'guidingPolicy',
  'rootCause',
  'whoAffected',
  'proposedWording',
])

// Build the completedFields map from the latest idea state
async function buildCompletedFields(ideaId: string) {
  const latest = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      diagnosis: true,
      rootCause: true,
      guidingPolicy: true,
      summaryDiagnosis: true,
      summaryGuidingPolicy: true,
      summaryCoherentActions: true,
      whoAffected: true,
      proposedWording: true,
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
    },
  })

  return {
    diagnosis: !!latest?.summaryDiagnosis || !!latest?.diagnosis,
    rootCause: !!latest?.rootCause,
    guidingPolicy: !!latest?.summaryGuidingPolicy || !!latest?.guidingPolicy,
    coherentActions: (latest?.coherentActions.length ?? 0) > 0 || !!latest?.summaryCoherentActions?.trim(),
    whoAffected: !!latest?.whoAffected,
    research: (latest?.research.length ?? 0) > 0,
    proposedWording: !!latest?.proposedWording,
  }
}

// POST /api/ideas/[id]/field-approval — accept a field proposal and write to DB
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

  const parsed = FieldApprovalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { fieldKey, value } = parsed.data

  try {
    if (fieldKey === 'ideaType') {
      // Enum field — validate before writing
      if (value !== 'LEGISLATION' && value !== 'ORGANISATION') {
        return NextResponse.json({ error: 'Invalid ideaType value' }, { status: 422 })
      }
      await prisma.idea.update({
        where: { id: ideaId },
        data: { ideaType: value },
      })

    } else if (IDEA_STAGE1_FIELDS.has(fieldKey)) {
      // Stage 1 summary fields — write to Idea
      const updateData: Record<string, string> = { [fieldKey]: value }
      // Mirror summary fields to legacy fields for sidebar compatibility
      if (fieldKey === 'summaryDiagnosis') updateData['diagnosis'] = value
      if (fieldKey === 'summaryGuidingPolicy') updateData['guidingPolicy'] = value
      await prisma.idea.update({ where: { id: ideaId }, data: updateData })

    } else if (IDEA_STAGE2_FIELDS.has(fieldKey)) {
      // Stage 2 Idea-level fields
      await prisma.idea.update({
        where: { id: ideaId },
        data: { [fieldKey]: value },
      })

    } else if (fieldKey.startsWith('diagnosis.')) {
      // Diagnosis sub-entity field
      const subField = fieldKey.slice('diagnosis.'.length)
      await prisma.diagnosis.upsert({
        where: { ideaId },
        create: { ideaId, [subField]: value },
        update: { [subField]: value },
      })

    } else if (fieldKey.startsWith('guidingPolicy.')) {
      // GuidingPolicy sub-entity field
      const subField = fieldKey.slice('guidingPolicy.'.length)
      await prisma.guidingPolicy.upsert({
        where: { ideaId },
        create: { ideaId, [subField]: value },
        update: { [subField]: value },
      })

    } else if (fieldKey.startsWith('rootCause.')) {
      // RootCause — update the most recent one if it exists, otherwise create
      const subField = fieldKey.slice('rootCause.'.length)
      const existing = await prisma.rootCause.findFirst({
        where: { ideaId },
        orderBy: { createdAt: 'desc' },
      })
      if (existing) {
        await prisma.rootCause.update({
          where: { id: existing.id },
          data: { [subField]: value },
        })
      } else {
        await prisma.rootCause.create({
          data: { ideaId, [subField]: value },
        })
      }

    } else if (fieldKey === 'coherentActions') {
      // CoherentAction — value may be JSON with {title, description, actionType, orderIndex}
      let actionData: Record<string, string | number> = {}
      try {
        actionData = JSON.parse(value)
      } catch {
        // Plain string → treat as title
        actionData = { title: value }
      }
      await prisma.coherentAction.create({
        data: {
          ideaId,
          title: String(actionData.title ?? 'Action'),
          detailedDescription: actionData.description ? String(actionData.description) : undefined,
          actionType: actionData.actionType ? String(actionData.actionType) : undefined,
          orderIndex: typeof actionData.orderIndex === 'number' ? actionData.orderIndex : 0,
        },
      })

    } else if (fieldKey === 'evidence') {
      // Evidence — value should be JSON
      let evidenceData: Record<string, string> = {}
      try {
        evidenceData = JSON.parse(value)
      } catch {
        evidenceData = { title: value, description: value }
      }
      await prisma.evidence.create({
        data: {
          ideaId,
          title: evidenceData.title ?? 'Evidence',
          description: evidenceData.description ?? value,
          sourceType: (evidenceData.sourceType as never) ?? 'OTHER',
          sourceUrl: evidenceData.sourceUrl || null,
        },
      })

    } else {
      return NextResponse.json({ error: `Unknown fieldKey: ${fieldKey}` }, { status: 422 })
    }
  } catch (err) {
    console.error('[field-approval] Write failed:', err)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }

  const completedFields = await buildCompletedFields(ideaId)
  return NextResponse.json({ completedFields })
}
