import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { sendFeedbackAdminEmail } from '@/lib/email'

const FeedbackSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  feedbackType: z.enum(['feature', 'bug', 'general', 'support']).optional(),
  email: z.string().email(),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { subject, message, feedbackType, email } = parsed.data

  // Resolve user if signed in
  const { userId: clerkId } = await auth()
  let userId: string | null = null
  let userName: string | null = null

  if (clerkId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, name: true },
    })
    if (dbUser) {
      userId = dbUser.id
      userName = dbUser.name
    }
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: userId ?? undefined,
      email,
      subject,
      message,
      feedbackType: feedbackType ?? null,
    },
  })

  // Fire-and-forget — don't fail the request if email fails
  sendFeedbackAdminEmail({
    feedbackId: feedback.id,
    subject,
    message,
    feedbackType,
    fromEmail: email,
    fromName: userName,
  }).catch(err => console.error('[feedback] Admin email failed:', err))

  return NextResponse.json({ ok: true }, { status: 201 })
}
