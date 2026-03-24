import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'

// 1 export per 24 hours per user
const EXPORT_LIMIT = 1
const EXPORT_WINDOW_MS = 24 * 60 * 60 * 1000

export async function POST() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  if (!checkRateLimit(`export:${user.id}`, EXPORT_LIMIT, EXPORT_WINDOW_MS)) {
    return NextResponse.json(
      { error: 'Export limit reached. You may export your data once every 24 hours.' },
      { status: 429 }
    )
  }

  // Collect all user data
  const [fullUser, ideas, contributions, votes, research, amendments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        preferredName: true,
        displayName: true,
        username: true,
        email: true,
        bio: true,
        role: true,
        status: true,
        ageConfirmed: true,
        tcAgreedAt: true,
        rulesAgreedAt: true,
        tcVersion: true,
        parliamentaryStatus: true,
        country: true,
        joinDate: true,
        createdAt: true,
        updatedAt: true,
        lastActiveAt: true,
      },
    }),
    prisma.idea.findMany({
      where: { creatorId: user.id },
      select: {
        id: true,
        title: true,
        summaryDescription: true,
        stage: true,
        visibility: true,
        status: true,
        govtArea: true,
        diagnosis: true,
        rootCause: true,
        guidingPolicy: true,
        proposedWording: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id },
      select: {
        id: true,
        ideaId: true,
        content: true,
        contributionType: true,
        stance: true,
        createdAt: true,
      },
    }),
    prisma.vote.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ideaId: true,
        direction: true,
        strength: true,
        createdAt: true,
      },
    }),
    prisma.research.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ideaId: true,
        title: true,
        snippet: true,
        url: true,
        sourceType: true,
        createdAt: true,
      },
    }),
    prisma.amendment.findMany({
      where: { authorId: user.id },
      select: {
        id: true,
        ideaId: true,
        proposedWording: true,
        rationale: true,
        status: true,
        createdAt: true,
      },
    }),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: fullUser,
    ideas,
    contributions,
    votes,
    research,
    amendments,
  }

  // Log the export request
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      activityType: 'DATA_EXPORT_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      description: 'User requested data export',
    },
  }).catch(() => {})

  // If R2 is not configured, return JSON directly
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.warn('[export] CLOUDFLARE_ACCOUNT_ID not set — returning JSON directly')
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="scrutinise-export-${user.id}.json"`,
      },
    })
  }

  // TODO: Upload to R2 and return signed URL when R2 is configured
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="scrutinise-export-${user.id}.json"`,
    },
  })
}
