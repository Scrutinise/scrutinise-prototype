import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { getCommunityMembership, getRootCommunityId } from '@/lib/community'
import { getCommunityActivityLog } from '@/lib/central-points'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Community activity log' }

/**
 * The Community activity log.
 *
 * Every approved and declined activity claim across the whole tree, who claimed
 * it, who decided it and what it paid — visible to EVERY member of the
 * Community, not only to admins. That visibility is the anti-abuse mechanism at
 * this stage: approvals are witnessed rather than private, which is what makes
 * a tariff-paying approval safe to hand to branch admins.
 */
export default async function CommunityActivityPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/activity`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/activity`)

  const rootId = await getRootCommunityId(id)
  if (!(await getCommunityMembership(user.id, rootId))) notFound()

  const root = await prisma.community.findUniqueOrThrow({
    where: { id: rootId },
    select: { id: true, name: true },
  })
  const entries = await getCommunityActivityLog(rootId)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-2 text-xs text-muted-foreground">
          <Link href={`/communities/${id}`} className="hover:underline">← back</Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every offline activity approved or declined in {root.name}. Visible to every member — that is
          the point.
        </p>

        {entries.length === 0 ? (
          <div className="mt-8 rounded-lg border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Nothing has been decided yet.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {e.claimant.name ?? e.claimant.username} — {e.label}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {e.status === 'APPROVED' ? `+${e.pointsAwarded} points` : 'Declined — no points'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  in {e.community.name} ·{' '}
                  {new Date(e.occurredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · decided by '}
                  {e.decidedBy ? (e.decidedBy.name ?? e.decidedBy.username) : 'an admin'}
                  {e.decidedAt &&
                    ` on ${new Date(e.decidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                </p>
                {e.note && <p className="mt-1 text-xs italic text-muted-foreground">“{e.note}”</p>}
                {e.evidenceUrl && (
                  <a
                    href={e.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs underline underline-offset-2"
                  >
                    Evidence
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
