import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  getQuestionVisibilityFilter,
  requireLibraryAccess,
  toggleQuestionVote,
} from '@/lib/question-library'

type Params = { params: Promise<{ id: string; questionId: string }> }

// POST /api/communities/[id]/questions/[questionId]/vote
// "I've been asked this too." UP ONLY — there is no downvote on a question,
// because the vote records FREQUENCY, not quality. Self-voting is allowed and
// is not an oversight: the asker demonstrably was asked. Posting again withdraws.
export async function POST(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, questionId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const filter = await getQuestionVisibilityFilter(id)
  const visible = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, filter] },
    select: { id: true },
  })
  if (!visible) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(await toggleQuestionVote(questionId, user.id))
}
