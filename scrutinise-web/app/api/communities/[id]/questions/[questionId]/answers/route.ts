import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  getQuestionVisibilityFilter,
  getRankedAnswers,
  requireLibraryAccess,
} from '@/lib/question-library'

type Params = { params: Promise<{ id: string; questionId: string }> }

const AnswerSchema = z.object({
  body: z.string().min(2).max(8000),
  sources: z.array(z.string().url().max(500)).max(10).default([]),
  localExample: z.string().max(4000).optional(),
})

// POST /api/communities/[id]/questions/[questionId]/answers
// Answer a question. Sources and a local example are optional and stay
// separate fields rather than being folded into the body — the design renders
// the local example as its own block, and packs carry the two differently.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, questionId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const filter = await getQuestionVisibilityFilter(id)
  const question = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, filter] },
    select: { id: true, authorId: true, text: true },
  })
  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AnswerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const answer = await prisma.answer.create({
    data: {
      questionId,
      authorId: user.id,
      body: parsed.data.body.trim(),
      sources: parsed.data.sources,
      localExample: parsed.data.localExample?.trim() || null,
    },
  })

  if (question.authorId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: question.authorId,
        type: 'SYSTEM',
        title: 'New answer to your question',
        message: `${user.name} answered “${question.text.slice(0, 80)}”`,
        linkUrl: `/communities/${id}/questions/${questionId}`,
      },
    })
  }

  return NextResponse.json(
    { answer, answers: await getRankedAnswers(questionId, user.id) },
    { status: 201 },
  )
}
