import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import {
  acceptMatch,
  closeMatch,
  contactFor,
  declineMatch,
  requireTrainingAccess,
  sharePreviewForAuthor,
} from '@/lib/training'

type Params = { params: Promise<{ id: string; matchId: string }> }

// GET /api/communities/[id]/training/matches/[matchId]
// Two things, and only these two: what the author would be sharing if they
// accepted (before), and the contact details they may see (after).
//
// `contactFor` returns null for anyone who is not one of the two participants,
// so a Community admin hitting this route by hand gets `contact: null` — not a
// 403 that would tell them a match exists, and not an address.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, matchId } = await params
  try {
    await requireTrainingAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [preview, contact] = await Promise.all([
    sharePreviewForAuthor(matchId),
    contactFor(matchId, user.id),
  ])
  return NextResponse.json({ preview, contact })
}

const ActionSchema = z.object({
  action: z.enum(['accept', 'decline', 'close']),
  /** Optional on both accept and decline. A decline with a line of explanation
   *  is much better for a small community than a silent refusal. */
  message: z.string().max(1000).optional(),
})

// POST /api/communities/[id]/training/matches/[matchId]
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
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    await requireTrainingAccess(user.id, id)
    if (parsed.data.action === 'accept') {
      await acceptMatch(matchId, user.id, parsed.data.message)
    } else if (parsed.data.action === 'decline') {
      await declineMatch(matchId, user.id, parsed.data.message)
    } else {
      await closeMatch(matchId, user.id)
    }
    // The caller re-reads the tab rather than trusting a returned row: the
    // contact details it will then show come from `contactFor`, never from the
    // response to the action that unlocked them.
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
