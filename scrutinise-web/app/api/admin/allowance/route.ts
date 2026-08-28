// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-M §4 — ADMIN CAN GRANT ALLOWANCE TO A USER.
//
//   GET   ?email=… | ?userId=…  → what they have, what they have spent, what is left
//   PATCH { userId, thirds, note } → set it
//
// ⚠ IT SETS, IT DOES NOT INCREMENT, and the difference matters at 2am. "Add 3" applied twice
// by a double-clicked button gives 6; "set to 7" applied twice gives 7. The read above tells
// the admin what it is now, so setting is no harder to use and cannot compound.
//
// ⚠ A NOTE IS REQUIRED. An allowance that moves with no record of who moved it or why is an
// unaccountable grant, and this is exactly the action somebody will later ask about. Same
// rule as an excluded source's reason (§20.2.1) and a dismissed issue's.
//
// ⚠ AND IT WRITES AN ActivityLog ROW. Every ADMIN access to another user's material already
// does (docs/CLAUDE.md §6, PRIVACY LOG); changing what they may spend is at least as much
// their business as reading their idea.
//
// ⚠ ADMIN-GATED INDEPENDENTLY of any layout gate — one gate covering two paths is a gate
// that silently stops covering one of them.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readAllowance, FULL_BUILD_THIRDS, REUSE_BUILD_THIRDS } from '@/lib/lex/allowance'

async function requireAdmin() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return { error, user: null as never }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null as never }
  }
  return { error: null, user }
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const email = req.nextUrl.searchParams.get('email')?.trim()
  const userId = req.nextUrl.searchParams.get('userId')?.trim()
  if (!email && !userId) {
    return NextResponse.json({ error: 'Pass ?email= or ?userId=' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email },
    select: { id: true, email: true, name: true, buildAllowanceThirds: true, buildAllowanceNote: true },
  })
  if (!target) return NextResponse.json({ error: 'No such user' }, { status: 404 })

  return NextResponse.json({
    user: { id: target.id, email: target.email, name: target.name },
    note: target.buildAllowanceNote,
    allowance: await readAllowance(target.id),
    prices: { fullBuildThirds: FULL_BUILD_THIRDS, reuseBuildThirds: REUSE_BUILD_THIRDS },
  })
}

const PatchSchema = z.object({
  userId: z.string().min(1).max(64),
  /** In THIRDS. 3 = one full build, 1 = one redraft. Zero is a legitimate value: it is how
   *  an allowance is withdrawn, and refusing it would make withdrawal impossible. */
  thirds: z.number().int().min(0).max(300),
  /** ⚠ REQUIRED. See the header — an unaccountable grant is the thing this prevents. */
  note: z.string().trim().min(3).max(500),
})

export async function PATCH(req: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error) return error

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  }
  const { userId, thirds, note } = parsed.data

  const before = await prisma.user.findUnique({
    where: { id: userId }, select: { id: true, buildAllowanceThirds: true },
  })
  if (!before) return NextResponse.json({ error: 'No such user' }, { status: 404 })

  await prisma.user.update({
    where: { id: userId },
    data: {
      buildAllowanceThirds: thirds,
      // The note carries WHO as well as why, because the column is one field and the
      // question asked later is always both.
      buildAllowanceNote: `${note} — set to ${thirds} thirds by ${user.email ?? user.id} on `
        + `${new Date().toISOString().slice(0, 16)}Z (was ${before.buildAllowanceThirds})`,
    },
  })

  // ⚠ AND IT IS LOGGED. `ActivityLog` is where every admin action against another user's
  // material already lands; a grant that changed what they may spend and left no trace
  // would be the one exception, and it is the one most likely to be queried.
  await prisma.activityLog.create({
    data: {
      // ⚠ THE ROW IS AGAINST THE USER WHOSE ALLOWANCE CHANGED, not against the admin, with
      // the admin in `accessedByUserId`. That is how the privacy log already works, and it
      // is the direction that makes the row findable by the person who would ask about it.
      userId,
      activityType: 'ADMIN_SET_BUILD_ALLOWANCE',
      entityType: 'User',
      entityId: userId,
      description: `Build allowance ${before.buildAllowanceThirds} → ${thirds} thirds. ${note}`,
      accessedByUserId: user.id,
      metadata: { fromThirds: before.buildAllowanceThirds, toThirds: thirds, note },
    },
  }).catch((e) => {
    // ⚠ THE GRANT IS NOT ROLLED BACK ON A LOGGING FAILURE, and the failure is printed rather
    // than swallowed. Refusing the grant because the log failed would leave an admin unable
    // to unblock a pilot user for a reason that has nothing to do with them.
    console.error('[admin-allowance] the grant was applied but NOT logged', {
      userId, by: user.id, error: e instanceof Error ? e.message : String(e),
    })
  })

  return NextResponse.json({ ok: true, allowance: await readAllowance(userId) })
}
