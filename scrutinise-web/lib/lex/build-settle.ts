// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §2 — the abandoned-build settle.
//
// A serverless function killed mid-build leaves its IdeaBuild row at RUNNING with
// nothing coming back to finish it. Without this, the progress display spins for ever
// and the Build button stays disabled — a status that is not merely stale but FALSE,
// since no build is in progress. Worse than in the Deepening's case, because the
// partial build's PROPOSALS are already in the panel: the user would be looking at a
// half-drafted kernel while the page told them it was still being written.
//
// ⚠ IT WRITES, IT DOES NOT DISPLAY. The temptation is to render "probably dead" and
// leave the row alone. That is the split §18's corollary warns about: a component that
// is stopped and a component that has failed must not look identical, and THE STATUS
// SHOWN MUST BE THE STATUS STORED. So the row moves to FAILED with a reason that says
// what actually happened, and everything the build had already persisted stays —
// a partial build keeps its passes, and says which ones they were.
//
// This is also the mechanism that catches the platform's own ceiling. A Next.js route
// cannot run for the brief's fifteen minutes (see build-config.ts), so a build that
// outlives `maxDuration` is killed outright with no chance to write its own failure.
// This settle is what turns that into an honest FAILED row rather than a permanent
// spinner — which is precisely what §6's "a build killed mid-run settles to FAILED by
// writing the row" asks for.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ 25-B §1 — THE SETTLE NOW RESUMES AS WELL AS FAILS, AND THE ORDER MATTERS.
//
// "A client that closes mid-build must not leave a permanently RUNNING row. The existing
// abandoned-run settle covers it; extend it to RESUME rather than only to fail, and make
// an orphaned build resumable from its last completed pass."
//
// Under 25-A there was one request, so a stalled row meant a dead build and FAILED was
// the whole truth. Under one-pass-per-request there are two different stalls wearing the
// same face, and they must not share an outcome:
//
//   · A PASS that was killed mid-flight — its record sits at RUNNING while nothing is
//     running. The BUILD is fine. Reset that pass to PENDING and the next poll picks it
//     up from the last completed pass. Nothing already drafted is touched.
//
//   · A BUILD nobody is driving — the client closed, so no poll will ever trigger the
//     next pass. That is genuinely abandoned and settles to FAILED, as before.
//
// The two are told apart by TIME, which is the only evidence available: a pass stuck for
// longer than a pass can possibly take was killed; a build untouched for far longer than
// that has lost its driver. Resuming first is deliberate — a build wrongly failed loses
// work the user waited minutes for, while a build wrongly resumed simply runs a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { ABANDONED_AFTER_MS, PASS_BUDGET_MS } from './build-config'
import { readPassLog, isResumable } from './build-carry'
import { stripNullBytes } from './json-safe'

/**
 * How long a pass may sit at RUNNING before it is treated as killed rather than slow.
 * Comfortably beyond the pass budget AND the platform's own 300s ceiling, so a live pass
 * is never reset out from under itself.
 */
const PASS_STUCK_AFTER_MS = parseInt(
  process.env.LEX_BUILD_PASS_STUCK_MS ?? String(PASS_BUDGET_MS + 120_000), 10,
)

export async function settleAbandonedBuilds(ideaId: string): Promise<number> {
  await resumeStalledPasses(ideaId)

  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS)
  const res = await prisma.ideaBuild.updateMany({
    where: {
      ideaId,
      status: { in: ['QUEUED', 'RUNNING'] },
      // ⚠ AGED OFF `updatedAt`, NOT `startedAt`. Under 25-A a build's whole life was one
      // request, so its start time was the only clock there was. A 25-B build legitimately
      // lives for many minutes across many requests, and ageing it off `startedAt` would
      // declare a healthy seven-pass build abandoned while it was still working. What
      // marks a build as driverless is that NOTHING HAS TOUCHED IT — every pass write
      // moves `updatedAt`, so silence there is the real signal.
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      currentPass: null,
      failureReason:
        'The build stopped without reporting back — nothing has driven it forward for a while, so the ' +
        'page that started it was almost certainly closed. Whatever it had already drafted has been ' +
        'kept and is in the panel; the passes it finished are listed below. Run it again to continue ' +
        'from where it got to.',
    },
  })
  if (res.count) {
    console.warn('[lex-diag] 25b settled abandoned build(s)', { ideaId, count: res.count })
  }
  return res.count
}

/**
 * Reset passes that were killed mid-flight back to PENDING, so the build can carry on.
 *
 * ⚠ IT WRITES, IT DOES NOT DISPLAY — the same rule the original settle was built on. The
 * status shown is the status stored, so a pass that is going to be re-run must SAY
 * PENDING, not be rendered as pending while the row says something else.
 */
async function resumeStalledPasses(ideaId: string): Promise<number> {
  const cutoff = Date.now() - PASS_STUCK_AFTER_MS
  const rows = await prisma.ideaBuild.findMany({
    where: { ideaId, status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true, passes: true },
  })

  let resumed = 0
  for (const row of rows) {
    const log = readPassLog(row.passes)
    let changed = false
    const next = log.map((p) => {
      if (p.status !== 'RUNNING') return p
      const started = p.startedAt ? Date.parse(p.startedAt) : 0
      if (started && started > cutoff) return p
      changed = true
      return {
        ...p,
        status: 'PENDING' as const,
        startedAt: null,
        // ⚠ The activity line is CLEARED. Leaving "Asking: …" on a pass that is going to
        // start again from the beginning would tell the user work is in flight that is not.
        activity: null,
        // Anything the killed attempt spent is KEPT. It was really spent, and dropping it
        // would make a re-run look cheaper than it was.
      }
    })
    if (!changed) continue
    await prisma.ideaBuild.update({
      where: { id: row.id },
      data: { passes: stripNullBytes(next) as never, currentPass: null },
    })
    resumed++
    console.warn('[lex-diag] 25b resumed a stalled pass — the build continues from its last completed one', {
      ideaId, buildId: row.id, resumable: isResumable(next),
    })
  }
  return resumed
}
