-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-B / AMENDMENT_25B §C4 — "email me when it's done". Additive schema deltas.
-- Idempotent; safe to re-run.
--
-- Apply to Neon (NEVER `prisma db push` — see docs/CLAUDE.md §16):
--   cd scrutinise-web
--   npm run whichdb                        # confirm the host first, every time
--   DIRECT_URL="<neon direct url>" npx prisma db execute --file prisma/lex_build_25b.sql --schema prisma/schema.prisma
--   npx prisma generate
--
-- TWO COLUMNS, BOTH ADDITIVE, BOTH DEFAULTED. Nothing is dropped, renamed or rewritten;
-- on PostgreSQL 11+ a column added with a constant default does not rewrite the table, so
-- this is safe against `User`, which is the largest table either statement touches.
--
-- ⚠ WHY TWO COLUMNS AND NOT ONE. They answer different questions and would go wrong if
-- merged:
--
--   User.emailOnBuildComplete   — the user's REMEMBERED DEFAULT. §C4: "Remember the
--                                 choice per user as a default they can change." It is
--                                 what the checkbox is pre-set to next time.
--
--   IdeaBuild.notifyEmail       — the choice made for THIS BUILD, frozen at enqueue.
--                                 The worker reads it minutes later, on another machine,
--                                 and it must send according to what the user asked for
--                                 WHEN THEY STARTED IT — not according to a preference
--                                 they may have changed in another tab since. A single
--                                 column on User would have made the setting retroactive.
--
-- ⚠ AND NEITHER IS A CONSENT RECORD. `EmailSuppression` remains the authority on whether
-- we may email an address at all, and the send path checks it (docs/CLAUDE.md §7 item 8).
-- A user asking for one build notification is not a standing permission.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailOnBuildComplete" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "IdeaBuild"
  ADD COLUMN IF NOT EXISTS "notifyEmail" BOOLEAN NOT NULL DEFAULT false;

-- The estimate (§C4) reads the last 20 DONE builds by `completedAt`. Without this it is a
-- sort over every build row on every page load of /ideas/build.
CREATE INDEX IF NOT EXISTS "IdeaBuild_status_completedAt_idx"
  ON "IdeaBuild" ("status", "completedAt" DESC);
