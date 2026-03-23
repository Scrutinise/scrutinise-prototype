import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ reportId: string }> }

const PatchSchema = z.object({
  action: z.enum(['DISMISS', 'HIDE', 'REMOVE', 'WARN']),
  moderatorNotes: z.string().max(2000).optional(),
})

// PATCH /api/admin/reports/[reportId]
// Updates report status and creates a notification for the content owner.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { reportId } = await params

  const report = await prisma.contentReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      reportedContentType: true,
      reportedIdeaId: true,
      reportedCommentId: true,
      reportedUserId: true,
      reportedIdea: { select: { creatorId: true } },
      reportedComment: { select: { authorId: true } },
    },
  })

  if (!report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { action, moderatorNotes } = parsed.data

  const statusMap: Record<string, 'DISMISSED' | 'UNDER_REVIEW' | 'ACTION_TAKEN'> = {
    DISMISS: 'DISMISSED',
    HIDE: 'ACTION_TAKEN',
    REMOVE: 'ACTION_TAKEN',
    WARN: 'ACTION_TAKEN',
  }

  const newStatus = statusMap[action]

  // Determine content owner to notify
  const contentOwnerId =
    report.reportedIdea?.creatorId ??
    report.reportedComment?.authorId ??
    report.reportedUserId ??
    null

  const notificationMessage = {
    DISMISS: null,
    HIDE: 'A moderator has reviewed a content report relating to your contribution.',
    REMOVE: 'A moderator has removed content following a community report.',
    WARN: 'A moderator has reviewed reported content and issued a reminder about community guidelines.',
  }[action]

  await prisma.$transaction([
    prisma.contentReport.update({
      where: { id: reportId },
      data: {
        status: newStatus,
        reviewedByUserId: authUser.id,
        reviewedAt: new Date(),
        moderatorNotes: moderatorNotes ?? undefined,
      },
    }),
    ...(contentOwnerId && notificationMessage
      ? [
          prisma.notification.create({
            data: {
              userId: contentOwnerId,
              type: 'SYSTEM',
              title: 'Moderation notice',
              message: notificationMessage,
            },
          }),
        ]
      : []),
    ...(report.reportedIdeaId && action === 'HIDE'
      ? [
          prisma.idea.update({
            where: { id: report.reportedIdeaId },
            data: { status: 'ARCHIVED' },
          }),
        ]
      : []),
  ])

  return NextResponse.json({ success: true })
}
