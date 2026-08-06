import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const QuerySchema = z.object({
  q: z.string().min(2).max(100),
})

// GET /api/users/search?q= — search users by name, username, or email.
// Auth required. Excludes the requesting user. No email returned.
//
// Email is matched EXACTLY (case-insensitive), never as a substring: a
// substring match on an address would let anyone enumerate accounts by typing
// a common domain fragment. Name/username stay substring matches. Before the
// Stage 1 user test on 6 Aug 2026 email was not searchable at all, so inviting
// a known user by their address silently found nothing.
export async function GET(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({ q: searchParams.get('q') ?? '' })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Query parameter q must be at least 2 characters' },
      { status: 422 },
    )
  }

  const { q } = parsed.data
  const term = q.trim()

  const results = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      isHistoricalAccount: false,
      status: 'ACTIVE',
      OR: [
        { email: { equals: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      username: true,
    },
    take: 8,
  })

  return NextResponse.json({ users: results })
}
