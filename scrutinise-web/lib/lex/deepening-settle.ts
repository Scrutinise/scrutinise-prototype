// ─────────────────────────────────────────────────────────────────────────────
// The abandoned-run settle.
//
// A serverless function killed mid-gather leaves its DeepeningPass row at RUNNING with
// nothing coming back to finish it. Without this, that pass shows a spinner for ever and
// the Run button stays disabled — a status that is not merely stale but FALSE, since no
// run is in progress.
//
// ⚠ IT WRITES, IT DOES NOT DISPLAY. The temptation is to render "probably dead" in the UI
// and leave the row alone. That reintroduces exactly the split §18's corollary warns about:
// a component that is stopped and a component that has failed must not look identical, and
// the status SHOWN must be the status STORED. So the row is moved to FAILED with a reason
// that says what actually happened, and whatever the run had already persisted stays — a
// partial gather keeps its findings.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

/**
 * How long a RUNNING row may go unfinished before it is treated as abandoned. Comfortably
 * longer than the run budget (LEX_DEEPENING_BUDGET_MS, 110s) plus the platform's own
 * function ceiling, so a slow-but-live run is never killed by this.
 */
const ABANDONED_AFTER_MS = parseInt(process.env.LEX_DEEPENING_ABANDON_MS ?? '600000', 10)

export async function settleAbandonedRuns(ideaId: string): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS)
  const res = await prisma.deepeningPass.updateMany({
    where: { ideaId, status: 'RUNNING', startedAt: { lt: cutoff } },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      failureReason:
        'The run stopped without reporting back — it was almost certainly cut short by the platform’s ' +
        'time limit. Anything it had already found has been kept. Re-run to continue.',
    },
  })
  return res.count
}
