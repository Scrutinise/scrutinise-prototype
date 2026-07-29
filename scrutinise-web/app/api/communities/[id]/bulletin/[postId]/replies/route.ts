import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole } from '@/lib/community'

type Params = { params: Promise<{ id: string; postId: string }> }

const ALL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

const ReplySchema = z.object({ body: z.string().min(1).max(10_000) })

// POST /api/communities/[id]/bulletin/[postId]/replies
// Reply to a thread. Members only. Notifies the thread author (skips self) —
// this is what makes replies show up in the dashboard "Feed" tab, since Feed
// reuses the existing Notification-driven list rather than a second data source.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, postId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  const parentThread = await prisma.bulletinPost.findFirst({
    where: { id: postId, communityId, parentId: null },
    select: { id: true, title: true, authorId: true },
  })
  if (!parentThread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ReplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const [reply] = await prisma.$transaction([
    prisma.bulletinPost.create({
      data: { communityId, parentId: postId, authorId: user.id, body: parsed.data.body },
      include: { author: { select: { id: true, name: true, username: true } } },
    }),
    ...(parentThread.authorId !== user.id
      ? [
          prisma.notification.create({
            data: {
              userId: parentThread.authorId,
              type: 'SYSTEM',
              title: 'New reply',
              message: `${user.name} replied to your thread "${parentThread.title}"`,
              linkUrl: `/communities/${communityId}?thread=${postId}`,
            },
          }),
        ]
      : []),
  ])

  return NextResponse.json({ reply }, { status: 201 })
}
