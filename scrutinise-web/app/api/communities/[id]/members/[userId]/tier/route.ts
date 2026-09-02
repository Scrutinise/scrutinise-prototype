import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { setMembershipTier } from '@/lib/community-permissions'
import { MEMBERSHIP_TIERS } from '@/lib/membership-tier'

type Params = { params: Promise<{ id: string; userId: string }> }

/**
 * CENTRAL 25-C §1a/§2e — move somebody between GROUP and BRANCH.
 *
 * ⚠ ITS OWN ROUTE, not another field on the members PATCH, for the same reason
 * ownership got its own: a tier is not a rung on the role ladder. The role
 * control says what somebody may do on ONE NODE; this says how they belong to
 * the Community, it is a root-level act, and §2e makes it resign branch
 * ownership — which no reader of `{ role: 'MEMBER' }` would expect.
 *
 * ⚠ A REASON IS REQUIRED, for decision 51's reason: a demotion with nothing
 * recorded later reads as a bug rather than a decision, and this one can stand
 * a branch manager down as a side-effect.
 */
const BodySchema = z.object({
  tier: z.enum(MEMBERSHIP_TIERS),
  reason: z.string().trim().min(1).max(500),
})

export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, userId: targetUserId } = await params

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    // A plain string — the panel prints this verbatim.
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ')
    return NextResponse.json({ error: `That could not be read — ${detail}` }, { status: 422 })
  }

  try {
    const result = await setMembershipTier({
      communityId,
      targetUserId,
      tier: parsed.data.tier,
      actorUserId: user.id,
      reason: parsed.data.reason,
    })
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[members/tier] failed', e)
    return NextResponse.json(
      { error: `That did not work — ${e instanceof Error ? e.message : 'unknown server error'}` },
      { status: 500 },
    )
  }
}
