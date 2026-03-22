import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Get the authenticated Clerk user and the corresponding DB User record.
 * If the User record doesn't exist (webhook missed or delayed), performs a
 * just-in-time sync by fetching from the Clerk API and creating it.
 * Returns { error, user } — error is a NextResponse if auth fails.
 */
export async function getAuthenticatedUser() {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }), user: null }
  }

  let dbUser = await prisma.user.findUnique({ where: { clerkId: clerkUserId } })

  if (!dbUser) {
    // JIT user sync — webhook may not have fired yet; create User from Clerk data
    console.log(`[auth] User ${clerkUserId} not in DB — attempting JIT sync from Clerk`)
    try {
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(clerkUserId)

      const primaryEmail =
        clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
        ?? clerkUser.emailAddresses[0]?.emailAddress

      if (!primaryEmail) {
        console.error(`[auth] JIT sync: no email address for clerkId ${clerkUserId}`)
        return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }), user: null }
      }

      const firstName = clerkUser.firstName ?? 'User'
      const lastName = clerkUser.lastName ?? ''
      const fullName = [firstName, lastName].filter(Boolean).join(' ')
      const base = (clerkUser.username ?? fullName.toLowerCase().replace(/[^a-z0-9]/g, '_')).slice(0, 20)
      const uniqueUsername = `${base}_${Date.now().toString(36)}`

      dbUser = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            clerkId: clerkUserId,
            email: primaryEmail,
            emailVerified: true,
            firstName,
            lastName,
            name: fullName,
            preferredName: firstName,
            ageConfirmed: false,
            username: uniqueUsername,
            role: 'CITIZEN',
            status: 'ACTIVE',
            referralCode: crypto.randomUUID(),
          },
        })
        await tx.credibilityScore.create({ data: { userId: newUser.id } })
        return newUser
      })

      console.log(`[auth] JIT sync: created User ${dbUser.id} for clerkId ${clerkUserId}`)
    } catch (err) {
      console.error(`[auth] JIT sync failed for clerkId ${clerkUserId}:`, err)
      return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }), user: null }
    }
  }

  return { error: null, user: dbUser }
}

export type AuthUser = Exclude<Awaited<ReturnType<typeof getAuthenticatedUser>>['user'], null>
