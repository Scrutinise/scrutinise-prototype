// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 §4 — THE DONATION ALIGNMENT, JUDGED BLIND FIRST.
//
//   GET   ?donor=<entityId>     → the PUBLISHED RECORD. Never our reading.
//   POST  { …, userVerdict }    → records their judgement, and ONLY THEN ours.
//   PATCH { id, agreed }        → right | wrong | not-sure on ours.
//
// ⚠⚠ THE ORDER IS THE MEASUREMENT, and it is copied deliberately from 25-L's
// claim review rather than reinvented. §4: *"Show the donation record first and
// our guess second, exactly as LEX 25-L did for positions: the sourced record,
// the user's judgement, then our assessment revealed. That design is right and
// this must not weaken it."*
//
// So the GET returns `facts`, `parties`, `statement` — every one of them a
// published Electoral Commission field — and DOES NOT return `tier`,
// `confidence` or `inference`. There is nothing in the response to hide.
//
// ⚠ AND THE FACT IS THE HEADLINE, THE INFERENCE IS NOT. §4: *"Separate the fact
// from the guess on screen. 'Donated £50,000 to X in 2019, and to no other
// party' is a fact with a citation. The inference sits beneath it, labelled, and
// is never the headline."* `statement` is the fact; `inference` is withheld
// until they have judged, and is labelled "Our reading" when it arrives.
//
// ⚠⚠ AND NOTHING HERE CAN PRODUCE A DIRECTION ON A PROPOSAL. See
// `donation-alignment.ts`: a `PartyAlignment` has no direction and no target
// field, so the sentence "supports your bill" cannot be constructed from this
// response. That is a shape, not a wording rule.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { alignmentForDonor, pickDonorToReview } from '@/lib/graph/donation-alignment'

const BETA_INVITATION =
  'Help us test this. The Electoral Commission publishes who gave money to which party. We can '
  + 'read a pattern out of that, and we are not sure how much it is worth — so read the record '
  + 'below and tell us what you make of it before we show you what we made of it.'

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedUser()
  if (error) return error

  const donor = req.nextUrl.searchParams.get('donor')?.trim()
    || await pickDonorToReview()
  if (!donor) {
    return NextResponse.json({
      alignment: null,
      invitation: BETA_INVITATION,
      note: 'We hold no donation with both a resolved donor and a resolved recipient, so there is '
        + 'nothing here to check. That is a gap in what we have matched up, not a statement about '
        + 'what the register contains.',
    })
  }

  const a = await alignmentForDonor(donor)
  if (!a) {
    return NextResponse.json({
      alignment: null,
      invitation: BETA_INVITATION,
      note: 'We hold no party donation for that organisation.',
    })
  }

  // ⚠⚠ `tier`, `confidence` AND `inference` ARE DELIBERATELY NOT SPREAD HERE. Read the header
  // before changing this line: returning them ends the experiment silently, and every agreement
  // rate measured afterwards is worthless.
  return NextResponse.json({
    invitation: BETA_INVITATION,
    alignment: {
      donorEntityId: a.donorEntityId,
      donorName: a.donorName,
      // The FACT, and it leads.
      statement: a.statement,
      parties: a.parties,
      facts: a.facts,
      firstDonation: a.firstDonation,
      lastDonation: a.lastDonation,
      yearsSpanned: a.yearsSpanned,
    },
  })
}

const PostSchema = z.object({
  ideaId: z.string().max(64).nullish(),
  donorEntityId: z.string().min(1).max(64),
  userVerdict: z.enum(['sympathetic', 'not-sympathetic', 'no-direction', 'not-enough']),
  userReason: z.string().max(2000).nullish(),
})

export async function POST(req: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  }
  const d = parsed.data

  const a = await alignmentForDonor(d.donorEntityId)
  if (!a) return NextResponse.json({ error: 'That donor is no longer in the register.' }, { status: 404 })

  // ⚠ THE VERDICT IS WRITTEN FIRST AND `revealedAt` IS STAMPED IN THE SAME BREATH, because the
  // reveal IS this response. Two CHECK constraints enforce the ordering in the database as well,
  // because the second writer added in six months will not have read this route.
  const now = new Date()
  const row = await prisma.graphDonationJudgement.create({
    data: {
      userId: user.id,
      ideaId: d.ideaId ?? null,
      donorEntityId: d.donorEntityId,
      donorName: a.donorName,
      partiesShown: a.parties.join('; '),
      factsShown: a.facts.length,
      userVerdict: d.userVerdict,
      userReason: d.userReason?.trim() || null,
      judgedAt: now,
      revealedAt: now,
      // ⚠ OURS IS COPIED IN, NOT JOINED LATER. The register grows; a judgement scored against a
      // live query weeks later would be scored against an alignment that has since moved.
      ourTier: a.tier,
      ourInference: a.inference,
      ourConfidence: a.confidence,
      configVersion: a.configVersion,
    },
    select: { id: true },
  })

  return NextResponse.json({
    judgementId: row.id,
    assessment: {
      tier: a.tier,
      confidence: a.confidence,
      // ⚠ THE ONLY SENTENCE THAT MAY BE PRINTED AS OUR READING, composed in the library.
      inference: a.inference,
      configVersion: a.configVersion,
    },
  })
}

const PatchSchema = z.object({
  id: z.string().min(1).max(64),
  /** ⚠ THREE-WAY. "Not sure" is a real answer, not a missing one. */
  agreed: z.enum(['right', 'wrong', 'not-sure']),
  agreedReason: z.string().max(2000).nullish(),
})

export async function PATCH(req: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  }

  // ⚠ SCOPED TO THE JUDGE. Without `userId` in the where clause anybody holding an id could
  // answer for somebody else's judgement, and the agreement rate is exactly the thing that would
  // be quietly wrong afterwards.
  const updated = await prisma.graphDonationJudgement.updateMany({
    where: { id: parsed.data.id, userId: user.id, revealedAt: { not: null } },
    data: {
      agreed: parsed.data.agreed,
      agreedReason: parsed.data.agreedReason?.trim() || null,
      answeredAt: new Date(),
    },
  })
  if (!updated.count) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ⚠⚠ AND THE RESPONSE SAYS, IN WORDS, THAT NOTHING CHANGED. §4: a verdict is a signal, not a
  // truth. Implying their answer had corrected the register would be a claim we cannot honour.
  return NextResponse.json({
    ok: true,
    note: 'Recorded. Your judgement is stored as an observation with the date and the method '
      + 'version — it does not overwrite the published record and it does not move any score. '
      + 'It tells us where to look.',
  })
}
