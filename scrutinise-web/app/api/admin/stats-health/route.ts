import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { statsConfigured, statsHealth } from '@/lib/stats/stats-db'
import { getCofogRollup } from '@/lib/stats/stats-query'

// GET /api/admin/stats-health — Admin+.
//
// Proves, from the deployed runtime, that the web app can reach the STATISTICS
// database (a different Neon project from the app/corpus DB) and that it holds real
// rows. Run this after any change to STATS_DATABASE_URL in Vercel — a green tsc and
// a working local .env say nothing about what the serverless runtime can reach.
//
// Also returns the top spending function, because a connection that succeeds but
// returns nothing is the failure mode worth catching (the stats read layer had a
// stale measure name that did exactly that — see lib/stats/stats-query.ts).
export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!statsConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, error: 'STATS_DATABASE_URL is not set in this environment.' },
      { status: 503 },
    )
  }

  const started = Date.now()
  const health = await statsHealth()
  let topFunction: { name: string | null; value: number; unit: string; period: string } | null = null
  if (health.ok) {
    const rollup = await getCofogRollup({}).catch(() => null)
    const top = rollup?.rows[0]
    if (rollup && top) {
      topFunction = {
        name: top.cofogFunctionName,
        value: top.totalValue,
        unit: top.unit,
        period: rollup.periodLabel,
      }
    }
  }

  return NextResponse.json(
    { ...health, configured: true, topFunction, elapsedMs: Date.now() - started },
    { status: health.ok ? 200 : 503 },
  )
}
