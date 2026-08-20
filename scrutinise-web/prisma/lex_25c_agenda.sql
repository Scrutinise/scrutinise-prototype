-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-C §3a — THE REVIEW AGENDA'S DECISIONS. Additive schema deltas.
-- Idempotent; safe to re-run.
--
-- Apply to Neon (NEVER `prisma db push` — see docs/CLAUDE.md §16):
--   cd scrutinise-web
--   npm run whichdb                 # confirm the host first, every time
--   npx prisma db execute --file prisma/lex_25c_agenda.sql
--   npx prisma generate
--
-- THREE COLUMNS ON `BuildFork`, ALL ADDITIVE AND ALL NULLABLE. Nothing is dropped, renamed
-- or rewritten, and a nullable column added without a default does not rewrite the table.
--
-- ⚠ WHY THE FORK NEEDED ANYTHING AT ALL. §3a asks for each fork to be rendered as a genuine
-- choice — "what Lex chose, the alternative, the case for each, and **Lex's recommendation
-- with its reasoning shown**" — and for choosing to resolve it while KEEPING both. The row
-- already held `chosen`, `alternative`, `caseForAlternative` and a `resolved` boolean. Two
-- things were missing and neither can be derived:
--
--   recommendationReason  WHY Lex chose what it chose. `caseForAlternative` is the case for
--                         the road NOT taken; there was never a field for the case for the
--                         one it did take, so the panel could show the alternative argued
--                         for and the recommendation asserted. A user cannot weigh a
--                         recommendation whose reasoning is absent — they can only defer to
--                         it, which is the opposite of what the agenda is for.
--
--   resolvedChoice        WHICH WAY the user went. `resolved` is a boolean: it records THAT
--                         a decision happened and loses WHAT was decided. 25-C turns forks
--                         into decisions, so the decision has to be readable afterwards —
--                         and §3a is explicit that "the record keeps both, because a
--                         proposal that shows what it considered and set aside is stronger
--                         than one that looks inevitable."
--
--   resolvedAt            When. Ordinary provenance; a decision with no date cannot be told
--                         apart from a default.
--
-- ⚠ `resolvedChoice` IS A STRING, NOT A BOOLEAN OR AN INDEX. It stores `'chosen'` or
-- `'alternative:<n>'`. A boolean would have repeated the mistake being fixed, and a bare
-- integer would silently point at the wrong row the day the alternatives are reordered.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "BuildFork"
  ADD COLUMN IF NOT EXISTS "recommendationReason" TEXT;

ALTER TABLE "BuildFork"
  ADD COLUMN IF NOT EXISTS "resolvedChoice" TEXT;

ALTER TABLE "BuildFork"
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

-- The agenda reads a build's forks grouped by decision point, newest build first.
CREATE INDEX IF NOT EXISTS "BuildFork_ideaId_resolved_idx"
  ON "BuildFork" ("ideaId", "resolved");
