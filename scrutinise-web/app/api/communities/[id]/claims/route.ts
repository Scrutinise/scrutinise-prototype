import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, canManageCommunity } from '@/lib/community'
import { createActivityClaim, listActivityClaims, CLAIM_STATUSES, type ClaimStatus } from '@/lib/central-points'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/claims?status=PENDING
// The node's pending-claims queue, beside its join requests. Manage rights, and
// manage rights cascade — an ancestor admin approves a branch's claims without
// joining it (Stage 2 admin cascade).
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params
  if (!(await canManageCommunity(user.id, communityId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Stage 2e: AWARDED by default. There is no approval queue any more, so the
  // useful default is “what has been paid on this node, and can still be
  // reversed”.
  const raw = new URL(req.url).searchParams.get('status') ?? 'AWARDED'
  const status = (CLAIM_STATUSES as readonly string[]).includes(raw) ? (raw as ClaimStatus) : 'AWARDED'

  return NextResponse.json({ claims: await listActivityClaims(communityId, status) })
}

const ClaimSchema = z.object({
  activityType: z.string().min(1).max(64),
  occurredAt: z.string().min(1),
  evidenceUrl: z.string().url().max(500).optional(),
  note: z.string().max(1000).optional(),
})

// POST /api/communities/[id]/claims
// Log an offline activity. SELF-CLAIMS ONLY — the userId comes from the
// session and is never a field the client can set.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ClaimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const occurredAt = new Date(parsed.data.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 422 })
  }

  try {
    const claim = await createActivityClaim({
      userId: user.id,
      communityId,
      activityType: parsed.data.activityType,
      occurredAt,
      evidenceUrl: parsed.data.evidenceUrl,
      note: parsed.data.note,
    })
    return NextResponse.json({ claim }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
