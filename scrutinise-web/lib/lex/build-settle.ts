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

import { prisma } from '@/lib/prisma'
import { ABANDONED_AFTER_MS } from './build-config'

export async function settleAbandonedBuilds(ideaId: string): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS)
  const res = await prisma.ideaBuild.updateMany({
    where: {
      ideaId,
      status: { in: ['QUEUED', 'RUNNING'] },
      // A QUEUED row that never started has no startedAt, so it is aged off createdAt.
      OR: [{ startedAt: { lt: cutoff } }, { startedAt: null, createdAt: { lt: cutoff } }],
    },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      currentPass: null,
      failureReason:
        'The build stopped without reporting back — it was almost certainly cut short by the platform’s ' +
        'time limit. Whatever it had already drafted has been kept and is in the panel; the passes it ' +
        'finished are listed below. Run it again to continue.',
    },
  })
  if (res.count) {
    console.warn('[lex-diag] 25a settled abandoned build(s)', { ideaId, count: res.count })
  }
  return res.count
}
