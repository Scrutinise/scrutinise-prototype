-- Lex rebuild — Sprint 1 (Page 1 + canonical state). Additive, idempotent.
-- Applied to Neon (production app DB after the V26 cutover). NOT applied to Railway.
-- See docs/LEX_REBUILD_DESIGN.md §3, §6, §8.

-- Per-field state machine enum (§3.2)
DO $$ BEGIN
  CREATE TYPE "FieldStatus" AS ENUM ('EMPTY','AWAITING_CONFIRMATION','ACCEPTED','SKIPPED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- User profile (Box 3 "About you", reused across ideas)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aboutYouNarrative" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileSlots" JSONB;

-- Idea Page 1 boxes + generated outputs
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "ideaNarrative" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "youAndIdeaNarrative" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "ideaSlots" JSONB;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "keywords" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "ideaContext" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "legislationRefs" JSONB;

-- Field-state machine table (server-authoritative; §3.2 / §3.4)
CREATE TABLE IF NOT EXISTS "IdeaFieldState" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "status" "FieldStatus" NOT NULL DEFAULT 'EMPTY',
  "value" TEXT,
  "proposal" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaFieldState_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "IdeaFieldState" ADD CONSTRAINT "IdeaFieldState_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaFieldState_ideaId_fieldKey_key" ON "IdeaFieldState"("ideaId","fieldKey");
CREATE INDEX IF NOT EXISTS "IdeaFieldState_ideaId_idx" ON "IdeaFieldState"("ideaId");

-- Initial Background document (§8.2)
CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "summary" TEXT,
  "body" TEXT,
  "docxUrl" TEXT,
  "pdfUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "Document_ideaId_kind_key" ON "Document"("ideaId","kind");
CREATE INDEX IF NOT EXISTS "Document_ideaId_idx" ON "Document"("ideaId");
