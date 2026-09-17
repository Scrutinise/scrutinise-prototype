-- LEX — a generated document is bound to the build it records (17 Sep 2026).
--
-- Pilot feedback (Angus Barry): the Initial Background Briefing is a frozen snapshot of a
-- build's first pass, and its companion, Initial Questions, is a snapshot of what that same
-- build needs from the user. Both are stamped with the build so the pair reads as one thing.
-- Until now nothing recorded which build wrote a Document row; the only dating was the
-- row's updatedAt and the ORIENT search time, and "which build" was an inference.
--
-- Additive and nullable: no existing row changes, no existing query changes. buildVersion is
-- denormalised beside buildId deliberately — the stamp must survive the build row being
-- removed (ON DELETE SET NULL keeps the document; the version keeps the label).

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "buildId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "buildVersion" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Document_buildId_fkey'
  ) THEN
    ALTER TABLE "Document"
      ADD CONSTRAINT "Document_buildId_fkey"
      FOREIGN KEY ("buildId") REFERENCES "IdeaBuild"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Document_buildId_idx" ON "Document"("buildId");
