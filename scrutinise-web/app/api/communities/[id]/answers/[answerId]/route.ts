import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import {
  clearAnswerFlag,
  setAnswerFlag,
  setAnswerHidden,
  requireLibraryAccess,
  FLAG_LEVELS,
} from '@/lib/question-library'

type Params = { params: Promise<{ id: string; answerId: string }> }

const PatchSchema = z.union([
  z.object({
    action: z.literal('flag'),
    level: z.enum(FLAG_LEVELS),
    // Required by the schema, not just by the UI: a flag without a stated
    // reason is an unaccountable veto.
    reason: z.string().min(3).max(1000),
  }),
  z.object({ action: z.literal('unflag') }),
  z.object({ action: z.literal('hide'), hidden: z.boolean() }),
])

// PATCH /api/communities/[id]/answers/[answerId]
// Manager actions on an answer: flag it, clear the flag, or hide it outright.
// All three require manage rights over the Community, checked inside the lib
// functions against the ANSWER's own Community rather than the [id] in the URL.
export async function PATCH(req: Request, { params }: Params) {
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

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    if (parsed.data.action === 'flag') {
      const flag = await setAnswerFlag({
        answerId,
        userId: user.id,
        level: parsed.data.level,
        reason: parsed.data.reason,
      })
      return NextResponse.json({ flag })
    }
    if (parsed.data.action === 'unflag') {
      await clearAnswerFlag(answerId, user.id)
      return NextResponse.json({ flag: null })
    }
    const answer = await setAnswerHidden(answerId, user.id, parsed.data.hidden)
    return NextResponse.json({ hidden: answer.hidden })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
