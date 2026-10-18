-- LEX 26-S2 decisions 188 + 190 (18 Oct 2026). All additive and nullable / defaulted; no index (the list per idea is small).
--   Idea.conditions                  the ordered list of conditions the proposal must meet ({ items:[{id,text,by,at}], proposals:[{id,text,why}], source? })
--   LexCoherentAction.conditionIds   which conditions the action delivers (many); supportOnly = marked "support": delivers none directly
--   LexCoherentAction.foldedIntoId   190 Consolidate: the mechanism this component was folded into (status ARCHIVED; Restore unfolds it)
--   LexCoherentAction.headingWasId / headingReason   190 Re-sort: the heading it was on before, and the reason Lex gave for the new one (reversible)
--   ActionHeading.archivedAt         190: a retired heading is ARCHIVED, never deleted (lib/prisma.ts hides archived headings from direct reads)
-- Apply with `npx tsx scripts/whichdb.ts` first (16); commit with schema.prisma in one commit.
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "conditions" JSONB;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "conditionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "supportOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "foldedIntoId" TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "headingWasId" TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "headingReason" TEXT;
ALTER TABLE "ActionHeading" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
--   Idea.headingPlan                 190: the instrument headings the Re-sort pass sorts into ({ targets:[{name,purpose}], source }); the button shows only when one is set
--   LexCoherentAction.foldedAdded    190: the condition / cause ids a Consolidate added to the mechanism from this component, so Restore can take back exactly those
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "headingPlan" JSONB;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "foldedAdded" JSONB;
