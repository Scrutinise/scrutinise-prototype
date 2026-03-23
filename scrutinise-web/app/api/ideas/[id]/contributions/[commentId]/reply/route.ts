import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; commentId: string }> }

const ReplySchema = z.object({
  content: z.string().min(1).max(5000),
})

// POST /api/ideas/[id]/contributions/[commentId]/reply — owner only
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId, commentId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden — only the idea owner can reply' }, { status: 403 })
  }

  const parent = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, ideaId: true, authorId: true },
  })

  if (!parent || parent.ideaId !== ideaId) {
    return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
  }

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

  const reply = await prisma.comment.create({
    data: {
      ideaId,
      authorId: user.id,
      parentId: commentId,
      content: parsed.data.content,
      stance: 'NEUTRAL',
      isOwnerReply: true,
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
    },
  })

  // Notify the original contributor (if different from owner)
  if (parent.authorId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: parent.authorId,
        type: 'COMMENT_POSTED',
        relatedIdeaId: ideaId,
        message: `The idea owner replied to your Contribution.`,
        linkUrl: `/ideas/${ideaId}?tab=contributions`,
      },
    })
  }

  return NextResponse.json(reply, { status: 201 })
}
