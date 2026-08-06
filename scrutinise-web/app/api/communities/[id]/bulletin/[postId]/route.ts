import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole, findBoardPost } from '@/lib/community'

type Params = { params: Promise<{ id: string; postId: string }> }

const ALL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

// GET /api/communities/[id]/bulletin/[postId]
// Thread detail + replies, each with the caller's own vote value so the UI
// can render active up/down state. Members only. Reachable for this node's own
// threads and for Community-wide threads from elsewhere in the same tree.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, postId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  const visible = await findBoardPost(postId, communityId, { rootOnly: true })
  if (!visible) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const thread = await prisma.bulletinPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, username: true } },
      community: { select: { id: true, name: true } },
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
      isCommunityWide: thread.scope === 'COMMUNITY',
      fromOtherBranch: thread.communityId !== communityId,
      replies: thread.replies.map((r) => ({ ...r, myVote: r.votes[0]?.value ?? 0 })),
    },
  })
}
