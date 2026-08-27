import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { requireLibraryAccess } from '@/lib/question-library'
import { RESOURCE_TYPE_KEYS, createResource, listResources } from '@/lib/resources'
import { approvalStampFor, getCommunityBranding, resolveApproverCaps } from '@/lib/approval'
import { canManageCommunity } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/resources?type=&topic=&sort=
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const branding = await getCommunityBranding(id)
  const [rows, caps, canManage] = await Promise.all([
    listResources(id, user.id, {
      type: url.searchParams.get('type') ?? undefined,
      topic: url.searchParams.get('topic') ?? undefined,
      sort: url.searchParams.get('sort') === 'newest' ? 'newest' : 'top',
    }),
    // ⚠ Resolved ONCE for the viewer, not per row: the mode is a Community
    // setting, so every card in the list is decided by the same four booleans.
    resolveApproverCaps(user.id, id, branding),
    canManageCommunity(user.id, id),
  ])

  return NextResponse.json({
    branding,
    caps,
    canManage,
    viewerId: user.id,
    resources: rows.map((r) => ({ ...r, approval: approvalStampFor(r, branding) })),
  })
}

const CreateSchema = z.object({
  type: z.enum(RESOURCE_TYPE_KEYS as unknown as [string, ...string[]]),
  title: z.string().min(1).max(200),
  whyUseful: z.string().min(1).max(4000),
  context: z.string().max(4000).optional(),
  topicTags: z.array(z.string()).max(10).optional(),
  scope: z.enum(['COMMUNITY', 'BRANCH']).optional(),
  externalUrl: z.string().url().optional(),
  file: z
    .object({ key: z.string(), name: z.string(), type: z.string(), size: z.number() })
    .optional(),
  // ⚠ NOT `.default(false)`. A default would let a client that omits the field
  // sail through the gate; the assertion has to be sent, deliberately, as true.
  rightsConfirmed: z.boolean(),
})

// POST /api/communities/[id]/resources
// The file is uploaded first (see ./upload), which returns the R2 key echoed
// back here — so a resource row never exists pointing at an object that failed
// to store.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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
    const resource = await createResource({
      communityId: id,
      authorId: user.id,
      ...parsed.data,
    })
    return NextResponse.json({ resource }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
