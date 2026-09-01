-- 25-Q §7 — a challenge gets a title, and its source moves out of the sentence.
-- Idempotent. Neon ep-old-dust-aboxi69a.
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "title"       TEXT;
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "sourceModel" TEXT;
