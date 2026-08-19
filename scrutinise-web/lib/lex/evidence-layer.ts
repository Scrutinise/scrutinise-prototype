// ─────────────────────────────────────────────────────────────────────────────
// THE EVIDENCE LAYER'S SHARED RULES.
//
// `EvidenceItem` is now written by TWO producers — the Deepening's passes (§22) and the
// build's research and revision passes (25-B §2) — and the rules about what a RE-RUN does
// to a user's findings belong to the LAYER, not to either engine. This module is where
// they live so that there is one answer rather than two that drift.
//
// ⚠ WHY THIS FILE EXISTS RATHER THAN AN EXPORT FROM `deepening.ts`, WHICH IS WHERE THE
// RULE WAS WRITTEN FIRST. That is where 25-B originally imported it from, and it is the
// obvious home. At commit time `deepening.ts` was mid-flight in another thread's sprint
// and imports a module that is not yet in the repository — so committing it would have
// put a file on `Main` whose import does not resolve, which is the exact incident
// CLAUDE.md §20 records for `build-cost.ts`. Extracting the rule was the way to ship 25-B
// without either duplicating it or shipping somebody else's unfinished work.
//
// ▶ FOLLOW-UP, OWNED BY WHICHEVER THREAD LANDS SECOND: `deepening.ts` still has its own
// private copy of `supersedeOlderProposals`. It should be deleted and this one imported.
// Until then the two are identical BY INSPECTION, which is exactly the arrangement this
// codebase distrusts — so it is written down here rather than left to be discovered.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

/**
 * Re-run housekeeping: PROPOSED items from earlier runs of the same pass are superseded —
 * marked REJECTED with a note saying why — and ACCEPTED items are NEVER touched.
 *
 * ⚠ THE TWO HALVES ARE BOTH DELIBERATE. Superseding keeps a re-run from silently doubling
 * the findings list; leaving ACCEPTED rows alone keeps a re-run from deleting a judgement
 * the user has already made. Issues are not touched at all: an OPEN issue nobody has
 * triaged is still open, and clearing it would delete their to-do list.
 *
 * Returns the count, so a caller can report what a re-run actually did rather than
 * implying it started clean.
 */
export async function supersedeOlderProposals(
  ideaId: string, passKey: string, runVersion: number,
): Promise<number> {
  const res = await prisma.evidenceItem.updateMany({
    where: { ideaId, passKey, status: 'PROPOSED', runVersion: { lt: runVersion } },
    data: { status: 'REJECTED', note: `Superseded by run ${runVersion}` },
  })
  return res.count
}
