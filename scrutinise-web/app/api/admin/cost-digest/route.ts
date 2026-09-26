// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/cost-digest — S25 §4. The raw-counters link the cost digest email points
// to, so the email body can stay short. ADMIN and SUPER_ADMIN only, same gate as
// /api/admin/spend.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { buildCostDigestData } from '@/lib/lex/cost-digest-data'

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const data = await buildCostDigestData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/cost-digest] failed', err)
    return NextResponse.json(
      { error: 'Could not build the cost digest', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
