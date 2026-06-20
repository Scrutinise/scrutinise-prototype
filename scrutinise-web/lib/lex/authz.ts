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
      collaborators: { select: { userId: true } },
    },
  })
  if (!idea) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null, idea: null }

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
