import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, type AuthUser } from '@/lib/auth'

export interface IdeaAuthOk {
  error: null
  user: AuthUser
  idea: { id: string; creatorId: string; title: string; aiChatHistory: unknown }
}
export interface IdeaAuthErr {
  error: NextResponse
  user: null
  idea: null
}

/** Auth + owner/collaborator authorisation for an idea. */
export async function authorizeIdea(ideaId: string): Promise<IdeaAuthOk | IdeaAuthErr> {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { error: error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 }), user: null, idea: null }

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      creatorId: true,
      title: true,
      aiChatHistory: true,
      deletedAt: true,
      collaborators: { select: { userId: true } },
    },
  })
  if (!idea) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null, idea: null }
  // §19-E Task 6 — a deleted idea is gone as far as the product is concerned. Put here
  // rather than in each of the forty routes that read an idea: this is the chokepoint
  // every Lex surface already passes through, and a rule spread over forty call sites
  // is a rule that will hold in thirty-nine of them.
  // 404 rather than 410: to the caller it does not exist, and 410 would confirm that it
  // once did to anyone probing ids.
  if (idea.deletedAt) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null, idea: null }
  }

  const isOwner = idea.creatorId === user.id
  const isCollaborator = idea.collaborators.some((c) => c.userId === user.id)
  if (!isOwner && !isCollaborator) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null, idea: null }
  }

  return {
    error: null,
    user,
    idea: { id: idea.id, creatorId: idea.creatorId, title: idea.title, aiChatHistory: idea.aiChatHistory },
  }
}
