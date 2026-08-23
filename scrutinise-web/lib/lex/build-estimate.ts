// ─────────────────────────────────────────────────────────────────────────────
// AMENDMENT_25B §C4 — HOW LONG THIS USUALLY TAKES.
//
// CCh: "The estimate is a measurement, not a guess. It should say so, and it should say
// when it doesn't have enough data to be one."
//
// That single line decides everything in this file:
//
//  · It is a QUERY, not new instrumentation. `IdeaBuild` has recorded `startedAt` and
//    `completedAt` since 25-A, so the mean of the last 20 successful builds is already
//    in the database and nothing needs to be measured to get it.
//  · FAILED AND CANCELLED BUILDS ARE EXCLUDED. "A build that died at 40 seconds is not
//    evidence about how long a build takes" — and including them would drag the mean
//    down precisely when builds are breaking, telling the user it is quick at the moment
//    it is least likely to be.
//  · BELOW FIVE COMPLETED BUILDS THERE IS NO MEAN WORTH QUOTING. Extrapolating from two
//    is a guess wearing a number's clothes, so it says it does not know yet.
//  · IT ROUNDS TO SOMETHING A HUMAN USES. "About 7 minutes", never "6.8 minutes" —
//    false precision on a figure that varies by minutes reads as a promise.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

/** How many recent successful builds the mean is taken over. */
const SAMPLE = parseInt(process.env.LEX_BUILD_ESTIMATE_SAMPLE ?? '20', 10)

/**
 * Below this many completed builds, no figure is quoted at all.
 *
 * ⚠ Five is a judgement, not a statistic, and it is deliberately conservative: the first
 * few builds after a change to the passes are the least representative there will ever be.
 */
export const MIN_SAMPLE = parseInt(process.env.LEX_BUILD_ESTIMATE_MIN ?? '5', 10)

/**
 * The email offer appears above this. "Below about three minutes, no offer (they'll
 * wait)" — an unrequested email for a two-minute job is a nuisance.
 */
export const EMAIL_OFFER_SECONDS = parseInt(process.env.LEX_BUILD_EMAIL_OFFER_SECONDS ?? '180', 10)

/**
 * How far past the mean a build has to run before the display says so. A build that
 * varies by a third is normal; one running at half again as long is worth a word, because
 * a progress display sitting past its own estimate in silence is what makes a user think
 * it has hung.
 */
const OVERRUN_FACTOR = Number(process.env.LEX_BUILD_OVERRUN_FACTOR ?? '1.5')

export interface BuildEstimate {
  /** The measured mean, in seconds. NULL when there is not enough data to have one. */
  meanSeconds: number | null
  /** How many completed builds the mean is taken over. */
  sampleSize: number
  /** The rounded figure the user is shown, in minutes. Null when unknown. */
  minutes: number | null
  /** The sentence. Never quotes a number it does not have. */
  line: string
  /** §C4 — is this long enough to be worth offering an email for? */
  offerEmail: boolean
}

/**
 * Round to something a human would say.
 *
 * Under 90 seconds is "about a minute"; up to ten minutes rounds to the nearest minute;
 * beyond that to the nearest five, because nobody distinguishes 17 from 18 minutes and
 * offering the difference implies we can.
 */
export function humaniseSeconds(seconds: number): string {
  if (seconds < 90) return 'about a minute'
  const mins = seconds / 60
  if (mins < 10) return `about ${Math.round(mins)} minutes`
  return `about ${Math.round(mins / 5) * 5} minutes`
}

/** "8m 12s" — the ACTUAL duration, for the honesty check at the end. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m ? `${m}m ${s}s` : `${s}s`
}

/**
 * The estimate, from the last `SAMPLE` builds that actually finished.
 *
 * ⚠ Deliberately GLOBAL rather than per-user. A user's first build would otherwise have
 * no estimate at all, which is exactly the moment the number is most useful — and how
 * long a build takes is a fact about the passes, not about whose idea it is.
 */
export async function buildEstimate(): Promise<BuildEstimate> {
  const rows = await prisma.ideaBuild.findMany({
    where: {
      // ⚠ DONE only. A FAILED or CANCELLED build tells us nothing about how long a build
      // takes, and a run of early failures would make the estimate say "about a minute".
      status: 'DONE',
      startedAt: { not: null },
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: SAMPLE,
    select: { startedAt: true, completedAt: true },
  })

  const durations = rows
    .map((r) => (r.completedAt!.getTime() - r.startedAt!.getTime()) / 1000)
    // A negative or absurd duration means clock skew or a row written by hand; it is not
    // evidence, and one of them would move a 20-sample mean noticeably.
    .filter((d) => d > 0 && d < 3 * 60 * 60)

  if (durations.length < MIN_SAMPLE) {
    return {
      meanSeconds: null,
      sampleSize: durations.length,
      minutes: null,
      // ⚠ 25-E §4c — TWO THINGS IN ONE SENTENCE, AND THE SECOND ONE IS OURS, NOT THEIRS.
      //
      // It read "Usually a few minutes — we don't have enough builds yet to be precise."
      // Both halves are true and the honesty was well meant, but the user is being asked
      // one question — how long do I wait? — and was handed an answer plus a confession
      // about our sample size, at the moment they are deciding whether to commit.
      //
      // "A few minutes" IS the honest shape of the answer; it claims no figure, so there is
      // nothing to disclaim. The precision caveat earns its place only once there IS a
      // number, and the line below carries it then (`from the last N builds`). Nothing is
      // hidden: `meanSeconds: null` and `sampleSize` still travel in the object, and the
      // client shows the sample only when there is one.
      line: 'This usually takes a few minutes.',
      // ⚠ OFFERED WHEN UNKNOWN. Not knowing is not evidence that it is quick, and the
      // cost of a needless offer is a checkbox nobody ticks; the cost of not offering is
      // someone waiting ten minutes at a screen.
      offerEmail: true,
    }
  }

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length
  return {
    meanSeconds: mean,
    sampleSize: durations.length,
    minutes: Math.round(mean / 60),
    line: `This usually takes ${humaniseSeconds(mean)}.`,
    offerEmail: mean >= EMAIL_OFFER_SECONDS,
  }
}

/**
 * §C4 — "If a build overruns the estimate materially, say so rather than letting the
 * progress bar sit there."
 *
 * Returns null when there is nothing to say, which is the normal case. It says nothing
 * at all when there is no measured mean: "taking longer than usual" is a claim about a
 * usual we do not have.
 */
export function overrunNote(estimate: BuildEstimate, elapsedSeconds: number | null): string | null {
  if (estimate.meanSeconds == null || elapsedSeconds == null) return null
  if (elapsedSeconds < estimate.meanSeconds * OVERRUN_FACTOR) return null
  return 'Taking longer than usual — still running.'
}

/**
 * §C4 — the line shown once it has finished, so the estimate is visibly honest.
 *
 * ⚠ It shows the estimate BESIDE the actual, including when the estimate was wrong. A
 * figure that is only ever displayed before the event cannot be calibrated by the person
 * reading it, and one that quietly disappears when it misses is worse than none.
 */
export function actualVsEstimate(estimate: BuildEstimate, elapsedSeconds: number | null): string | null {
  if (elapsedSeconds == null) return null
  if (estimate.meanSeconds == null) return `Took ${formatDuration(elapsedSeconds)}.`
  return `Took ${formatDuration(elapsedSeconds)} — usually ${humaniseSeconds(estimate.meanSeconds)}.`
}
