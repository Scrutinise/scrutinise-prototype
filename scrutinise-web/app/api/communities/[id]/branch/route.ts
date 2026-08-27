import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { deleteBranch, describeBranchDeletion, restoreBranch } from '@/lib/branch-deletion'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/branch
//
// What deleting this branch would actually do, in numbers. The confirmation
// dialog READS this rather than counting for itself — a dialog that says
// "3 members and 12 items" while the delete touches something else is worse than
// no dialog, because it is trusted.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    const preview = await describeBranchDeletion(id)
    // The preview leaks only what a manager of this node can already see, and
    // the delete itself re-checks rights, so a read here is safe for any member.
    void user
    return NextResponse.json({ preview })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}

const DeleteSchema = z.object({ reason: z.string().max(1000).optional() })

// DELETE /api/communities/[id]/branch
export async function DELETE(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const parsed = DeleteSchema.safeParse(body)

  try {
    const result = await deleteBranch({
      branchId: id,
      actorUserId: user.id,
      reason: parsed.success ? parsed.data.reason : undefined,
    })
    return NextResponse.json({ result })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}

// POST /api/communities/[id]/branch — restore.
export async function POST(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    return NextResponse.json({ result: await restoreBranch({ branchId: id, actorUserId: user.id }) })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
