-- 25-T §1f — how many times the WORKER has resumed a build on its own.
--
-- ⚠ SEPARATE FROM `resumeCount`, WHICH IS THE USER'S. §1f bounds the automatic attempts at two;
-- 25-N bounds the user's at three (MAX_RESUMES). Sharing one counter would mean a build the
-- worker retried twice left the user only one press — spending their allowance of patience on
-- our own retries.
--
-- Idempotent. Neon ep-old-dust-aboxi69a.
ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "autoResumeCount" INTEGER NOT NULL DEFAULT 0;
