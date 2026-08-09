import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireBoardRead, canManageCommunity, findBoardPost, CommunityRuleError } from '@/lib/community'

type Params = { params: Promise<{ id: string; postId: string }> }

// GET /api/communities/[id]/bulletin/[postId]
// Thread detail + replies, each with the caller's own vote value so the UI
// can render active up/down state. Members, and managers via the Stage 2
// cascade. Reachable for this node's own threads and for Community-wide
// threads from elsewhere in the same tree.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, postId } = await params

  const denied = await requireBoardRead(user.id, communityId)
  if (denied) return denied

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

// DELETE /api/communities/[id]/bulletin/[postId]
// Moderation: remove a post or reply. Available to anyone with manage rights
// over the node the post LIVES on — the Stage 2 admin cascade — and to the
// post's own author.
//
// Deleting the post does NOT rewrite the points ledger. The events it produced
// stay, because the ledger only appends and a moderator removing a post is not
// evidence the marks on it were never cast. Reversing an award is a separate,
// deliberate act; nothing silently claws points back.
export async function DELETE(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, postId } = await params

  const denied = await requireBoardRead(user.id, communityId)
  if (denied) return denied

  const post = await findBoardPost(postId, communityId)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = post.authorId === user.id
  if (!isAuthor && !(await canManageCommunity(user.id, post.communityId))) {
    return NextResponse.json({ error: 'You cannot remove this post' }, { status: 403 })
  }

  try {
    // Replies and their votes go with a thread; a reply takes only its own.
    await prisma.$transaction(async (tx) => {
      const replyIds = (
        await tx.bulletinPost.findMany({ where: { parentId: postId }, select: { id: true } })
      ).map((r) => r.id)
      const allIds = [postId, ...replyIds]
      await tx.bulletinVote.deleteMany({ where: { postId: { in: allIds } } })
      await tx.bulletinPost.deleteMany({ where: { id: { in: replyIds } } })
      await tx.bulletinPost.delete({ where: { id: postId } })
    })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }

  return NextResponse.json({ removed: true, moderated: !isAuthor })
}
