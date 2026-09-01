-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-P §1 — THE GUIDING POLICY BECOMES A DECISION, NOT A LIST.
--
-- ⚠ ADDITIVE ONLY. Columns on "PolicyOption" and "Idea", nothing dropped, nothing rewritten.
-- Idempotent.
--
-- ⚠⚠ TWO MEASUREMENTS SHAPED THIS, AND BOTH CONTRADICT AN ASSUMPTION IN THE BRIEF. Measured on
-- idea 452c5ade, 1 September 2026:
--
--   1. THE 18 CANDIDATE POLICIES ARE SIX BUILDS × THREE, APPENDED. `createPolicyOptions` never
--      deletes and `revisePass` never touches policy rows — so the list the user cannot choose
--      from is the UNION OF SIX RUNS, full of near-duplicates nobody de-duplicated. "How do I
--      choose?" is partly a question about an accumulation, not about one considered set.
--
--   2. ⚠⚠ `targetCauseIds` IS SET ON **ZERO OF 18**. §1.5 says to cluster "read off the causal
--      chain" — and the column that would carry that link has never been written by any pass.
--      The schema permits it; no prompt requires it (CLAUDE.md §24, fourth instance). So the
--      cluster cannot READ a link; the sort has to ASSIGN one, and it is a model judgement
--      labelled as such rather than a structural fact.
--
-- Apply against Neon (ep-old-dust-aboxi69a) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ §1.1 — THE STABLE NUMBER ═══════════════════════════════════════════════════
-- 1..n, assigned once, and it NEVER MOVES. A rejected 7 leaves a gap; nothing renumbers.
-- The user instructs Lex BY NUMBER, so a renumbering between reading and typing would merge two
-- different policies silently.
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "number" INTEGER;

-- ══ §1.2 — WHAT THE SORT DECIDED, AND WHY ══════════════════════════════════════
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'GUIDING_POLICY';
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "kindReason" TEXT;
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "sortedAt" TIMESTAMP(3);

-- ══ §1.3 — AN ACTION MOVES ONLY ON CONSENT, AND BELONGS TO A POLICY ════════════
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "moveStatus" TEXT;
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "parkedWithId" TEXT;
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "movedToActionId" TEXT;

-- ══ §1.7 — MERGES ═════════════════════════════════════════════════════════════
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "mergedFrom" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT;

-- ══ §1.6 — TWO JUDGEMENTS, KEPT APART, EACH CARRYING ITS BASIS ═════════════════
-- { verdict, why, basis: REASONED | RETRIEVED | NOT_FOUND }.
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "importance" JSONB;
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "addressability" JSONB;

-- ══ §1.8 — THE CHAIN-LINK CONSEQUENCE ═════════════════════════════════════════
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "chainLink" TEXT;

-- ══ §1.10 — NOW OR LATER ══════════════════════════════════════════════════════
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "phase" TEXT;
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "phaseReason" TEXT;

-- ══ §1.4 — THE CAUSE A POLICY IMPLIES THAT THE DIAGNOSIS DOES NOT HAVE ═════════
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "impliedCause" JSONB;

-- ══ §1.9 — TWO ROUNDS, THEN LEX STOPS ASKING ══════════════════════════════════
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "guidingPolicyRounds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "guidingPolicyUnresolved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "guidingPolicyUnresolvedWhy" TEXT;

-- ⚠ THE NUMBER IS LOOKED UP ON EVERY INSTRUCTION THE USER TYPES ("merge 4 and 8"), so it is
-- indexed. Not partial and not unique: a gap is legitimate, and two ideas may both have a 4.
CREATE INDEX IF NOT EXISTS "PolicyOption_ideaId_number_idx"
  ON "PolicyOption" ("ideaId", "number");
