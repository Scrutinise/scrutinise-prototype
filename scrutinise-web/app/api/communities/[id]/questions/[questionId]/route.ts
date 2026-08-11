import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import {
  canPromoteQuestion,
  getQuestionVisibilityFilter,
  getRankedAnswers,
  requireLibraryAccess,
} from '@/lib/question-library'

type Params = { params: Promise<{ id: string; questionId: string }> }

/** Resolve a question the viewer is actually allowed to see from where they
 *  stand — a branch-scoped question is invisible from a sibling branch. */
async function visibleQuestion(communityId: string, questionId: string) {
  const filter = await getQuestionVisibilityFilter(communityId)
  return prisma.question.findFirst({
    where: { AND: [{ id: questionId }, filter] },
    include: {
      author: { select: { id: true, name: true, username: true } },
      branch: { select: { id: true, name: true } },
      _count: { select: { votes: true, answers: true } },
    },
  })
}

// GET /api/communities/[id]/questions/[questionId]
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, questionId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const question = await visibleQuestion(id, questionId)
  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const myVote = await prisma.questionVote.findUnique({
    where: { questionId_userId: { questionId, userId: user.id } },
    select: { id: true },
  })

  return NextResponse.json({
    question: {
      ...question,
      voteCount: question._count.votes,
      answerCount: question._count.answers,
      myVote: myVote !== null,
    },
    answers: await getRankedAnswers(questionId, user.id),
    canPromote: question.scope === 'BRANCH' && (await canPromoteQuestion(user.id, questionId)),
  })
}

const PatchSchema = z.object({ scope: z.literal('COMMUNITY') })

// PATCH /api/communities/[id]/questions/[questionId]
// Promote a branch question to the whole Community. Author, or anyone with
// manage rights. Deliberately one-way: there is no demote, because a question
// other branches have already answered should not vanish from under them.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, questionId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const question = await visibleQuestion(id, questionId)
  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  try {
    if (!(await canPromoteQuestion(user.id, questionId))) {
      throw new CommunityRuleError('Only the author or a Community admin can promote this', 403)
    }
    const updated = await prisma.question.update({
      where: { id: questionId },
      data: { scope: 'COMMUNITY' },
    })
    return NextResponse.json({ question: updated })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
