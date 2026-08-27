import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, canManageCommunity, getRootCommunityId } from '@/lib/community'
import { APPROVAL_MODES, getCommunityBranding, updateCommunitySettings } from '@/lib/approval'

type Params = { params: Promise<{ id: string }> }

const PatchSchema = z.object({
  organisationName: z.string().max(80).nullable().optional(),
  organisationColour: z.string().nullable().optional(),
  approvalFeatureEnabled: z.boolean().optional(),
  approvalMode: z.enum(APPROVAL_MODES).optional(),
  namedApproverIds: z.array(z.string()).optional(),
})

// GET /api/communities/[id]/settings
// ⚠ READABLE BY ANY MEMBER, not just admins: the organisation name and colour
// are needed to RENDER the stamp on every surface, so gating the read would
// blank the branding for everyone who cannot edit it.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)
  const branding = await getCommunityBranding(rootId)
  return NextResponse.json({
    ...branding,
    canEdit: await canManageCommunity(user.id, rootId),
  })
}

// PATCH /api/communities/[id]/settings — root Community admins only, enforced
// inside updateCommunitySettings against the ROOT, not the [id] in the URL.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    await updateCommunitySettings({ communityId: id, actorUserId: user.id, ...parsed.data })
    return NextResponse.json(await getCommunityBranding(id))
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
