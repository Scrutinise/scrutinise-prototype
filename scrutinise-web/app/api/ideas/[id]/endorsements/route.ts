import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const EndorsementSchema = z.object({
  endorserConstituency: z.string().optional(),
  endorserPeerage: z.string().optional(),
  displayTitle: z.string().optional(),
  publicStatement: z.string().max(1000).optional(),
})

// GET /api/ideas/[id]/endorsements
// Returns all active endorsements for an idea (public).
export async function GET(_req: Request, { params }: Params) {
  const { id: ideaId } = await params

  const [endorsements, draftsmanEndorsements] = await Promise.all([
    prisma.endorsement.findMany({
      where: { ideaId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, username: true, parliamentaryStatus: true } },
      },
      orderBy: { endorsedAt: 'asc' },
    }),
    prisma.draftsmanEndorsement.findMany({
      where: { ideaId, status: 'ACTIVE' },
      include: {
        draftsman: { select: { id: true, name: true, username: true } },
      },
      orderBy: { certifiedAt: 'asc' },
    }),
  ])

  return NextResponse.json({ endorsements, draftsmanEndorsements })
}

// POST /api/ideas/[id]/endorsements
// Creates an endorsement. Requires MP or PEER parliamentary status (or manualCredibilityOverride).
// One endorsement per user per idea (@@unique constraint).
// Also handles "Below Standard" — creates IdeaReview(outcome=BELOW_STANDARD).
export async function POST(req: Request, { params }: Params) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, stage: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowedStages = ['STAGE_4', 'STAGE_5']
  if (!allowedStages.includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Endorsements are available at Stage 4 and above' },
      { status: 422 },
    )
  }

  // Fetch full user record to check eligibility
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { parliamentaryStatus: true, manualCredibilityOverride: true },
  })

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const canEndorse =
    dbUser.parliamentaryStatus === 'MP' ||
    dbUser.parliamentaryStatus === 'PEER' ||
    dbUser.manualCredibilityOverride != null

  if (!canEndorse) {
    return NextResponse.json(
      { error: 'Only MPs, Peers, or verified professionals can endorse ideas' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Check if this is a "Below Standard" action
  const rawBody = body as Record<string, unknown>
  if (rawBody.action === 'BELOW_STANDARD') {
    const review = await prisma.ideaReview.upsert({
      where: { ideaId_userId: { ideaId, userId: authUser.id } },
      update: { outcome: 'BELOW_STANDARD' },
      create: { ideaId, userId: authUser.id, outcome: 'BELOW_STANDARD' },
      select: { id: true, outcome: true },
    })
    return NextResponse.json(review)
  }

  const parsed = EndorsementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const endorserRole = dbUser.parliamentaryStatus === 'MP' ? 'MP' : 'PEER'

  try {
    const endorsement = await prisma.endorsement.create({
      data: {
        ideaId,
        userId: authUser.id,
        endorserRole,
        endorserConstituency: parsed.data.endorserConstituency,
        endorserPeerage: parsed.data.endorserPeerage,
        displayTitle: parsed.data.displayTitle,
        publicStatement: parsed.data.publicStatement,
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    })

    // Increment denormalised count
    await prisma.idea.update({
      where: { id: ideaId },
      data: { endorsementCount: { increment: 1 } },
    })

    return NextResponse.json(endorsement, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'You have already endorsed this idea' },
        { status: 409 },
      )
    }
    throw e
  }
}
