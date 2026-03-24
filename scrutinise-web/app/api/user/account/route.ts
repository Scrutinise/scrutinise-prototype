import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.co.uk'
const FROM = 'Scrutinise <noreply@scrutinise.org>'

export async function DELETE() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  // 30-day grace period
  const now = new Date()
  const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: 'DELETION_PENDING',
      deletionRequestedAt: now,
      deletionScheduledFor: scheduledFor,
    },
  })

  // Send confirmation email if RESEND_API_KEY is set
  if (process.env.RESEND_API_KEY) {
    const formattedDate = scheduledFor.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const unsubUrl = `${APP_URL}/unsubscribe/${user.unsubscribeToken}`

    const text = `
Hi ${user.firstName},

Your account deletion has been requested. Your data will be permanently deleted on ${formattedDate}.

To cancel, simply log back in to Scrutinise before that date. Your account will be automatically restored.

If you did not make this request, log in immediately and contact us at hello@scrutinise.org.

---
Scrutinise — ${APP_URL}
Unsubscribe: ${unsubUrl}
`.trim()

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">Account deletion requested</h2>
  <p>Hi ${user.firstName},</p>
  <p>Your account deletion has been requested. Your data will be permanently deleted on <strong>${formattedDate}</strong>.</p>
  <p>To cancel, simply log back in to Scrutinise before that date. Your account will be automatically restored.</p>
  <p style="color: #dc2626; font-size: 14px;">If you did not make this request, log in immediately and contact us at hello@scrutinise.org.</p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #71717a; font-size: 12px;">
    Scrutinise — <a href="${APP_URL}">${APP_URL}</a><br/>
    <a href="${unsubUrl}" style="color: #71717a;">Unsubscribe</a>
  </p>
</body>
</html>
`.trim()

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: user.email,
        subject: 'Your Scrutinise account deletion has been requested',
        html,
        text,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({
    message: 'Account deletion scheduled.',
    scheduledFor: scheduledFor.toISOString(),
  })
}
