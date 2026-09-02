import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { ADMIN_USER_SORTS, listAdminUsers } from '@/lib/admin-users'

const QuerySchema = z.object({
  sort: z.enum(ADMIN_USER_SORTS).default('lastSignIn'),
})

/**
 * GET /api/admin/users — every registered user. Admin+.
 *
 * CENTRAL 25-A §6a. Rewritten from a 25-a-page list: the question the list has
 * to answer is "who signed up and never came back", and sorting one page of 25
 * by a field every other page also carries answers a different question. The
 * whole list is sorted, then returned.
 *
 * The sign-in half of every row comes from Clerk, because we hold no sign-in
 * record of our own — see lib/admin-users.ts and the report's §6b.
 */
export async function GET(req: Request) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({ sort: url.searchParams.get('sort') ?? undefined })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown sort' }, { status: 422 })
  }

  return NextResponse.json(await listAdminUsers(parsed.data.sort))
}
