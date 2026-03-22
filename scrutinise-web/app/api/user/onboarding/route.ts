import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const OnboardingSchema = z.object({
  preferredName: z.string().min(1).max(50),
  ageConfirmed: z.literal(true, { message: 'Age confirmation is required' }),
  tcAgreed: z.literal(true, { message: 'Terms agreement is required' }),
  rulesAgreed: z.literal(true, { message: 'Community rules agreement is required' }),
})

export async function PATCH(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { preferredName, tcAgreed, rulesAgreed } = parsed.data
  const now = new Date()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      preferredName,
      ageConfirmed: true,
      tcAgreedAt: tcAgreed ? now : undefined,
      rulesAgreedAt: rulesAgreed ? now : undefined,
      tcVersion: tcAgreed ? '1.0' : undefined,
    },
  })

  return NextResponse.json({ ok: true })
}
