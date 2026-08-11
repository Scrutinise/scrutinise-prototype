import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireLibraryAccess, toggleFavourite } from '@/lib/question-library'

type Params = { params: Promise<{ id: string; answerId: string }> }

// POST /api/communities/[id]/answers/[answerId]/favourite
//
// PRIVATE. The response carries only the caller's own state and never a count,
// because there is no count: favourites are never aggregated, never affect
// ranking, and are invisible to everyone else including admins and the
// across-branches view. If a future change makes this endpoint return anything
// about other people's favourites, that is a privacy regression, not a feature.
export async function POST(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, answerId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(await toggleFavourite(answerId, user.id))
}
