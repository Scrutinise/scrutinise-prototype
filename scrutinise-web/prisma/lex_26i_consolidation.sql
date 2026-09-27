-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-I — "one guiding policy, properly arrived at."
--
-- ⚠ ADDITIVE ONLY. New columns default to values that leave every existing row
-- reading exactly as it did before this ran. New tables only. Idempotent.
--
-- §2 — two new dispositions PolicyOption's existing fields have no home for
-- ("Part of the solution", "Says roughly the same as [X]"). Rule out (status),
-- Later phase (phase) and Really an action (kind) already exist — see the
-- PolicyOptionStatus/phase/kind columns from lex_rebuild_page3_4.sql.
--
-- §5c/B4 — `draftModel` on PolicyOption: which model actually wrote a candidate
-- (a build-seeded one is normally Gemini Flash; a chat-drafted one is whatever
-- the idea runs on per addendum B1; a user-added one is null). This is the
-- provenance B4 needs to ever measure "are Flash-drafted candidates chosen."
--
-- §3/§4 — GuidingPolicyConsolidation/GuidingPolicyDraft: one run of Consolidate,
-- its four premium drafts, the judge's verdict on each, the user's favourite and
-- feedback, the redraft, and what was finally accepted. Kept as its own audit
-- trail rather than overwriting PolicyOption rows in place, because the whole
-- point of §4/§5c is a durable record of what four models said and which the
-- user picked — "the cheapest experiment the platform will run."
--
-- A1 — PolicyFeedback: one feedback record per idea, every input about guiding
-- policies (a card's reason box, the general box, the Lex chat), tagged by
-- source. `policyOptionId` null means general/not-about-one-candidate.
--
-- Apply against Neon (neondb) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "PolicyDisposition" AS ENUM ('UNDISPOSITIONED', 'PART_OF_SOLUTION', 'SAYS_SAME_AS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "disposition" "PolicyDisposition" NOT NULL DEFAULT 'UNDISPOSITIONED';
-- §2 — the OTHER candidate this one says roughly the same as, by its stable §1.1
-- number (not a foreign key: the same "instruct Lex by number" convention every
-- other reference on this table already uses — see `mergedFrom`/targetNumber
-- elsewhere. A number, unlike an id, survives being typed by Charlie.)
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "duplicateOfNumber" INTEGER;
-- §5c/B4 — which model drafted this candidate, when it was Lex's (source = LEX).
-- Null for a user-added candidate, and null for pre-26-I rows (no measurement
-- claim is made about history we didn't record).
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "draftModel" TEXT;
-- §3 fixed form — "What it rules out" and "How likely it is to happen", required
-- on every guiding policy, candidate or final (§3's own bullet). Populated on the
-- PolicyOption created when a consolidation is accepted (see `settle` reuse in
-- guiding-policy-state.ts); null on ordinary un-consolidated candidates, which
-- never claimed to carry either.
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "rulesOut" TEXT;
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "likelihood" TEXT;

-- ══ A1 — ONE FEEDBACK RECORD PER IDEA, EVERY INPUT TAGGED BY SOURCE ══════════
DO $$ BEGIN
  CREATE TYPE "PolicyFeedbackSource" AS ENUM ('CARD_REASON', 'GENERAL_BOX', 'LEX_CHAT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "PolicyFeedback" (
  "id"             TEXT NOT NULL,
  "ideaId"         TEXT NOT NULL,
  "policyOptionId" TEXT,
  "source"         "PolicyFeedbackSource" NOT NULL,
  "text"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PolicyFeedback_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "PolicyFeedback" ADD CONSTRAINT "PolicyFeedback_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "PolicyFeedback" ADD CONSTRAINT "PolicyFeedback_policyOptionId_fkey"
    FOREIGN KEY ("policyOptionId") REFERENCES "PolicyOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "PolicyFeedback_ideaId_idx" ON "PolicyFeedback"("ideaId");
CREATE INDEX IF NOT EXISTS "PolicyFeedback_policyOptionId_idx" ON "PolicyFeedback"("policyOptionId");

-- ══ §3/§4/§5/§6/§7 — CONSOLIDATE: FOUR PREMIUM DRAFTS, JUDGED, ONE REDRAFT ═══
DO $$ BEGIN
  CREATE TYPE "ConsolidationStatus" AS ENUM ('DRAFTING', 'JUDGED', 'FAVOURITE_CHOSEN', 'REDRAFTED', 'ACCEPTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "GuidingPolicyConsolidation" (
  "id"                TEXT NOT NULL,
  "ideaId"            TEXT NOT NULL,
  "status"            "ConsolidationStatus" NOT NULL DEFAULT 'DRAFTING',
  -- §3 — the exact context every model was handed: problem, causes, the
  -- part-of-solution candidates, the user's own attempts, the Rumelt tests in
  -- full. Kept so a later reviewer can see what four models actually saw,
  -- not what they were later assumed to have seen.
  "candidateSnapshot" JSONB NOT NULL,
  -- §5a/§5c — which draft's model the user favoured, and why (§5b: what worked
  -- and did not, across all four — feedback, not a splice request).
  "favouriteModel"    TEXT,
  "userFeedback"      TEXT,
  -- §6 — the one redraft, by the favourite's model, briefed on both feedbacks.
  "redraftText"       TEXT,
  "redraftRulesOut"   TEXT,
  "redraftLikelihood" TEXT,
  "redraftChainLink"  TEXT,
  "redraftFixesCauseNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "redraftJudge"      JSONB,
  -- §7 — accepted, edited or not. `acceptedEdited` is true the moment the user's
  -- own words replace any part of the redraft (§7a: "an edited version is their
  -- words, kept, and tested again").
  "acceptedText"        TEXT,
  "acceptedEdited"      BOOLEAN NOT NULL DEFAULT false,
  "acceptedPolicyOptionId" TEXT,
  -- §3 — "report the cost per consolidation." Pence, across every model call
  -- this run made (four drafts + judge + redraft + redraft's own judge).
  "costPence"         INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuidingPolicyConsolidation_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "GuidingPolicyConsolidation" ADD CONSTRAINT "GuidingPolicyConsolidation_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "GuidingPolicyConsolidation_ideaId_idx" ON "GuidingPolicyConsolidation"("ideaId");

CREATE TABLE IF NOT EXISTS "GuidingPolicyDraft" (
  "id"               TEXT NOT NULL,
  "consolidationId"  TEXT NOT NULL,
  "model"            TEXT NOT NULL,
  -- §3's fixed form, every field required at write time (enforced in code, not
  -- here — a draft a model failed to produce in full is a failed draft, not a
  -- row with blanks in it).
  "statement"        TEXT NOT NULL,
  "rulesOut"         TEXT NOT NULL,
  "fixesCauseNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "likelihood"       TEXT NOT NULL,
  "chainLink"        TEXT NOT NULL,
  -- §4 — the judge's verdict on this card: compound?, rules out nothing?,
  -- answers the obstacle?, which causes it actually attacks vs what it claims.
  -- Null until the batched judge call (B2) returns.
  "judge"            JSONB,
  "costPence"        INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuidingPolicyDraft_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "GuidingPolicyDraft" ADD CONSTRAINT "GuidingPolicyDraft_consolidationId_fkey"
    FOREIGN KEY ("consolidationId") REFERENCES "GuidingPolicyConsolidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "GuidingPolicyDraft_consolidationId_idx" ON "GuidingPolicyDraft"("consolidationId");
