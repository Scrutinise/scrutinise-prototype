import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import {
  closeListing,
  listProposalsOn,
  proposeMatch,
  requireTrainingAccess,
  sharePreviewForResponder,
} from '@/lib/training'

type Params = { params: Promise<{ id: string; listingId: string }> }

// GET /api/communities/[id]/training/[listingId]
// The proposals sitting on one of the viewer's OWN listings. `listProposalsOn`
// refuses anyone else — including a Community admin, who has no business in
// two members' arrangements.
//
// It returns what each responder has AGREED to share, never the values. The
// values arrive only after this author accepts, and only through `contactFor`.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, listingId } = await params
  try {
    await requireTrainingAccess(user.id, id)
    return NextResponse.json({ proposals: await listProposalsOn(listingId, user.id) })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('propose'),
    message: z.string().max(1000).optional(),
    shareEmail: z.boolean().default(false),
    sharePhone: z.boolean().default(false),
  }),
  z.object({
    // "What exactly will I be sharing, and with whom?" — computed server-side
    // from the same ticks `contactFor` reads, so the promise on the
    // confirmation screen cannot drift from the disclosure that follows.
    action: z.literal('preview'),
    shareEmail: z.boolean().default(false),
    sharePhone: z.boolean().default(false),
  }),
  z.object({ action: z.literal('close') }),
])

// POST /api/communities/[id]/training/[listingId]
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, listingId } = await params

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

    if (parsed.data.action === 'preview') {
      const preview = await sharePreviewForResponder(listingId, {
        shareEmail: parsed.data.shareEmail,
        sharePhone: parsed.data.sharePhone,
      })
      if (!preview) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      return NextResponse.json({ preview })
    }

    if (parsed.data.action === 'close') {
      return NextResponse.json({ listing: await closeListing(listingId, user.id) })
    }

    const match = await proposeMatch({
      listingId,
      userId: user.id,
      message: parsed.data.message,
      shareEmail: parsed.data.shareEmail,
      sharePhone: parsed.data.sharePhone,
    })
    return NextResponse.json({ match }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
