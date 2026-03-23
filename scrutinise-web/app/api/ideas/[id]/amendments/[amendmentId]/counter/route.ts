import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; amendmentId: string }> }

const CounterSchema = z.object({
  proposedText: z.string().min(1, 'Proposed text is required'),
  rationale: z.string().min(1, 'Rationale is required'),
})

// POST /api/ideas/[id]/amendments/[amendmentId]/counter — owner counter-proposal
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, amendmentId } = await params

  const [idea, parentAmendment] = await Promise.all([
    prisma.idea.findUnique({
      where: { id },
      select: { id: true, creatorId: true, stage: true },
    }),
    prisma.amendment.findUnique({
      where: { id: amendmentId },
      select: {
        id: true,
        ideaId: true,
        authorId: true,
        sectionChanged: true,
        currentText: true,
        status: true,
        stageNumber: true,
      },
    }),
  ])

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
  if (!parentAmendment) return NextResponse.json({ error: 'Amendment not found' }, { status: 404 })
  if (parentAmendment.ideaId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the idea owner can counter-propose
  if (idea.creatorId !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden — only the owner can counter-propose' },
      { status: 403 },
    )
  }

  // Parent must be PENDING
  if (parentAmendment.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Can only counter-propose on a pending amendment' },
      { status: 422 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CounterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { proposedText, rationale } = parsed.data

  const counter = await prisma.$transaction(async tx => {
    const newCounter = await tx.amendment.create({
      data: {
        ideaId: id,
        authorId: user.id,
        stageNumber: parentAmendment.stageNumber,
        sectionChanged: parentAmendment.sectionChanged,
        currentText: parentAmendment.currentText,
        proposedText,
        rationale,
        isCounterProposal: true,
        parentAmendmentId: amendmentId,
        status: 'PENDING',
      },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    })

    // Notify the original amendment author
    if (parentAmendment.authorId !== user.id) {
      await tx.notification.create({
        data: {
          userId: parentAmendment.authorId,
          type: 'AMENDMENT_PROPOSED',
          relatedIdeaId: id,
          title: 'Owner counter-proposed your amendment',
          message: 'The owner has proposed an alternative wording to your amendment.',
          linkUrl: `/ideas/${id}?tab=amendments`,
        },
      })
    }

    return newCounter
  })

  return NextResponse.json({ amendment: counter }, { status: 201 })
}
