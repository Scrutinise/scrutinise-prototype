import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CreateIdeaClient from './CreateIdeaClient'

function getTimeOfDay(utcHour: number): string {
  if (utcHour >= 5 && utcHour < 12) return 'morning'
  if (utcHour >= 12 && utcHour < 18) return 'afternoon'
  return 'evening'
}

interface Props {
  searchParams: Promise<{ ideaId?: string }>
}

export default async function CreateIdeaPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/ideas/create')
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, preferredName: true, firstName: true, ageConfirmed: true, experienceLevel: true },
  })

  // Onboarding not completed — redirect to onboarding, then return here
  if (dbUser && !dbUser.ageConfirmed) {
    redirect('/onboarding?redirect_url=/ideas/create')
  }

  // Existing user who completed original onboarding but hasn't set experience level
  if (dbUser?.ageConfirmed && !dbUser.experienceLevel) {
    redirect('/onboarding?redirect_url=/ideas/create&from=create')
  }

  const params = await searchParams

  // Resume an existing idea session if ideaId param provided
  let initialIdeaId: string | undefined
  let initialMessages: unknown[] | undefined
  let initialStage: string | undefined

  if (params.ideaId && dbUser) {
    const existingIdea = await prisma.idea.findUnique({
      where: { id: params.ideaId, creatorId: dbUser.id },
      select: { id: true, aiChatHistory: true, stage: true },
    })
    if (existingIdea) {
      initialIdeaId = existingIdea.id
      initialMessages = Array.isArray(existingIdea.aiChatHistory)
        ? (existingIdea.aiChatHistory as unknown[])
        : undefined
      initialStage = existingIdea.stage
    }
  }

  let openingMessage: string
  let isFirstIdea = false

  if (!dbUser) {
    // JIT sync not yet run — fall back to default
    openingMessage = "I'm Lex, your researcher and guide. Before we start, would you like a quick guide to how this works, or do you want to dive straight in?"
    isFirstIdea = true
  } else {
    const ideaCount = await prisma.idea.count({ where: { creatorId: dbUser.id } })
    const name = dbUser.preferredName ?? dbUser.firstName ?? ''
    const hour = new Date().getUTCHours()
    const timeOfDay = getTimeOfDay(hour)

    if (ideaCount === 0) {
      isFirstIdea = true
      openingMessage = `Welcome ${name}, I'm Lex, your researcher and guide. Before we start, would you like a quick guide to how this works, or do you want to dive straight in?`
    } else {
      openingMessage = `Good ${timeOfDay} ${name}, I assume you know what you're doing, but just in case, the button below takes you on a short guided tour. What's the problem or challenge you want to address?`
    }
  }

  return (
    <CreateIdeaClient
      openingMessage={openingMessage}
      initialIdeaId={initialIdeaId}
      initialMessages={initialMessages}
      initialStage={initialStage}
      isFirstIdea={isFirstIdea}
    />
  )
}
