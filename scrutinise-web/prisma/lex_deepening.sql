-- ─────────────────────────────────────────────────────────────────────────────
-- The Deepening, Pilot A (§22 / BRIEF_DEEPENING_RESTART.md §2.2) — additive schema
-- deltas. Idempotent; safe to re-run.
--
-- Apply to Neon (NEVER `prisma db push` — see docs/CLAUDE.md §16 and the playbook):
--   cd scrutinise-web
--   npm run whichdb                        # confirm the host first, every time
--   DIRECT_URL="<neon direct url>" npx prisma db execute --file prisma/lex_deepening.sql --schema prisma/schema.prisma
--   npx prisma generate
--
-- THE ARCHITECTURAL INVARIANT THESE TABLES EXIST TO HOLD (§2.1.1):
--   Deepening writes EvidenceItem records that REFERENCE canonical fields. It never
--   writes a field's value. Any change to what a field SAYS goes through the normal
--   save path (proposal → AWAITING_CONFIRMATION → the user's Save). Mixing the two
--   would reintroduce the multi-source-of-truth condition the Lex rebuild removed —
--   which is why `EvidenceItem.fieldRef` is a plain TEXT REFERENCE and there is no
--   column here that any field-write path reads.
--
-- 1. DeepeningPass — one row per (idea, passKey). Carries the run's status, its
--    version, and its KNOWN UNKNOWNS, which are first-class output and not a
--    nice-to-have: a pass that cannot say what it failed to find has not reported
--    (§2.1.2). `knownUnknowns` is JSONB, shape:
--      [ { question, searched: [intent…], why? } ]
--
-- 2. EvidenceItem — a finding. PROPOSED until the user accepts or rejects it.
--    `kind` distinguishes SUPPORTS from CONTRADICTS deliberately: a CONTRADICTS
--    finding is as valuable as a SUPPORTS one and must never be filtered out (§2.3).
--
-- 3. DeepeningIssue — a specific, addressable gap. `reviewFindingId` is here from the
--    start, unused, because §24.3 lands review findings on this same list and a
--    column added later would mean migrating live rows.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "DeepeningPassStatus" AS ENUM ('NOT_RUN', 'RUNNING', 'RUN', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EvidenceKind" AS ENUM ('FINDING', 'PRECEDENT', 'SUPPORTS', 'CONTRADICTS', 'COMPARISON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EvidenceStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeepeningIssueStatus" AS ENUM ('OPEN', 'ADDRESSED', 'DEFERRED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DeepeningPass" (
  "id"            TEXT PRIMARY KEY,
  "ideaId"        TEXT NOT NULL,
  "passKey"       TEXT NOT NULL,
  "status"        "DeepeningPassStatus" NOT NULL DEFAULT 'NOT_RUN',
  "runVersion"    INTEGER      NOT NULL DEFAULT 0,
  "startedAt"     TIMESTAMP(3),
  "completedAt"   TIMESTAMP(3),
  "failureReason" TEXT,
  -- Always an ARRAY, never null once a run has happened: "nothing was unfindable" is
  -- itself information and renders as an empty list, not as a missing section (§2.5).
  "knownUnknowns" JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeepeningPass_ideaId_fkey" FOREIGN KEY ("ideaId")
    REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One pass row per idea per passKey. This is the lock that makes "one active run per
-- idea per pass" enforceable in the database rather than in a comment.
CREATE UNIQUE INDEX IF NOT EXISTS "DeepeningPass_ideaId_passKey_key"
  ON "DeepeningPass"("ideaId", "passKey");

CREATE TABLE IF NOT EXISTS "EvidenceItem" (
  "id"         TEXT PRIMARY KEY,
  "ideaId"     TEXT NOT NULL,
  "passKey"    TEXT NOT NULL,
  "runVersion" INTEGER NOT NULL DEFAULT 1,
  -- A REFERENCE to a canonical field, never a write to one. e.g. "challenge",
  -- "causes:<causeId>", "actions:<actionId>". Null = evidence about the idea at large.
  "fieldRef"   TEXT,
  "kind"       "EvidenceKind"   NOT NULL DEFAULT 'FINDING',
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  -- Provenance. A finding with no source is a claim, and §19-C forbids those.
  "sourceType" TEXT,
  "sourceId"   TEXT,
  "citation"   TEXT,
  "url"        TEXT,
  "status"     "EvidenceStatus" NOT NULL DEFAULT 'PROPOSED',
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceItem_ideaId_fkey" FOREIGN KEY ("ideaId")
    REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EvidenceItem_ideaId_passKey_idx" ON "EvidenceItem"("ideaId", "passKey");
CREATE INDEX IF NOT EXISTS "EvidenceItem_ideaId_fieldRef_idx" ON "EvidenceItem"("ideaId", "fieldRef");
CREATE INDEX IF NOT EXISTS "EvidenceItem_ideaId_status_idx"   ON "EvidenceItem"("ideaId", "status");

CREATE TABLE IF NOT EXISTS "DeepeningIssue" (
  "id"                  TEXT PRIMARY KEY,
  "ideaId"              TEXT NOT NULL,
  "passKey"             TEXT NOT NULL,
  "runVersion"          INTEGER NOT NULL DEFAULT 1,
  "text"                TEXT NOT NULL,
  "status"              "DeepeningIssueStatus" NOT NULL DEFAULT 'OPEN',
  -- Required BY THE APPLICATION when status = DISMISSED, not by a CHECK constraint:
  -- the reason belongs to the dismissal, and a dismissed issue stays VISIBLE with it
  -- attached (§2.5). A dismissal without a reason is an unaccountable veto.
  "dismissReason"       TEXT,
  "resolutionNote"      TEXT,
  "resolutionEvidenceId" TEXT,
  -- §24.3-ready. Review findings land on this same list; the column exists now so that
  -- building §24 is an insert, not a migration of live rows.
  "reviewFindingId"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"          TIMESTAMP(3),
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeepeningIssue_ideaId_fkey" FOREIGN KEY ("ideaId")
    REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeepeningIssue_resolutionEvidenceId_fkey" FOREIGN KEY ("resolutionEvidenceId")
    REFERENCES "EvidenceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeepeningIssue_ideaId_passKey_idx" ON "DeepeningIssue"("ideaId", "passKey");
CREATE INDEX IF NOT EXISTS "DeepeningIssue_ideaId_status_idx"  ON "DeepeningIssue"("ideaId", "status");
