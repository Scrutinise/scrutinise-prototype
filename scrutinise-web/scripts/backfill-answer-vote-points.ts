/**
 * CENTRAL Stage 2e — pay the answer votes that were cast before the library was
 * wired to the ledger.
 *
 *   dry run :  tsx --env-file=.env scripts/backfill-answer-vote-points.ts
 *   apply   :  tsx --env-file=.env scripts/backfill-answer-vote-points.ts --apply
 *
 * ⚠ WHY THIS EXISTS. Stage 2b built the answer vote as a ranking signal and
 *   Stage 2 built the ledger for bulletin marks; nobody joined them, so until
 *   24 Aug 2026 an upvote paid its author nothing. Votes cast in that window are
 *   real votes on real answers, and leaving them unpaid means the first thing a
 *   pilot member sees after the fix is their existing upvote still paying zero —
 *   which looks exactly like the bug that was just fixed.
 *
 * ⚠ NOT IN THE MIGRATION, ON PURPOSE. This goes through `recordPointsEvent`, so
 *   the referral chain mints from these awards the way it would have at the
 *   time. A SQL INSERT would have skipped that silently.
 *
 * Rules it keeps, all of them the live ones:
 *   · an AI-authored answer mints nothing;
 *   · a vote already carrying a ledger row is skipped, so re-running is safe;
 *   · the daily mark budget is NOT applied — it limits what a member may do
 *     today, and these are historical actions, not new ones.
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { recordPointsEvent, resolveTariff } from '@/lib/central-points'
import { getRootCommunityId } from '@/lib/community'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`\nCENTRAL answer-vote backfill — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log('host:', new URL(process.env.DATABASE_URL!).hostname)

  const votes = await prisma.answerVote.findMany({
    include: {
      user: { select: { username: true } },
      answer: {
        select: {
          id: true,
          authorId: true,
          authorType: true,
          author: { select: { username: true } },
          question: { select: { communityId: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`\n${votes.length} answer vote(s) on record`)

  let paid = 0
  let skippedAi = 0
  let skippedDone = 0

  for (const v of votes) {
    const already = await prisma.pointsEvent.findFirst({
      where: {
        sourceType: 'ANSWER_VOTE',
        sourceId: v.answerId,
        actorUserId: v.userId,
        type: 'MARK_RECEIVED',
      },
    })
    if (already) {
      skippedDone++
      console.log(`  · ${v.user.username} → ${v.answer.author.username}: already in the ledger`)
      continue
    }
    if (v.answer.authorType === 'AI') {
      skippedAi++
      console.log(`  · ${v.user.username} → ${v.answer.author.username}: AI-authored, mints nothing`)
      continue
    }

    const tariff = await resolveTariff(v.direction === 'UP' ? 'MARK_CONSTRUCTIVE' : 'MARK_UNCONSTRUCTIVE')
    console.log(`  ${APPLY ? '✓' : '→'} ${v.user.username} ${v.direction} on ${v.answer.author.username}'s answer: ${tariff.points >= 0 ? '+' : ''}${tariff.points}`)

    if (APPLY) {
      const rootId = await getRootCommunityId(v.answer.question.communityId)
      await recordPointsEvent({
        userId: v.answer.authorId,
        communityId: rootId,
        sourceCommunityId: v.answer.question.communityId,
        type: 'MARK_RECEIVED',
        points: tariff.points,
        sourceType: 'ANSWER_VOTE',
        sourceId: v.answerId,
        actorUserId: v.userId,
        tariff,
      })
    }
    paid++
  }

  console.log(`\n${APPLY ? 'paid' : 'would pay'}: ${paid}  ·  already done: ${skippedDone}  ·  AI, mints nothing: ${skippedAi}`)
  if (!APPLY) console.log('\nDRY RUN — pass --apply to write.')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
