-- ─────────────────────────────────────────────────────────────────────────────
-- §19-E Task 6 — DELETE AN IDEA. Additive schema delta. Idempotent; safe to re-run.
--
-- Apply to Neon (NEVER `prisma db push` — see docs/CLAUDE.md §16 and the playbook):
--   cd scrutinise-web
--   npm run whichdb                        # confirm the host first, every time
--   npx prisma db execute --file prisma/idea_soft_delete.sql
--   npx prisma generate
--
-- WHY A NEW COLUMN RATHER THAN `status = 'ARCHIVED'` OR `status = 'WITHDRAWN'`.
--
-- Both of those already mean something. WITHDRAWN is a Stage 4/5 act — a proposal
-- taken back out of public circulation, which is a position the owner has taken and
-- which other people can see. ARCHIVED is a housekeeping state for an idea that has
-- run its course. Neither means "I never want to see this again", and overloading one
-- of them would make every later query about archived or withdrawn ideas silently
-- include deleted ones, in a codebase where `status: 'ACTIVE'` filters already differ
-- from surface to surface (the dashboard has no status filter at all; /ideas has one).
--
-- // A deleted idea and an archived one differ in what the OWNER meant. Storing them
-- // in the same column loses the distinction the moment anybody writes a filter.
--
-- SOFT, because the brief asks for the cheapest thing to reverse: an accidental delete
-- is a single UPDATE away from being undone, and the alternative — a cascade across
-- twenty related tables — is not reversible at all. `deletedAt` also records WHEN,
-- which a boolean would not.
--
-- Charlie's reason for wanting it, recorded because it sets the bar: he has pre-rebuild
-- ideas that cannot exercise the current flow and are polluting his testing. The test
-- of this feature is that those disappear from his list.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Partial index: the overwhelmingly common query is "the live ones", and a partial
-- index over the live rows stays small as deleted rows accumulate.
CREATE INDEX IF NOT EXISTS "Idea_creatorId_live_idx" ON "Idea" ("creatorId") WHERE "deletedAt" IS NULL;
