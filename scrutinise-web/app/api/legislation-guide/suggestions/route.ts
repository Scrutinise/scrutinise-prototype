import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { sendLegislationGuideSuggestionEmail } from '@/lib/email'
import { SECTION_OPTIONS, sectionLabel } from '@/lib/reading-legislation-content'

// POST /api/legislation-guide/suggestions
//
// A correction to the published draft of "Reading legislation: a working guide".
//
// NO LOGIN. The people best placed to correct this — practising counsel, parliamentary
// draftsmen, academics — are the least likely to create an account first, and a sign-up
// wall would cost us exactly the corrections we most want. An EMAIL ADDRESS is required
// instead: a correction we cannot reply to is worth much less than one we can, and it
// is also the only accountability an anonymous form has.
//
// PERSIST THEN SEND (the §20.5 rule). The row is written first and the email attempted
// second, with the outcome recorded on the row. A mail failure then loses a notification
// and never a correction — and because `sendEmail` returns SILENTLY with no API key and
// on a suppressed address, the sender turns both into thrown errors so `sentAt` can
// never claim a send that did not happen.

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  // Self-declared and unverified — we say so on the form and in the record.
  credentials: z.string().trim().max(300).optional(),
  // Validated against the ONE section list the page renders from, so a suggestion can
  // never be filed against a section that does not exist.
  sectionKey: z.enum(SECTION_OPTIONS.map((o) => o.key) as [string, ...string[]]),
  suggestion: z.string().trim().min(10).max(10000),
})

/** SHA-256, never the raw address (security rule 6). Abuse triage only. */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex')
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const { name, email, credentials, sectionKey, suggestion } = parsed.data

  // Two limits, because they stop different things. The IP limit stops a flood from one
  // machine; the email limit stops the same person resubmitting the same correction
  // twenty times from a phone, a laptop and a train. Both are generous enough that a
  // reviewer working through the guide section by section is never blocked — eight
  // sections plus the general one is nine, and the guide invites exactly that.
  if (!checkRateLimit(`guide-suggest-ip:${ip}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'That is a lot of suggestions in one hour. Please try again shortly, or email cl@scrutinise.org.' },
      { status: 429 },
    )
  }
  if (!checkRateLimit(`guide-suggest-email:${email.toLowerCase()}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'That is a lot of suggestions in one hour. Please try again shortly, or email cl@scrutinise.org.' },
      { status: 429 },
    )
  }

  const sectionTitle = sectionLabel(sectionKey) ?? sectionKey

  const record = await prisma.legislationGuideSuggestion.create({
    data: {
      name,
      email,
      credentials: credentials || null,
      sectionKey,
      sectionTitle,
      suggestion,
      ipHash: ip === 'unknown' ? null : hashIp(ip),
    },
  })

  // Awaited, not fire-and-forget: the outcome is recorded on the row, so "was Charlie
  // told?" is answerable from the database rather than from a log line nobody reads.
  // The user is still told their suggestion was received either way — it was, and the
  // record is the thing that matters.
  try {
    await sendLegislationGuideSuggestionEmail({
      suggestionId: record.id,
      name,
      email,
      credentials: credentials || null,
      sectionTitle,
      suggestion,
    })
    await prisma.legislationGuideSuggestion.update({
      where: { id: record.id },
      data: { sentAt: new Date() },
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[legislation-guide] suggestion stored but NOT emailed:', reason)
    await prisma.legislationGuideSuggestion
      .update({ where: { id: record.id }, data: { sendError: reason.slice(0, 500) } })
      .catch(() => {})
  }

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 })
}
