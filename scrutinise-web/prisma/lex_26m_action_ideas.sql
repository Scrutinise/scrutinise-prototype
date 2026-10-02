-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-M addendum — coherent-action ideas held from consolidation drafts.
--
-- ⚠ ADDITIVE ONLY. One new table, one new nullable column. Every existing row reads exactly as it
-- did before this ran. Idempotent. Apply with scripts/apply-sql.ts (after scripts/whichdb.ts).
--
-- No partial or expression index here, so docs/CLAUDE.md §21's register is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "GuidingPolicyDraft" ADD COLUMN IF NOT EXISTS "actionsExtractedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ActionIdea" (
  "id"               TEXT NOT NULL,
  "ideaId"           TEXT NOT NULL,
  -- Deliberately NOT a foreign key — see the model's comment in schema.prisma.
  "consolidationId"  TEXT,
  "status"           TEXT NOT NULL DEFAULT 'HELD',
  "text"             TEXT NOT NULL,
  "verdict"          TEXT,
  "reason"           TEXT,
  "sources"          JSONB NOT NULL,
  "testedAgainstId"  TEXT,
  "acceptedActionId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionIdea_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ActionIdea" ADD CONSTRAINT "ActionIdea_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ActionIdea_ideaId_status_idx" ON "ActionIdea"("ideaId", "status");
