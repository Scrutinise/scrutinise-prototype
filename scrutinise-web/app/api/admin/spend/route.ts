// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/spend — BRIEF_SEARCH_S6 §3 ADDENDUM.
//
// What the platform is costing Charlie, over a chosen period. ADMIN and SUPER_ADMIN only.
//
// ⚠⚠ READ-ONLY, AND THERE IS NO SPEND CONTROL BEHIND IT. Charlie's instruction: "build the
// measurement, do not switch on any user-facing spend control. Until it's the user's own
// money, the only thing being measured is what this costs him." This route has no POST, no
// PATCH, and calls nothing that can refuse a user's request.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { spendOverview } from '@/lib/lex/spend-admin'

/**
 * ⚠ The window is bounded at 366 days. Not for safety — the table is small — but because an
 * unbounded range on a growing append-only ledger is a query that works today and times the
 * page out in a year, silently, with no code change to blame.
 */
const Query = z.object({
  days: z.coerce.number().int().min(1).max(366).default(30),
})

export async function GET(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', detail: parsed.error.flatten() }, { status: 400 })
  }

  const until = new Date()
  const since = new Date(until.getTime() - parsed.data.days * 24 * 60 * 60 * 1000)

  try {
    const overview = await spendOverview(since, until)
    return NextResponse.json(overview)
  } catch (err) {
    // ⚠ Named, not swallowed. A spend page that renders empty because the view is missing
    // looks exactly like a platform that has spent nothing.
    console.error('[admin/spend] failed', err)
    return NextResponse.json(
      { error: 'Could not read the spend ledger', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
