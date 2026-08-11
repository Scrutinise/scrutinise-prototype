import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { findNearMatches, requireLibraryAccess } from '@/lib/question-library'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/questions/near-matches?q=
// Runs live as the user types, so the near-match step is never a surprise when
// they reach it. The result is a SHORTCUT, never a block — "your answer is
// worth more on a question people are already reading" — and the caller always
// keeps "carry on and post yours as new" at equal weight.
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 8) return NextResponse.json({ matches: [] })

  return NextResponse.json({ matches: await findNearMatches(id, q) })
}
