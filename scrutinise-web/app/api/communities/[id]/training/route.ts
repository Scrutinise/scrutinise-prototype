import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import {
  LISTING_KINDS,
  createListing,
  listCompletedSessions,
  listListings,
  listMyMatches,
  phoneSharingEnabled,
  requireTrainingAccess,
} from '@/lib/training'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/training
// Everything the Training tab shows, in one round trip: open offers, open
// requests, my listings, my matches, and the branch's completed sessions.
//
// No contact details are selected by any of these queries except `listMyMatches`,
// which routes every one of them through lib/training.ts `contactFor`.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    await requireTrainingAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [offers, requests, mine, matches, sessions, phoneOn, me] = await Promise.all([
    listListings(id, user.id, { kind: 'OFFER', status: 'OPEN' }),
    listListings(id, user.id, { kind: 'REQUEST', status: 'OPEN' }),
    listListings(id, user.id, { mineOnly: true }),
    listMyMatches(id, user.id),
    listCompletedSessions(id),
    phoneSharingEnabled(),
    prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } }),
  ])

  return NextResponse.json({
    offers,
    requests,
    mine,
    matches,
    sessions,
    phoneSharingEnabled: phoneOn,
    // Whether the VIEWER has a number on file, so the form can say "add one in
    // settings first" instead of offering a channel that cannot deliver. The
    // number itself is not returned.
    iHavePhone: Boolean(me?.phone?.trim()),
  })
}

const CreateSchema = z.object({
  kind: z.enum(LISTING_KINDS),
  topic: z.string().min(2).max(120),
  description: z.string().min(5).max(4000),
  availability: z.string().max(500).optional(),
  shareEmail: z.boolean().default(false),
  sharePhone: z.boolean().default(false),
})

// POST /api/communities/[id]/training — post an offer or a request.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const listing = await createListing({ userId: user.id, communityId: id, ...parsed.data })
    return NextResponse.json({ listing }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
