import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { canManageCommunity, getRootCommunityId, getSubtreeIds } from '@/lib/community'
import { sendBranchManagerBroadcastEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

const BroadcastSchema = z.object({
  subject: z.string().min(3).max(150),
  message: z.string().min(3).max(5000),
})

// POST /api/communities/[id]/broadcast
// Message every branch manager in this Community. Community admins only.
//
// Both channels are attempted and BOTH outcomes are reported per recipient:
// the notification always lands, the email may not, and telling an admin their
// message "went out" when nothing was delivered is the failure this reports
// its way around (same rule as the Stage 1.2 invite email).
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)

  // Community admins — manage rights on the ROOT, not merely on some branch.
  if (!(await canManageCommunity(user.id, rootId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BroadcastSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const community = await prisma.community.findUniqueOrThrow({
    where: { id: rootId },
    select: { name: true },
  })

  // Managers of BRANCHES — OWNER/ADMIN on any node below the root. Root admins
  // are not included: this is "message all branch managers", not "message all
  // admins", and an admin messaging themselves is noise.
  const nodeIds = (await getSubtreeIds(rootId)).filter((n) => n !== rootId)
  const managers = await prisma.communityMember.findMany({
    where: { communityId: { in: nodeIds }, role: { in: ['OWNER', 'ADMIN'] } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      community: { select: { name: true } },
    },
  })

  const unique = new Map<string, { id: string; name: string | null; email: string; branch: string }>()
  for (const m of managers) {
    if (!unique.has(m.userId)) {
      unique.set(m.userId, {
        id: m.userId,
        name: m.user.name,
        email: m.user.email,
        branch: m.community.name,
      })
    }
  }

  const recipients = [...unique.values()]
  let emailed = 0
  const emailFailures: string[] = []

  for (const r of recipients) {
    await prisma.notification.create({
      data: {
        userId: r.id,
        type: 'SYSTEM',
        title: parsed.data.subject,
        message: parsed.data.message,
        linkUrl: `/communities/${rootId}`,
      },
    })

    const result = await sendBranchManagerBroadcastEmail({
      toEmail: r.email,
      toName: r.name ?? 'there',
      fromName: user.name ?? 'A Community admin',
      communityName: community.name,
      communityId: rootId,
      subject: parsed.data.subject,
      message: parsed.data.message,
    })
    if (result.sent) emailed++
    else emailFailures.push(`${r.name ?? r.id}: ${result.reason ?? 'not sent'}`)
  }

  return NextResponse.json({
    recipients: recipients.length,
    notified: recipients.length,
    emailed,
    emailFailures,
  })
}
