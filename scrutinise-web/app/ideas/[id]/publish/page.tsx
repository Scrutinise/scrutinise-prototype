// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-B/D — the owner's publish page.
//
// Owner-only, and the check is here as well as in the API: a collaborator may
// read and render, but sending something out of the building under the owner's
// name is the owner's act (§20.3, "user-chosen").
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import PublishPanel from '@/components/documents/PublishPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PublishProposalPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/ideas/${id}/publish`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/ideas/${id}/publish`)

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: { id: true, title: true, creatorId: true, deletedAt: true },
  })
  if (!idea || idea.deletedAt) notFound()
  // 404 rather than 403: to a non-owner this page does not exist, and 403 would
  // confirm the idea does to anyone probing ids.
  if (idea.creatorId !== user.id) notFound()

  return (
    <>
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-xs text-zinc-500 mb-1">
          <a href={`/ideas/${id}`} className="hover:underline">← {idea.title}</a>
        </p>
        <h1 className="text-xl font-semibold text-zinc-900 mb-1">Publish this proposal</h1>
        <p className="text-sm text-zinc-600 mb-6">
          Everything the platform has built so far is an input. This is where it becomes something an
          MP, an adviser or a committee clerk can be sent.
        </p>
        <PublishPanel ideaId={id} />
      </main>
    </>
  )
}
