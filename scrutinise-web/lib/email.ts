import { prisma } from './prisma'

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM = 'Scrutinise <noreply@messages.scrutinise.org>'
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
  replyTo?: string
}

async function sendEmail({ to, subject, html, text, replyTo }: SendEmailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent to', to)
    return
  }

  const suppressed = await isEmailSuppressed(to)
  if (suppressed) {
    console.info(`Email suppressed for ${to} — not sent`)
    return
  }

  const body: Record<string, unknown> = { from: FROM, to, subject, html, text }
  if (replyTo) body.reply_to = replyTo

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const resBody = await res.text()
    throw new Error(`Resend error ${res.status}: ${resBody}`)
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

export async function sendSignUpInviteEmail(
  email: string,
  token: string,
  invitedByName?: string,
): Promise<void> {
  const url = `${APP_URL}/sign-up?invite=${token}`
  const subject = "You're invited to join Scrutinise"

  const text = `
You've been invited${invitedByName ? ` by ${invitedByName}` : ''} to join Scrutinise — a community dedicated to bringing high standards of quality to policy development and scrutiny of legislation.

This invite is locked to ${email} and expires in 14 days.

Accept your invitation: ${url}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 16px;">Welcome to Scrutinise</h1>
  <p>You've been invited${invitedByName ? ` by <strong>${invitedByName}</strong>` : ''} to join Scrutinise — a community dedicated to bringing high standards of quality to policy development and scrutiny of legislation.</p>
  <p>This invite is locked to <strong>${email}</strong> and expires in 14 days.</p>
  <p style="margin: 32px 0;">
    <a href="${url}" style="background: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Accept invitation</a>
  </p>
  <p style="color: #71717a; font-size: 13px;">Or paste this link into your browser:<br/>${url}</p>
</body>
</html>
`.trim()

  await sendEmail({ to: email, subject, html, text })
}

export async function sendContactFormEmail(
  fromEmail: string,
  fromName: string,
  message: string,
): Promise<void> {
  const adminEmail = 'cl@scrutinise.org'
  const subject = `Scrutinise contact: ${fromName}`

  const text = `From: ${fromName} <${fromEmail}>\n\n${message}`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">Contact form message</h2>
  <p><strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;</p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 16px 0;" />
  <p style="white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
</body>
</html>
`.trim()

  await sendEmail({ to: adminEmail, subject, html, text, replyTo: fromEmail })
}

export async function sendOwnershipTransferEmail({
  toEmail,
  toFirstName,
  fromOwnerName,
  ideaTitle,
  ideaId,
  token,
}: {
  toEmail: string
  toFirstName: string
  fromOwnerName: string
  ideaTitle: string
  ideaId: string
  token: string
}): Promise<void> {
  const acceptUrl = `${APP_URL}/ideas/${ideaId}/transfer/accept?token=${token}`
  const unsubscribeUrl = `${APP_URL}/unsubscribe/${Buffer.from(toEmail).toString('base64')}`

  const subject = `${fromOwnerName} wants to transfer ownership of "${ideaTitle}" to you`

  const text = `
Hi ${toFirstName},

${fromOwnerName} has offered to transfer full ownership of their Scrutinise idea to you:

"${ideaTitle}"

If you accept, you will become the owner of this idea. ${fromOwnerName} will become a collaborator.

Click the link below to accept. This offer expires in 48 hours.

${acceptUrl}

If you did not expect this, you can ignore this email.

---
If you don't want to receive these emails, unsubscribe here: ${unsubscribeUrl}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">Ownership transfer offer</h2>
  <p>Hi ${toFirstName},</p>
  <p><strong>${fromOwnerName}</strong> has offered to transfer full ownership of their Scrutinise idea to you:</p>
  <p style="font-size: 16px; font-weight: 600; padding: 12px; background: #f4f4f5; border-radius: 6px;">"${ideaTitle}"</p>
  <p>If you accept, you will become the owner. ${fromOwnerName} will become a collaborator.</p>
  <p>
    <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Accept ownership →
    </a>
  </p>
  <p style="color: #71717a; font-size: 12px;">This offer expires in 48 hours. If you did not expect this, you can ignore this email.</p>
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

export async function sendFeedbackAdminEmail({
  feedbackId,
  subject,
  message,
  feedbackType,
  fromEmail,
  fromName,
}: {
  feedbackId: string
  subject: string
  message: string
  feedbackType?: string | null
  fromEmail: string
  fromName?: string | null
}): Promise<void> {
  const adminEmail = 'cl@scrutinise.org'
  const typeLabel = feedbackType
    ? { feature: 'Feature suggestion', bug: 'Bug or problem', general: 'General comment', support: 'I need help with my account' }[feedbackType] ?? feedbackType
    : 'Not specified'

  const emailSubject = `[Scrutinise Feedback] ${subject}`

  const text = `
New feedback submission on Scrutinise.

From: ${fromName ?? 'Unknown'} <${fromEmail}>
Type: ${typeLabel}
Subject: ${subject}

Message:
${message}

---
Feedback ID: ${feedbackId}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">New Feedback</h2>
  <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
    <tr>
      <td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px; font-weight: 600; width: 80px;">From</td>
      <td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px;">${fromName ?? 'Unknown'} &lt;${fromEmail}&gt;</td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; font-size: 13px; font-weight: 600;">Type</td>
      <td style="padding: 6px 12px; font-size: 13px;">${typeLabel}</td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px; font-weight: 600;">Subject</td>
      <td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px;">${subject}</td>
    </tr>
  </table>
  <p style="font-size: 13px; font-weight: 600;">Message:</p>
  <p style="font-size: 13px; white-space: pre-wrap; padding: 12px; background: #f9f9f9; border-radius: 4px;">${message}</p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #71717a; font-size: 12px;">Feedback ID: ${feedbackId}</p>
</body>
</html>
`.trim()

  await sendEmail({ to: adminEmail, subject: emailSubject, html, text })
}

export async function sendInviteMismatchNotificationEmail({
  toEmail,
  toFirstName,
  originalName,
  signedUpName,
  signedUpEmail,
  ideaTitle,
}: {
  toEmail: string
  toFirstName: string
  originalName: string
  signedUpName: string
  signedUpEmail: string
  ideaTitle: string
}): Promise<void> {
  const unsubscribeUrl = `${APP_URL}/unsubscribe/${Buffer.from(toEmail).toString('base64')}`

  const subject = `Update: the person you invited to "${ideaTitle}" signed up with different details`

  const text = `
Hi ${toFirstName},

The person you invited to collaborate on "${ideaTitle}" as ${originalName} has signed up with different details:

Name: ${signedUpName}
Email: ${signedUpEmail}

They have been added to your team. Reply to this email if you have any concerns.

---
If you don't want to receive these emails, unsubscribe here: ${unsubscribeUrl}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">Your invited collaborator signed up</h2>
  <p>Hi ${toFirstName},</p>
  <p>The person you invited to collaborate on <strong>"${ideaTitle}"</strong> as <strong>${originalName}</strong> has signed up with different details:</p>
  <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
    <tr>
      <td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px; font-weight: 600; width: 80px;">Name</td>
      <td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px;">${signedUpName}</td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; font-size: 13px; font-weight: 600;">Email</td>
      <td style="padding: 6px 12px; font-size: 13px;">${signedUpEmail}</td>
    </tr>
  </table>
  <p>They have been added to your team. Reply to this email if you have any concerns.</p>
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
