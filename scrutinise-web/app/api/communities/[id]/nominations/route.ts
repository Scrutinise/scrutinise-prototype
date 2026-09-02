import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, canManageCommunity, getRootCommunityId } from '@/lib/community'
import {
  decideBranchNomination,
  listPendingNominations,
  resignAndNominate,
} from '@/lib/community-permissions'

type Params = { params: Promise<{ id: string }> }

/**
 * CENTRAL 25-C §2i — resign and nominate, and the decision on it.
 *
 *   GET  → the nominations waiting on a decision in this Community.
 *   POST { action: 'nominate' } → the branch manager resigns and names a successor.
 *   POST { action: 'decide' }   → a community admin approves or declines.
 *
 * ⚠⚠ A PENDING NOMINATION CONFERS NOTHING. `resignAndNominate` writes a row and
 * vacates the position; it never writes an OWNER row. Only the approval does,
 * and it does it through `appointBranchOwner` — still the one guarded path.
 */
const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('nominate'),
    nomineeUserId: z.string().min(1),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal('decide'),
    nominationId: z.string().min(1),
    approve: z.boolean(),
    note: z.string().trim().max(500).optional(),
  }),
])

export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params
  const rootId = await getRootCommunityId(communityId)
  // Only somebody who could decide one has any use for the list.
  if (!(await canManageCommunity(user.id, rootId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ nominations: await listPendingNominations(communityId) })
}

export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ')
    return NextResponse.json({ error: `That could not be read — ${detail}` }, { status: 422 })
  }

  try {
    if (parsed.data.action === 'nominate') {
      const result = await resignAndNominate({
        communityId,
        actorUserId: user.id,
        nomineeUserId: parsed.data.nomineeUserId,
        reason: parsed.data.reason,
      })
      return NextResponse.json({ nominated: true, ...result }, { status: 201 })
    }

    const result = await decideBranchNomination({
      nominationId: parsed.data.nominationId,
      actorUserId: user.id,
      approve: parsed.data.approve,
      note: parsed.data.note,
    })
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[nominations] failed', e)
    return NextResponse.json(
      { error: `That did not work — ${e instanceof Error ? e.message : 'unknown server error'}` },
      { status: 500 },
    )
  }
}
