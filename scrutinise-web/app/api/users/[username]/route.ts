import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ username: string }> }

// GET /api/users/[username] — public profile data
export async function GET(_req: Request, { params }: Params) {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      joinDate: true,
      credibilityScore: {
        select: { totalScore: true, phase: true },
      },
      ideas: {
        where: {
          stage: { in: ['STAGE_3', 'STAGE_4', 'STAGE_5'] },
          visibility: { in: ['LINK_ONLY', 'PLATFORM_LISTED'] },
          status: { not: 'WITHDRAWN' },
        },
        select: {
          id: true,
          title: true,
          summaryDescription: true,
          stage: true,
          commentCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { comments: true },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    joinDate: user.joinDate,
    credibilityScore: user.credibilityScore
      ? {
          totalScore: user.credibilityScore.totalScore?.toString() ?? null,
          phase: user.credibilityScore.phase,
        }
      : null,
    ideas: user.ideas.map(idea => ({
      ...idea,
      createdAt: idea.createdAt.toISOString(),
    })),
    contributionCount: user._count.comments,
  })
}
