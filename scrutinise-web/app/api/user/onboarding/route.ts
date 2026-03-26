import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const EXPERIENCE_LEVELS = [
  'NO_BACKGROUND',
  'SECTOR_LIVED',
  'THINK_TANK_JUNIOR',
  'THINK_TANK_SENIOR',
  'POLITICAL_JUNIOR',
  'POLITICAL_SENIOR',
  'PARLIAMENTARIAN',
] as const

const OnboardingSchema = z.object({
  preferredName: z.string().min(1).max(50).optional(),
  ageConfirmed: z.literal(true, { message: 'Age confirmation is required' }).optional(),
  tcAgreed: z.literal(true, { message: 'Terms agreement is required' }).optional(),
  rulesAgreed: z.literal(true, { message: 'Community rules agreement is required' }).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
})

// Full onboarding schema (all required fields for first-time onboarding)
const FullOnboardingSchema = z.object({
  preferredName: z.string().min(1).max(50),
  ageConfirmed: z.literal(true, { message: 'Age confirmation is required' }),
  tcAgreed: z.literal(true, { message: 'Terms agreement is required' }),
  rulesAgreed: z.literal(true, { message: 'Community rules agreement is required' }),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
})

// GET — return current user's profile fields (used by settings page)
export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  return NextResponse.json({
    preferredName: user.preferredName,
    experienceLevel: user.experienceLevel,
  })
}

export async function PATCH(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Detect full onboarding submission vs profile update
  const isFullOnboarding = (body as Record<string, unknown>)?.ageConfirmed === true

  if (isFullOnboarding) {
    const parsed = FullOnboardingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const { preferredName, tcAgreed, rulesAgreed, experienceLevel } = parsed.data
    const now = new Date()

    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferredName,
        ageConfirmed: true,
        tcAgreedAt: tcAgreed ? now : undefined,
        rulesAgreedAt: rulesAgreed ? now : undefined,
        tcVersion: tcAgreed ? '1.0' : undefined,
        experienceLevel,
      },
    })
  } else {
    // Profile update (e.g. from settings — experienceLevel only)
    const parsed = OnboardingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const { preferredName, experienceLevel } = parsed.data

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(preferredName !== undefined && { preferredName }),
        ...(experienceLevel !== undefined && { experienceLevel }),
      },
    })
  }

  return NextResponse.json({ ok: true })
}
