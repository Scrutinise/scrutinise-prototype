import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CreateIdeaClient from './CreateIdeaClient'
import { surfaceContext } from '@/lib/lex/surfaces'

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

  if (params.ideaId && dbUser) {
    const existingIdea = await prisma.idea.findUnique({
      where: { id: params.ideaId, creatorId: dbUser.id },
      select: { id: true, aiChatHistory: true },
    })
    if (existingIdea) {
      initialIdeaId = existingIdea.id
      initialMessages = Array.isArray(existingIdea.aiChatHistory)
        ? (existingIdea.aiChatHistory as unknown[])
        : undefined
    }
  }

  // §13 Task 5 — first idea: the full intro, then the first question as a SEPARATE
  // bubble immediately after. Verbatim. Returning users keep a short greeting.
  const FIRST_IDEA_INTRO =
    "I'm here to help you develop and build support for a credible proposal for your idea, ready for " +
    'Parliamentary colleagues. There are three panels here: this is the chat, where you can use me to help you ' +
    'develop your proposal; next to it is the proposal itself as you build it; and last is the legislative panel, ' +
    "where we'll place relevant legislation for review once we have enough information to source data that's " +
    'helpful. You can answer the questions here in the chat, or type directly into the form in the second panel ' +
    'if you don\'t need my help. For a quick introduction if you don\'t know what to do, click “How this works” above.'
  const FIRST_QUESTION = "What's the problem you want to fix?"

  let openingBubbles: string[]
  let isFirstIdea = false

  // Address the user by what they go by: preferredName, falling back to firstName.
  // (The preferred name is now seeded correctly per user, so "Charles" → "Charlie".)
  const displayName = dbUser?.preferredName?.trim() || dbUser?.firstName?.trim() || ''
  const ideaCount = dbUser ? await prisma.idea.count({ where: { creatorId: dbUser.id } }) : 0

  if (!dbUser || ideaCount === 0) {
    isFirstIdea = true
    openingBubbles = [FIRST_IDEA_INTRO, FIRST_QUESTION]
  } else {
    const timeOfDay = getTimeOfDay(new Date().getUTCHours())
    openingBubbles = [
      `Good ${timeOfDay}${displayName ? ' ' + displayName : ''}. ${FIRST_QUESTION} For a quick introduction if you don't know what to do, click “How this works” above.`,
    ]
  }

  // 25-G §2 — the route back to the build, when there is a build to go back to.
  const surface = initialIdeaId ? await surfaceContext(initialIdeaId, 'proposal') : null

  return (
    <CreateIdeaClient
      openingBubbles={openingBubbles}
      initialIdeaId={initialIdeaId}
      initialMessages={initialMessages}
      isFirstIdea={isFirstIdea}
      surface={surface}
    />
  )
}
