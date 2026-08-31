// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-O §2 — THE PUBLIC VIEW: A HOLDING PAGE, NOT A BUILD.
//
// **Charlie's decision: hold, do not build.** "See this as others would" pointed at
// `/ideas/[id]` — which is the page the TEAM sees, not the public. That is a dead end in the
// middle of the core flow, and §2 is right that a pilot tester will find it.
//
// ⚠⚠ WHY A HOLDING PAGE RATHER THAN HIDING THE BUTTON. §2's own reasoning, and it is the
// reason this file exists at all: the button tells the user the feature exists, which is TRUE.
// An honest "not yet" costs a tester nothing; a button that goes somewhere wrong costs their
// trust in everything else on the page. Removing the button would also lose the one signal we
// have that anybody wanted it.
//
// ⚠ IT SHOWS THE TITLE AND THE SUMMARY AND NOTHING ELSE. §2 is explicit, and the restraint is
// the point: anything more would be a guess at the public view's design, and 25-N §6 already
// contains that design — reviewed, and deliberately not built this sprint. A half-built public
// view would be harder to replace than an empty one.
//
// ⚠ AND IT IS ITS OWN ROUTE, NOT A MODE ON THE TEAM PAGE. 25-N §6's design says the same and
// the argument survives the holding page: a `?public=1` flag on a page that already renders
// privileged material is one forgotten conditional away from publishing it, and the conditional
// will be forgotten. Building the holding page HERE means the real view replaces this file
// rather than adding a branch to a page that must never leak.
//
// ⚠ ACCESS: OWNER OR COLLABORATOR, exactly as the team page. It is a PREVIEW of what the public
// will see, shown to the people who own the idea — not a public URL. A genuinely public route
// is `/proposals/[token]`, which reads a published VERSION and is unchanged by this.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * §2's line, verbatim, and exported so a check can assert it without rendering.
 *
 * ⚠ IT SAYS WHAT THIS PAGE IS *AND* WHAT THE READER IS LOOKING AT INSTEAD. "Coming soon" on its
 * own leaves a tester unable to answer the question they came with — *what do other people
 * see?* — and the honest answer today is "what your team sees", which is a real answer.
 */
export const PUBLIC_VIEW_HOLDING_LINE =
  'The public view is being built. This is what your team sees today; the version the public '
  + 'will see is coming.'

export default async function PublicViewHoldingPage({ params }: Props) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) redirect(`/sign-in?redirect_url=/ideas/${id}/public`)

  const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } })
  if (!me) notFound()

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: {
      id: true, title: true, summaryDescription: true,
      creatorId: true, deletedAt: true,
      collaborators: { select: { userId: true } },
    },
  })
  // ⚠ 404 RATHER THAN 403 ON A DELETED OR FOREIGN IDEA. To the caller it does not exist, and a
  // 403 would confirm that it does to anyone probing ids — the same rule `authorizeIdea` keeps.
  if (!idea || idea.deletedAt) notFound()
  const mine = idea.creatorId === me.id || idea.collaborators.some((c) => c.userId === me.id)
  if (!mine) notFound()

  const title = idea.title?.trim() && idea.title.trim() !== 'Untitled idea' ? idea.title.trim() : null
  const summary = idea.summaryDescription?.trim() || null

  return (
    <>
      <PublicNav />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          The public view
        </p>

        {/* ⚠ THE TITLE AND SUMMARY ARE THE IDEA'S OWN, AND AN ABSENCE IS STATED. A blank where
            the title goes reads as a page that failed to load; "you have not named it yet" is
            a fact the user can act on, and it is the same never-claim rule the rest of the
            product keeps. */}
        <h1 className="text-2xl font-semibold text-zinc-900 mt-1">
          {title ?? <span className="text-zinc-400">You have not named this idea yet</span>}
        </h1>
        <p className="text-sm text-zinc-700 leading-relaxed mt-3">
          {summary ?? (
            <span className="text-zinc-400">
              There is no summary on this idea yet — the public view will open on one.
            </span>
          )}
        </p>

        <div className="mt-8 rounded-2xl border-2 border-zinc-300 bg-zinc-50/70 p-4">
          <p className="text-sm text-zinc-800">{PUBLIC_VIEW_HOLDING_LINE}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/ideas/${idea.id}`}
            className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90"
          >
            See what your team sees
          </Link>
          <Link
            href={`/ideas/create?ideaId=${idea.id}`}
            className="text-sm font-medium px-4 py-2 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          >
            Back to your draft
          </Link>
        </div>
      </main>
    </>
  )
}
