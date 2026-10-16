-- LEX 26-S decision 154 (16 Oct 2026) — the feedback admin list. Additive only.
-- FeedbackItem was written and emailed but listed nowhere. It gains Feedback's lifecycle (NEW | TRIAGED | RESOLVED | WONTFIX),
-- the admin's notes, and when the status last changed. Existing rows become NEW. No partial or expression index (CLAUDE.md §21).
-- Apply with `npx tsx scripts/whichdb.ts` first (§16); commit with schema.prisma in one commit.
ALTER TABLE "FeedbackItem" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "FeedbackItem" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "FeedbackItem" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "FeedbackItem_status_createdAt_idx" ON "FeedbackItem"("status", "createdAt");
