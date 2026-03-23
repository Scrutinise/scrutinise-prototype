import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { sendCollaboratorInviteEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

const InviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['EDITOR', 'VIEWER']).default('EDITOR'),
  customMessage: z.string().max(500).optional(),
})

// POST /api/ideas/[id]/collaborators — invite a collaborator by email
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, title: true, creatorId: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden — only the owner can invite collaborators' }, { status: 403 })
  }

  // Rate limit: 10 invites per day per user
  const rateLimitKey = `invite:${user.id}`
  if (!checkRateLimit(rateLimitKey, 10, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — you can send up to 10 invites per day. Please try again tomorrow.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { email, firstName, lastName, role, customMessage } = parsed.data

  // Check if already a collaborator
  const existing = await prisma.ideaCollaborator.findFirst({
    where: { ideaId, user: { email } },
  })
  if (existing) {
    return NextResponse.json({ error: 'User is already a collaborator' }, { status: 409 })
  }

  // Check if there's already a pending invite
  const existingInvite = await prisma.userInvite.findFirst({
    where: { email, ideaId, status: 'PENDING' },
  })
  if (existingInvite) {
    return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 409 })
  }

  const magicLinkToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const invite = await prisma.userInvite.create({
    data: {
      invitedByUserId: user.id,
      email,
      firstName,
      lastName,
      magicLinkToken,
      ideaId,
      collaboratorRole: role,
      customMessage,
      status: 'PENDING',
      expiresAt,
    },
  })

  // Send invite email (checks EmailSuppression internally)
  await sendCollaboratorInviteEmail({
    toEmail: email,
    toFirstName: firstName,
    invitedByName: user.name,
    ideaTitle: idea.title,
    magicLinkToken,
    customMessage,
  })

  return NextResponse.json({ inviteId: invite.id }, { status: 201 })
}
