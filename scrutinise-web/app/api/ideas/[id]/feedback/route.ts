// ─────────────────────────────────────────────────────────────────────────────
// §20.5 — feedback capture. Two actions, and the split is the whole point:
//
//   summarise → produces the text and STORES NOTHING. The user sees exactly what
//               would be sent before deciding.
//   submit    → only reached after an explicit Yes. Persists FIRST, then sends.
//
// A mail failure must not lose the record, so the send is attempted after the row
// exists and its failure is written back onto that row. The response says plainly
// what happened so Lex never claims a send that did not occur (§19-C 1b).
//
// 8 Oct 2026 (Charlie's walkthrough, item 4):
//   · BUG_REPORT is a surface of its own, and for it the model summary is SKIPPED: the user's words (scrubbed) and the technical
//     detail (sanitised, never paraphrased) are what is shown, stored and emailed;
//   · a report may carry up to three files (uploaded at Yes, via ./attachment — nothing is stored before the Yes);
//   · DECISION 137 — the person is "User 435" in the summary and the email, never "the user".
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { sendLexFeedbackEmail } from '@/lib/email'
import { describeIssues } from '@/lib/api-rejection'
import {
  scrubPersonal,
  summariseCritique,
  FEEDBACK_SURFACES,
  type FeedbackSurfaceKey,
} from '@/lib/lex/feedback'
import { FEEDBACK_ATTACHMENT_MAX_FILES, userRefLabel, type FeedbackAttachment } from '@/lib/lex/feedback-types'
import { sanitiseTechnicalDetail } from '@/lib/lex/feedback-technical'

type Params = { params: Promise<{ id: string }> }

const SurfaceSchema = z.enum(FEEDBACK_SURFACES as [FeedbackSurfaceKey, ...FeedbackSurfaceKey[]])
const Detail = z.record(z.string(), z.unknown()).optional()
const AttachmentMeta = z.object({
  key: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  bytes: z.number().int().min(0).max(20 * 1024 * 1024),
})

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('summarise'),
    text: z.string().trim().min(1).max(4000),
    surface: SurfaceSchema.default('OTHER'),
    stage: z.string().trim().max(64).default('ORIENTATION'),
    technicalDetail: Detail,
  }),
  z.object({
    action: z.literal('submit'),
    originalText: z.string().trim().min(1).max(4000),
    summarisedText: z.string().trim().min(1).max(2000),
    surface: SurfaceSchema.default('OTHER'),
    stage: z.string().trim().max(64).default('ORIENTATION'),
    userEdited: z.boolean().default(false),
    technicalDetail: Detail,
    attachments: z.array(AttachmentMeta).max(FEEDBACK_ATTACHMENT_MAX_FILES).optional(),
  }),
])

const WORDS: Record<string, string> = {
  text: 'what you wrote', originalText: 'what you wrote', summarisedText: 'the text to be sent', surface: 'what this is about',
  stage: 'the stage', technicalDetail: 'the technical detail', attachments: 'the attached files', userEdited: 'the edit flag',
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend
  const { user, idea } = authz

  if (!checkRateLimit(`feedback:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 20 feedback actions per hour.' }, { status: 429 })
  }

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'The feedback form sent something the server could not read (the body was not JSON). Nothing has been sent.' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    // CLAUDE.md §30 — name the input and the reason.
    const { message, rejected } = describeIssues(parsed.error.issues, { action: 'Sending feedback', labels: WORDS })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const body = parsed.data

  // The user's own identifiers — the one category of personal content we can name
  // exactly, so we hand it to the scrubber rather than hoping the model spots it.
  const identities = [user.name, user.firstName, user.lastName, user.preferredName, user.username, user.email]
  // DECISION 137 — a stable pseudonymous reference, so repeat reports connect without naming anyone.
  const userRef = userRefLabel((user as { feedbackRef?: number | null }).feedbackRef)

  // ── summarise: nothing is written, nothing is sent ─────────────────────────
  if (body.action === 'summarise') {
    const result = await summariseCritique({
      text: body.text,
      surface: body.surface,
      stage: body.stage,
      identities,
      userRef,
    })
    // The technical detail is sanitised HERE and handed back, so what the user sees is what will be stored and sent.
    const tech = body.surface === 'BUG_REPORT' && body.technicalDetail ? sanitiseTechnicalDetail(body.technicalDetail, identities) : null
    return NextResponse.json({
      summarisedText: result.summarisedText,
      redactions: [...result.redactions, ...(tech?.redactions ?? [])],
      usedFallback: result.usedFallback,
      verbatim: Boolean(result.verbatim),
      technicalDetail: tech?.detail ?? null,
      userRef,
      stored: false,
      sent: false,
    })
  }

  // ── submit: an explicit Yes has happened ───────────────────────────────────
  // Between the summary being shown and this call there is an editable text box,
  // so the text is scrubbed AGAIN here. If that changes anything, the user is
  // shown the corrected text and asked once more — we neither send personal
  // content nor silently send something different from what they approved.
  const rescrub = scrubPersonal(body.summarisedText, identities)
  const techOut = body.surface === 'BUG_REPORT' && body.technicalDetail ? sanitiseTechnicalDetail(body.technicalDetail, identities) : null
  const techChanged = !!techOut && JSON.stringify(techOut.detail) !== JSON.stringify(body.technicalDetail)
  if (rescrub.text !== body.summarisedText || techChanged) {
    return NextResponse.json(
      {
        error: 'personal_content_found',
        message: 'That version still had personal details in it, so nothing has been sent. Here it is with them removed — send this instead?',
        summarisedText: rescrub.text,
        technicalDetail: techOut?.detail ?? null,
        redactions: [...rescrub.redactions, ...(techOut?.redactions ?? [])],
        stored: false,
        sent: false,
      },
      { status: 409 },
    )
  }

  // Attachments may only be keys THIS user uploaded for THIS idea (./attachment) — never an arbitrary R2 key.
  const prefix = `_feedback/${idea.id}/${user.id}/`
  const attachments: FeedbackAttachment[] = (body.attachments ?? []).filter((a) => a.key.startsWith(prefix) && !a.key.includes('..'))
  if ((body.attachments ?? []).length !== attachments.length) {
    return NextResponse.json({ error: 'One of the attached files was not one you uploaded for this idea, so nothing has been sent.' }, { status: 422 })
  }

  // Persist FIRST. From here on the record exists whatever the mail server does.
  const item = await prisma.feedbackItem.create({
    data: {
      userId: user.id,
      ideaId: idea.id,
      stage: body.stage,
      surface: body.surface,
      // The raw wording is kept so the critique can be understood in context; it is
      // never emailed and never leaves the database.
      originalText: body.originalText,
      summarisedText: rescrub.text,
      userEdited: body.userEdited,
      consentGiven: true,
      technicalDetail: (techOut?.detail ?? undefined) as never,
      attachments: (attachments.length ? attachments : undefined) as never,
    },
    select: { id: true },
  })

  let sent = false
  let sendError: string | null = null
  try {
    await sendLexFeedbackEmail({
      feedbackItemId: item.id,
      stage: body.stage,
      surface: body.surface,
      summarisedText: rescrub.text,
      userEdited: body.userEdited,
      ideaTitle: idea.title,
      ideaId: idea.id,
      userRef,
      technicalDetail: techOut?.detail ?? null,
      attachments,
    })
    sent = true
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
    console.error('[lex-feedback] stored but not sent', { feedbackItemId: item.id, error: sendError })
  }

  await prisma.feedbackItem.update({
    where: { id: item.id },
    data: sent ? { sentAt: new Date() } : { sendError: sendError?.slice(0, 500) ?? 'unknown send failure' },
  })

  return NextResponse.json({
    feedbackItemId: item.id,
    stored: true,
    sent,
    // Lex says exactly this, and nothing more optimistic than this.
    message: sent
      ? 'Thank you — that has been saved and passed to the Scrutinise team.'
      : 'Thank you — that has been saved. The email to the team did not go through, so it has been logged for them to pick up rather than sent just now.',
  })
}
