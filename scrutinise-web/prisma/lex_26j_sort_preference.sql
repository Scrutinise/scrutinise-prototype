-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-J §4 — the sort preference, off localStorage, onto the user record.
--
-- ⚠ ADDITIVE ONLY. One nullable column, idempotent. Same pattern `User.lexPanelLayout`
-- already uses for exactly the same reason (a per-device store not following the user).
--
-- Apply against Neon (neondb) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ideaSortMode" TEXT;
