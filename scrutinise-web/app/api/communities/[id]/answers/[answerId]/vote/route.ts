import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { requireLibraryAccess, VOTE_DIRECTIONS } from '@/lib/question-library'
import { applyAnswerVote } from '@/lib/central-points'

type Params = { params: Promise<{ id: string; answerId: string }> }

const VoteSchema = z.object({ direction: z.enum(VOTE_DIRECTIONS) })

// POST /api/communities/[id]/answers/[answerId]/vote
// Quality vote: up or down, MUTUALLY EXCLUSIVE. Switching withdraws the
// previous vote rather than stacking, so the displayed count moves by two.
// Voting on your own answer is refused, consistent with the Stage 2
// no-marking-own-content rule.
//
// ⚠ STAGE 2e: this now goes through applyAnswerVote, which ALSO writes the
// ledger. Until 24 Aug 2026 it called setAnswerVote alone — the vote ranked the
// answer and paid its author nothing, because the library was never wired to
// the points engine. An AI-authored answer still ranks and still pays nothing.
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

  const parsed = VoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    return NextResponse.json(await applyAnswerVote(answerId, user.id, parsed.data.direction))
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
