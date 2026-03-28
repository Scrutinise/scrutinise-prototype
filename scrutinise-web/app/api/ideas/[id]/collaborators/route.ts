import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { sendCollaboratorInviteEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

// Flow A: add existing user directly by userId
const AddExistingSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['EDITOR', 'VIEWER']).default('EDITOR'),
})

// Flow B: invite new user by email
const InviteByEmailSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['EDITOR', 'VIEWER']).default('EDITOR'),
  customMessage: z.string().max(500).optional(),
})

// POST /api/ideas/[id]/collaborators
// Body with userId → add existing user as collaborator immediately
// Body with email/firstName/lastName → send email invite to new user
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
    return NextResponse.json(
      { error: 'Forbidden — only the owner can invite collaborators' },
      { status: 403 },
    )
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

  // ── Flow A: userId provided — add existing user directly ────────────────────
  const existingUserParsed = AddExistingSchema.safeParse(body)
  if (existingUserParsed.success) {
    const { userId: targetUserId, role } = existingUserParsed.data

    // Verify target user exists and is not the owner
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 })
    }

    // Check not already a collaborator
    const alreadyCollab = await prisma.ideaCollaborator.findFirst({
      where: { ideaId, userId: targetUserId },
    })
    if (alreadyCollab) {
      return NextResponse.json({ error: 'User is already a collaborator' }, { status: 409 })
    }

    const collab = await prisma.ideaCollaborator.create({
      data: {
        ideaId,
        userId: targetUserId,
        role,
        invitedByUserId: user.id,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        user: { select: { id: true, name: true, username: true } },
      },
    })

    return NextResponse.json({ collaborator: collab }, { status: 201 })
  }

  // ── Flow B: email provided — invite new user ────────────────────────────────
  const emailParsed = InviteByEmailSchema.safeParse(body)
  if (!emailParsed.success) {
    return NextResponse.json({ error: emailParsed.error.flatten() }, { status: 422 })
  }

  const { email, firstName, lastName, role, customMessage } = emailParsed.data

  // Check if already a collaborator
  const existingCollab = await prisma.ideaCollaborator.findFirst({
    where: { ideaId, user: { email } },
  })
  if (existingCollab) {
    return NextResponse.json({ error: 'User is already a collaborator' }, { status: 409 })
  }

  // Check for pending invite
  const existingInvite = await prisma.userInvite.findFirst({
    where: { email, ideaId, status: 'PENDING' },
  })
  if (existingInvite) {
    return NextResponse.json(
      { error: 'An invitation has already been sent to this email' },
      { status: 409 },
    )
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
