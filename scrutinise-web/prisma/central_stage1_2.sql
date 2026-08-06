-- CENTRAL Stage 1.2 — membership, join requests & roles (2026-08-06)
-- Additive + idempotent. Safe to re-run. HAND-WRITTEN, not taken from
-- `prisma migrate diff` — that command still wants to drop the 914k-row
-- LegislationSection_DEPRECATED table and specialist_queue because schema.prisma
-- has long-standing unrelated drift (docs/CLAUDE.md §16, handoff 29 Jul entry).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb). Confirm with
-- scripts/whichdb.ts before running.
--
-- One table, one partial unique index, one backfill.

-- 1 ─────────────────────────────────────────────────────────────────────────
-- Join requests. Column types mirror the surrounding Community tables: TEXT ids
-- (uuid strings), TIMESTAMP(3) to match Prisma's DateTime mapping.
CREATE TABLE IF NOT EXISTS "CommunityJoinRequest" (
  "id"              TEXT         NOT NULL,
  "communityId"     TEXT         NOT NULL,
  "userId"          TEXT         NOT NULL,
  "status"          TEXT         NOT NULL DEFAULT 'PENDING',
  "message"         TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt"       TIMESTAMP(3),
  "decidedByUserId" TEXT,
  CONSTRAINT "CommunityJoinRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityJoinRequest_communityId_fkey') THEN
    ALTER TABLE "CommunityJoinRequest"
      ADD CONSTRAINT "CommunityJoinRequest_communityId_fkey"
      FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityJoinRequest_userId_fkey') THEN
    ALTER TABLE "CommunityJoinRequest"
      ADD CONSTRAINT "CommunityJoinRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityJoinRequest_decidedByUserId_fkey') THEN
    ALTER TABLE "CommunityJoinRequest"
      ADD CONSTRAINT "CommunityJoinRequest_decidedByUserId_fkey"
      FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CommunityJoinRequest_communityId_status_idx"
  ON "CommunityJoinRequest" ("communityId", "status");
CREATE INDEX IF NOT EXISTS "CommunityJoinRequest_userId_status_idx"
  ON "CommunityJoinRequest" ("userId", "status");

-- 2 ─────────────────────────────────────────────────────────────────────────
-- The duplicate-pending guard. PARTIAL on purpose: a plain unique on
-- (communityId, userId) would make a declined request permanently
-- un-repeatable, and re-requesting after a decline is deliberately allowed this
-- sprint. Prisma's schema language cannot express this, so it lives only here —
-- see the model comment in schema.prisma before running any migrate diff.
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityJoinRequest_pending_unique"
  ON "CommunityJoinRequest" ("communityId", "userId")
  WHERE "status" = 'PENDING';

-- 3 ─────────────────────────────────────────────────────────────────────────
-- Invariant introduced this sprint: belonging to a branch means belonging to
-- the Community it sits in. Branch invites now write both rows; this repairs
-- anyone who joined a branch before that rule existed.
--
-- Roots are resolved by walking parentCommunityId upward. Existing root
-- membership (and its role) is never overwritten — the insert only fills gaps,
-- and always at MEMBER, since a branch OWNER is not thereby an owner of the
-- whole Community.
WITH RECURSIVE up AS (
  SELECT c."id" AS node_id, c."id" AS cursor_id, c."parentCommunityId"
  FROM "Community" c
  UNION ALL
  SELECT u.node_id, p."id", p."parentCommunityId"
  FROM up u
  JOIN "Community" p ON p."id" = u."parentCommunityId"
),
roots AS (
  SELECT node_id, cursor_id AS root_id FROM up WHERE "parentCommunityId" IS NULL
)
INSERT INTO "CommunityMember" ("id", "communityId", "userId", "role", "joinedAt", "lastReadAt")
-- lastReadAt is set to now, not to joinedAt: a backfilled root membership
-- should not arrive with a pile of "unread" posts the person never missed.
SELECT gen_random_uuid(), r.root_id, m."userId", 'MEMBER', m."joinedAt", CURRENT_TIMESTAMP
FROM "CommunityMember" m
JOIN roots r ON r.node_id = m."communityId"
WHERE r.root_id <> m."communityId"
  AND NOT EXISTS (
    SELECT 1 FROM "CommunityMember" existing
    WHERE existing."communityId" = r.root_id AND existing."userId" = m."userId"
  );
