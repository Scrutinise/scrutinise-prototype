-- CENTRAL Stage 2e — AI attribution, award-then-reverse, referral accrual (2026-08-24)
-- Additive + idempotent. Safe to re-run. HAND-WRITTEN, not from
-- `prisma migrate diff` — that still wants to drop the 914k-row
-- LegislationSection_DEPRECATED table and specialist_queue (docs/CLAUDE.md §16).
-- Column types match the rest of Central: TEXT ids, TIMESTAMP(3).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- Six parts. Two of them CHANGE EXISTING DATA and say so:
--   · §2 relabels the 27 seeded answers as AI-authored;
--   · §6 awards the activity claims that were left pending under the old
--     approval gate, because Stage 2e removes that gate.
--
-- ⚠ ONE EXISTING INDEX IS REPLACED (§4). It is an expression + partial unique
--   index that schema.prisma cannot declare — see docs/CLAUDE.md §21, the
--   "indexes Prisma can't see" register.

-- 1 ── AI attribution (Stage 2c's launch blocker, built at last) ─────────────
-- Until now an answer written by Claude and an answer written by a member were
-- the same row with the same shape, and the answer card rendered no author at
-- all. Nothing in the product could tell them apart, so nobody reading it
-- could either.
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "authorType" TEXT NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "aiModel"    TEXT;

-- 2 ── backfill the seeded answers ───────────────────────────────────────────
-- The Stage 2b import attributed 27 Claude-written answers to the `lex`
-- historical account. They keep that author — it is who holds them — and gain
-- the label that says what wrote them.
--
-- ⚠ Keyed on the seed account's clerkId, never on a hard-coded user id: the id
--   differs between databases and a wrong one would silently relabel nothing.
UPDATE "Answer"
SET "authorType" = 'AI',
    "aiModel"    = 'Claude'
WHERE "authorId" IN (SELECT "id" FROM "User" WHERE "clerkId" = 'seed_central_lex')
  AND "authorType" <> 'AI';

-- The count is asserted rather than assumed. 27 at the time of writing; if the
-- seed set grows this raises rather than drifting quietly.
DO $$
DECLARE ai_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ai_count FROM "Answer" WHERE "authorType" = 'AI';
  RAISE NOTICE 'Answers now labelled AI: %', ai_count;
  IF ai_count = 0 THEN
    RAISE WARNING 'No answers were labelled AI — is the seed account clerkId still seed_central_lex?';
  END IF;
END $$;

-- 3 ── award-then-reverse (Charlie's decision, 24 Aug) ───────────────────────
-- Pre-approval is removed: a claim awards immediately and a manager may reverse
-- it afterwards, with a reason. The ledger only ever appends, so a reversal is a
-- second event at the ORIGINAL award value, not an edit to the first.
ALTER TABLE "ActivityClaim" ADD COLUMN IF NOT EXISTS "reversedByUserId" TEXT;
ALTER TABLE "ActivityClaim" ADD COLUMN IF NOT EXISTS "reversedAt"       TIMESTAMP(3);
ALTER TABLE "ActivityClaim" ADD COLUMN IF NOT EXISTS "reversalReason"   TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityClaim_reversedByUserId_fkey') THEN
    ALTER TABLE "ActivityClaim"
      ADD CONSTRAINT "ActivityClaim_reversedByUserId_fkey"
      FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4 ── the one-per-day guard has to let a reversed claim be re-made ──────────
-- ⚠ EXPRESSION + PARTIAL UNIQUE INDEX — schema.prisma cannot declare it, and a
--   `prisma migrate diff` will propose dropping it. See docs/CLAUDE.md §21.
--
-- Stage 2 scoped it to `status <> 'DECLINED'` so a declined claim did not make
-- that day permanently un-claimable. REVERSED is the same case for the same
-- reason: a reversal says the claim should not have paid, and the member must be
-- able to put it right. A dropped-and-recreated index rather than an added one,
-- because two overlapping partial uniques on the same columns is a trap.
DROP INDEX IF EXISTS "ActivityClaim_one_per_day";
CREATE UNIQUE INDEX "ActivityClaim_one_per_day"
  ON "ActivityClaim" ("userId", "activityType", (("occurredAt")::date))
  WHERE "status" NOT IN ('DECLINED', 'REVERSED');

-- 5 ── referral accrual carries a fraction ───────────────────────────────────
-- ⚠ THE REASON THIS EXISTS: the chain paid 10% of each event, floored to a whole
--   point. A constructive mark is worth 4, so 10% of 4 floors to 0 — the L1
--   inviter earned nothing from any number of marks, and raising the mark value
--   would not have fixed it either (it moves the threshold, not the flooring).
--   Each link now carries a decimal balance and mints a whole event when it
--   crosses 1.0, so ten 4-point marks pay the inviter 4 points rather than 0.
ALTER TABLE "CommunityReferral"
  ADD COLUMN IF NOT EXISTS "bonusBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 6 ── award the claims left pending by the old approval gate ───────────────
-- ⚠ THIS WRITES POINTS. Stage 2e removes pre-approval, so a claim sitting in
--   PENDING is not "awaiting a decision" any more — it is an award that never
--   happened. Each pending claim gets its CLAIM_APPROVED event at the tariff in
--   force, then becomes AWARDED.
--
-- ⚠ Referral bonuses are NOT minted here, and that is safe rather than
--   convenient: `CommunityReferral` holds zero rows in this database, so there
--   is no chain for these awards to pay. If that ever stops being true, do this
--   backfill through `recordPointsEvent` instead of in SQL.
INSERT INTO "PointsEvent" (
  "id", "userId", "communityId", "sourceCommunityId", "type", "points",
  "sourceType", "sourceId", "actorUserId", "tariffKey", "tariffPoints", "tariffId"
)
SELECT
  gen_random_uuid(),
  c."userId",
  COALESCE(root."id", c."communityId"),
  c."communityId",
  'CLAIM_APPROVED',
  t."points",
  'ACTIVITY_CLAIM',
  c."id",
  NULL,
  t."actionKey",
  t."points",
  t."id"
FROM "ActivityClaim" c
JOIN LATERAL (
  SELECT pt."id", pt."actionKey", pt."points"
  FROM "PointsTariff" pt
  WHERE pt."actionKey" = 'CLAIM_' || c."activityType"
    AND pt."active"
    AND pt."effectiveFrom" <= CURRENT_TIMESTAMP
  ORDER BY pt."effectiveFrom" DESC
  LIMIT 1
) t ON TRUE
LEFT JOIN LATERAL (
  -- Walk to the root Community, the way getRootCommunityId does.
  WITH RECURSIVE up AS (
    SELECT "id", "parentCommunityId" FROM "Community" WHERE "id" = c."communityId"
    UNION ALL
    SELECT p."id", p."parentCommunityId" FROM "Community" p JOIN up ON up."parentCommunityId" = p."id"
  )
  SELECT "id" FROM up WHERE "parentCommunityId" IS NULL LIMIT 1
) root ON TRUE
WHERE c."status" = 'PENDING'
  AND NOT EXISTS (
    SELECT 1 FROM "PointsEvent" e
    WHERE e."sourceType" = 'ACTIVITY_CLAIM' AND e."sourceId" = c."id" AND e."type" = 'CLAIM_APPROVED'
  );

UPDATE "ActivityClaim"
SET "status" = 'AWARDED'
WHERE "status" = 'PENDING'
  AND EXISTS (
    SELECT 1 FROM "PointsEvent" e
    WHERE e."sourceType" = 'ACTIVITY_CLAIM' AND e."sourceId" = "ActivityClaim"."id" AND e."type" = 'CLAIM_APPROVED'
  );

-- Claims approved under the old gate keep paying; they are simply renamed to the
-- status the new model uses, so one word means one thing across the table.
UPDATE "ActivityClaim" SET "status" = 'AWARDED' WHERE "status" = 'APPROVED';

DO $$
DECLARE pending_left INTEGER; awarded INTEGER;
BEGIN
  SELECT COUNT(*) INTO pending_left FROM "ActivityClaim" WHERE "status" = 'PENDING';
  SELECT COUNT(*) INTO awarded FROM "ActivityClaim" WHERE "status" = 'AWARDED';
  RAISE NOTICE 'ActivityClaim: % awarded, % still pending', awarded, pending_left;
END $$;

-- 6b ── a decline can carry a line of explanation ──────────────────────────
-- ⚠ WHY: a silent refusal in a branch of a dozen people is worse than no
--   listing at all. The author may say why when they accept OR decline, and the
--   line is stored on the match so the responder can read it on the page as
--   well as in the notification that told them.
ALTER TABLE "TrainingMatch" ADD COLUMN IF NOT EXISTS "authorMessage" TEXT;

-- 7 ── the Government departments, as topics ────────────────────────────────
-- The shipped upload template lists these under "Valid values", so the library
-- should already know them: otherwise the first uploader to use one defines it
-- by accident and a typo becomes a permanent tag. Unpromoted, so they live in
-- the "All topics" dropdown and never in the chip row.
--
-- Ministerial departments only — not the agencies and arm's length bodies,
-- which would make the dropdown unusable.
INSERT INTO "QuestionTag" ("id", "communityId", "kind", "label", "promoted", "sortOrder")
SELECT gen_random_uuid(), c."id", 'TOPIC', v.label, false, 50
FROM "Community" c
CROSS JOIN (VALUES
  ('Attorney General’s Office'),
  ('Cabinet Office'),
  ('Department for Business and Trade'),
  ('Department for Culture, Media and Sport'),
  ('Department for Education'),
  ('Department for Energy Security and Net Zero'),
  ('Department for Environment, Food and Rural Affairs'),
  ('Department for Science, Innovation and Technology'),
  ('Department for Transport'),
  ('Department for Work and Pensions'),
  ('Department of Health and Social Care'),
  ('Foreign, Commonwealth and Development Office'),
  ('HM Treasury'),
  ('Home Office'),
  ('Ministry of Defence'),
  ('Ministry of Housing, Communities and Local Government'),
  ('Ministry of Justice'),
  ('Northern Ireland Office'),
  ('Office of the Advocate General for Scotland'),
  ('Office of the Leader of the House of Commons'),
  ('Office of the Leader of the House of Lords'),
  ('Scotland Office'),
  ('UK Export Finance'),
  ('Wales Office')
) AS v(label)
WHERE NOT EXISTS (
  SELECT 1 FROM "QuestionTag" t
  WHERE t."communityId" = c."id" AND t."kind" = 'TOPIC' AND t."label" = v.label
);
