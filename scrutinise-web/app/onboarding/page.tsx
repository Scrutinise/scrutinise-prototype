import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import OnboardingForm from './OnboardingForm'

interface Props {
  searchParams: Promise<{ redirect_url?: string; from?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const { userId } = await auth()
  const params = await searchParams

  // Not signed in — redirect to sign-in, preserving the original redirect_url
  if (!userId) {
    const dest = params.redirect_url
      ? `/sign-in?redirect_url=${encodeURIComponent(params.redirect_url)}`
      : '/sign-in?redirect_url=/onboarding'
    redirect(dest)
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { ageConfirmed: true, experienceLevel: true },
  })

  // Fully onboarded (both ageConfirmed and experienceLevel set) — skip ahead
  if (dbUser?.ageConfirmed && dbUser.experienceLevel) {
    redirect(params.redirect_url ?? '/dashboard')
  }

  // Existing user who completed original onboarding but hasn't set experienceLevel
  const promptOnly = !!(dbUser?.ageConfirmed && !dbUser.experienceLevel)
  const fromCreate = params.from === 'create'

  return (
    <OnboardingForm
      redirectUrl={params.redirect_url}
      promptOnly={promptOnly}
      fromCreate={fromCreate}
    />
  )
}
