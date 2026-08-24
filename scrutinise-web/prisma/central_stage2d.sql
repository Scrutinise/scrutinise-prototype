-- CENTRAL Stage 2d — training exchange, bulk upload, navigation (2026-08-24)
-- Additive + idempotent. Safe to re-run. HAND-WRITTEN, not from
-- `prisma migrate diff` — that still wants to drop the 914k-row
-- LegislationSection_DEPRECATED table and specialist_queue (docs/CLAUDE.md §16).
-- Column types match the rest of Central: TEXT ids, TIMESTAMP(3).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- Four tables, one User column, one config row, and the tag-promotion update.
--
-- ⚠ TrainingSession WAS A STAGE 2c ITEM AND STAGE 2c WAS NEVER BUILT. There is
--   no central_stage2c.sql, no TrainingSession model and no `authorType` column
--   anywhere in this database — the 2d brief assumes 2c landed and it did not.
--   The table is created here because "Log this session" is a 2d acceptance
--   criterion and cannot exist without it. When 2c is built it must ADD to this
--   table, not recreate it.
--
-- ⚠ NO PARTIAL OR EXPRESSION INDEXES IN THIS FILE. Stage 1.2 and Stage 2 each
--   left one invisible to schema.prisma; every uniqueness rule below is a plain
--   composite, so schema.prisma tells the whole truth about 2d.

-- 1 ── the optional phone number ─────────────────────────────────────────────
-- Used for NOTHING except training contact sharing. It is entered by the user
-- in their own settings, is never required, and is never read by any surface
-- other than an accepted TrainingMatch (asserted by check:central).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- 2 ── the training exchange ─────────────────────────────────────────────────
-- Scoped to ONE Community (the root). No cross-Community and no public
-- listings at this stage — `communityId` is always the root id, the same rule
-- the question library follows.
CREATE TABLE IF NOT EXISTS "TrainingListing" (
  "id"           TEXT         NOT NULL,
  "communityId"  TEXT         NOT NULL,
  "authorId"     TEXT         NOT NULL,
  -- OFFER | REQUEST
  "kind"         TEXT         NOT NULL,
  "topic"        TEXT         NOT NULL,
  "description"  TEXT         NOT NULL,
  -- Free text on purpose: "Tuesday evenings, or a Saturday morning at a push"
  -- is the real answer and no structured field holds it.
  "availability" TEXT         NOT NULL DEFAULT '',
  -- What the AUTHOR consents to share once a match is accepted by both sides.
  "shareEmail"   BOOLEAN      NOT NULL DEFAULT false,
  "sharePhone"   BOOLEAN      NOT NULL DEFAULT false,
  -- OPEN | MATCHED | CLOSED
  "status"       TEXT         NOT NULL DEFAULT 'OPEN',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TrainingListing_communityId_status_idx" ON "TrainingListing" ("communityId", "status");
CREATE INDEX IF NOT EXISTS "TrainingListing_communityId_kind_idx"   ON "TrainingListing" ("communityId", "kind");
CREATE INDEX IF NOT EXISTS "TrainingListing_authorId_idx"           ON "TrainingListing" ("authorId");

-- A listing may carry several proposals; accepting one sets the listing to
-- MATCHED and the others stay PROPOSED until the author declines them.
--
-- ⚠ TWO ACCEPTANCE TIMESTAMPS, NOT ONE. "Both sides have accepted" is the
--   condition that reveals contact details, so it is stored as two facts that
--   can be read back rather than inferred from a status string.
--   `responderAcceptedAt` is stamped when the proposal is created — the
--   responder is shown exactly what of theirs will be shared, and to whom,
--   before that request is sent. `authorAcceptedAt` is stamped when the
--   listing's author accepts.
--
-- ⚠ CLOSING IS NOT A STATUS. The brief's status set is PROPOSED/ACCEPTED/
--   DECLINED; a closed match must still record that it WAS accepted (otherwise
--   the training history loses the fact a match ever happened), so closure is
--   its own pair of columns.
CREATE TABLE IF NOT EXISTS "TrainingMatch" (
  "id"                  TEXT         NOT NULL,
  "listingId"           TEXT         NOT NULL,
  "responderId"         TEXT         NOT NULL,
  -- PROPOSED | ACCEPTED | DECLINED
  "status"              TEXT         NOT NULL DEFAULT 'PROPOSED',
  "message"             TEXT,
  -- What the RESPONDER consents to share. Independent of the listing's own
  -- ticks: if one side ticked email only, the other sees email only.
  "shareEmail"          BOOLEAN      NOT NULL DEFAULT false,
  "sharePhone"          BOOLEAN      NOT NULL DEFAULT false,
  "responderAcceptedAt" TIMESTAMP(3),
  "authorAcceptedAt"    TIMESTAMP(3),
  "acceptedAt"          TIMESTAMP(3),
  "closedAt"            TIMESTAMP(3),
  "closedByUserId"      TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingMatch_pkey" PRIMARY KEY ("id")
);
-- One proposal per responder per listing. Re-proposing edits the existing row.
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingMatch_listingId_responderId_key" ON "TrainingMatch" ("listingId", "responderId");
CREATE INDEX IF NOT EXISTS "TrainingMatch_listingId_status_idx" ON "TrainingMatch" ("listingId", "status");
CREATE INDEX IF NOT EXISTS "TrainingMatch_responderId_idx"      ON "TrainingMatch" ("responderId");

-- 3 ── the Stage 2c record, created here because 2c was never built ──────────
-- One session, two participants, two activity claims. `matchId` is UNIQUE so
-- "Log this session" is idempotent: pressing it twice does not raise four
-- claims.
CREATE TABLE IF NOT EXISTS "TrainingSession" (
  "id"             TEXT         NOT NULL,
  "communityId"    TEXT         NOT NULL,
  "matchId"        TEXT,
  "listingId"      TEXT,
  "trainerId"      TEXT         NOT NULL,
  "traineeId"      TEXT         NOT NULL,
  "topic"          TEXT         NOT NULL,
  "occurredAt"     TIMESTAMP(3) NOT NULL,
  "notes"          TEXT,
  "loggedByUserId" TEXT         NOT NULL,
  -- The two claims this session raised. Nullable because a duplicate-per-day
  -- claim is REUSED rather than re-raised, and the reuse is recorded here.
  "trainerClaimId" TEXT,
  "traineeClaimId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingSession_matchId_key"          ON "TrainingSession" ("matchId");
CREATE INDEX IF NOT EXISTS "TrainingSession_communityId_occurredAt_idx"  ON "TrainingSession" ("communityId", "occurredAt");
CREATE INDEX IF NOT EXISTS "TrainingSession_trainerId_idx"               ON "TrainingSession" ("trainerId");
CREATE INDEX IF NOT EXISTS "TrainingSession_traineeId_idx"               ON "TrainingSession" ("traineeId");

-- 4 ── foreign keys ──────────────────────────────────────────────────────────
DO $$
DECLARE fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('TrainingListing_communityId_fkey',  'TrainingListing', 'communityId',    'Community', 'RESTRICT'),
      ('TrainingListing_authorId_fkey',     'TrainingListing', 'authorId',       'User',      'CASCADE'),
      ('TrainingMatch_listingId_fkey',      'TrainingMatch',   'listingId',      'TrainingListing', 'CASCADE'),
      ('TrainingMatch_responderId_fkey',    'TrainingMatch',   'responderId',    'User',      'CASCADE'),
      ('TrainingMatch_closedByUserId_fkey', 'TrainingMatch',   'closedByUserId', 'User',      'SET NULL'),
      ('TrainingSession_communityId_fkey',  'TrainingSession', 'communityId',    'Community', 'RESTRICT'),
      ('TrainingSession_matchId_fkey',      'TrainingSession', 'matchId',        'TrainingMatch',   'SET NULL'),
      ('TrainingSession_listingId_fkey',    'TrainingSession', 'listingId',      'TrainingListing', 'SET NULL'),
      ('TrainingSession_trainerId_fkey',    'TrainingSession', 'trainerId',      'User',      'RESTRICT'),
      ('TrainingSession_traineeId_fkey',    'TrainingSession', 'traineeId',      'User',      'RESTRICT'),
      ('TrainingSession_loggedByUserId_fkey','TrainingSession','loggedByUserId', 'User',      'RESTRICT')
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

-- 5 ── the phone-sharing switch ──────────────────────────────────────────────
-- ⚠ CHARLIE'S DECISION, NOT MINE. The brief says to add an optional phone
--   field, and also that email-only is a valid v1 if we would rather not hold
--   phone numbers at all. This ships as the brief's primary instruction (phone
--   sharing ON) with the alternative one UPDATE away:
--
--     UPDATE "PointsConfig" SET "numericValue" = 0 WHERE "key" = 'TRAINING_PHONE_SHARING';
--
--   With it at 0 the phone tick-box disappears from every form and a phone
--   number is never revealed, even on a match that already ticked it. Both
--   states are asserted by check:central, so neither is untested.
INSERT INTO "PointsConfig" ("id", "key", "numericValue", "note")
SELECT gen_random_uuid(), 'TRAINING_PHONE_SHARING', 1,
       'Stage 2d — 1 = members may share a phone number on an accepted training match; 0 = email only. Charlie''s call.'
WHERE NOT EXISTS (SELECT 1 FROM "PointsConfig" WHERE "key" = 'TRAINING_PHONE_SHARING');

-- 6 ── the topic promotion update (Stage 2d §B) ──────────────────────────────
-- Topics no longer render as chips at all — the chip row is contexts only, so
-- that it pairs one-to-one with the Out-in-the-world / Behind-the-scenes
-- toggle above it. `promoted` now orders the "All topics" dropdown: promoted
-- topics come first, so promotion still means something visible.
--
-- Five topics up, Housing down. Applied to EVERY Community node, because the
-- Stage 2b migration seeds the tag set per node and a member standing at a
-- branch reads that branch's tags: 5 labels × 4 nodes = the 20 rows the
-- library update flagged.
UPDATE "QuestionTag"
SET "promoted" = true,
    "sortOrder" = CASE "label"
      WHEN 'Party conduct' THEN 7
      WHEN 'Media skills'  THEN 8
      WHEN 'Economy'       THEN 9
      WHEN 'Social issues' THEN 10
      WHEN 'Law & rights'  THEN 11
      ELSE "sortOrder" END
WHERE "kind" = 'TOPIC'
  AND "label" IN ('Party conduct', 'Media skills', 'Economy', 'Social issues', 'Law & rights');

-- Housing has 0 questions across the whole Community and was promoted by the
-- Stage 2b seed before anyone had written anything. It stays in the dropdown.
UPDATE "QuestionTag"
SET "promoted" = false
WHERE "kind" = 'TOPIC' AND "label" = 'Housing';
