import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { NextResponse } from 'next/server'

/**
 * Get the authenticated Clerk user and the corresponding DB User record.
 * Returns { clerkUserId, dbUser } or throws a 401/404 NextResponse.
 */
export async function getAuthenticatedUser() {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }), user: null }
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: clerkUserId } })

  if (!dbUser) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }), user: null }
  }

  return { error: null, user: dbUser }
}

export type AuthUser = Exclude<Awaited<ReturnType<typeof getAuthenticatedUser>>['user'], null>
