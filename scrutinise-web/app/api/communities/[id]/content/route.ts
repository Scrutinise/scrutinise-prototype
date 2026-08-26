import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import {
  CONTENT_KINDS,
  deleteAnswer,
  deletePost,
  deleteQuestion,
} from '@/lib/content-deletion'

type Params = { params: Promise<{ id: string }> }

const DeleteSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  id: z.string().min(1),
  /** Optional for your own content; REQUIRED in code when removing somebody
   *  else's, which lib/content-deletion.ts enforces rather than this schema —
   *  the schema cannot know whose content it is. */
  reason: z.string().max(1000).optional(),
})

// DELETE /api/communities/[id]/content
//
// One route for all three content kinds, because they share one pattern: soft
// delete, marked cascade, points reversed at the value they were awarded.
//
// ⚠ Authorisation is checked inside the delete functions against the CONTENT's
// own community, never the [id] in the URL.
export async function DELETE(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Say which item to remove.' }, { status: 422 })
  }

  try {
    const { kind, id, reason } = parsed.data
    const result =
      kind === 'question'
        ? await deleteQuestion({ questionId: id, actorUserId: user.id, reason })
        : kind === 'answer'
          ? await deleteAnswer({ answerId: id, actorUserId: user.id, reason })
          : await deletePost({ postId: id, actorUserId: user.id, reason })
    return NextResponse.json({ result })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
