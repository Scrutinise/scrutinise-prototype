import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { decideEditSuggestion, requireLibraryAccess } from '@/lib/question-library'

type Params = { params: Promise<{ id: string; suggestionId: string }> }

const DecisionSchema = z.object({ decision: z.enum(['APPLIED', 'DISMISSED']) })

// PATCH /api/communities/[id]/suggestions/[suggestionId]
// The answer's AUTHOR applies or dismisses. Enforced in decideEditSuggestion,
// which refuses everyone else — including Community admins. That is the design:
// no admin path to someone else's words.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, suggestionId } = await params
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

  const parsed = DecisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const suggestion = await decideEditSuggestion(suggestionId, user.id, parsed.data.decision)
    return NextResponse.json({ suggestion })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
