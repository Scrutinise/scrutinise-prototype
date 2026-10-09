-- LEX 26-R follow-up — ResearchNote.sourceId: RESTRICT -> NO ACTION.
--
-- RESTRICT is checked IMMEDIATELY, so deleting a whole idea (which cascades to both IdeaSource and ResearchNote) could fail depending
-- on which of the two Postgres removed first — and a failed hard delete of an idea is exactly the kind of fault that surfaces months
-- later. NO ACTION is checked at the END of the statement, after every cascade has run, so the idea cascade passes — while deleting a
-- single source that notes still cite is STILL refused. Sources are never deleted by the product anyway (they archive); this keeps
-- that guard without making an idea undeletable.
ALTER TABLE "ResearchNote" DROP CONSTRAINT IF EXISTS "ResearchNote_sourceId_fkey";
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IdeaSource"("id") ON DELETE NO ACTION;
