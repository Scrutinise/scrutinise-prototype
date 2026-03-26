import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CreateIdeaClient from './CreateIdeaClient'

function getTimeOfDay(utcHour: number): string {
  if (utcHour >= 5 && utcHour < 12) return 'morning'
  if (utcHour >= 12 && utcHour < 18) return 'afternoon'
  return 'evening'
}

export default async function CreateIdeaPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/ideas/create')
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, preferredName: true, firstName: true, ageConfirmed: true },
  })

  // Onboarding not completed — redirect to onboarding, then return here
  if (dbUser && !dbUser.ageConfirmed) {
    redirect('/onboarding?redirect_url=/ideas/create')
  }

  let openingMessage: string

  if (!dbUser) {
    // JIT sync not yet run — fall back to default
    openingMessage = "I'm Lex, your researcher and guide. What's the challenge you want to fix?"
  } else {
    const ideaCount = await prisma.idea.count({ where: { creatorId: dbUser.id } })
    const name = dbUser.preferredName ?? dbUser.firstName ?? ''
    const hour = new Date().getUTCHours()
    const timeOfDay = getTimeOfDay(hour)

    if (ideaCount === 0) {
      openingMessage = `Welcome ${name}, I'm Lex, your researcher and guide. To get started with your idea, we should start with the causes. What is the challenge you want to overcome?`
    } else {
      openingMessage = `Good ${timeOfDay} ${name}, let's develop another idea. What is the challenge you want to overcome?`
    }
  }

  return <CreateIdeaClient openingMessage={openingMessage} />
}
