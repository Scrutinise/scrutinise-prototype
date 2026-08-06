import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole, findBoardPost } from '@/lib/community'

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

  const parentThread = await findBoardPost(postId, communityId, { rootOnly: true })
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
    // A reply belongs to the thread's node and inherits its reach — so a reply
    // to a Community-wide thread stays visible (and votable) from every board
    // that can see the thread, instead of stranding itself on one branch.
    prisma.bulletinPost.create({
      data: {
        communityId: parentThread.communityId,
        parentId: postId,
        authorId: user.id,
        scope: parentThread.scope,
        body: parsed.data.body,
      },
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
              // Point at the thread's own board, not the board the replier
              // happened to be on — a Community-wide thread can be replied to
              // from a branch the author may not belong to.
              linkUrl: `/communities/${parentThread.communityId}?thread=${postId}`,
            },
          }),
        ]
      : []),
  ])

  return NextResponse.json({ reply }, { status: 201 })
}
