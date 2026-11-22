import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, type AuthUser } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────────────────
// WHO MAY READ AND WHO MAY CHANGE AN IDEA (the chokepoint every Lex route passes through).
//
// ⚠⚠ SECURITY FIX, 22 Nov 2026 (CCh 2145Z point 3). Until today this admitted the owner and ANY collaborator and never read the
//   collaborator's `role`, so a VIEWER had an EDITOR's access to every Lex route, writes included. Now:
//     · read  — the owner, an EDITOR or a VIEWER;
//     · write — the owner or an EDITOR only. A VIEWER's write is refused 403, in words.
//   `need` DEFAULTS TO 'write': a route that forgets to say is closed to viewers, never opened to them. Only GET handlers pass 'read'.
// ─────────────────────────────────────────────────────────────────────────────

export type IdeaNeed = 'read' | 'write'
export type IdeaAccess = 'owner' | 'EDITOR' | 'VIEWER'

/** The words a VIEWER's refused write gets. */
export const VIEWER_WRITE_REFUSED = 'You can read this idea, but only its owner or an editor can change it. Nothing was changed.'

/** A collaborator's role, as stored, may change the idea only when it is EDITOR (anything else, VIEWER or unknown, reads only). */
export const roleMayWrite = (role: string | null | undefined): boolean => role === 'EDITOR'

/**
 * PURE — what this user may do with this idea. null = not theirs to see at all. Used by authorizeIdea and by the routes that check an
 * idea they have already loaded, so the rule is written once.
 */
export function ideaAccessOf(userId: string, creatorId: string, collaborators: ReadonlyArray<{ userId: string; role?: string | null }>): IdeaAccess | null {
  if (creatorId === userId) return 'owner'
  const c = collaborators.find((x) => x.userId === userId)
  if (!c) return null
  return roleMayWrite(c.role) ? 'EDITOR' : 'VIEWER'
}
/** PURE — may this access do what is needed? */
export const accessAllows = (access: IdeaAccess | null, need: IdeaNeed): boolean => access != null && (need === 'read' || access !== 'VIEWER')

export interface IdeaAuthOk {
  error: null
  user: AuthUser
  idea: { id: string; creatorId: string; title: string; aiChatHistory: unknown }
  access: IdeaAccess
}
export interface IdeaAuthErr {
  error: NextResponse
  user: null
  idea: null
  access: null
}

/** Auth + owner/collaborator authorisation for an idea. `need` defaults to 'write' (see the header). */
export async function authorizeIdea(ideaId: string, need: IdeaNeed = 'write'): Promise<IdeaAuthOk | IdeaAuthErr> {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { error: error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 }), user: null, idea: null, access: null }

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      creatorId: true,
      title: true,
      aiChatHistory: true,
      deletedAt: true,
      collaborators: { select: { userId: true, role: true } },
    },
  })
  if (!idea) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null, idea: null, access: null }
  // §19-E Task 6 — a deleted idea is gone as far as the product is concerned. Put here
  // rather than in each of the forty routes that read an idea: this is the chokepoint
  // every Lex surface already passes through, and a rule spread over forty call sites
  // is a rule that will hold in thirty-nine of them.
  // 404 rather than 410: to the caller it does not exist, and 410 would confirm that it
  // once did to anyone probing ids.
  if (idea.deletedAt) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null, idea: null, access: null }
  }

  const access = ideaAccessOf(user.id, idea.creatorId, idea.collaborators)
  if (!access) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null, idea: null, access: null }
  }
  if (!accessAllows(access, need)) {
    return { error: NextResponse.json({ error: VIEWER_WRITE_REFUSED }, { status: 403 }), user: null, idea: null, access: null }
  }

  return {
    error: null,
    user,
    idea: { id: idea.id, creatorId: idea.creatorId, title: idea.title, aiChatHistory: idea.aiChatHistory },
    access,
  }
}
