// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-M §4 — THE PILOT ALLOWANCE. The last hard blocker on letting anyone else in.
//
// ⚠⚠ THE COUNTER IS `IdeaBuild`, NOT `LlmSpend`, AND THIS CONTRADICTS THE BRIEF ON PURPOSE.
//
// §4: "The counter is over `LlmSpend`, which already carries the user and the cost." The
// second half of that sentence is true of the SCHEMA and false of the DATA. Measured on
// 28 Aug 2026:
//
//     LlmSpend: 2,702 rows — 2 with a userId, 5 with an ideaId.
//     Every build-stream row sampled: userId null, ideaId null.
//
// `SpendAttribution` is an optional argument to the model-call helper and the build passes
// have never passed it. An allowance counted over `LlmSpend` would read ZERO for every user
// and hand out unlimited free builds — the exact failure the allowance exists to prevent,
// shipped as a feature, and invisible until a bill arrived.
//
// So the counter is `IdeaBuild`. That is not a new source of truth either — it is one row
// per build, with the status on it, and it is the unit §4 states its own spend rule in.
// `LlmSpend` stays the COST record, which is the thing it is actually good at.
//
// ⚠⚠ A FAILED BUILD DOES NOT SPEND THE ALLOWANCE — Charlie's decision, and the tie-break
// matters more than the rule: **ambiguous is not spent.** So this counts only what it can
// prove: `status = 'DONE'`. FAILED, CANCELLED, QUEUED, RUNNING and anything a future status
// might add all fall to "not spent" by construction, because the test is an allow-list and
// not a deny-list. A deny-list would silently start charging for the next status somebody
// adds.
//
// ⚠ AND IT IS COUNTED, NOT DECREMENTED. There is no balance column to drift: the balance is
// `granted − spent`, computed from rows that already exist. A stored counter would need a
// transaction around every build and would be wrong the first time one was rolled back.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

/** A full build. §4: re-runs cost less because they reuse the research. */
export const FULL_BUILD_THIRDS = 3
/**
 * A reuse re-run. One third, from 25-G's measured 48% input-token saving on the two passes
 * it skips — ⚠ NOT 48% of a build, which is a number this codebase has been careful not to
 * claim (25-J). A third is the price the re-run dialogue has quoted since 25-L; the charge
 * and the sentence on screen must not disagree.
 */
export const REUSE_BUILD_THIRDS = 1

export interface Allowance {
  /** What they have been given, in thirds. */
  grantedThirds: number
  /** What they have used, in thirds. */
  spentThirds: number
  /** What is left. Never negative — see `readAllowance`. */
  remainingThirds: number
  /** Whole builds' worth remaining, for the sentence a user reads. */
  remainingBuilds: number
  /** How many DONE builds they have. The evidence for `spentThirds`. */
  doneBuilds: number
  /** TRUE when a FULL build can still be started. */
  canStartFull: boolean
  /** TRUE when a REUSE re-run can still be started. */
  canStartReuse: boolean
  /** The sentence shown beside the cost and duration line. Never a bare number. */
  line: string
  /**
   * Why a build is blocked, in words, or null. Fed into the EXISTING `blockedReason` path
   * (§4) rather than a second mechanism — the screen already knows how to render one.
   */
  blockedReason: string | null
}

/** The address a blocked user writes to. An email link is enough for a pilot (§4). */
const ASK_FOR_MORE = 'cl@scrutinise.org'

function buildsFrom(thirds: number): number {
  return Math.floor(thirds / FULL_BUILD_THIRDS)
}

/**
 * What this user has left.
 *
 * ⚠ SPENT IS COUNTED OVER `DONE` BUILDS ONLY, and the mode is read from the row so a re-run
 * costs a third of what a full build costs. `mode` was added by 25-G and is on every row
 * since; a row without one is treated as FULL, which is the conservative direction — it
 * charges us, not the user, for our own missing data.
 */
export async function readAllowance(userId: string): Promise<Allowance> {
  const [user, done] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { buildAllowanceThirds: true },
    }),
    prisma.ideaBuild.findMany({
      // ⚠ AN ALLOW-LIST. Only DONE counts. Every other status — including one added next
      // year — falls to "not spent", which is Charlie's tie-break: ambiguous is not spent.
      where: { status: 'DONE', idea: { creatorId: userId } },
      select: { mode: true },
    }),
  ])

  const grantedThirds = user?.buildAllowanceThirds ?? 0
  const spentThirds = done.reduce(
    (n, b) => n + (b.mode === 'REUSE' ? REUSE_BUILD_THIRDS : FULL_BUILD_THIRDS),
    0,
  )
  // ⚠ CLAMPED AT ZERO. An admin who lowers an allowance below what somebody has already
  // spent must not produce a negative balance on their screen; they are simply out.
  const remainingThirds = Math.max(0, grantedThirds - spentThirds)

  const canStartFull = remainingThirds >= FULL_BUILD_THIRDS
  const canStartReuse = remainingThirds >= REUSE_BUILD_THIRDS

  const remainingBuilds = buildsFrom(remainingThirds)
  const line = remainingThirds === 0
    ? 'You have used your build allowance.'
    : canStartFull
      ? `You have ${remainingBuilds === 1 ? '1 build' : `${remainingBuilds} builds`} left.`
      // ⚠ THE HONEST MIDDLE STATE. Enough for a redraft and not for a full search is a real
      // position, and "0 builds left" beside a working redraft button would be a lie.
      : 'You have enough left for a redraft, but not for a full search.'

  const blockedReason = remainingThirds === 0
    ? 'You have used your build allowance for the pilot. Nothing you have written is lost — '
      + `everything is still here. If you would like more, email ${ASK_FOR_MORE} and say what `
      + 'you are working on.'
    : null

  return {
    grantedThirds, spentThirds, remainingThirds, remainingBuilds,
    doneBuilds: done.length, canStartFull, canStartReuse, line, blockedReason,
  }
}

/**
 * Can this user start a build of this mode? The sentence, or null when they can.
 *
 * ⚠ REUSE IS CHECKED AGAINST THE REUSE PRICE. A user with one third left may redraft and may
 * not search again, and refusing both would take away something they have paid for.
 */
export async function allowanceBlock(userId: string, mode: 'FULL' | 'REUSE'): Promise<string | null> {
  const a = await readAllowance(userId)
  if (mode === 'REUSE' ? a.canStartReuse : a.canStartFull) return null
  if (a.blockedReason) return a.blockedReason
  // Not empty, but not enough for THIS mode.
  return 'You have enough of your allowance left for a redraft from the research already '
    + 'gathered, but not for a full search of the corpus. Redrafting costs a third as much.'
}
