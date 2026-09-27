-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-J §2b — "Delete archives; it does not destroy."
--
-- ⚠ ADDITIVE ONLY. Two nullable columns, nothing dropped, idempotent.
--
-- Neither `Research` nor `IdeaUserMaterial` had an archive concept before this — deleting
-- either destroyed the row outright. This gives both the same `archivedAt` pattern
-- `Idea.archivedAt` already uses (prisma/lex_25o.sql): hidden from every list, row kept.
--
-- Apply against Neon (neondb) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Research" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "IdeaUserMaterial" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
