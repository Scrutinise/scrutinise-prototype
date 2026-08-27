-- CENTRAL Stage 2g + items 12–14 (2026-08-27)
-- Additive. Idempotent. Safe to re-run. HAND-WRITTEN (docs/CLAUDE.md §16, §21).
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- Four things in one file because they are one feature: a Community decides what
-- "approved" means (item 12), answers and resources carry that stamp and a
-- context note (item 13), answers may be a video (item 14), and Resources is the
-- new tab those live on (2g).

-- 1 ── item 12: Community settings, ROOT ONLY ────────────────────────────────
-- ⚠ Generic platform machinery. Nothing party-specific is hard-coded — every
--   Community sets its own values, and the seed at the bottom is data, not code.
CREATE TABLE IF NOT EXISTS "CommunitySettings" (
  "id"                     TEXT         NOT NULL,
  "communityId"            TEXT         NOT NULL,
  -- Used wherever the approval label appears. Null = the Community has not set one.
  "organisationName"       TEXT,
  -- Hex, for the approval frame.
  "organisationColour"     TEXT,
  -- Hidden removes the name, the colour frame and the superscript entirely.
  -- ⚠ It does NOT delete approval data — re-enabling restores it.
  "approvalFeatureEnabled" BOOLEAN      NOT NULL DEFAULT true,
  -- SELF | BRANCH_ADMIN | COMMUNITY_ADMIN | NAMED
  "approvalMode"           TEXT         NOT NULL DEFAULT 'SELF',
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunitySettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunitySettings_communityId_key"
  ON "CommunitySettings" ("communityId");

-- The NAMED mode's picker.
CREATE TABLE IF NOT EXISTS "CommunityApprover" (
  "id"          TEXT         NOT NULL,
  "communityId" TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityApprover_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityApprover_communityId_userId_key"
  ON "CommunityApprover" ("communityId", "userId");

-- 2 ── item 13 + 14 on Answer ────────────────────────────────────────────────
-- ⚠ `context` is PERMANENT and is never hidden by the item-12 toggle. It is a
--   note about when and how to use the material, which is useful whether or not
--   anybody has stamped it.
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "context"          TEXT;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "approvedAt"       TIMESTAMP(3);
-- Item 14: link only, no hosting, per the standing decision.
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "videoUrl"         TEXT;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "videoTitle"       TEXT;

-- 3 ── Stage 2g: Resource ────────────────────────────────────────────────────
-- ⚠ EITHER a file OR a link, never both required. Video and websites are links
--   only — no hosting — so `fileKey` stays null for those.
CREATE TABLE IF NOT EXISTS "Resource" (
  "id"                TEXT         NOT NULL,
  "communityId"       TEXT         NOT NULL,
  "branchId"          TEXT,
  "authorId"          TEXT         NOT NULL,
  -- MEME | FLYER | SOCIAL | VIDEO | TRAINING | EVENT_PACK | WEBSITE | MERCH | TEMPLATE
  "type"              TEXT         NOT NULL,
  "title"             TEXT         NOT NULL,
  -- Required. It is what makes the tab worth browsing rather than a file dump.
  "whyUseful"         TEXT         NOT NULL,
  "context"           TEXT,
  "topicTags"         TEXT[]       NOT NULL DEFAULT '{}',
  -- R2 object key, when a file was uploaded. The bucket stays private; the app
  -- serves a signed URL.
  "fileKey"           TEXT,
  "fileName"          TEXT,
  "fileType"          TEXT,
  "fileSize"          INTEGER,
  "externalUrl"       TEXT,
  -- COMMUNITY | BRANCH
  "scope"             TEXT         NOT NULL DEFAULT 'COMMUNITY',
  -- ⚠ RECORDED AGAINST THE ROW, not a checkbox that vanishes. Who asserted the
  --   right to share this, and when.
  "rightsConfirmedByUserId" TEXT   NOT NULL,
  "rightsConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedByUserId"  TEXT,
  "approvedAt"        TIMESTAMP(3),
  -- MEMBER | AI — an AI-authored resource mints no points, as for answers.
  "authorType"        TEXT         NOT NULL DEFAULT 'MEMBER',
  "aiModel"           TEXT,
  "deletedAt"         TIMESTAMP(3),
  "deletedByUserId"   TEXT,
  "deletionReason"    TEXT,
  "deletedWithParent" BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Resource_communityId_type_idx" ON "Resource" ("communityId", "type");
CREATE INDEX IF NOT EXISTS "Resource_authorId_idx" ON "Resource" ("authorId");
-- ⚠ PARTIAL INDEX — schema.prisma cannot declare it; registered in §21.
CREATE INDEX IF NOT EXISTS "Resource_live_idx"
  ON "Resource" ("communityId", "createdAt") WHERE "deletedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "ResourceVote" (
  "id"         TEXT             NOT NULL,
  "resourceId" TEXT             NOT NULL,
  "userId"     TEXT             NOT NULL,
  "direction"  TEXT             NOT NULL,
  "voteWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceVote_resourceId_userId_key"
  ON "ResourceVote" ("resourceId", "userId");

-- The existing flag levels, unchanged, with the reason still required.
CREATE TABLE IF NOT EXISTS "ResourceFlag" (
  "id"          TEXT         NOT NULL,
  "resourceId"  TEXT         NOT NULL,
  "level"       TEXT         NOT NULL,
  "reason"      TEXT         NOT NULL,
  "setByUserId" TEXT         NOT NULL,
  "setAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceFlag_resourceId_key" ON "ResourceFlag" ("resourceId");

-- A visible Report action on every resource, routing to Community admins.
CREATE TABLE IF NOT EXISTS "ResourceReport" (
  "id"               TEXT         NOT NULL,
  "resourceId"       TEXT         NOT NULL,
  "reportedByUserId" TEXT         NOT NULL,
  "reason"           TEXT         NOT NULL,
  -- OPEN | RESOLVED
  "status"           TEXT         NOT NULL DEFAULT 'OPEN',
  "resolvedByUserId" TEXT,
  "resolvedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ResourceReport_resourceId_status_idx"
  ON "ResourceReport" ("resourceId", "status");

-- 4 ── foreign keys ──────────────────────────────────────────────────────────
DO $$
DECLARE fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('CommunitySettings_communityId_fkey', 'CommunitySettings', 'communityId',       'Community', 'CASCADE'),
      ('CommunityApprover_communityId_fkey', 'CommunityApprover', 'communityId',       'Community', 'CASCADE'),
      ('CommunityApprover_userId_fkey',      'CommunityApprover', 'userId',            'User',      'CASCADE'),
      ('Answer_approvedByUserId_fkey',       'Answer',            'approvedByUserId',  'User',      'SET NULL'),
      ('Resource_communityId_fkey',          'Resource',          'communityId',       'Community', 'RESTRICT'),
      ('Resource_branchId_fkey',             'Resource',          'branchId',          'Community', 'SET NULL'),
      ('Resource_authorId_fkey',             'Resource',          'authorId',          'User',      'RESTRICT'),
      ('Resource_rightsConfirmedByUserId_fkey','Resource',        'rightsConfirmedByUserId', 'User', 'RESTRICT'),
      ('Resource_approvedByUserId_fkey',     'Resource',          'approvedByUserId',  'User',      'SET NULL'),
      ('Resource_deletedByUserId_fkey',      'Resource',          'deletedByUserId',   'User',      'SET NULL'),
      ('ResourceVote_resourceId_fkey',       'ResourceVote',      'resourceId',        'Resource',  'CASCADE'),
      ('ResourceVote_userId_fkey',           'ResourceVote',      'userId',            'User',      'CASCADE'),
      ('ResourceFlag_resourceId_fkey',       'ResourceFlag',      'resourceId',        'Resource',  'CASCADE'),
      ('ResourceFlag_setByUserId_fkey',      'ResourceFlag',      'setByUserId',       'User',      'RESTRICT'),
      ('ResourceReport_resourceId_fkey',     'ResourceReport',    'resourceId',        'Resource',  'CASCADE'),
      ('ResourceReport_reportedByUserId_fkey','ResourceReport',   'reportedByUserId',  'User',      'CASCADE'),
      ('ResourceReport_resolvedByUserId_fkey','ResourceReport',   'resolvedByUserId',  'User',      'SET NULL')
    ) AS t(name, tbl, col, ref, ondelete)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I("id") ON DELETE %s ON UPDATE CASCADE',
        fk.tbl, fk.name, fk.col, fk.ref, fk.ondelete
      );
    END IF;
  END LOOP;
END $$;

-- 5 ── seed THIS Community's settings (item 12) ──────────────────────────────
-- ⚠ DATA, NOT CODE. Reform UK's name and colour live in a row, so a second
--   Community sets its own without a deploy.
--
-- ⚠ #17B9D1 vs the platform's live-state teal #14b8a6 measures ΔE2000 15.14 —
--   plainly different side by side, but both read as "teal" at the size a border
--   and a superscript actually render. Per the brief's contingency, the approval
--   frame is therefore distinguished by BORDER WEIGHT and its LABEL, with colour
--   as reinforcement only. A party stamp must not read as a platform state.
INSERT INTO "CommunitySettings"
  ("id", "communityId", "organisationName", "organisationColour", "approvalFeatureEnabled", "approvalMode")
SELECT gen_random_uuid(), c."id", 'Reform UK', '#17B9D1', true, 'SELF'
FROM "Community" c
WHERE c."parentCommunityId" IS NULL
  AND c."name" = 'Reform Branch Community'
  AND NOT EXISTS (SELECT 1 FROM "CommunitySettings" s WHERE s."communityId" = c."id");

DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM "CommunitySettings";
  RAISE NOTICE 'CommunitySettings rows: %', n;
END $$;
