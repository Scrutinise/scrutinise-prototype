// SPRINT 25-A — the minimum-elicitation entry point.
//
// ⚠ A NEW ROUTE, NOT A REPLACEMENT (§0). `/ideas/create` is untouched and remains the
// way an idea is built today; this is the §25 path — the user decides, Lex writes —
// and it exists alongside it so Charlie can judge the premise against the real thing.
// When the build finishes, this hands off to `/ideas/create?ideaId=…`, so the kernel is
// presented in the existing panel exactly as §5 asks.
//
// Onboarding redirects mirror `/ideas/create` deliberately: a user who lands here
// without an age confirmation or an experience level must go through the same gate, and
// duplicating the two checks is cheaper than a shared helper that would have to be
// imported into a page another thread is editing this week.

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BuildIdeaClient from './BuildIdeaClient'

interface Props {
  searchParams: Promise<{ ideaId?: string }>
}

export default async function BuildIdeaPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/ideas/build')

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, ageConfirmed: true, experienceLevel: true },
  })
  if (dbUser && !dbUser.ageConfirmed) redirect('/onboarding?redirect_url=/ideas/build')
  if (dbUser?.ageConfirmed && !dbUser.experienceLevel) redirect('/onboarding?redirect_url=/ideas/build&from=create')

  const params = await searchParams
  let initialIdeaId: string | undefined
  if (params.ideaId && dbUser) {
    const existing = await prisma.idea.findUnique({
      where: { id: params.ideaId, creatorId: dbUser.id },
      select: { id: true, deletedAt: true },
    })
    if (existing && !existing.deletedAt) initialIdeaId = existing.id
  }

  return <BuildIdeaClient initialIdeaId={initialIdeaId} />
}
