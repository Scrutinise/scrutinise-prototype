import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Clerk sends webhooks using svix — install: npm install svix
// CLERK_WEBHOOK_SECRET must be set in Vercel env vars

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    email_addresses: Array<{ email_address: string; verification: { status: string } }>
    first_name: string | null
    last_name: string | null
    username: string | null
    unsafe_metadata?: Record<string, unknown>
    public_metadata?: Record<string, unknown>
  }
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
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

  let event: ClerkUserCreatedEvent
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  if (event.type !== 'user.created') {
    return NextResponse.json({ received: true })
  }

  const { id: clerkId, email_addresses, first_name, last_name, username, unsafe_metadata } = event.data

  const primaryEmail = email_addresses.find(e => e.verification.status === 'verified')?.email_address
    ?? email_addresses[0]?.email_address

  if (!primaryEmail) {
    return NextResponse.json({ error: 'No email found' }, { status: 400 })
  }

  const firstName = first_name ?? 'User'
  const lastName = last_name ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  // Username: Clerk may send null — always generate a unique fallback.
  // Matches the JIT sync pattern in lib/auth.ts exactly.
  const usernameBase = username
    ?? (firstName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'user')
  const uniqueUsername = usernameBase.slice(0, 20) + '_' + Date.now().toString(36)

  // Consent fields from onboarding page (written via PATCH /api/user/onboarding,
  // not via Clerk metadata — these will be null/false at webhook time)
  const preferredName = (unsafe_metadata?.preferredName as string | undefined) ?? firstName
  const ageConfirmed = (unsafe_metadata?.ageConfirmed as boolean | undefined) === true
  const tcAgreed = (unsafe_metadata?.tcAgreed as boolean | undefined) === true
  const rulesAgreed = (unsafe_metadata?.rulesAgreed as boolean | undefined) === true
  const now = new Date()

  // webhook received — user.created event

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

      // Create credibility score record
      await tx.credibilityScore.upsert({
        where: { userId: newUser.id },
        update: {},
        create: { userId: newUser.id },
      })

      return newUser
    })

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
