import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { appointBranchOwner, vacateBranchOwnership } from '@/lib/community-permissions'

type Params = { params: Promise<{ id: string }> }

/**
 * CENTRAL 25-B §5 / decision 44 — who manages this branch.
 *
 * ⚠ Its own route, not another verb on the members route, because these are not
 * role changes: `setMemberRole` still refuses to touch an OWNER and
 * `check:central` still asserts that it does. Making a node's owner changeable
 * through the ordinary role control is exactly what would make a node takeable
 * by any co-admin.
 *
 * ⚠ A REASON IS REQUIRED on both (decision 51). A vacancy with no recorded
 * reason later reads as a bug rather than a decision.
 */
const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('vacate'), reason: z.string().trim().min(1).max(500) }),
  z.object({
    action: z.literal('appoint'),
    userId: z.string().min(1),
    reason: z.string().trim().min(1).max(500),
  }),
])

export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    // ⚠ A plain string, never `flatten()` — the panel prints this verbatim, and a
    // caller that cannot say what went wrong is how a diagnosable fault becomes
    // an undiagnosable one.
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
    return NextResponse.json({ error: `That could not be read — ${detail}` }, { status: 422 })
  }

  try {
    if (parsed.data.action === 'vacate') {
      const { vacatedUserId } = await vacateBranchOwnership({
        communityId,
        actorUserId: user.id,
        reason: parsed.data.reason,
      })
      return NextResponse.json({ vacated: true, vacatedUserId })
    }

    const { replacedUserId } = await appointBranchOwner({
      communityId,
      targetUserId: parsed.data.userId,
      actorUserId: user.id,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ appointed: true, replacedUserId })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[ownership] failed', e)
    return NextResponse.json(
      { error: `That did not work — ${e instanceof Error ? e.message : 'unknown server error'}` },
      { status: 500 },
    )
  }
}
