import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { requireLibraryAccess } from '@/lib/question-library'
import { reportResource } from '@/lib/resources'

type Params = { params: Promise<{ id: string; resourceId: string }> }

const ReportSchema = z.object({ reason: z.string().min(3).max(1000) })

// POST /api/communities/[id]/resources/[resourceId]/report
// ⚠ ANY MEMBER, not just managers. Report is the copyright escalation route, and
// the person who recognises their own work is exactly the person with no rights
// over the Community that posted it.
export async function POST(req: Request, { params }: Params) {
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

  const parsed = ReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    await reportResource({ resourceId, userId: user.id, reason: parsed.data.reason })
    return NextResponse.json({ reported: true })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
