import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; amendmentId: string }> }

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('circulate') }),
  z.object({
    action: z.literal('request_revision'),
    revisionGuidance: z.string().min(1, 'Guidance is required'),
  }),
  z.object({
    action: z.literal('reject'),
    rejectionReason: z.string().min(1, 'Rejection reason is required'),
  }),
])

// PATCH /api/ideas/[id]/amendments/[amendmentId] — owner action on a pending amendment
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, amendmentId } = await params

  const [idea, amendment] = await Promise.all([
    prisma.idea.findUnique({
      where: { id },
      select: { id: true, creatorId: true, stage: true },
    }),
    prisma.amendment.findUnique({
      where: { id: amendmentId },
      select: { id: true, ideaId: true, authorId: true, status: true },
    }),
  ])

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
  if (!amendment) return NextResponse.json({ error: 'Amendment not found' }, { status: 404 })
  if (amendment.ideaId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the idea owner can take action
  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden — only the owner can action amendments' }, { status: 403 })
  }

  // Only act on PENDING amendments
  if (amendment.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Amendment is already ${amendment.status.toLowerCase().replace('_', ' ')}` },
      { status: 422 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const payload = parsed.data

  const updated = await prisma.$transaction(async tx => {
    let updateData: Record<string, unknown>
    let notificationTitle: string
    let notificationMessage: string

    switch (payload.action) {
      case 'accept':
        updateData = { status: 'ACCEPTED', mode: 'MODE_B' }
        notificationTitle = 'Your amendment was accepted'
        notificationMessage = 'The owner accepted your amendment (Mode B — Binding).'
        break
      case 'circulate':
        updateData = { status: 'CONSULTING', mode: 'MODE_A' }
        notificationTitle = 'Your amendment is being consulted'
        notificationMessage =
          'The owner is circulating your amendment for consultation (Mode A — Advisory).'
        break
      case 'request_revision':
        updateData = { status: 'REVISION_REQUESTED', revisionGuidance: payload.revisionGuidance }
        notificationTitle = 'Revision requested on your amendment'
        notificationMessage = `The owner has asked for a revision: "${payload.revisionGuidance}"`
        break
      case 'reject':
        updateData = { status: 'REJECTED', rejectionReason: payload.rejectionReason }
        notificationTitle = 'Your amendment was rejected'
        notificationMessage = `The owner rejected your amendment: "${payload.rejectionReason}"`
        break
    }

    const result = await tx.amendment.update({
      where: { id: amendmentId },
      data: updateData,
    })

    // Notify the amendment author (if not the owner acting on their own)
    if (amendment.authorId !== user.id) {
      await tx.notification.create({
        data: {
          userId: amendment.authorId,
          type: payload.action === 'accept' ? 'AMENDMENT_ACCEPTED' : 'AMENDMENT_REJECTED',
          relatedIdeaId: id,
          title: notificationTitle,
          message: notificationMessage,
          linkUrl: `/ideas/${id}?tab=amendments`,
        },
      })
    }

    return result
  })

  return NextResponse.json({ amendment: updated })
}
