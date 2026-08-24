import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { logSessionForMatch, requireTrainingAccess } from '@/lib/training'

type Params = { params: Promise<{ id: string; matchId: string }> }

const LogSchema = z.object({
  occurredAt: z.string().min(1),
  notes: z.string().max(2000).optional(),
})

// POST /api/communities/[id]/training/matches/[matchId]/session
//
// "Log this session" — one action, both records. It writes the TrainingSession
// and raises BOTH activity claims (trainer 40, trainee 20) for branch-admin
// approval. Who is the trainer comes from the listing, not from who pressed the
// button.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, matchId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = LogSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const occurredAt = new Date(parsed.data.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 422 })
  }

  try {
    await requireTrainingAccess(user.id, id)
    const result = await logSessionForMatch({
      matchId,
      userId: user.id,
      occurredAt,
      branchCommunityId: id,
      notes: parsed.data.notes,
    })
    return NextResponse.json({ result }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
