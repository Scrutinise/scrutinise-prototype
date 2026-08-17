-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-A — minimum elicitation and the first build. Additive schema deltas.
-- Idempotent; safe to re-run.
--
-- Apply to Neon (NEVER `prisma db push` — see docs/CLAUDE.md §16 and the playbook):
--   cd scrutinise-web
--   npm run whichdb                        # confirm the host first, every time
--   DIRECT_URL="<neon direct url>" npx prisma db execute --file prisma/lex_build_25a.sql --schema prisma/schema.prisma
--   npx prisma generate
--
-- THREE TABLES, AND NOTHING ELSE CHANGES. §25 inverts the flow — the user decides,
-- Lex writes — but 25-A ADDS A PATH, it does not remove one (BRIEF_25A §0). No
-- existing table, column, field key or page sequence is touched, so an idea built
-- the current way is unaffected by every line in this file.
--
-- 1. IdeaElicitation — the four exchanges of §1, one row per idea. Separate from
--    IdeaFieldState on purpose: the field machine's statuses (EMPTY /
--    AWAITING_CONFIRMATION / ACCEPTED / SKIPPED) describe a proposal contract, and
--    these four answers are not proposals — they are the user's own words, taken
--    before anything has been drafted. Overloading the field machine to carry them
--    would have meant changing it, which §1 says not to do.
--
--    ⚠ `ownKnowledgeProvenance` IS LOAD-BEARING, not decoration. Exchange 3 is what
--    the user knows that the record will not show. Every later citation depends on
--    telling that apart from retrieved material, so it is stored with its provenance
--    and carried as a label into every prompt that reads it. `check:build-25a`
--    asserts that the own-knowledge text can never be rendered into a citation slot.
--
--    ⚠ `readingStatus` defaults to NOT_READ and 25-A never changes it. Ingestion is
--    25-D. Capturing a link and letting the user believe it has been read is the
--    never-claim rule broken at the first exchange.
--
-- 2. IdeaBuild — a build is a JOB, not a chat turn (§2). The row is the status:
--    what is SHOWN is what is STORED, and an abandoned RUNNING row is settled by
--    WRITING it to FAILED (the Deepening's pattern — see lib/lex/build-settle.ts).
--
--    ⚠ `estCostPence` IS NULLABLE AND NULL MEANS UNPRICED. A model we have no rate
--    for must not silently cost zero: zero is a claim, and it is the claim most
--    likely to be believed. Tokens are still counted, so "we spent tokens and cannot
--    price them" is representable and distinguishable from "we spent nothing".
--
--    ⚠ `framing` records which of §3a's two query framings this build used. The
--    experiment is the point of pass 1 being in this sprint at all, and a comparison
--    whose arm was not written down is not a comparison. NO DEFAULT: a build must
--    say which arm it ran.
--
-- 3. BuildFork — wherever Lex had to choose, the alternative it set aside with the
--    case for it (§4.1). 25-C turns these into decisions; 25-A only captures them.
--    TWO ALTERNATIVES PER FORK (Charlie's decision), which is why `forkKey` and
--    `alternativeIndex` exist alongside the brief's field list: two strong
--    alternatives are two rows sharing one decision point, and grouping them by
--    (fieldKey, chosen) string equality would be a join on prose.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ElicitationStatus" AS ENUM ('IN_PROGRESS', 'AWAITING_CONFIRMATION', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- USER_TESTIMONY vs RETRIEVED. Both values exist from the start even though 25-A only
-- ever writes the first: an enum with one member is a column that reads as decoration,
-- and the whole reason this column exists is that the two kinds must be TOLD APART.
DO $$ BEGIN
  CREATE TYPE "ElicitationProvenance" AS ENUM ('USER_TESTIMONY', 'RETRIEVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BuildStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A — the user's problem phrased as they would put it into a chat window.
-- B — the problem plus goal, ruled-outs, their own knowledge and the profile.
DO $$ BEGIN
  CREATE TYPE "BuildFraming" AS ENUM ('A_NAIVE', 'B_CONTEXTUALISED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. IdeaElicitation ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IdeaElicitation" (
  "id"                      TEXT PRIMARY KEY,
  "ideaId"                  TEXT NOT NULL,

  -- Exchange 1 — the problem, in their words. Subject to the existing §19-D problem
  -- gate: a solution offered here is challenged, at most twice, then accepted.
  "problem"                 TEXT,
  "problemPresses"          INTEGER NOT NULL DEFAULT 0,
  -- Did the deterministic solution-shape reading fire? Recorded so that whether the
  -- gate armed is observable from outside rather than inferred from Lex's wording
  -- (CLAUDE.md §18 corollary — off and failed must not look alike).
  "problemGateFired"        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Exchange 2 — what you want to happen, and anything already ruled out.
  "goalKind"                TEXT,
  "goalDetail"              TEXT,
  "ruledOut"                TEXT,

  -- Exchange 3 — what you know that we won't find.
  "ownKnowledge"            TEXT,
  "ownKnowledgeProvenance"  "ElicitationProvenance" NOT NULL DEFAULT 'USER_TESTIMONY',

  -- Exchange 4 — anything to read? CAPTURED, NOT READ. 25-D ingests it.
  "readingUrl"              TEXT,
  "readingFileName"         TEXT,
  "readingNote"             TEXT,
  "readingStatus"           TEXT NOT NULL DEFAULT 'NOT_READ',

  -- The reusable About-you profile, skipped for a returning user (§1a).
  "profileSkipped"          BOOLEAN NOT NULL DEFAULT FALSE,

  -- §1c — Lex writes back its understanding and WAITS. `corrections` counts
  -- "Not quite" presses; a correction re-runs the confirmation, not the whole page.
  "understanding"           TEXT,
  "corrections"             INTEGER NOT NULL DEFAULT 0,
  "status"                  "ElicitationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "confirmedAt"             TIMESTAMP(3),

  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaElicitation_ideaId_fkey" FOREIGN KEY ("ideaId")
    REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdeaElicitation_ideaId_key" ON "IdeaElicitation"("ideaId");

-- ── 2. IdeaBuild ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IdeaBuild" (
  "id"             TEXT PRIMARY KEY,
  "ideaId"         TEXT NOT NULL,
  "version"        INTEGER NOT NULL,
  "status"         "BuildStatus" NOT NULL DEFAULT 'QUEUED',
  -- NO DEFAULT. §3a's comparison only survives if every build says which arm it ran.
  "framing"        "BuildFraming" NOT NULL,

  "passesComplete" INTEGER NOT NULL DEFAULT 0,
  "currentPass"    TEXT,
  -- INCREMENTAL PERSISTENCE (§2). One entry per named pass, rewritten as each pass
  -- completes: [{ key, label, status, startedAt, completedAt, output?, failureReason? }].
  -- A timeout loses the tail, never the run, and a partial build can say WHICH passes
  -- completed because the answer is stored rather than reconstructed.
  "passes"         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- §4.2 — what Lex is unsure about, per field, in a sentence. { fieldKey: sentence }.
  -- This is what the user reads first, so it is output, not logging.
  "uncertainties"  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- §5 — the "what I did and what I'm unsure about" message, stored so it survives a
  -- reload rather than living only in the response that started the build.
  "summaryMessage" TEXT,
  -- The search string pass 1 actually issued. The A/B artefact: without it, "framing B
  -- was used" is an assertion about code rather than a record of what was sent.
  "queryUsed"      TEXT,

  "startedAt"      TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  -- Set whenever status = FAILED or CANCELLED. Hitting a ceiling is a FAILED build
  -- with a plain reason, NEVER a silently shortened one (§2).
  "failureReason"  TEXT,
  -- Cancel is co-operative: the request is written here and the engine checks it
  -- between passes. A cancel that only stops the poller would leave the work running
  -- and the row lying about it.
  "cancelRequested" BOOLEAN NOT NULL DEFAULT FALSE,

  "tokensIn"       INTEGER NOT NULL DEFAULT 0,
  "tokensOut"      INTEGER NOT NULL DEFAULT 0,
  -- NULLABLE, AND NULL MEANS UNPRICED — see the header. Tokens are still counted.
  "estCostPence"   NUMERIC(12, 4),

  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaBuild_ideaId_fkey" FOREIGN KEY ("ideaId")
    REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdeaBuild_ideaId_version_key" ON "IdeaBuild"("ideaId", "version");
CREATE INDEX IF NOT EXISTS "IdeaBuild_ideaId_status_idx" ON "IdeaBuild"("ideaId", "status");

-- ONE ACTIVE BUILD PER IDEA, enforced by the database rather than by a comment.
-- ⚠ PARTIAL, and Prisma cannot declare a partial unique index — a future
-- `prisma migrate diff` will want to drop it. It must not be dropped: a plain unique
-- on ideaId would make a SECOND build permanently impossible, and re-running a build
-- after a correction is the normal case, not the exception. (Same shape as the Central
-- Stage 1.2 duplicate-pending guard; see docs/CHANGE_LOG.md 2026-08-06 20:41 UTC.)
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaBuild_one_active_per_idea"
  ON "IdeaBuild"("ideaId") WHERE "status" IN ('QUEUED', 'RUNNING');

-- ── 3. BuildFork ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BuildFork" (
  "id"                 TEXT PRIMARY KEY,
  "buildId"            TEXT NOT NULL,
  -- Denormalised so the forks for an idea can be read without joining every build.
  "ideaId"             TEXT NOT NULL,
  -- The DECISION POINT. Two alternatives share one forkKey; without it, grouping them
  -- means comparing `chosen` prose for equality.
  "forkKey"            TEXT NOT NULL,
  "fieldKey"           TEXT NOT NULL,
  "chosen"             TEXT NOT NULL,
  "alternativeIndex"   INTEGER NOT NULL DEFAULT 0,
  "alternative"        TEXT NOT NULL,
  "caseForAlternative" TEXT NOT NULL,
  -- 25-C turns a fork into a decision. Until then every fork is unresolved, and that
  -- is the honest value rather than a placeholder.
  "resolved"           BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuildFork_buildId_fkey" FOREIGN KEY ("buildId")
    REFERENCES "IdeaBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuildFork_ideaId_fkey" FOREIGN KEY ("ideaId")
    REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BuildFork_buildId_idx" ON "BuildFork"("buildId");
CREATE INDEX IF NOT EXISTS "BuildFork_ideaId_fieldKey_idx" ON "BuildFork"("ideaId", "fieldKey");
CREATE UNIQUE INDEX IF NOT EXISTS "BuildFork_buildId_forkKey_altIndex_key"
  ON "BuildFork"("buildId", "forkKey", "alternativeIndex");
