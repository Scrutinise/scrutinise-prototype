import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { createEditSuggestion, requireLibraryAccess } from '@/lib/question-library'

type Params = { params: Promise<{ id: string; answerId: string }> }

const SuggestSchema = z.object({ suggestedBody: z.string().min(2).max(8000) })

// GET /api/communities/[id]/answers/[answerId]/suggestions
// Pending suggestions on an answer, visible to its AUTHOR only — this is a
// conversation between two members, not a moderation queue, so there is no
// admin path to it.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, answerId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: { authorId: true },
  })
  if (!answer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (answer.authorId !== user.id) return NextResponse.json({ suggestions: [] })

  const suggestions = await prisma.editSuggestion.findMany({
    where: { answerId, status: 'PENDING' },
    include: { suggestedBy: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ suggestions })
}

// POST /api/communities/[id]/answers/[answerId]/suggestions
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, answerId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SuggestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const suggestion = await createEditSuggestion(answerId, user.id, parsed.data.suggestedBody)
    return NextResponse.json({ suggestion }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
