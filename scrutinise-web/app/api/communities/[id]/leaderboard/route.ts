import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getCommunityMembership, getRootCommunityId } from '@/lib/community'
import {
  getBranchLeaderboard,
  getIndividualLeaderboard,
  getUserPoints,
  LEADERBOARD_WINDOWS,
  type LeaderboardWindow,
} from '@/lib/central-points'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/leaderboard?window=month|quarter|all&sort=total|average
// Members of the Community only — no cross-Community or global boards exist.
// The window is a viewer control, which the event ledger makes free: it is only
// a createdAt filter, so nothing is precomputed or cached per window.
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)

  if (!(await getCommunityMembership(user.id, rootId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sp = new URL(req.url).searchParams
  const raw = sp.get('window') ?? 'all'
  const window = (LEADERBOARD_WINDOWS as readonly string[]).includes(raw)
    ? (raw as LeaderboardWindow)
    : 'all'
  const sort = sp.get('sort') === 'average' ? 'average' : 'total'

  const [individuals, branches, myPoints] = await Promise.all([
    getIndividualLeaderboard(rootId, window),
    getBranchLeaderboard(rootId, window, sort),
    getUserPoints(user.id, rootId, window),
  ])

  return NextResponse.json({ window, sort, individuals, branches, myPoints })
}
