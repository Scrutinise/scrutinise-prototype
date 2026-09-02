import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { sendInviteMismatchNotificationEmail } from '@/lib/email'
import { findInviteCredential } from '@/lib/invite-gate'
import { acceptInvitationsAtSignIn } from '@/lib/invite-acceptance'

// CLERK_WEBHOOK_SECRET must be set in Vercel env vars.
// Subscribe endpoint to user.created (and user.updated for name sync).

interface ClerkUserEvent {
  type: 'user.created' | 'user.updated'
  data: {
    id: string
    email_addresses: Array<{ id: string; email_address: string; verification: { status: string } }>
    primary_email_address_id: string | null
    first_name: string | null
    last_name: string | null
    username: string | null
    unsafe_metadata?: Record<string, unknown>
    public_metadata?: Record<string, unknown>
  }
}

async function deleteClerkUser(userId: string, reason: string) {
  console.log(`[clerk-webhook] Deleting user ${userId}: ${reason}`)
  try {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  } catch (err) {
    // If delete fails the Clerk account persists but has no app-side User record —
    // they can authenticate but won't have access to anything. Log for manual cleanup.
    console.error(`[clerk-webhook] Failed to delete user ${userId}:`, err)
  }
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Verify svix signature
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const payload = await req.text()

  let event: ClerkUserEvent
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  if (event.type !== 'user.created' && event.type !== 'user.updated') {
    return NextResponse.json({ received: true })
  }

  const { id: clerkId, email_addresses, primary_email_address_id, first_name, last_name, username, unsafe_metadata } = event.data

  const firstName = first_name ?? 'User'
  const lastName = last_name ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  // user.updated — sync name fields only, no invite check needed
  if (event.type === 'user.updated') {
    try {
      await prisma.user.updateMany({
        where: { clerkId },
        data: { firstName, lastName, name: fullName },
      })
      return NextResponse.json({ updated: true })
    } catch (err) {
      console.error('[webhook] user.updated name sync failed —', {
        clerkId,
        error: err instanceof Error ? err.message : String(err),
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
  }

  // Resolve primary email
  const primaryEmail = (
    email_addresses.find(e => e.id === primary_email_address_id)?.email_address
    ?? email_addresses.find(e => e.verification.status === 'verified')?.email_address
    ?? email_addresses[0]?.email_address
  )?.toLowerCase()

  if (!primaryEmail) {
    await deleteClerkUser(clerkId, 'no primary email')
    return NextResponse.json({ ok: true, action: 'deleted_no_email' })
  }

  // ── Invite gate ────────────────────────────────────────────────────────────
  // Only allow sign-up if this address holds a valid invitation. If not, the
  // Clerk account is deleted immediately.
  //
  // ⚠⚠ CENTRAL 25-A §7b — THIS ASKS THE SAME FUNCTION THE SIGN-UP PAGE ASKS.
  // It used to recognise only the platform `Invite` table while the sign-up page
  // kept a rule of its own, and a Community invitation satisfied neither — which
  // is how five real people were invited to a branch and could not create an
  // account. If the door were widened without widening this in the same change,
  // they would sign up successfully and be silently destroyed seconds later,
  // which is worse than being refused because nobody finds out.
  // `findInviteCredential` is the single decision, so there is nothing left to
  // keep in sync.
  const now = new Date()
  const credential = await findInviteCredential(primaryEmail, now)

  if (!credential) {
    await deleteClerkUser(clerkId, `no valid invitation of any kind for ${primaryEmail}`)
    return NextResponse.json({ ok: true, action: 'deleted_no_invite' })
  }

  // ⚠ A PLATFORM invitation is spent by the sign-up it authorised. A COMMUNITY
  // invitation is NOT: it is consumed when the person JOINS, and burning it here
  // would leave them holding an account with no way into the branch they were
  // invited to.
  if (credential.consumeOnSignUp) {
    await prisma.invite.update({
      where: { id: credential.inviteId },
      data: { usedAt: now },
    })
  }
  // ── End invite gate ────────────────────────────────────────────────────────

  // Username: Clerk may send null — always generate a unique fallback.
  const usernameBase = username
    ?? (firstName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'user')
  const uniqueUsername = usernameBase.slice(0, 20) + '_' + Date.now().toString(36)

  // Consent fields from onboarding (written via PATCH /api/user/onboarding;
  // not available at webhook time — will be null/false here)
  const preferredName = (unsafe_metadata?.preferredName as string | undefined) ?? firstName
  const ageConfirmed = (unsafe_metadata?.ageConfirmed as boolean | undefined) === true
  const tcAgreed = (unsafe_metadata?.tcAgreed as boolean | undefined) === true
  const rulesAgreed = (unsafe_metadata?.rulesAgreed as boolean | undefined) === true

  try {
    const user = await prisma.$transaction(async (tx) => {
      // Upsert so re-deliveries are idempotent
      const newUser = await tx.user.upsert({
        where: { clerkId },
        update: {},
        create: {
          clerkId,
          email: primaryEmail,
          emailVerified: true,
          firstName,
          lastName,
          name: fullName,
          preferredName,
          ageConfirmed,
          tcAgreedAt: tcAgreed ? now : null,
          rulesAgreedAt: rulesAgreed ? now : null,
          tcVersion: tcAgreed ? '1.0' : null,
          username: uniqueUsername,
          role: 'CITIZEN',
          status: 'ACTIVE',
          referralCode: crypto.randomUUID(),
        },
      })

      await tx.credibilityScore.upsert({
        where: { userId: newUser.id },
        update: {},
        create: { userId: newUser.id },
      })

      return newUser
    })

    // ⚠ CENTRAL 25-A §7c — THE SECOND LINK THEY SHOULD NOT HAVE TO FIND.
    // The account exists; the invitation that brought them here is redeemed for
    // them now, so they arrive already in the branch they were invited to.
    // Fire-and-forget: the account is created either way.
    void acceptInvitationsAtSignIn(primaryEmail)

    // Check for pending collaborator invite to this email — if name differs, notify inviter
    const pendingInvite = await prisma.userInvite.findFirst({
      where: { email: primaryEmail, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })

    if (pendingInvite && pendingInvite.ideaId) {
      const originalFullName = [pendingInvite.firstName, pendingInvite.lastName].filter(Boolean).join(' ')
      const nameChanged = fullName.toLowerCase() !== originalFullName.toLowerCase()

      if (nameChanged) {
        Promise.all([
          prisma.user.findUnique({
            where: { id: pendingInvite.invitedByUserId },
            select: { email: true, firstName: true, name: true },
          }),
          prisma.idea.findUnique({
            where: { id: pendingInvite.ideaId },
            select: { title: true },
          }),
        ]).then(([inviter, idea]) => {
          if (!inviter || !idea) return

          sendInviteMismatchNotificationEmail({
            toEmail: inviter.email,
            toFirstName: inviter.firstName ?? inviter.name,
            originalName: originalFullName,
            signedUpName: fullName,
            signedUpEmail: primaryEmail,
            ideaTitle: idea.title,
          }).catch(err => console.error('[webhook] mismatch email failed —', err))

          prisma.notification.create({
            data: {
              userId: pendingInvite.invitedByUserId,
              type: 'COLLABORATOR_ACCEPTED',
              relatedIdeaId: pendingInvite.ideaId!,
              title: 'Collaborator signed up with different details',
              message: `The person you invited as ${originalFullName} signed up as ${fullName} (${primaryEmail}). They have been added to your team.`,
              linkUrl: `/ideas/${pendingInvite.ideaId}?tab=team`,
            },
          }).catch(err => console.error('[webhook] mismatch notification create failed —', err))
        }).catch(err => console.error('[webhook] mismatch lookup failed —', err))
      }
    }

    return NextResponse.json({ userId: user.id })
  } catch (err) {
    console.error('[webhook] user creation failed —', {
      clerkId,
      email: primaryEmail,
      username: uniqueUsername,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
