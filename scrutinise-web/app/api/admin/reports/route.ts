import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

// GET /api/admin/reports
// Lists ContentReport records — PENDING first, then by createdAt DESC.
export async function GET(_req: Request) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reports = await prisma.contentReport.findMany({
    orderBy: [
      // PENDING first
      { status: 'asc' },
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      reportedContentType: true,
      reason: true,
      description: true,
      status: true,
      createdAt: true,
      reporter: { select: { id: true, name: true, username: true } },
      reportedIdea: { select: { id: true, title: true, creatorId: true, creator: { select: { id: true, name: true } } } },
      reportedComment: { select: { id: true, content: true, authorId: true, author: { select: { id: true, name: true } } } },
      reportedUser: { select: { id: true, name: true, username: true } },
      moderatorNotes: true,
      reviewedAt: true,
    },
  })

  return NextResponse.json(reports)
}
