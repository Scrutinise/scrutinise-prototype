-- LEX 26-S decision 159, step 2 (17 Oct 2026) — a duplicate cause number cannot be stored. Apply ONLY after the deployment carrying the code that leaves `number` to the trigger
-- has been read back from /api/health (see lex_26s_cause_number.sql). Plain unique index (no WHERE, no expression — CLAUDE.md §21 register unchanged). NULLs may repeat.
DROP INDEX IF EXISTS "DiagnosisCause_ideaId_number_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "DiagnosisCause_ideaId_number_key" ON "DiagnosisCause"("ideaId", "number");
