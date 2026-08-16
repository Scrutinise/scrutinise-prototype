import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkAndAdvanceStage } from '@/lib/stage-gates'
import { awardPoints } from '@/lib/points'

type Params = { params: Promise<{ id: string }> }

// Idea fields that can be updated via PATCH
const PatchIdeaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summaryDescription: z.string().max(280).optional(),
  summaryDiagnosis: z.string().max(500).optional(),
  summaryGuidingPolicy: z.string().max(500).optional(),
  summaryCoherentActions: z.string().max(500).optional(),
  diagnosis: z.string().optional(),
  guidingPolicy: z.string().optional(),
  rootCause: z.string().optional(),
  whoAffected: z.string().optional(),
  proposedWording: z.string().optional(),
  aiChatHistory: z.array(z.object({
    role: z.enum(['user', 'lex']),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional(),
  aiCurrentField: z.string().optional(),
  userAdditionalNotes: z.string().optional(),
}).strict()

// GET /api/ideas/[id]
// Public for LINK_ONLY (Stage 3+) and PLATFORM_LISTED ideas.
// Private ideas require owner/collaborator/admin auth.
export async function GET(req: Request, { params }: Params) {
  const { id } = await params

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, username: true, credibilityScore: { select: { totalScore: true, phase: true } } } },
      coherentActions: { orderBy: { orderIndex: 'asc' } },
      diagnoses: true,
      rootCauses: true,
      guidingPolicies: true,
      research: { orderBy: { createdAt: 'asc' } },
      collaborators: { include: { user: { select: { id: true, name: true, email: true } } } },
      legislationLinks: { select: { id: true, legislationItemId: true } },
    },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // LINK_ONLY and PLATFORM_LISTED ideas are public — no auth required
  if (idea.visibility === 'LINK_ONLY' || idea.visibility === 'PLATFORM_LISTED') {
    return NextResponse.json(idea)
  }

  // PRIVATE ideas — require auth
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: clerkUserId } })
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const isOwner = idea.creatorId === dbUser.id
  const isCollaborator = idea.collaborators.some(c => c.userId === dbUser.id)
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(dbUser.role)

  if (!isOwner && !isCollaborator && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Privacy log: admin accessing another user's idea
  if (isAdmin && !isOwner) {
    const accessReason = req.headers.get('x-access-reason') ?? 'No reason provided'
    await prisma.activityLog.create({
      data: {
        userId: idea.creatorId,
        ideaId: idea.id,
        activityType: 'ADMIN_ACCESS',
        description: `Admin accessed idea: ${idea.title}`,
        accessType: 'ADMIN_ACCESS',
        accessReason,
        accessedByUserId: dbUser.id,
      },
    })
  }

  return NextResponse.json(idea)
}

// PATCH /api/ideas/[id]
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: { collaborators: { select: { userId: true, role: true } } },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = idea.creatorId === user.id
  const isEditor = idea.collaborators.some(c => c.userId === user.id && c.role === 'EDITOR')

  if (!isOwner && !isEditor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchIdeaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const updated = await prisma.idea.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      stage: true,
      title: true,
      summaryDescription: true,
      diagnosis: true,
      guidingPolicy: true,
      rootCause: true,
      whoAffected: true,
      proposedWording: true,
      updatedAt: true,
    },
  })

  // Stage gate: check if 1→2 auto-advance should fire
  await checkAndAdvanceStage(id, idea.creatorId)

  // Award points for first-time field completions (owner only)
  if (isOwner) {
    const wasBlank = (field: string | null | undefined) => !field?.trim()
    if (idea.stage === 'STAGE_1' && wasBlank(idea.diagnosis) && wasBlank(idea.guidingPolicy)) {
      await awardPoints({ userId: user.id, actionType: 'IDEA_STARTED', relatedIdeaId: id })
    }
    if (wasBlank(idea.diagnosis) && parsed.data.diagnosis?.trim()) {
      await awardPoints({ userId: user.id, actionType: 'DIAGNOSIS_COMPLETE', relatedIdeaId: id })
    }
    if (wasBlank(idea.guidingPolicy) && parsed.data.guidingPolicy?.trim()) {
      await awardPoints({ userId: user.id, actionType: 'GUIDING_POLICY_COMPLETE', relatedIdeaId: id })
    }
  }

  // Re-fetch with latest stage after potential advancement
  const latest = await prisma.idea.findUnique({
    where: { id },
    select: { id: true, stage: true, updatedAt: true },
  })

  return NextResponse.json({ ...updated, stage: latest?.stage })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/ideas/[id] — §19-E Task 6.
//
// There was no way to delete an idea at all. Charlie has pre-rebuild ideas that cannot
// exercise the current flow and are polluting his testing, and the only way to be rid
// of one was a hand-written SQL statement against production.
//
// FOUR DECISIONS, each with a reason:
//
//  1. OWNER ONLY. Not owner-or-collaborator. `authorizeIdea` admits collaborators,
//     which is right for editing and wrong for destruction: a collaborator invited to
//     help with the wording should not be able to remove the thing they were invited
//     to. Checked here rather than by reaching for the shared helper, because the
//     shared helper's answer is the wrong one for this verb.
//
//  2. SOFT. `deletedAt` is set; nothing is destroyed. An accidental delete is one
//     UPDATE away from being undone. A cascade across twenty related tables — votes,
//     comments, endorsements, evidence, cost lines — is not reversible at all, and the
//     brief asks for whichever is cheaper to reverse.
//
//  3. REFUSED FROM STAGE 4. Once voting has opened and the public can see it, an idea
//     has other people's contributions attached to it and deleting it takes their work
//     with it. That is a withdrawal, which already exists as a separate act with its
//     own semantics. Returning 409 with the reason is more useful than a silent
//     no-op, and more honest than pretending to delete something that is still listed.
//
//  4. IDEMPOTENT. Deleting an already-deleted idea returns 200, not 404. The client
//     may retry; a second press should not produce an error dialogue about an idea the
//     user has already successfully removed.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: { id: true, creatorId: true, title: true, stage: true, deletedAt: true },
  })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (idea.creatorId !== user.id) {
    // 403, not 404: the caller reached an idea they can legitimately see (they may be a
    // collaborator). Pretending it does not exist would be a lie they can disprove.
    return NextResponse.json({ error: 'Only the owner can delete an idea' }, { status: 403 })
  }

  if (idea.deletedAt) {
    return NextResponse.json({ ok: true, alreadyDeleted: true, id, title: idea.title })
  }

  const PUBLIC_STAGES = ['STAGE_4', 'STAGE_5']
  if (PUBLIC_STAGES.includes(idea.stage)) {
    return NextResponse.json({
      error:
        'This idea is public and carries other people’s votes and contributions. ' +
        'Withdraw it instead — deleting it would take their work with it.',
      code: 'PUBLIC_IDEA',
    }, { status: 409 })
  }

  await prisma.idea.update({ where: { id }, data: { deletedAt: new Date() } })
  console.log('[idea] deleted', { id, stage: idea.stage, by: user.id })

  return NextResponse.json({ ok: true, id, title: idea.title })
}
