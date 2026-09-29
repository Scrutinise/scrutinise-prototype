-- 26-L addendum 3 §5 — COST COLUMNS WERE INTEGER PENCE, SO EVERY CONSOLIDATION WAS UNDERCOUNTED.
--
-- GuidingPolicyDraft.costPence and GuidingPolicyConsolidation.costPence were `Int`. A draft
-- that cost 0.07p was stored as 0 and read "£0.00"; 1.73p stored as 1; 3.14p as 3; and the
-- consolidation total was the sum of already-rounded pieces. The ledger (LlmSpend.estCostPence)
-- was exact all along — only these two columns lost the fraction.
--
-- DOUBLE PRECISION is the same widening as LlmSpend.estCostPence's own numeric use; existing
-- integer values convert exactly. Additive in effect: no row is rewritten lossily.
-- Not a partial or expression index — nothing here for docs/CLAUDE.md §21's register.

ALTER TABLE "GuidingPolicyDraft"         ALTER COLUMN "costPence" TYPE DOUBLE PRECISION;
ALTER TABLE "GuidingPolicyConsolidation" ALTER COLUMN "costPence" TYPE DOUBLE PRECISION;
