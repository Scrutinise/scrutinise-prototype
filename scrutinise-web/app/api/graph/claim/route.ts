// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §5 (as amended) — THE BLIND-FIRST CLAIM REVIEW.
//
//   GET   ?ideaId=…            → a claim to judge: the member, the question, the SOURCED
//                                FACTS. Never our assessment.
//   POST  { …, userVerdict }   → records their judgement, and ONLY THEN returns ours.
//   PATCH { id, agreed }       → records whether ours looked right to them.
//
// ⚠⚠ THE GET CANNOT RETURN OUR ASSESSMENT AND THE POST CANNOT BE SKIPPED. That is the whole
// experiment: an assessment visible before the user has judged buys agreement rather than
// information, and a client-side reveal is one `view-source` away from being no experiment
// at all. `claimFor` returns the two halves separately for exactly this reason, and the GET
// destructures only `question`.
//
// ⚠ THE FACTS ARE NOT GATED. Votes and contributions are public record. Only the inferred
// position waits.
//
// ⚠ SIGNED IN, BUT NOT ADMIN. `/api/admin/positions` is admin-only because design §8 held
// the estimates back "until the hand-labelled validation set has scored them". This IS that
// validation set — gating it to admins would mean the only people scoring the graph are the
// people who built it, which is the sample most likely to agree with it.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseTarget } from '@/lib/graph/positions'
import {
  claimFor, findClaimTarget, isUserVerdict, BETA_INVITATION, agreementRate,
} from '@/lib/graph/claim-review'

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedUser()
  if (error) return error

  const ideaId = req.nextUrl.searchParams.get('ideaId')?.trim() || null
  const explicit = req.nextUrl.searchParams.get('target')?.trim() || null

  let targets = null as ReturnType<typeof parseTarget>[] | null
  let questionText = ''

  if (explicit) {
    const t = parseTarget(explicit)
    if (!t) return NextResponse.json({ error: 'That target could not be read.' }, { status: 422 })
    targets = [t]
    questionText = 'Where does this member stand on this?'
  } else if (ideaId) {
    // ⚠ THE IDEA'S OWN WORDS, and it is the user's problem statement rather than the
    // drafted kernel: the kernel is Lex's language and searching it would find the
    // divisions Lex already had in mind.
    const row = await prisma.ideaElicitation.findUnique({
      where: { ideaId }, select: { problem: true, goalDetail: true },
    })
    const found = await findClaimTarget(`${row?.problem ?? ''} ${row?.goalDetail ?? ''}`)
    if (found) { targets = found.targets; questionText = found.questionText }
  }

  if (!targets?.length) {
    // ⚠ AN HONEST NOTHING. "We could not find a division that bears on your subject" is a
    // statement about our coverage, and §5 requires gaps to be stated rather than dressed
    // as an empty list.
    return NextResponse.json({
      claim: null,
      invitation: BETA_INVITATION,
      note: 'We could not find a vote or motion in the record that clearly bears on this subject, '
        + 'so there is nothing here to check. That is a gap in what we hold, not a statement '
        + 'about whether anybody has taken a position.',
    })
  }

  const found = await claimFor(targets.filter((t): t is NonNullable<typeof t> => !!t), null, questionText)
  if (!found) {
    return NextResponse.json({
      claim: null,
      invitation: BETA_INVITATION,
      note: 'We found the vote but hold no recorded position for anybody on it.',
    })
  }

  // ⚠⚠ `found.assessment` IS DELIBERATELY NOT SPREAD HERE. Read the header before changing
  // this line — returning it would end the experiment silently and every agreement rate
  // measured afterwards would be worthless.
  return NextResponse.json({ claim: found.question, invitation: BETA_INVITATION })
}

const PostSchema = z.object({
  ideaId: z.string().max(64).nullish(),
  actorId: z.string().min(1).max(200),
  actorName: z.string().min(1).max(300),
  targetKey: z.string().min(1).max(500),
  questionText: z.string().min(1).max(500),
  userVerdict: z.string().refine(isUserVerdict, 'not a verdict'),
  userReason: z.string().max(2000).nullish(),
  groundsShown: z.number().int().min(0).max(500).optional(),
})

export async function POST(req: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  }
  const d = parsed.data

  const targets = d.targetKey.split(',').map((t) => parseTarget(t.trim()))
    .filter((t): t is NonNullable<typeof t> => !!t)
  if (!targets.length) return NextResponse.json({ error: 'That target could not be read.' }, { status: 422 })

  const found = await claimFor(targets, d.actorId, d.questionText)
  if (!found) return NextResponse.json({ error: 'That claim is no longer in the graph.' }, { status: 404 })

  // ⚠⚠ THE USER'S VERDICT IS WRITTEN FIRST, IN ITS OWN STATEMENT, AND `revealedAt` IS
  // STAMPED IN THE SAME BREATH BECAUSE THE REVEAL IS THIS RESPONSE. Two CHECK constraints
  // in the database enforce that a reveal cannot precede a judgement and an agreement
  // cannot precede a reveal — the route is not the only thing that must be true here,
  // because the second writer added in six months will not have read the route.
  const now = new Date()
  const row = await prisma.graphClaimJudgement.create({
    data: {
      userId: user.id,
      ideaId: d.ideaId ?? null,
      actorId: d.actorId,
      actorName: d.actorName,
      targetKey: d.targetKey,
      questionText: d.questionText,
      userVerdict: d.userVerdict,
      userReason: d.userReason?.trim() || null,
      groundsShown: d.groundsShown ?? found.question.grounds.length,
      judgedAt: now,
      revealedAt: now,
      // ⚠ OURS IS COPIED IN, NOT JOINED LATER. The graph decays on every read, so a
      // judgement scored against a live query weeks later would be scored against a claim
      // that has since moved. The row has to be able to say what the user was shown.
      ourStance: found.assessment.stance,
      ourClaim: found.assessment.claim,
      ourConfidence: found.assessment.confidence,
      ourConfidenceWording: found.assessment.confidenceWording,
      configVersion: found.assessment.configVersion,
    },
    select: { id: true },
  })

  return NextResponse.json({ judgementId: row.id, assessment: found.assessment })
}

const PatchSchema = z.object({
  id: z.string().min(1).max(64),
  agreed: z.boolean(),
  agreedReason: z.string().max(2000).nullish(),
})

export async function PATCH(req: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  }

  // ⚠ SCOPED TO THE JUDGE. Without the `userId` in the where clause, anybody holding an id
  // could answer for somebody else's judgement — and the agreement rate is exactly the thing
  // that would be quietly wrong afterwards.
  const updated = await prisma.graphClaimJudgement.updateMany({
    where: { id: parsed.data.id, userId: user.id, revealedAt: { not: null } },
    data: {
      agreed: parsed.data.agreed,
      agreedReason: parsed.data.agreedReason?.trim() || null,
      answeredAt: new Date(),
    },
  })
  if (!updated.count) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ⚠ THE RATE COMES BACK WITH ITS CAVEAT ATTACHED. A number returned alone is a number
  // quoted alone.
  return NextResponse.json({ ok: true, agreement: await agreementRate() })
}
