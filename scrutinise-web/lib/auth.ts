import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { canCreateAccount } from './invite-gate'
import { acceptInvitationsAtSignIn } from './invite-acceptance'
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

  // Name sync on login: if the user exists, refresh name from Clerk in the background.
  // This corrects any mismatch between the stored name and the current Clerk profile.
  if (dbUser) {
    const storedFirst = dbUser.firstName
    const storedLast = dbUser.lastName
    void (async () => {
      try {
        const client = await clerkClient()
        const clerkUser = await client.users.getUser(clerkUserId)
        const freshFirst = clerkUser.firstName ?? storedFirst
        const freshLast = clerkUser.lastName ?? storedLast
        if (freshFirst !== storedFirst || freshLast !== storedLast) {
          const freshName = [freshFirst, freshLast].filter(Boolean).join(' ')
          await prisma.user.update({
            where: { clerkId: clerkUserId },
            data: { firstName: freshFirst, lastName: freshLast, name: freshName },
          })
        }
      } catch {
        // silent — best-effort sync
      }
    })()
  }

  if (!dbUser) {
    // JIT user sync — webhook may not have fired yet; create User from Clerk data
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

      // ⚠⚠ CENTRAL 25-A §7b — THE THIRD DOOR, AND IT USED TO HAVE NO LOCK.
      //
      // This path exists because the Clerk webhook can be late, and it creates a
      // User row for any Clerk session that lacks one — with no invitation check
      // at all. So the invite gate was enforced in exactly one of three places:
      // a Clerk account that survived the webhook (delayed, undelivered, or its
      // `deleteUser` call failed) was admitted here regardless.
      //
      // It asks the same question the other two ask. A late webhook is still
      // served: a platform invitation is not marked used until the webhook runs,
      // and a Community invitation is not consumed until the person joins, so a
      // genuine invitee's credential is still valid at this moment.
      if (!(await canCreateAccount(primaryEmail))) {
        console.warn(`[auth] JIT sync refused: no valid invitation for ${primaryEmail}`)
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

      // ⚠ CENTRAL 25-A §7c — the other place a first sign-in can land. If the
      // webhook was late, the account is created here instead, and the
      // invitation has to be honoured here too or it never is.
      void acceptInvitationsAtSignIn(primaryEmail)

    } catch (err) {
      console.error(`[auth] JIT sync failed for clerkId ${clerkUserId}:`, err)
      return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }), user: null }
    }
  }

  // Cancellation: if user logs in while DELETION_PENDING, restore account
  if (dbUser && dbUser.status === 'DELETION_PENDING') {
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { status: 'ACTIVE', deletionRequestedAt: null, deletionScheduledFor: null },
    })
  }

  return { error: null, user: dbUser }
}

export type AuthUser = Exclude<Awaited<ReturnType<typeof getAuthenticatedUser>>['user'], null>
