-- ════════════════════════════════════════════════════════════════════════════════════════════
-- SURFACE 3 §4 — GraphDonationJudgement
--
-- Additive only. One new table, three indexes, three CHECK constraints. Nothing is dropped and
-- nothing existing is altered.
--
-- ⚠⚠ THE THREE CHECKS ARE THE DESIGN, NOT DECORATION. The route enforces the same order, but the
-- route is not the only thing that will ever write here — the second writer added in six months
-- will not have read it. This is the same reasoning `GraphClaimJudgement` carries for positions.
--
--   1. a reveal cannot precede a judgement            (revealedAt >= judgedAt)
--   2. an agreement cannot precede a reveal           (answeredAt requires revealedAt)
--   3. the vocabularies are closed                    (userVerdict, agreed, ourTier)
--
-- ⚠ AND THERE IS NO WRITE-BACK PATH FROM THIS TABLE TO position_signal OR position_estimate, by
-- design. §4: "a verdict is a signal, not a truth … one verdict must not overwrite an estimate."
-- Nothing here is a foreign key into the signal layer and nothing reads it when scoring.
-- ════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "GraphDonationJudgement" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "ideaId"        TEXT REFERENCES "Idea"("id") ON DELETE SET NULL,

  "donorEntityId" TEXT NOT NULL,
  "donorName"     TEXT NOT NULL,
  "partiesShown"  TEXT NOT NULL,
  "factsShown"    INTEGER NOT NULL DEFAULT 0,

  "userVerdict"   TEXT NOT NULL,
  "userReason"    TEXT,
  "judgedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  "revealedAt"    TIMESTAMPTZ,
  "ourTier"       TEXT,
  "ourInference"  TEXT,
  "ourConfidence" TEXT,
  "configVersion" TEXT,

  "agreed"        TEXT,
  "agreedReason"  TEXT,
  "answeredAt"    TIMESTAMPTZ,

  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 1 · the reveal is this response, so it is stamped with the judgement — never before it.
  CONSTRAINT "GraphDonationJudgement_reveal_after_judgement"
    CHECK ("revealedAt" IS NULL OR "revealedAt" >= "judgedAt"),
  -- 2 · you cannot agree with something you have not been shown.
  CONSTRAINT "GraphDonationJudgement_answer_after_reveal"
    CHECK ("answeredAt" IS NULL OR "revealedAt" IS NOT NULL),
  -- 3 · closed vocabularies. ⚠ 'not-sure' is a first-class answer and not a missing one.
  CONSTRAINT "GraphDonationJudgement_user_verdict"
    CHECK ("userVerdict" IN ('sympathetic', 'not-sympathetic', 'no-direction', 'not-enough')),
  CONSTRAINT "GraphDonationJudgement_agreed"
    CHECK ("agreed" IS NULL OR "agreed" IN ('right', 'wrong', 'not-sure')),
  CONSTRAINT "GraphDonationJudgement_our_tier"
    CHECK ("ourTier" IS NULL OR "ourTier" IN
      ('sustained-single-party', 'one-off-single-party', 'multi-party'))
);

CREATE INDEX IF NOT EXISTS "GraphDonationJudgement_donorEntityId_idx"
  ON "GraphDonationJudgement" ("donorEntityId");
CREATE INDEX IF NOT EXISTS "GraphDonationJudgement_userId_idx"
  ON "GraphDonationJudgement" ("userId");
CREATE INDEX IF NOT EXISTS "GraphDonationJudgement_agreed_idx"
  ON "GraphDonationJudgement" ("agreed");
