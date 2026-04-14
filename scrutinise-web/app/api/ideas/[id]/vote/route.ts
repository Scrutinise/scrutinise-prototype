import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { awardPoints } from '@/lib/points'

type Params = { params: Promise<{ id: string }> }

const VoteSchema = z.object({
  direction: z.enum(['FOR', 'AGAINST', 'UNDECIDED']),
  strength: z.number().min(0).max(5).multipleOf(0.5),
  qualityFlags: z.array(z.string()).optional().default([]),
})

// GET /api/ideas/[id]/vote
// Public aggregate counts + authenticated user's existing vote
export async function GET(_req: Request, { params }: Params) {
  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, stage: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Aggregate vote counts
  const grouped = await prisma.vote.groupBy({
    by: ['direction'],
    where: { ideaId, withdrawn: false },
    _count: { id: true },
  })

  const counts = { for: 0, against: 0, undecided: 0, total: 0 }
  for (const row of grouped) {
    const n = row._count.id
    if (row.direction === 'FOR') counts.for = n
    else if (row.direction === 'AGAINST') counts.against = n
    else if (row.direction === 'UNDECIDED') counts.undecided = n
    counts.total += n
  }

  // Get user's existing vote if authenticated
  const { userId: clerkUserId } = await auth()
  let userVote = null

  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    })
    if (dbUser) {
      const existing = await prisma.vote.findUnique({
        where: { ideaId_userId: { ideaId, userId: dbUser.id } },
        select: { direction: true, strength: true, qualityFlags: true, withdrawn: true },
      })
      if (existing && !existing.withdrawn) {
        userVote = {
          direction: existing.direction,
          strength: Number(existing.strength),
          qualityFlags: Array.isArray(existing.qualityFlags) ? existing.qualityFlags : [],
        }
      }
    }
  }

  return NextResponse.json({ counts, userVote })
}

// POST /api/ideas/[id]/vote — create or update (upsert). Stage 4+ only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, stage: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!['STAGE_4', 'STAGE_5'].includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Voting is only open at Stage 4 (Campaign) and above' },
      { status: 422 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = VoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { direction, strength, qualityFlags } = parsed.data

  const vote = await prisma.vote.upsert({
    where: { ideaId_userId: { ideaId, userId: user.id } },
    create: {
      ideaId,
      userId: user.id,
      direction,
      strength,
      qualityFlags,
      withdrawn: false,
    },
    update: {
      direction,
      strength,
      qualityFlags,
      withdrawn: false,
    },
    select: { direction: true, strength: true, qualityFlags: true },
  })

  // Update denormalised voteCount on idea
  const total = await prisma.vote.count({ where: { ideaId, withdrawn: false } })
  await prisma.idea.update({
    where: { id: ideaId },
    data: { voteCount: total },
  })

  await awardPoints({ userId: user.id, actionType: 'IDEA_VOTED', relatedIdeaId: ideaId })

  return NextResponse.json({
    direction: vote.direction,
    strength: Number(vote.strength),
    qualityFlags: vote.qualityFlags,
  })
}
