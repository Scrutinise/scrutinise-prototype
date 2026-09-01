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

/**
 * ══ WHEN THE ALLOWANCE CAME INTO EFFECT ═══════════════════════════════════════
 *
 * ⚠⚠ AN ALLOWANCE INTRODUCED TODAY MUST NOT RETROACTIVELY CHARGE FOR WORK DONE BEFORE IT
 * EXISTED, and the first version of this file did exactly that. Measured immediately after
 * shipping it, against the only account with any history:
 *
 *     granted 4 · spent 9 · remaining 0 · "You have used your build allowance."
 *
 * Three builds made over the previous fortnight, when there was no allowance and no way to
 * know one was coming, instantly locked the account out of the product. That is the opposite
 * of what a pilot allowance is for — it is meant to bound what a thousand new users can
 * spend, not to bill the one person who has been testing it.
 *
 * ⚠ IT IS THE SAME PRINCIPLE AS "AMBIGUOUS IS NOT SPENT". A build made when no allowance
 * existed was not made against one.
 *
 * ⚠ A NAMED CONSTANT, NOT A MAGIC DATE. This is the moment `buildAllowanceThirds` shipped
 * (`prisma/lex_25m.sql`), and a reader has to be able to see why the number is what it is.
 * ⚠ AND IT NEEDS NO DATA MIGRATION: nothing is rewritten, the cut-off is applied on read.
 */
export const ALLOWANCE_EPOCH = new Date('2026-08-28T11:45:00.000Z')

/**
 * ══ 25-O §1c — THE PILOT ALLOWANCE, AS CONFIGURATION ════════════════════════════
 *
 * §1c: *"The pilot allowance is three full builds and three re-runs per user. Set as
 * configuration, not as a constant in code, because it drops back to one once the payment path
 * exists."*
 *
 * 3 × FULL (3 thirds) + 3 × REUSE (1 third) = **12 thirds**.
 *
 * ⚠ IT IS THE DEFAULT GRANT, NOT A CEILING ON AN ADMIN'S GRANT. A user with an explicit grant
 * keeps it — raising or lowering the pilot number must never silently overwrite a decision an
 * admin recorded a reason for.
 *
 * ⚠⚠ AND "EXPLICITLY GRANTED" IS READ OFF `buildAllowanceNote`, NOT OFF THE NUMBER. The column
 * `buildAllowanceThirds` has a database default of 4, so a user who has never been touched is
 * INDISTINGUISHABLE BY VALUE from one an admin deliberately set to 4. The note is required on
 * every admin write (`PATCH /api/admin/allowance` refuses without one) and is written by nothing
 * else, so its presence is the only reliable record that somebody decided.
 */
export const PILOT_ALLOWANCE_THIRDS = Number(process.env.LEX_PILOT_ALLOWANCE_THIRDS ?? '12')

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
  /** TRUE when an admin set that figure; FALSE when it is the pilot default. */
  grantedExplicitly: boolean
  /** What they have used, in thirds. */
  spentThirds: number
  /**
   * ══ 25-O §1a — WHAT IS HELD BY BUILDS THAT ARE STILL RUNNING ══════════════════
   *
   * ⚠ A HOLD IS NOT A SPEND, and the two are separate fields because they answer different
   * questions and are released differently. `spentThirds` is final. This is returned the moment
   * the build stops without completing.
   */
  reservedThirds: number
  /** How many builds are holding a reservation right now. The evidence for `reservedThirds`. */
  inFlightBuilds: number
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

/**
 * ══ 25-P §4a — WHAT THE USER ACTUALLY HAS, IN BOTH CURRENCIES ══════════════════════
 *
 * §4a: *"The message reads 'You have 4 builds left'. Twelve thirds genuinely is four full
 * builds, but Charlie's intent was three builds and three re-runs, and the sentence does not
 * say so. Make it say what he actually has, in both currencies."*
 *
 * ⚠⚠ THE OLD SENTENCE WAS TRUE AND STILL MISLED, which is why it is worth the words. Twelve
 * credits IS four full builds — and a user who reads that and plans four full builds discovers
 * only afterwards that every re-run he did came out of the same twelve. The balance is in ONE
 * currency and is spent in TWO, so the sentence has to name both.
 *
 * ⚠ AND IT NAMES THE PRICES. "3 full builds and 3 re-runs" is a fact about today's balance;
 * "a full build costs three, a re-run one" is the rule that lets the user work out any other
 * split for themselves, which is the thing a single worked example cannot do.
 *
 * ⚠ PURE, AND EXPORTED, so `check:lex-25p` asserts the sentence rather than the arithmetic
 * behind it. The defect here was never in the arithmetic.
 */
export function balanceSentence(remainingThirds: number): string {
  if (remainingThirds <= 0) return 'You have used your build allowance.'

  const full = Math.floor(remainingThirds / FULL_BUILD_THIRDS)
  const price = `A full build costs ${FULL_BUILD_THIRDS} and a re-run costs ${REUSE_BUILD_THIRDS}`

  // ⚠ THE HONEST MIDDLE STATE, KEPT. Enough for a redraft and not for a full search is a real
  // position, and "0 builds left" beside a working redraft button would be a lie.
  if (full === 0) {
    return `You have ${remainingThirds} left — ${price.toLowerCase()}, so that is enough for `
      + `${remainingThirds === 1 ? 'one re-run' : `${remainingThirds} re-runs`}, `
      + 'but not for a full build.'
  }

  const asMix = full >= 2
    // ⚠ ONE FULL BUILD TRADED FOR THREE RE-RUNS — the split Charlie actually meant by "twelve".
    ? `, or ${full - 1} full build${full - 1 === 1 ? '' : 's'} and `
      + `${remainingThirds - (full - 1) * FULL_BUILD_THIRDS} re-runs`
    : ''
  return `You have ${remainingThirds} left. ${price} — so that is `
    + `${full} full build${full === 1 ? '' : 's'}${asMix}, `
    + `or ${remainingThirds} re-runs.`
}

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
/**
 * ══ 25-O §1a — HOW LONG A RESERVATION MAY LIVE ══════════════════════════════════
 *
 * ⚠⚠ THE RELEASE IS STRUCTURAL, AND THIS IS THE BACKSTOP FOR THE ONE CASE IT CANNOT COVER.
 *
 * A reservation is not a stored row: it is the fact that a build is QUEUED or RUNNING. So
 * §1b's "release on FAILED and CANCELLED" needs no write at all — the moment the status
 * leaves that set, the hold is gone, and there is nothing to leak. That is deliberate: a
 * reservation released by a separate write is a reservation that survives every path where
 * that write is missed, and 25-M already recorded that the spend test is an allow-list, so a
 * leaked hold would be a permanent deduction with no row saying why.
 *
 * ⚠ THE ONE CASE STRUCTURE CANNOT COVER is a row STUCK at RUNNING — a worker killed between
 * the settle sweeps. `settleAbandonedBuilds` catches those within `ABANDONED_AFTER_MS`, but it
 * only runs on a read of that idea or on the worker's sweep, and a user whose stuck build is on
 * an idea nobody opens would be holding thirds indefinitely. So a hold also EXPIRES: past the
 * whole-build hard stop plus a wide margin, the build cannot still be running, whatever the row
 * says. It stops counting.
 *
 * ⚠ AND THE ROW IS NOT REWRITTEN HERE. This is a read; `settleAbandonedBuilds` is the writer,
 * and "the status shown is the status stored" (25-A §2) stays true.
 */
const RESERVATION_MAX_AGE_MS = parseInt(
  process.env.LEX_RESERVATION_MAX_AGE_MS ?? String(15 * 60 * 1000 + 10 * 60 * 1000), 10,
)

export async function readAllowance(userId: string): Promise<Allowance> {
  const [user, done, inFlight] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { buildAllowanceThirds: true, buildAllowanceNote: true },
    }),
    prisma.ideaBuild.findMany({
      // ⚠ AN ALLOW-LIST. Only DONE counts. Every other status — including one added next
      // year — falls to "not spent", which is Charlie's tie-break: ambiguous is not spent.
      //
      // ⚠⚠ AND ONLY BUILDS MADE SINCE THE ALLOWANCE EXISTED. See `ALLOWANCE_EPOCH` — without
      // this line the feature's first act is to lock out everyone who has already used the
      // product, which is measured fact and not a hypothetical.
      where: {
        status: 'DONE',
        createdAt: { gte: ALLOWANCE_EPOCH },
        idea: { creatorId: userId },
      },
      select: { mode: true },
    }),
    // ══ 25-O §1a — THE RESERVATION ═══════════════════════════════════════════
    //
    // ⚠⚠ THIS IS THE HOLE §1a IS ABOUT, AND IT IS A RACE RATHER THAN A MID-RUN REFUSAL.
    // Nothing in the pass path has ever read the allowance, so a build has never been stopped
    // part-way by it. What COULD happen is worse and quieter: the spend counted only DONE
    // builds, so two builds started inside the same ten minutes — two ideas, two tabs — both
    // passed the door check because neither was DONE yet, and only one of them was paid for.
    // Counting the in-flight ones is what closes it.
    prisma.ideaBuild.findMany({
      where: {
        status: { in: ['QUEUED', 'RUNNING'] },
        createdAt: { gte: new Date(Date.now() - RESERVATION_MAX_AGE_MS) },
        idea: { creatorId: userId },
      },
      select: { id: true, mode: true },
    }),
  ])

  // ⚠ 25-O §1c — THE PILOT DEFAULT APPLIES ONLY WHERE NOBODY HAS DECIDED. See
  // `PILOT_ALLOWANCE_THIRDS`: the note, not the number, is what records a decision.
  const grantedExplicitly = !!user?.buildAllowanceNote
  const grantedThirds = !user
    ? 0
    : grantedExplicitly ? user.buildAllowanceThirds : PILOT_ALLOWANCE_THIRDS

  const priceOf = (mode: string) => (mode === 'REUSE' ? REUSE_BUILD_THIRDS : FULL_BUILD_THIRDS)
  const spentThirds = done.reduce((n, b) => n + priceOf(b.mode), 0)
  // ⚠ AT THE ROW'S OWN MODE, which is what will RUN rather than what was asked for —
  // `claimBuild` writes the effective mode (25-M §4). Reserving the FULL price for a run that
  // is genuinely a redraft would refuse builds the user can afford.
  const reservedThirds = inFlight.reduce((n, b) => n + priceOf(b.mode), 0)

  // ⚠ CLAMPED AT ZERO. An admin who lowers an allowance below what somebody has already
  // spent must not produce a negative balance on their screen; they are simply out.
  const remainingThirds = Math.max(0, grantedThirds - spentThirds - reservedThirds)

  const canStartFull = remainingThirds >= FULL_BUILD_THIRDS
  const canStartReuse = remainingThirds >= REUSE_BUILD_THIRDS

  const remainingBuilds = buildsFrom(remainingThirds)
  // ⚠ 25-O §1a — A HOLD IS SAID OUT LOUD, because otherwise the balance appears to drop for
  // no reason the user can see. "You have 1 build left" while a build is running is confusing;
  // "1 left, and one running now" is a sentence they can act on.
  const heldNote = reservedThirds > 0
    ? ` ${inFlight.length === 1 ? 'One build is running now and is already paid for' : `${inFlight.length} builds are running now and are already paid for`}.`
    : ''
  const line = balanceSentence(remainingThirds) + heldNote

  const blockedReason = remainingThirds === 0
    // ⚠ 25-O §1a — A BALANCE HELD BY A RUNNING BUILD IS NOT A SPENT ALLOWANCE, and telling
    // the user they have used it up when it comes back in ten minutes is simply wrong.
    ? reservedThirds > 0
      ? 'The rest of your allowance is held by the build that is running. If that build stops '
        + 'without finishing, what it was holding comes straight back to you.'
      : 'You have used your build allowance for the pilot. Nothing you have written is lost — '
        + `everything is still here. If you would like more, email ${ASK_FOR_MORE} and say what `
        + 'you are working on.'
    : null

  return {
    grantedThirds, grantedExplicitly, spentThirds, reservedThirds,
    inFlightBuilds: inFlight.length,
    remainingThirds, remainingBuilds,
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
  // ⚠ 25-O §1a — NAME THE SHORTFALL. §1a asks for a refusal that says what is missing rather
  // than that something is missing: *"You have enough for a re-run but not a full build."*
  // A user who is told only "not enough" cannot tell whether to wait, to redraft, or to write.
  const want = mode === 'REUSE' ? REUSE_BUILD_THIRDS : FULL_BUILD_THIRDS
  const short = want - a.remainingThirds
  return 'You have enough of your allowance left for a redraft from the research already '
    + `gathered, but not for a full search of the corpus — a full build needs ${want} thirds and `
    + `you have ${a.remainingThirds}${a.reservedThirds > 0 ? ` (${a.reservedThirds} more are held by a build running now)` : ''}, `
    + `so you are ${short} short. Redrafting costs a third as much.`
}
