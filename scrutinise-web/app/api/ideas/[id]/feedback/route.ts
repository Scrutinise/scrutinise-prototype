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
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import { sendLexFeedbackEmail } from '@/lib/email'
import {
  scrubPersonal,
  summariseCritique,
  FEEDBACK_SURFACES,
  type FeedbackSurfaceKey,
} from '@/lib/lex/feedback'

type Params = { params: Promise<{ id: string }> }

const SurfaceSchema = z.enum(FEEDBACK_SURFACES as [FeedbackSurfaceKey, ...FeedbackSurfaceKey[]])

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('summarise'),
    text: z.string().trim().min(1).max(4000),
    surface: SurfaceSchema.default('OTHER'),
    stage: z.string().trim().max(64).default('ORIENTATION'),
  }),
  z.object({
    action: z.literal('submit'),
    originalText: z.string().trim().min(1).max(4000),
    summarisedText: z.string().trim().min(1).max(2000),
    surface: SurfaceSchema.default('OTHER'),
    stage: z.string().trim().max(64).default('ORIENTATION'),
    userEdited: z.boolean().default(false),
  }),
])

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz

  if (!checkRateLimit(`feedback:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 20 feedback actions per hour.' }, { status: 429 })
  }

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const body = parsed.data

  // The user's own identifiers — the one category of personal content we can name
  // exactly, so we hand it to the scrubber rather than hoping the model spots it.
  const identities = [user.name, user.firstName, user.lastName, user.preferredName, user.username, user.email]

  // ── summarise: nothing is written, nothing is sent ─────────────────────────
  if (body.action === 'summarise') {
    const result = await summariseCritique({
      text: body.text,
      surface: body.surface,
      stage: body.stage,
      identities,
    })
    return NextResponse.json({
      summarisedText: result.summarisedText,
      redactions: result.redactions,
      usedFallback: result.usedFallback,
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
  if (rescrub.text !== body.summarisedText) {
    return NextResponse.json(
      {
        error: 'personal_content_found',
        message: 'That version still had personal details in it, so nothing has been sent. Here it is with them removed — send this instead?',
        summarisedText: rescrub.text,
        redactions: rescrub.redactions,
        stored: false,
        sent: false,
      },
      { status: 409 },
    )
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
