// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/spend/explore — COST DASHBOARD. Spend over a date range, grouped by one dimension,
// filtered by the others (drill-down), with coverage and the reconciliation table.
// ADMIN / SUPER_ADMIN only. READ-ONLY: no POST, nothing here caps, throttles or charges anyone.
//
// ⚠ NO PROVIDER ADMIN KEY IS READ HERE OR ANYWHERE IN THE WEB APP. Reconciliation results arrive through
// the SpendReconciliation table, written by the reconciliation job — the only place those keys live.
// `check:spend-keys` asserts it.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { DIMENSIONS, exploreSpend, type Dimension } from '@/lib/lex/spend-explore'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Query = z.object({
  from: day.optional(),
  to: day.optional(),
  by: z.enum(DIMENSIONS).default('provider'),
  provider: z.string().max(80).optional(),
  model: z.string().max(120).optional(),
  feature: z.string().max(160).optional(),
  idea: z.string().max(80).optional(),
  user: z.string().max(80).optional(),
  build: z.string().max(80).optional(),
})

export async function GET(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query', detail: parsed.error.flatten() }, { status: 400 })
  const q = parsed.data

  // `to` is INCLUSIVE in the UI (a date), exclusive in the query (midnight after it). UTC throughout.
  const to = q.to ? new Date(`${q.to}T00:00:00Z`) : new Date()
  const toExclusive = q.to ? new Date(to.getTime() + 86_400_000) : new Date(to.getTime() + 1)
  const from = q.from ? new Date(`${q.from}T00:00:00Z`) : new Date(to.getTime() - 30 * 86_400_000)
  if (from >= toExclusive) return NextResponse.json({ error: '"from" must be before "to"' }, { status: 400 })
  if (toExclusive.getTime() - from.getTime() > 5 * 366 * 86_400_000) {
    return NextResponse.json({ error: 'Range is limited to five years' }, { status: 400 })
  }

  const filters: Partial<Record<Dimension, string>> = {
    provider: q.provider, model: q.model, feature: q.feature, idea: q.idea, user: q.user, build: q.build,
  }
  try {
    return NextResponse.json(await exploreSpend({ from, to: toExclusive, by: q.by, filters }))
  } catch (err) {
    // Named, not swallowed: a dashboard that renders empty on a failed query looks like a platform that spent nothing.
    console.error('[admin/spend/explore] failed', err)
    return NextResponse.json({ error: 'Could not read the spend ledger', detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
