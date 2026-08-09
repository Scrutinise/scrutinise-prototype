-- CENTRAL Stage 2 — points & leaderboards (2026-08-09)
-- Additive + idempotent. Safe to re-run. HAND-WRITTEN, not from
-- `prisma migrate diff` — that command still wants to drop the 914k-row
-- LegislationSection_DEPRECATED table and specialist_queue (docs/CLAUDE.md §16).
-- Column types were read off production first: TEXT ids, TIMESTAMP(3).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- Five tables, two indexes Prisma cannot declare, and the starter tariff seed.
-- NOTHING IS BACKFILLED into the ledger: the one bulletin vote that exists on
-- production predates the guardrails and is a self-mark, so paying it out would
-- open the ledger with the exact row the rules now forbid.

-- 1 ── the ledger ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PointsEvent" (
  "id"                TEXT         NOT NULL,
  "userId"            TEXT         NOT NULL,
  "communityId"       TEXT         NOT NULL,
  "sourceCommunityId" TEXT,
  "type"              TEXT         NOT NULL,
  "points"            INTEGER      NOT NULL,
  "sourceType"        TEXT         NOT NULL,
  "sourceId"          TEXT         NOT NULL,
  "actorUserId"       TEXT,
  "tariffKey"         TEXT         NOT NULL,
  "tariffPoints"      INTEGER      NOT NULL,
  "tariffId"          TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PointsEvent_communityId_createdAt_idx" ON "PointsEvent" ("communityId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointsEvent_communityId_userId_idx"    ON "PointsEvent" ("communityId", "userId");
CREATE INDEX IF NOT EXISTS "PointsEvent_sourceCommunityId_createdAt_idx" ON "PointsEvent" ("sourceCommunityId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointsEvent_sourceType_sourceId_idx"   ON "PointsEvent" ("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "PointsEvent_actorUserId_createdAt_idx" ON "PointsEvent" ("actorUserId", "createdAt");

-- 2 ── tariffs and config ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PointsTariff" (
  "id"            TEXT         NOT NULL,
  "actionKey"     TEXT         NOT NULL,
  "points"        INTEGER      NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active"        BOOLEAN      NOT NULL DEFAULT true,
  "note"          TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsTariff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PointsTariff_actionKey_active_effectiveFrom_idx"
  ON "PointsTariff" ("actionKey", "active", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "PointsConfig" (
  "id"           TEXT             NOT NULL,
  "key"          TEXT             NOT NULL,
  "numericValue" DOUBLE PRECISION NOT NULL,
  "note"         TEXT,
  "updatedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointsConfig_key_key" ON "PointsConfig" ("key");

-- 3 ── per-Community referral chain ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CommunityReferral" (
  "id"            TEXT         NOT NULL,
  "communityId"   TEXT         NOT NULL,
  "inviterUserId" TEXT         NOT NULL,
  "inviteeUserId" TEXT         NOT NULL,
  "decayFrom"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "boostedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityReferral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityReferral_communityId_inviteeUserId_key"
  ON "CommunityReferral" ("communityId", "inviteeUserId");
CREATE INDEX IF NOT EXISTS "CommunityReferral_communityId_inviterUserId_idx"
  ON "CommunityReferral" ("communityId", "inviterUserId");

-- 4 ── offline activity claims ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ActivityClaim" (
  "id"              TEXT         NOT NULL,
  "communityId"     TEXT         NOT NULL,
  "userId"          TEXT         NOT NULL,
  "activityType"    TEXT         NOT NULL,
  "occurredAt"      TIMESTAMP(3) NOT NULL,
  "evidenceUrl"     TEXT,
  "note"            TEXT,
  "status"          TEXT         NOT NULL DEFAULT 'PENDING',
  "decidedByUserId" TEXT,
  "decidedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ActivityClaim_communityId_status_idx" ON "ActivityClaim" ("communityId", "status");
CREATE INDEX IF NOT EXISTS "ActivityClaim_userId_activityType_idx" ON "ActivityClaim" ("userId", "activityType");

-- The duplicate-claim guard: one claim per (user, activity type, calendar day).
-- EXPRESSION + PARTIAL, so Prisma cannot declare it — a migrate diff will want
-- to drop it; don't let it.
--
-- Scoped to `status <> 'DECLINED'` deliberately. A flat guard would make a
-- declined claim permanently un-correctable — the same reasoning that made the
-- Stage 1.2 join-request guard partial. Anti-abuse is unaffected: a declined
-- claim paid nothing. Tighten to a flat unique by editing this one index if the
-- looser reading proves wrong.
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityClaim_one_per_day"
  ON "ActivityClaim" ("userId", "activityType", (("occurredAt")::date))
  WHERE "status" <> 'DECLINED';

-- 5 ── foreign keys ──────────────────────────────────────────────────────────
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('PointsEvent_userId_fkey',                  'PointsEvent',       'userId',            'User',      'RESTRICT'),
      ('PointsEvent_communityId_fkey',             'PointsEvent',       'communityId',       'Community', 'RESTRICT'),
      ('PointsEvent_sourceCommunityId_fkey',       'PointsEvent',       'sourceCommunityId', 'Community', 'SET NULL'),
      ('PointsEvent_actorUserId_fkey',             'PointsEvent',       'actorUserId',       'User',      'SET NULL'),
      ('CommunityReferral_communityId_fkey',       'CommunityReferral', 'communityId',       'Community', 'RESTRICT'),
      ('CommunityReferral_inviterUserId_fkey',     'CommunityReferral', 'inviterUserId',     'User',      'RESTRICT'),
      ('CommunityReferral_inviteeUserId_fkey',     'CommunityReferral', 'inviteeUserId',     'User',      'RESTRICT'),
      ('ActivityClaim_communityId_fkey',           'ActivityClaim',     'communityId',       'Community', 'RESTRICT'),
      ('ActivityClaim_userId_fkey',                'ActivityClaim',     'userId',            'User',      'RESTRICT'),
      ('ActivityClaim_decidedByUserId_fkey',       'ActivityClaim',     'decidedByUserId',   'User',      'SET NULL')
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

-- 6 ── starter tariff and config ─────────────────────────────────────────────
-- Charlie retunes by editing these rows. Every event stamps the value it used,
-- so an edit here changes only what happens next.
--
-- MARK VALUES ARE MIRRORED FROM THE MAIN SYSTEM, NOT INVENTED. lib/points.ts
-- prices a contribution rating at +4 (3★, the lowest positive tier), +8 (4★),
-- +12 (5★) and -4 (1–2★). A Central mark is BINARY, with no quality gradation,
-- so it maps to the base positive tier and the negative tier: +4 / -4.
-- Symmetric, and no scaling against the 12 pts/hr anchor is needed (4 pts ≈ 20
-- minutes of basic work). If a constructive mark should feel weightier, +8 is
-- the next rung the main system already defines — one row edit, no code.
INSERT INTO "PointsTariff" ("id", "actionKey", "points", "note")
SELECT gen_random_uuid(), v.k, v.p, v.n
FROM (VALUES
  ('MARK_CONSTRUCTIVE',   4,  'Mirrors CONTRIBUTION_RATED_3 (+4), the main system''s base positive tier'),
  ('MARK_UNCONSTRUCTIVE', -4, 'Mirrors CONTRIBUTION_RATED_1_2 (-4)'),
  ('CLAIM_CANVASSING_SESSION', 24, '2 hours at the 12 pts/hr basic anchor'),
  ('CLAIM_RAN_EVENT',          60, 'Organised and ran an event'),
  ('CLAIM_GAVE_TRAINING',      40, '2 hours at the 20 pts/hr skilled anchor'),
  ('CLAIM_COMPLETED_TRAINING', 20, 'Completed training as a trainee')
) AS v(k, p, n)
WHERE NOT EXISTS (SELECT 1 FROM "PointsTariff" t WHERE t."actionKey" = v.k);

INSERT INTO "PointsConfig" ("id", "key", "numericValue", "note")
SELECT gen_random_uuid(), v.k, v.val, v.n
FROM (VALUES
  ('REFERRAL_RATE_L1',          0.10,  'Direct inviter''s share of an invitee''s earnings'),
  ('REFERRAL_RATE_L2',          0.05,  'Second layer'),
  ('REFERRAL_RATE_L3',          0.025, 'Third layer'),
  ('REFERRAL_DECAY_MONTHS',     6,     'Halve the multiplier every N months from decayFrom'),
  ('REFERRAL_DECAY_FLOOR',      0.25,  'Multiplier never falls below this'),
  ('REFERRAL_REBOOST_POINTS',   50,    'An invitee crossing this resets the link above them to 100%'),
  ('DAILY_MARK_BUDGET',         20,    'Distinct items one user may mark per day')
) AS v(k, val, n)
WHERE NOT EXISTS (SELECT 1 FROM "PointsConfig" c WHERE c."key" = v.k);
