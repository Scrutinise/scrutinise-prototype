import { prisma } from './prisma'

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM = 'Scrutinise <hello@scrutinise.org>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.org'

/**
 * Check EmailSuppression before every send.
 * Returns true if the email is suppressed (do not send).
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const suppressed = await prisma.emailSuppression.findUnique({ where: { email } })
  return !!suppressed
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent to', to)
    return
  }

  const suppressed = await isEmailSuppressed(to)
  if (suppressed) {
    console.info(`Email suppressed for ${to} — not sent`)
    return
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}

export async function sendCollaboratorInviteEmail({
  toEmail,
  toFirstName,
  invitedByName,
  ideaTitle,
  magicLinkToken,
  customMessage,
}: {
  toEmail: string
  toFirstName: string
  invitedByName: string
  ideaTitle: string
  magicLinkToken: string
  customMessage?: string | null
}): Promise<void> {
  const inviteUrl = `${APP_URL}/invite/${magicLinkToken}`
  const unsubscribeUrl = `${APP_URL}/unsubscribe/${Buffer.from(toEmail).toString('base64')}`

  const subject = `${invitedByName} has invited you to collaborate on "${ideaTitle}"`

  const text = `
Hi ${toFirstName},

${invitedByName} has invited you to join them as a collaborator on their Scrutinise idea: "${ideaTitle}".
${customMessage ? `\n${invitedByName} says: "${customMessage}"\n` : ''}
Click the link below to accept the invitation and join the idea:
${inviteUrl}

This link expires in 7 days.

Scrutinise is a not-for-profit civic technology platform where citizens develop ideas into Parliament-ready legislation.

---
If you don't want to receive these emails, unsubscribe here: ${unsubscribeUrl}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">You've been invited to collaborate</h2>
  <p>Hi ${toFirstName},</p>
  <p><strong>${invitedByName}</strong> has invited you to join them as a collaborator on their Scrutinise idea:</p>
  <p style="font-size: 16px; font-weight: 600; padding: 12px; background: #f4f4f5; border-radius: 6px;">"${ideaTitle}"</p>
  ${customMessage ? `<p><em>"${customMessage}"</em></p>` : ''}
  <p>
    <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Accept invitation →
    </a>
  </p>
  <p style="color: #71717a; font-size: 12px;">This link expires in 7 days.</p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #71717a; font-size: 12px;">
    Scrutinise is a not-for-profit civic technology platform.<br/>
    <a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
  </p>
</body>
</html>
`.trim()

  await sendEmail({ to: toEmail, subject, html, text })
}
