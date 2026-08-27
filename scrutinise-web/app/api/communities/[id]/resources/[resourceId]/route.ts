import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { requireLibraryAccess } from '@/lib/question-library'
import { setResourceFlag } from '@/lib/resources'
import { setApproval } from '@/lib/approval'
import { deleteResource, restoreResource } from '@/lib/content-deletion'

type Params = { params: Promise<{ id: string; resourceId: string }> }

const PatchSchema = z.union([
  z.object({ action: z.literal('approve'), approved: z.boolean() }),
  z.object({
    action: z.literal('flag'),
    level: z.enum(['DO_NOT_USE', 'USE_WITH_CARE']),
    reason: z.string().min(3).max(1000),
  }),
  z.object({ action: z.literal('restore') }),
])

// PATCH /api/communities/[id]/resources/[resourceId]
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, resourceId } = await params
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

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    if (parsed.data.action === 'approve') {
      return NextResponse.json(
        await setApproval({
          kind: 'resource',
          itemId: resourceId,
          userId: user.id,
          approved: parsed.data.approved,
        }),
      )
    }
    if (parsed.data.action === 'flag') {
      return NextResponse.json(
        await setResourceFlag({
          resourceId,
          userId: user.id,
          level: parsed.data.level,
          reason: parsed.data.reason,
        }),
      )
    }
    return NextResponse.json(await restoreResource({ resourceId, userId: user.id }))
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}

// DELETE — the 2f soft-delete pattern: the row stays, points reverse, and a
// manager can put it back.
export async function DELETE(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, resourceId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const reason = new URL(req.url).searchParams.get('reason') ?? undefined
  try {
    return NextResponse.json(await deleteResource({ resourceId, userId: user.id, reason }))
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
