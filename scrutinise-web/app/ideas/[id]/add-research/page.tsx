// 26-R §3 — where the BOOKMARKLET lands: "Add research" with the page the user was reading filled in (address, title, selected text).
// Signs in first (and comes back with the details intact), checks the user may add to this idea, and shows ONLY the form — this is
// a small window opened from another site, not the workspace.

import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readBookmarkletParams } from '@/lib/lex/bookmarklet'
import AddResearchWindow from './AddResearchWindow'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AddResearchPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const { userId } = await auth()
  if (!userId) {
    const back = `/ideas/${id}/add-research?${new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v] as [string, string]] : []))).toString()}`
    redirect(`/sign-in?redirect_url=${encodeURIComponent(back)}`)
  }
  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } })
  if (!user) notFound()
  const idea = await prisma.idea.findFirst({
    where: { id, deletedAt: null, OR: [{ creatorId: user.id }, { collaborators: { some: { userId: user.id } } }] },
    select: { id: true, title: true },
  })
  // 404, not 403: to someone who may not add to it, the idea does not exist (as authorizeIdea does).
  if (!idea) notFound()
  return <AddResearchWindow ideaId={idea.id} ideaTitle={idea.title} initial={readBookmarkletParams(sp)} />
}
