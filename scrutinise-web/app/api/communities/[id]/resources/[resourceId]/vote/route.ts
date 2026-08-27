import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { requireLibraryAccess } from '@/lib/question-library'
import { applyResourceVote } from '@/lib/resources'

type Params = { params: Promise<{ id: string; resourceId: string }> }

const VoteSchema = z.object({ direction: z.enum(['UP', 'DOWN']) })

// POST /api/communities/[id]/resources/[resourceId]/vote
// Same rules as an answer vote, same tariffs, same ledger — and, as there, an
// AI-authored resource ranks but mints nothing.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, resourceId } = await params
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
    return NextResponse.json(await applyResourceVote(resourceId, user.id, parsed.data.direction))
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
