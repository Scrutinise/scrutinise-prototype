import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole } from '@/lib/community'

type Params = { params: Promise<{ id: string; postId: string }> }

const ALL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

// GET /api/communities/[id]/bulletin/[postId]
// Thread detail + replies, each with the caller's own vote value so the UI
// can render active up/down state. Members only.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, postId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  const thread = await prisma.bulletinPost.findFirst({
    where: { id: postId, communityId, parentId: null },
    include: {
      author: { select: { id: true, name: true, username: true } },
      votes: { where: { userId: user.id }, select: { value: true } },
      replies: {
        include: {
          author: { select: { id: true, name: true, username: true } },
          votes: { where: { userId: user.id }, select: { value: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    thread: {
      ...thread,
      myVote: thread.votes[0]?.value ?? 0,
      replies: thread.replies.map((r) => ({ ...r, myVote: r.votes[0]?.value ?? 0 })),
    },
  })
}
