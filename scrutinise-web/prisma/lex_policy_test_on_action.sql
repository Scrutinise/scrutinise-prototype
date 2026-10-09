-- LEX decision 138 (9 Oct 2026) — ONE LIST. The policy-test verdict lives ON THE ACTION.
--
-- Since decision 111 the consolidation's actions are written straight into the main Coherent Actions list, and a separate box above
-- the list ("Added from the consolidation") carried what the test said about each one. The box is removed, so what it carried must
-- not depend on the box's data. Until now the verdict, the one-line reason and the sources lived ONLY on `ActionIdea` (joined by
-- `acceptedActionId`); they move to the action itself.
--
--   policyTestVerdict  FITS | DOES_NOT_FIT | CONFLICTS | NOT_TESTED   (NULL = the action never went through the consolidation test:
--                      the user's own, or Lex's from another route — and that is said in words, not shown as "fits")
--   policyTestReason   one line
--   policyTestFrom     JSON array of strings, e.g. ["parked with policy 2 (item 15)", "your comment on the claude-opus-5 draft"]
--
-- Additive, nullable. `ActionIdea` is kept as it was (it still holds ideas that are HELD and not yet written).
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "policyTestVerdict" TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "policyTestReason" TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "policyTestFrom" JSONB;
