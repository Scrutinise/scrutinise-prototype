-- CENTRAL Stage 1.1 — user-test fixes (2026-08-06)
-- Additive + idempotent. Safe to re-run.
--
-- Two columns and one data migration:
--   1. BulletinPost.scope        — the composer's "Post to" reach selector.
--   2. Community.bulletinCategories — per-Community category set, seeded with
--      the agreed six. No admin category-management UI at this stage.
--   3. Existing posts migrated off the retired category names.
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb). Confirm with
-- scripts/whichdb.ts before running — see docs/CLAUDE.md §16.

-- 1 ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "BulletinPost"
  ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'BRANCH';

CREATE INDEX IF NOT EXISTS "BulletinPost_scope_parentId_idx"
  ON "BulletinPost" ("scope", "parentId");

-- 2 ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "Community"
  ADD COLUMN IF NOT EXISTS "bulletinCategories" TEXT[] NOT NULL DEFAULT '{}';

-- Seed/migrate every existing Community to the agreed set, in order.
-- "Announcements" is deliberately absent. Only touches Communities that do not
-- already carry exactly this set, so re-running is a no-op.
UPDATE "Community"
SET "bulletinCategories" = ARRAY[
  'Canvassing',
  'Building Members',
  'Public Debates',
  'Training',
  'Running Councils',
  'Questions'
]::TEXT[]
WHERE "bulletinCategories" IS DISTINCT FROM ARRAY[
  'Canvassing',
  'Building Members',
  'Public Debates',
  'Training',
  'Running Councils',
  'Questions'
]::TEXT[];

-- 3 ─────────────────────────────────────────────────────────────────────────
-- Retired Stage 1 categories → the new set. "Training — offers & requests" is
-- an exact rename. "Announcements" and "General" have no successor concept, so
-- both fall to "Questions", the nearest general-purpose bucket — recorded here
-- because the choice is a judgement call, not a derivation.
UPDATE "BulletinPost" SET "category" = 'Training'
  WHERE "category" = 'Training — offers & requests';
UPDATE "BulletinPost" SET "category" = 'Questions'
  WHERE "category" IN ('Announcements', 'General');

-- 4 ─────────────────────────────────────────────────────────────────────────
-- Idea teams: a Group's creator was never written in as a GroupMember, so
-- every team on the platform had zero members and the dashboard's
-- "My Communities and teams" section — which reads memberships — showed
-- Communities alone. New teams get the row at creation; this backfills the
-- ones made before that fix, and repairs the cached memberCount with it.
INSERT INTO "GroupMember" ("id", "groupId", "userId", "role", "joinedAt")
SELECT gen_random_uuid(), g."id", g."ownerId", 'OWNER', g."createdAt"
FROM "Group" g
WHERE NOT EXISTS (
  SELECT 1 FROM "GroupMember" m WHERE m."groupId" = g."id" AND m."userId" = g."ownerId"
);

UPDATE "Group" g
SET "memberCount" = sub.n
FROM (SELECT "groupId", COUNT(*)::int AS n FROM "GroupMember" GROUP BY "groupId") sub
WHERE sub."groupId" = g."id" AND g."memberCount" IS DISTINCT FROM sub.n;
