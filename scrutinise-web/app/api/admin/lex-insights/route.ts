import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

// GET /api/admin/lex-insights
// Returns all LexInsight records: DRAFT first (newest), APPROVED second, REJECTED last.
// Auth: ADMIN or SUPER_ADMIN only.
export async function GET(_req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const insights = await prisma.lexInsight.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      title: true,
      userQuote: true,
      conversationContext: true,
      lexConclusion: true,
      lexRecommendation: true,
      approvedRule: true,
      createdAt: true,
      reviewedAt: true,
      reviewedBy: { select: { id: true, name: true } },
    },
  })

  // Sort: DRAFT first (newest), APPROVED second (newest), REJECTED last
  const STATUS_ORDER: Record<string, number> = { DRAFT: 0, APPROVED: 1, REJECTED: 2 }
  insights.sort((a, b) => {
    const diff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
    if (diff !== 0) return diff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return NextResponse.json(insights)
}
