-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-N §1a — A BUILD THAT STOPPED BEFORE ITS PASSES CAN BE PICKED UP AGAIN.
--
-- ⚠ ADDITIVE ONLY. Three columns on "IdeaBuild", nothing dropped, nothing rewritten.
-- Idempotent.
--
-- ⚠⚠ THE MEASUREMENT THAT PRODUCED THIS, so nobody has to take it on trust. Build v7 of
-- idea 452c5ade-3153-400a-bf48-3b71aaa52773, 30 Aug 2026 11:14–11:30 UTC:
--
--     status         FAILED
--     passesComplete 8 of 10
--     DONE           ORIENT, DIAGNOSIS, APPROACH, ACTIONS, RESEARCH, REVISE, SMART, KERNEL_CHECK
--     NOT_REACHED    LOGIC_CHECK, ADVERSARIAL
--     failureReason  "The build ran out of time after 922 seconds and stopped."
--     summaryMessage NULL
--
-- It stopped on the 900,000ms hard stop BETWEEN passes, which is the ceiling working. What
-- was broken is everything after: `stopBuild` rewrites the remaining passes to NOT_REACHED,
-- `nextPassKey` only ever returns a PENDING or RUNNING pass, so `isResumable` was false —
-- and `resumable` was in the API payload and rendered by nothing anyway. Charlie: *"Stopping
-- before it's finished the passes! With no re-start. Why has it stopped?"*
--
-- ⚠ `resumedAt` IS WHAT MAKES THE RESUME POSSIBLE AT ALL. `checkStop` measures elapsed from
-- `startedAt`; a build that has already used 922 of its 900 seconds would stop again before
-- its first resumed pass, for ever. The time ceiling runs from the resume. The SPEND ceiling
-- deliberately does not — it sums the usages stored on every pass, including the stopped
-- attempt's, so a resume cannot be a way round the cost ceiling.
--
-- Apply against Neon (ep-old-dust-aboxi69a) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMP(3);

-- ⚠ BOUNDED, AND THE BOUND IS ENFORCED IN CODE (MAX_RESUMES). A build that stops on the same
-- pass every time would otherwise offer "resume" for ever and spend on every press.
ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "resumeCount" INTEGER NOT NULL DEFAULT 0;

-- ⚠ WHY IT STOPPED LAST TIME, KEPT ACROSS THE RESUME. `failureReason` is cleared when the row
-- goes back to QUEUED; without this a resumed build would have nothing left saying it had ever
-- stopped, which is the "silently presents incomplete work as finished" the sprint is against.
ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "lastStopReason" TEXT;
