// 26-C ADDENDUM 3 §23 — "YOUR IDEAS", ONE OF THE FIVE PAGES, ALONE.
//
// §23: "today's right-hand list, alone." Extracted from `/ideas/build/page.tsx`, which
// used to render this beside the New idea intake on one "mixed page" — §23 removes that
// page; this is the library's own home now.
//
// §23a: the "My ideas" nav entry (`PublicNav.tsx`) points HERE. When the user has no
// ideas at all, THIS page redirects to the New idea door rather than rendering an empty
// list — so the nav's two-way rule ("New idea when none, Your ideas when some") lives in
// one place, at the one URL the nav actually points to, rather than a second dispatcher
// route deciding in advance which of two URLs to send the browser to.

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import YourIdeasClient from './YourIdeasClient'
import type { MyIdea } from '@/components/lex/MyIdeasList'
import { doorPath, newIdeaDoor } from '@/lib/lex/new-idea-door'
import { LIVE_IDEA } from '@/lib/lex/idea-visibility'

export default async function YourIdeasPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/ideas/mine')

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, ageConfirmed: true, experienceLevel: true },
  })
  if (dbUser && !dbUser.ageConfirmed) redirect('/onboarding?redirect_url=/ideas/mine')
  if (dbUser?.ageConfirmed && !dbUser.experienceLevel) redirect('/onboarding?redirect_url=/ideas/mine&from=create')
  if (!dbUser) redirect('/sign-in?redirect_url=/ideas/mine')

  // §23a — zero ideas at all: this is a "New idea" moment, not a "Your ideas" one.
  const ideaCount = await prisma.idea.count({ where: { creatorId: dbUser.id, ...LIVE_IDEA } })
  if (ideaCount === 0) redirect(doorPath(await newIdeaDoor()))

  // ═══════════════════════════════════════════════════════════════════════════
  // 26-C §7a — EVERY IDEA IS LISTED, NOT ONLY THE ONES MADE THROUGH THE NEW-IDEA DOOR.
  // See the fuller history of this query in git blame of the old /ideas/build/page.tsx —
  // unchanged in substance, only moved.
  // ═══════════════════════════════════════════════════════════════════════════
  const select = {
    id: true, title: true, stage: true, updatedAt: true, ownerArchivedAt: true, ownerOrderIndex: true,
    elicitation: { select: { status: true, problem: true, goalDetail: true, ownKnowledge: true } },
    builds: {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      select: { status: true, passesComplete: true, completedAt: true },
    },
  }
  const toMyIdea = (r: {
    id: string; title: string; stage: string; updatedAt: Date
    ownerArchivedAt: Date | null; ownerOrderIndex: number | null
    elicitation: { status: string; problem: string | null; goalDetail: string | null; ownKnowledge: string | null } | null
    builds: { status: string; passesComplete: number | null; completedAt: Date | null }[]
  }, isDeleted: boolean): MyIdea => {
    const b = r.builds[0]
    const excerpt = (r.elicitation?.problem || r.elicitation?.goalDetail || r.elicitation?.ownKnowledge || '').trim()
    return {
      ideaId: r.id,
      title: r.title,
      excerpt: excerpt.length > 110 ? excerpt.slice(0, 110).trimEnd() + '…' : excerpt,
      stage: r.stage,
      archived: !!r.ownerArchivedAt,
      deleted: isDeleted,
      orderIndex: r.ownerOrderIndex,
      elicitationStatus: (r.elicitation?.status as MyIdea['elicitationStatus']) ?? 'CONFIRMED',
      buildStatus: (b?.status as MyIdea['buildStatus']) ?? null,
      passesComplete: b?.passesComplete ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }
  }
  // 26-D §2 — explicitly ordered rows first (in the order the owner dragged them into),
  // then everything never touched, in the order the list has always used. NULL sorts
  // last so today's order is exactly preserved until the first drag ever happens.
  const [activeRows, deletedRows] = await Promise.all([
    prisma.idea.findMany({
      where: { creatorId: dbUser.id, deletedAt: null },
      orderBy: [{ ownerOrderIndex: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take: 100, select,
    }),
    prisma.idea.findMany({
      where: { creatorId: dbUser.id, deletedAt: { not: null } }, orderBy: { updatedAt: 'desc' }, take: 100, select,
    }),
  ])
  const recent = activeRows.map((r) => toMyIdea(r, false))
  const deleted = deletedRows.map((r) => toMyIdea(r, true))

  return <YourIdeasClient recent={recent} deleted={deleted} />
}
