-- ─────────────────────────────────────────────────────────────────────────────
-- 25-P §2a — EvidenceItem gets somewhere to put a date.
--
-- ⚠ Two columns, not one. `sourceDate` is the date; `sourceDateBasis` is how it was got or
-- why there is none. §2c requires an undated row to be VISIBLY undated and COUNTED, and a
-- lone nullable date cannot tell "this source has no date" from "nothing has looked yet".
--
-- Idempotent. Applied to Neon ep-old-dust-aboxi69a.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "sourceDate"      TIMESTAMP(3);
ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "sourceDateBasis" TEXT;

CREATE INDEX IF NOT EXISTS "EvidenceItem_ideaId_sourceDateBasis_idx"
  ON "EvidenceItem" ("ideaId", "sourceDateBasis");
