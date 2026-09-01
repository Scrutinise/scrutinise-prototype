-- 25-S §2a — a stable number on every cause, exactly as PolicyOption has one.
-- ⚠ NOT orderIndex: that is the display position and MOVES when the list is reordered.
-- Idempotent. Neon ep-old-dust-aboxi69a.
ALTER TABLE "DiagnosisCause" ADD COLUMN IF NOT EXISTS "number" INTEGER;
CREATE INDEX IF NOT EXISTS "DiagnosisCause_ideaId_number_idx" ON "DiagnosisCause" ("ideaId", "number");
