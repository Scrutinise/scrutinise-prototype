import { prisma } from './prisma'
import { PILOT_WELCOME_LINE } from './lex/beta-disclosure'

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

${PILOT_WELCOME_LINE}

Accept your invitation: ${url}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 16px;">Welcome to Scrutinise</h1>
  <p>You've been invited${invitedByName ? ` by <strong>${invitedByName}</strong>` : ''} to join Scrutinise — a community dedicated to bringing high standards of quality to policy development and scrutiny of legislation.</p>
  <p>This invite is locked to <strong>${email}</strong> and expires in 14 days.</p>
  <!-- ⚠ 25-V §11d — Charlie's wording, verbatim. It ASKS FOR SOMETHING rather than warning about
       something, which is what stops it reading as a disclaimer: a rough edge the user reports is
       a contribution, and the same rough edge unannounced is a disappointment. -->
  <p style="border-left: 3px solid #a1a1aa; padding-left: 12px; color: #3f3f46;">${PILOT_WELCOME_LINE}</p>
  <p style="margin: 32px 0;">
    <a href="${url}" style="background: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Accept invitation</a>
  </p>
  <p style="color: #71717a; font-size: 13px;">Or paste this link into your browser:<br/>${url}</p>
</body>
</html>
`.trim()

  await sendEmail({ to: email, subject, html, text })
}

/**
 * Central — a Community/branch invitation tied to an email address.
 *
 * Returns a RESULT instead of throwing or returning quietly. `sendEmail` goes
 * silent when there is no API key and when the address is suppressed, which for
 * an invite is the worst of both worlds: the invite row is already created and
 * valid, so a throw would lose it, while a quiet return would let the panel tell
 * an admin their invitation was emailed when nothing left the building. The
 * caller reports what actually happened and keeps the copy-link panel either
 * way — email delivery is never guaranteed (Stage 1.2 brief, item 8).
 */
export async function sendCommunityInviteEmail({
  toEmail,
  invitedByName,
  communityName,
  isBranch,
  rootName,
  inviteCode,
}: {
  toEmail: string
  invitedByName: string
  communityName: string
  isBranch: boolean
  rootName: string
  inviteCode: string
}): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'Email is not configured on this deployment — send them the link yourself.' }
  }
  if (await isEmailSuppressed(toEmail)) {
    return { sent: false, reason: `${toEmail} has unsubscribed — send them the link yourself.` }
  }

  const inviteUrl = `${APP_URL}/community-invite/${inviteCode}`
  const unsubscribeUrl = `${APP_URL}/unsubscribe/${Buffer.from(toEmail).toString('base64')}`
  const where = isBranch ? `${communityName}, a branch of ${rootName},` : communityName

  const subject = `${invitedByName} has invited you to join ${communityName} on Scrutinise`

  const text = `
${invitedByName} has invited you to join ${where} on Scrutinise Central.

Open the invitation:
${inviteUrl}

Central is where people organise, train, debate and run events. Joining a Community
does not give anyone access to your Ideas — those stay governed by their own permissions.

---
If you don't want to receive these emails, unsubscribe here: ${unsubscribeUrl}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <p style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #a1a1aa;">Scrutinise Central</p>
  <h2 style="font-size: 18px; font-weight: 600;">You've been invited to join ${communityName}</h2>
  <p><strong>${invitedByName}</strong> has invited you to join ${where} on Scrutinise.</p>
  <p>
    <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Open the invitation →
    </a>
  </p>
  <p style="color: #71717a; font-size: 12px;">Or paste this link into your browser:<br/>${inviteUrl}</p>
  <p style="color: #71717a; font-size: 12px;">
    Joining a Community does not give anyone access to your Ideas — those stay governed by their own permissions.
  </p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #71717a; font-size: 12px;">
    Scrutinise is a not-for-profit civic technology platform.<br/>
    <a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
  </p>
</body>
</html>
`.trim()

  try {
    await sendEmail({ to: toEmail, subject, html, text })
    return { sent: true }
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'The email could not be sent.' }
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// §20.5 — a Lex critique the user consented to pass back. The body carries ONLY
// `summarisedText` (what the user saw and approved); their raw wording never
// leaves the database. This THROWS on failure by design: the caller has already
// stored the record and records the failure against it, so the record survives a
// mail outage and Lex can report honestly that the send did not happen.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendLexFeedbackEmail({
  feedbackItemId,
  stage,
  surface,
  summarisedText,
  userEdited,
  ideaTitle,
  ideaId,
}: {
  feedbackItemId: string
  stage: string
  surface: string
  summarisedText: string
  userEdited: boolean
  ideaTitle: string
  ideaId: string
}): Promise<void> {
  const adminEmail = 'cl@scrutinise.org'

  // `sendEmail` returns quietly when there is no API key and when the address is
  // suppressed. For every other caller that is the right behaviour; here it is
  // not — a quiet return would let the caller record a send that never happened
  // and let Lex tell the user their feedback had been passed on. Both cases are
  // turned into failures so the record carries the truth (§19-C 1b).
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not set — feedback email was not attempted')
  }
  if (await isEmailSuppressed(adminEmail)) {
    throw new Error(`${adminEmail} is on the suppression list — feedback email was not sent`)
  }

  const subject = `[Lex feedback] ${stage} · ${surface}`
  const escaped = summarisedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const text = `
A user has passed back feedback on Lex's output, with consent.

Stage:   ${stage}
Surface: ${surface}
Idea:    ${ideaTitle}
Edited by the user before sending: ${userEdited ? 'yes' : 'no'}

What they said (summarised, personal content stripped):
${summarisedText}

---
FeedbackItem: ${feedbackItemId}
Idea: ${APP_URL}/ideas/${ideaId}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">Lex feedback</h2>
  <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
    <tr><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px; font-weight: 600; width: 110px;">Stage</td><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px;">${stage}</td></tr>
    <tr><td style="padding: 6px 12px; font-size: 13px; font-weight: 600;">Surface</td><td style="padding: 6px 12px; font-size: 13px;">${surface}</td></tr>
    <tr><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px; font-weight: 600;">Idea</td><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px;">${ideaTitle}</td></tr>
    <tr><td style="padding: 6px 12px; font-size: 13px; font-weight: 600;">User edited</td><td style="padding: 6px 12px; font-size: 13px;">${userEdited ? 'yes' : 'no'}</td></tr>
  </table>
  <p style="font-size: 13px; font-weight: 600;">Summarised, personal content stripped:</p>
  <p style="font-size: 13px; white-space: pre-wrap; padding: 12px; background: #f9f9f9; border-radius: 4px;">${escaped}</p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #71717a; font-size: 12px;">FeedbackItem: ${feedbackItemId} · <a href="${APP_URL}/ideas/${ideaId}">open the idea</a></p>
</body>
</html>
`.trim()

  await sendEmail({ to: adminEmail, subject, html, text })
}

/**
 * An expert correction to the published draft of "Reading legislation: a working
 * guide" (/support → Reading legislation).
 *
 * Loud on both quiet-failure cases, exactly like sendLexFeedbackEmail above: a
 * missing API key and a suppressed admin address both make `sendEmail` return
 * silently, and the caller writes `sentAt` on whatever it gets back. A correction
 * from counsel that nobody is told about is the failure worth designing against.
 *
 * `replyTo` is the expert's own address, so answering the notification answers THEM
 * — the form promises a reply and this is what makes that one click rather than a
 * copy-paste.
 */
export async function sendLegislationGuideSuggestionEmail({
  suggestionId,
  name,
  email,
  credentials,
  sectionTitle,
  suggestion,
}: {
  suggestionId: string
  name: string
  email: string
  credentials?: string | null
  sectionTitle: string
  suggestion: string
}): Promise<void> {
  const adminEmail = 'cl@scrutinise.org'

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not set — the suggestion email was not attempted')
  }
  if (await isEmailSuppressed(adminEmail)) {
    throw new Error(`${adminEmail} is on the suppression list — the suggestion email was not sent`)
  }

  // Every one of these is a stranger's free text going into an HTML document.
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const subject = `[Legislation guide] ${sectionTitle}`

  const text = `
Someone has suggested an improvement to "Reading legislation: a working guide".

From:    ${name} <${email}>
${credentials ? `Role:    ${credentials}\n` : ''}Section: ${sectionTitle}

Their suggestion:
${suggestion}

---
Suggestion ID: ${suggestionId}
Reply to this email to answer them directly.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 18px; font-weight: 600;">Suggested improvement — legislation guide</h2>
  <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
    <tr><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px; font-weight: 600; width: 90px;">From</td><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px;">${esc(name)} &lt;${esc(email)}&gt;</td></tr>
    ${credentials ? `<tr><td style="padding: 6px 12px; font-size: 13px; font-weight: 600;">Role</td><td style="padding: 6px 12px; font-size: 13px;">${esc(credentials)}</td></tr>` : ''}
    <tr><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px; font-weight: 600;">Section</td><td style="padding: 6px 12px; background: #f4f4f5; font-size: 13px;">${esc(sectionTitle)}</td></tr>
  </table>
  <p style="font-size: 13px; font-weight: 600;">Their suggestion:</p>
  <p style="font-size: 13px; white-space: pre-wrap; padding: 12px; background: #f9f9f9; border-radius: 4px;">${esc(suggestion)}</p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #71717a; font-size: 12px;">Suggestion ID: ${suggestionId} · reply to this email to answer them directly.</p>
</body>
</html>
`.trim()

  await sendEmail({ to: adminEmail, subject, html, text, replyTo: email })
}

/**
 * Central — a Community admin's broadcast to every branch manager.
 *
 * Returns a RESULT rather than throwing or going quiet, for the same reason as
 * sendCommunityInviteEmail: the notification has already been written, so a
 * throw would abort the rest of the run, while a silent return would let the
 * composer report "sent to 6 managers" when nothing left the building. The
 * caller counts successes and lists the failures by name.
 */
export async function sendBranchManagerBroadcastEmail({
  toEmail,
  toName,
  fromName,
  communityName,
  communityId,
  subject,
  message,
}: {
  toEmail: string
  toName: string
  fromName: string
  communityName: string
  communityId: string
  subject: string
  message: string
}): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'email not configured on this deployment' }
  }
  if (await isEmailSuppressed(toEmail)) {
    return { sent: false, reason: 'has unsubscribed' }
  }

  const url = `${APP_URL}/communities/${communityId}`
  const unsubscribeUrl = `${APP_URL}/unsubscribe/${Buffer.from(toEmail).toString('base64')}`
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const text = `
Hi ${toName},

${fromName} has sent this to every branch manager in ${communityName}:

${message}

Open ${communityName}: ${url}

---
If you don't want to receive these emails, unsubscribe here: ${unsubscribeUrl}
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <p style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #a1a1aa;">Scrutinise Central · ${communityName}</p>
  <h2 style="font-size: 18px; font-weight: 600;">${subject}</h2>
  <p style="color: #71717a; font-size: 13px;">From ${fromName}, to every branch manager.</p>
  <p style="white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escaped}</p>
  <p><a href="${url}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Open ${communityName}</a></p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #71717a; font-size: 12px;">
    Scrutinise is a not-for-profit civic technology platform.<br/>
    <a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
  </p>
</body>
</html>
`.trim()

  try {
    await sendEmail({ to: toEmail, subject: `[${communityName}] ${subject}`, html, text })
    return { sent: true }
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'send failed' }
  }
}

/**
 * AMENDMENT_25B §C4 — "email me when it's done".
 *
 * ⚠ SENT ONLY WHEN THE USER ASKED FOR IT ON THIS BUILD. The flag lives on the IdeaBuild
 * row, frozen at enqueue, so a preference changed in another tab afterwards cannot make
 * this send retroactive — and `sendEmail` still checks EmailSuppression, which remains
 * the authority on whether we may write to the address at all (docs/CLAUDE.md §7 item 8).
 *
 * ⚠ A FAILED BUILD EMAILS TOO. Only telling people about success is how someone waits ten
 * minutes for something that stopped after two — the whole point of the notification is
 * that they are not watching.
 */
export async function sendBuildCompleteEmail({
  toEmail,
  toName,
  ideaId,
  ideaTitle,
  status,
  durationText,
  failureReason,
}: {
  toEmail: string
  toName: string | null
  ideaId: string
  ideaTitle: string
  status: 'DONE' | 'FAILED' | 'CANCELLED'
  durationText: string
  failureReason?: string | null
}): Promise<void> {
  const unsubscribeUrl = `${APP_URL}/unsubscribe/${Buffer.from(toEmail).toString('base64')}`
  const url = `${APP_URL}/ideas/create?ideaId=${ideaId}`
  const name = toName?.trim() || 'there'
  const title = ideaTitle?.trim() || 'your idea'

  const done = status === 'DONE'
  const subject = done
    ? `Your draft of “${title}” is ready`
    : `Your build of “${title}” stopped early`

  const opening = done
    ? `I've drafted, researched and revised ${title}. It took ${durationText}.`
    : status === 'CANCELLED'
      ? `You stopped the build of ${title} after ${durationText}. Everything it had drafted before that has been kept.`
      : `The build of ${title} stopped after ${durationText}. ${failureReason ?? ''} Whatever it drafted before stopping has been kept.`

  const text = [
    `Hello ${name},`,
    '',
    opening,
    '',
    `Read it here: ${url}`,
    '',
    'Nothing has been accepted on your behalf — everything is a proposal for you to keep, change or throw out.',
    '',
    `You asked to be emailed when this finished. To stop these, unsubscribe here: ${unsubscribeUrl}`,
  ].join('\n')

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #18181b;">
      <p>Hello ${name},</p>
      <p>${opening}</p>
      <p><a href="${url}" style="display:inline-block; background:#18181b; color:#fff; padding:10px 18px; border-radius:9999px; text-decoration:none;">Read it</a></p>
      <p style="color:#52525b; font-size: 14px;">Nothing has been accepted on your behalf — everything is a proposal for you to keep, change or throw out.</p>
      <hr style="border:none; border-top:1px solid #e4e4e7; margin: 24px 0;" />
      <p style="color:#71717a; font-size:12px;">
        You asked to be emailed when this finished.
        <a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
      </p>
    </div>
  `

  await sendEmail({ to: toEmail, subject, html, text })
}
