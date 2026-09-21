// 26-D §2 — drag to reorder "My ideas". One request per drop, not one per row moved.
//
// ⚠ SEQUENTIAL INTEGERS, WRITTEN FOR EVERY ROW IN THE DROPPED ORDER — not a fractional
// midpoint insertion. A fractional scheme has to reason about a mix of real and "never
// touched" (NULL) neighbours at every drop; rewriting the whole visible list as 0..N-1 in
// one transaction sidesteps that entirely and is cheap at this scale (the library caps at
// 100 rows per list — see /ideas/mine/page.tsx). The first drag on an account is what
// gives every row a real value for the first time; every drag after that just rewrites
// the same small set again.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const BodySchema = z.object({ order: z.array(z.string()).min(1).max(200) })

export async function PATCH(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'order must be a list of idea ids' }, { status: 422 })

  // Owner-scoped: only the caller's own ideas can be reordered, and any id in the list
  // that is not theirs (or does not exist) is silently excluded rather than erroring the
  // whole drop — a stale list on one tab must not block a drag that is otherwise valid.
  const owned = await prisma.idea.findMany({
    where: { id: { in: parsed.data.order }, creatorId: user.id, deletedAt: null },
    select: { id: true },
  })
  const ownedIds = new Set(owned.map((i) => i.id))
  const toWrite = parsed.data.order.filter((id) => ownedIds.has(id))

  await prisma.$transaction(
    toWrite.map((id, index) => prisma.idea.update({ where: { id }, data: { ownerOrderIndex: index } })),
  )

  return NextResponse.json({ ok: true, reordered: toWrite.length })
}
