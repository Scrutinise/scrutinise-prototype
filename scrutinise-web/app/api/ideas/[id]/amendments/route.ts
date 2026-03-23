import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const ProposeSchema = z.object({
  sectionChanged: z.string().min(1, 'Section is required'),
  currentText: z.string().min(1, 'Current text is required'),
  proposedText: z.string().min(1, 'Proposed text is required'),
  rationale: z.string().min(1, 'Rationale is required'),
  changesProposed: z.string().optional(),
  researchUrls: z.array(z.string().url('Invalid URL')).optional(),
})

// GET /api/ideas/[id]/amendments — list amendments (public for Stage 3+)
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: { stage: true, visibility: true },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only show amendments at Stage 3+ for public visibility
  if (idea.visibility === 'PRIVATE') {
    return NextResponse.json({ amendments: [] })
  }

  const amendments = await prisma.amendment.findMany({
    where: { ideaId: id, isCounterProposal: false },
    include: {
      author: { select: { id: true, name: true, username: true } },
      counterProposals: {
        include: {
          author: { select: { id: true, name: true, username: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ amendments })
}

// POST /api/ideas/[id]/amendments — propose an amendment (auth required)
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: { id: true, stage: true, visibility: true, creatorId: true },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Amendments only available from Stage 3+
  if (!['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Amendments are not available at this stage' },
      { status: 422 },
    )
  }

  // Idea must be accessible (not private)
  if (idea.visibility === 'PRIVATE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ProposeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { sectionChanged, currentText, proposedText, rationale, changesProposed, researchUrls } =
    parsed.data

  const stageNumber = parseInt(idea.stage.replace('STAGE_', ''), 10)

  const amendment = await prisma.$transaction(async tx => {
    const newAmendment = await tx.amendment.create({
      data: {
        ideaId: id,
        authorId: user.id,
        stageNumber,
        sectionChanged,
        currentText,
        proposedText,
        rationale,
        changesProposed: changesProposed ?? null,
        researchUrls: researchUrls ? researchUrls : undefined,
        status: 'PENDING',
      },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    })

    // Increment amendment count on idea
    await tx.idea.update({
      where: { id },
      data: { amendmentCount: { increment: 1 } },
    })

    // Notify owner (deep-link to Amendments tab)
    if (idea.creatorId !== user.id) {
      await tx.notification.create({
        data: {
          userId: idea.creatorId,
          type: 'AMENDMENT_PROPOSED',
          relatedIdeaId: id,
          title: 'New amendment proposed',
          message: `${user.name} proposed an amendment to your idea.`,
          linkUrl: `/ideas/${id}?tab=amendments`,
        },
      })
    }

    return newAmendment
  })

  return NextResponse.json({ amendment }, { status: 201 })
}
