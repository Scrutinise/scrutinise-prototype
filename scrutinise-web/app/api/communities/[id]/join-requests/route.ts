import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  CommunityRuleError,
  canManageCommunity,
  createJoinRequest,
  listJoinRequests,
  JOIN_REQUEST_STATUSES,
  type JoinRequestStatus,
} from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/join-requests?status=PENDING
// The node's Requests panel. Manage rights, NOT membership — this is the
// deliberate carve-out to the visibility rule (Stage 1.2 brief, item 7): an
// ancestor admin has to be able to decide a branch's requests without joining
// it. The node's BOARD stays membership-gated exactly as before.
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params
  if (!(await canManageCommunity(user.id, communityId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const raw = new URL(req.url).searchParams.get('status') ?? 'PENDING'
  const status = (JOIN_REQUEST_STATUSES as readonly string[]).includes(raw)
    ? (raw as JoinRequestStatus)
    : 'PENDING'

  return NextResponse.json({ requests: await listJoinRequests(communityId, status) })
}

const RequestSchema = z.object({ message: z.string().max(500).optional() })

// POST /api/communities/[id]/join-requests
// A Community member asks to join one of its branches. Rules, and why they are
// what they are, live in createJoinRequest().
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const request = await createJoinRequest(user.id, communityId, parsed.data.message)
    return NextResponse.json({ request }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
