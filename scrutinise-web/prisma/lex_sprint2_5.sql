-- Lex — Sprint 2.5 (feedback capture §20.5 + document export §8.2). Additive, idempotent.
-- Applied to the APP Neon DB (ep-old-dust-aboxi69a / neondb) via `prisma db execute`.
-- NEVER `prisma db push` (docs/CLAUDE.md §16), and never against Railway.

-- ── §20.5 Feedback capture ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "FeedbackSurface" AS ENUM ('BRIEFING','CAUSES','OPTIONS','COSTS','OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "FeedbackItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "surface" "FeedbackSurface" NOT NULL DEFAULT 'OTHER',
  "originalText" TEXT NOT NULL,
  "summarisedText" TEXT NOT NULL,
  "userEdited" BOOLEAN NOT NULL DEFAULT false,
  "consentGiven" BOOLEAN NOT NULL DEFAULT true,
  "sentAt" TIMESTAMP(3),
  "sendError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FeedbackItem_ideaId_idx" ON "FeedbackItem"("ideaId");
CREATE INDEX IF NOT EXISTS "FeedbackItem_userId_idx" ON "FeedbackItem"("userId");
CREATE INDEX IF NOT EXISTS "FeedbackItem_createdAt_idx" ON "FeedbackItem"("createdAt");

DO $$ BEGIN
  ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── §8.2 Document export (docx + PDF) ────────────────────────────────────────
-- docxUrl/pdfUrl already exist and hold the app download path; the R2 object key
-- and the generation provenance are new. A signed URL expires, so it is never
-- stored — the key is, and a fresh 24h URL is minted per download.
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "docxKey" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "pdfKey" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceFingerprint" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceLabel" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "exportError" TEXT;
