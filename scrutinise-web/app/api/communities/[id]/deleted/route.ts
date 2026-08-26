import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, canManageCommunity } from '@/lib/community'
import {
  CONTENT_KINDS,
  listDeletedContent,
  restoreAnswer,
  restorePost,
  restoreQuestion,
} from '@/lib/content-deletion'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/deleted
// Everything removed across this manager's subtree. Manage rights, which cascade
// from every ancestor — the same gate as the claims queue.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params
  if (!(await canManageCommunity(user.id, communityId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ items: await listDeletedContent(communityId) })
}

const RestoreSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  id: z.string().min(1),
})

// POST /api/communities/[id]/deleted — put something back.
//
// ⚠ Authorisation is checked inside the restore functions against the CONTENT's
// own community, not the [id] in the URL, so an item in one branch cannot be
// restored by aiming this route at another node the caller happens to manage.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = RestoreSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Say which item to restore.' }, { status: 422 })
  }

  try {
    const { kind, id } = parsed.data
    const result =
      kind === 'question'
        ? await restoreQuestion({ questionId: id, actorUserId: user.id })
        : kind === 'answer'
          ? await restoreAnswer({ answerId: id, actorUserId: user.id })
          : await restorePost({ postId: id, actorUserId: user.id })
    return NextResponse.json({ result })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
