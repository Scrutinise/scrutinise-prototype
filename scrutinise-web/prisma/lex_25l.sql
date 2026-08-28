-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-L — the re-run dialogue, the rejection log, source priority,
-- the panel layout, and the blind-first graph judgements.
--
-- ⚠ ADDITIVE ONLY. Five additions, one widened enum, no drops, no rewrites, no
-- backfill in this file. Every statement is idempotent so a re-run is a no-op.
--
-- ⚠⚠ NEVER `prisma migrate diff` AGAINST THIS DATABASE (docs/CLAUDE.md §21). It
-- proposes DROPPING the partial and expression indexes it cannot see, and
-- accepting that diff removes guards silently.
--
-- Applied against Neon (ep-old-dust-aboxi69a) — checked with scripts/whichdb.ts
-- before running, per §16.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ §1 — THE RE-RUN CRITIQUE, STORED AGAINST THE BUILD ═════════════════════
--
-- ⚠ ON THE BUILD, NOT ON THE IDEA. "What was wrong with the last run" is a
-- statement about ONE run. Hanging it off the idea would leave four critiques in
-- a heap with nothing saying which attempt each was about, which is exactly the
-- information that makes it a quality signal.
--
-- ⚠ AND IT IS THE INPUT TO *THIS* BUILD, not a note about the previous one. The
-- row it lands on is the build the user asked for after writing it, so reading
-- version N's critique tells you what N was asked to fix about N-1.
ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "userCritique" TEXT;
ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "userCritiqueAt" TIMESTAMP(3);

-- ══ §2 — EVERY REJECTED ITEM, WITH ITS TYPE ════════════════════════════════
--
-- ⚠ THIS TABLE IS THE EVIDENCE BASE FOR A DECISION WE HAVE NOT TAKEN. §2:
-- "Do not build YouTube transcript fetching now: it is fragile, its terms are
-- unclear, and we have no evidence of demand." A count of video links people
-- actually tried to give us is that evidence, and it cannot be recovered later
-- from anywhere else — a rejection that only ever became an error message on a
-- screen leaves no trace at all.
--
-- ⚠ `target` IS TRUNCATED BY THE APPLICATION, not by the column. A URL is
-- user-supplied text and belongs in TEXT; the cap lives where the sentence
-- explaining it can live with it.
CREATE TABLE IF NOT EXISTS "IdeaMaterialRejection" (
  "id"        TEXT PRIMARY KEY,
  "ideaId"    TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE,
  "userId"    TEXT,
  -- video | paywalled | unreadable-format | no-text | too-large | unfetchable | not-a-url | too-many
  "kind"      TEXT NOT NULL,
  -- The URL or the filename. What was refused, so a count can be broken down by host.
  "target"    TEXT NOT NULL,
  -- The sentence the user was actually shown. Stored so the log and the screen
  -- cannot drift into disagreeing about what we told them.
  "detail"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "IdeaMaterialRejection_ideaId_idx" ON "IdeaMaterialRejection" ("ideaId");
CREATE INDEX IF NOT EXISTS "IdeaMaterialRejection_kind_createdAt_idx" ON "IdeaMaterialRejection" ("kind", "createdAt");

-- ══ §3d — A THIRD DECISION: PRIORITY ═══════════════════════════════════════
--
-- ⚠ A NEW ENUM VALUE, NOT A NEW COLUMN. The decision on a source is one fact
-- with three states — priority, listed, set aside — and splitting "is it a
-- priority" into a second boolean would allow the meaningless fourth state
-- (excluded AND priority) to exist in the data.
--
-- ⚠ `IF NOT EXISTS` on ADD VALUE needs PG 12+; Neon is 16.
ALTER TYPE "SourceDecisionStatus" ADD VALUE IF NOT EXISTS 'PRIORITY';

-- ══ §4 — THE PANEL LAYOUT, PER USER ════════════════════════════════════════
--
-- ⚠ A COLUMN, NOT `localStorage`. §4: "the choice persists per user." A browser
-- store persists per DEVICE, so a user who set their layout on a laptop meets
-- the default again on a desktop and concludes it did not save. The shape is
-- validated by Zod on write; the column is deliberately loose because a future
-- fourth panel must not need a migration.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lexPanelLayout" JSONB;

-- ══ §5 — THE BLIND-FIRST JUDGEMENTS ════════════════════════════════════════
--
-- ⚠⚠ BOTH SIDES ARE STORED, AND THE USER'S IS STORED FIRST. The whole point of
-- the mechanism is that the user judges before seeing ours: if the two arrived
-- in one write we could never prove the order, and an agreement rate computed
-- over a screen that had already shown the answer measures nothing but anchoring.
-- So `userVerdict` is written on its own, `revealedAt` is stamped when ours is
-- shown, and `agreed` can only be written after that.
--
-- ⚠ OUR ASSESSMENT IS COPIED IN AT REVEAL TIME, not looked up later. The graph
-- is recomputed with decay on every read, so a judgement joined to a live query
-- would be scored against a claim that has since moved. The row has to be able
-- to say what the user was actually shown.
--
-- ⚠ NO UNIQUE ON (user, claim): a second judgement of the same claim months
-- later is data, not a duplicate.
CREATE TABLE IF NOT EXISTS "GraphClaimJudgement" (
  "id"              TEXT PRIMARY KEY,
  "userId"          TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  -- Null when judged outside an idea (the standalone review surface).
  "ideaId"          TEXT REFERENCES "Idea"("id") ON DELETE SET NULL,
  -- Which claim: the actor, and the targets the question was asked over.
  "actorId"         TEXT NOT NULL,
  "actorName"       TEXT NOT NULL,
  "targetKey"       TEXT NOT NULL,
  "questionText"    TEXT NOT NULL,
  -- ── the user's own judgement, made BEFORE ours was shown ──
  -- supports | opposes | unclear | not-enough
  "userVerdict"     TEXT NOT NULL,
  "userReason"      TEXT,
  "groundsShown"    INTEGER NOT NULL DEFAULT 0,
  "judgedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ── ours, copied in when it was revealed ──
  "revealedAt"      TIMESTAMP(3),
  "ourStance"       TEXT,
  "ourClaim"        TEXT,
  "ourConfidence"   DOUBLE PRECISION,
  "ourConfidenceWording" TEXT,
  "configVersion"   TEXT,
  -- ── and whether it looked right to them ──
  "agreed"          BOOLEAN,
  "agreedReason"    TEXT,
  "answeredAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- ⚠ THE ORDER IS ENFORCED IN THE DATABASE, not only in the route. This is the
  -- one property the whole measurement rests on, and a second writer added in six
  -- months will not have read the route. `coalesce` because a CHECK passes when
  -- its expression is NULL (docs/CLAUDE.md §21, the twenty-second shape).
  CONSTRAINT "GraphClaimJudgement_reveal_after_judgement"
    CHECK ("revealedAt" IS NULL OR "revealedAt" >= "judgedAt"),
  CONSTRAINT "GraphClaimJudgement_agreement_needs_reveal"
    CHECK ("agreed" IS NULL OR "revealedAt" IS NOT NULL),
  CONSTRAINT "GraphClaimJudgement_verdict_vocabulary"
    CHECK (coalesce("userVerdict", '') IN ('supports', 'opposes', 'unclear', 'not-enough'))
);
CREATE INDEX IF NOT EXISTS "GraphClaimJudgement_actorId_idx" ON "GraphClaimJudgement" ("actorId");
CREATE INDEX IF NOT EXISTS "GraphClaimJudgement_userId_idx" ON "GraphClaimJudgement" ("userId");
CREATE INDEX IF NOT EXISTS "GraphClaimJudgement_agreed_idx" ON "GraphClaimJudgement" ("agreed");
