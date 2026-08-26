import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'
import { getOrphanedTopicTags, getTopicUsage, getUntaggedQuestions } from '@/lib/question-library'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Topics' }

type Props = { params: Promise<{ id: string }> }

/**
 * CENTRAL — the admin topic view (Charlie, 26 Aug 2026).
 *
 * ⚠ THIS PAGE IS THE REASON THERE IS NO "OTHER" TOPIC. A catch-all absorbs
 * exactly the questions that would have told you which topic is missing: they go
 * in, everyone stops thinking about it, and the list never changes again. The
 * topic field is optional instead, and the Untagged list below is the evidence
 * base — a cluster of untagged questions about the same thing is the argument
 * for adding a topic, and a topic sitting at zero for months is the argument for
 * removing one.
 *
 * Adding a topic is meant to be a DATA decision, which is why the count is the
 * first thing on the row.
 *
 * Community admins only: the tag set lives on the root, so it is a
 * Community-level thing to change, not a branch-level one.
 */
export default async function TopicsPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/topics`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/topics`)

  const rootId = await getRootCommunityId(id)
  if (!(await canManageCommunity(user.id, rootId))) notFound()

  const root = await prisma.community.findUniqueOrThrow({
    where: { id: rootId },
    select: { id: true, name: true },
  })

  const [usage, untagged, orphaned] = await Promise.all([
    getTopicUsage(rootId),
    getUntaggedQuestions(rootId),
    getOrphanedTopicTags(rootId),
  ])

  const subjects = usage.filter((t) => t.subject)
  const internal = usage.filter((t) => !t.subject)
  const totalTagged = usage.reduce((s, t) => s + t.questionCount, 0)
  const unused = usage.filter((t) => t.questionCount === 0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-2 text-xs text-muted-foreground">
          <Link href={`/communities/${id}?tab=questions`} className="hover:underline">
            ← {root.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground pretty">
          A controlled list, shared by {root.name} and every branch in it. Topics are for browsing a
          slice you can’t name precisely — finding one specific question is what search is for.
        </p>

        <div className="central-card mt-5 flex flex-wrap gap-6 p-4 text-sm">
          <span>
            <span className="tabular font-semibold">{usage.length}</span> topics
          </span>
          <span>
            <span className="tabular font-semibold">{totalTagged}</span> taggings
          </span>
          <span className={unused.length ? 'text-muted-foreground' : ''}>
            <span className="tabular font-semibold">{unused.length}</span> with no questions yet
          </span>
          <span className={untagged.length ? 'central-teal-text font-medium' : 'text-muted-foreground'}>
            <span className="tabular font-semibold">{untagged.length}</span> questions with no topic
          </span>
        </div>

        {orphaned.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px]">
            <p className="font-semibold text-red-800">
              {orphaned.length} topic{orphaned.length === 1 ? '' : 's'} in use that the list no longer has
            </p>
            <p className="mt-1 text-red-700 pretty">
              These questions carry a label that is not in the tag set, so no filter will find them.
              A topic was renamed or removed without moving the questions using it.
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {orphaned.map((o) => (
                <li key={o.label} className="text-red-800">
                  <span className="tabular font-semibold">{o.questionCount}</span> · {o.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <TopicTable title="Subject" rows={subjects} />
        <TopicTable title="Doing the job" rows={internal} />

        <section className="mt-8">
          <h2 className="text-sm font-semibold">
            Untagged
            {untagged.length > 0 && (
              <span className="tabular ml-2 rounded-full bg-[var(--central-teal-fill-strong)] px-2 py-0.5 text-xs font-semibold central-teal-text">
                {untagged.length}
              </span>
            )}
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground pretty">
            Questions nobody could place. This list is the evidence for adding a topic — if several
            of these are about the same thing, that thing is the missing topic. There is deliberately
            no “Other”: it would swallow exactly these and you would never see them again.
          </p>
          {untagged.length === 0 ? (
            <p className="central-card mt-3 p-5 text-[13px] text-muted-foreground">
              Every question has a topic. Nothing to decide.
            </p>
          ) : (
            <div className="central-card mt-3 divide-y divide-border">
              {untagged.map((q) => (
                <div key={q.id} className="p-3">
                  <Link
                    href={`/communities/${id}/questions/${q.id}`}
                    className="text-[14px] font-medium leading-snug pretty hover:underline"
                  >
                    {q.text}
                  </Link>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {q.contextTags.join(' · ') || 'no context'}
                    {q.branchName ? ` · ${q.branchName}` : ''}
                    {' · '}
                    <span className="tabular">{q.answerCount}</span> answer{q.answerCount === 1 ? '' : 's'}
                    {' · '}
                    <span className="tabular">
                      {q.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-[12px] text-muted-foreground pretty">
          The list is fixed in code (<span className="tabular">DEFAULT_QUESTION_TAGS</span> in
          lib/community.ts) rather than editable here, so every Community reads the same set and a
          filter means the same thing everywhere. Changing it is a migration, deliberately — the
          evidence for changing it is on this page.
        </p>
      </main>
    </div>
  )
}

function TopicTable({ title, rows }: { title: string; rows: { label: string; questionCount: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.questionCount))
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="central-card divide-y divide-border">
        {rows.map((t) => (
          <div key={t.label} className="flex items-center gap-3 px-3 py-2">
            <span
              className={`tabular w-9 shrink-0 text-right text-sm font-semibold ${
                t.questionCount === 0 ? 'text-muted-foreground' : ''
              }`}
            >
              {t.questionCount}
            </span>
            {/* A bar, because "adding a topic is a data decision" is easier to
                act on when the shape of the data is visible at a glance. */}
            <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[oklch(0.94_0.004_250)]">
              <span
                className="block h-full rounded-full bg-[var(--central-teal)]"
                style={{ width: `${(t.questionCount / max) * 100}%` }}
              />
            </span>
            <span className={`text-[14px] ${t.questionCount === 0 ? 'text-muted-foreground' : ''}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
