-- LEGISLATION GUIDE — expert corrections (2026-08-09)
-- Additive + idempotent. Safe to re-run.
--
-- One new table backing the "Suggest an improvement" form on the published draft of
-- "Reading legislation: a working guide" (/support → Reading legislation).
--
-- Its own table rather than a Feedback row with a special feedbackType: this object
-- carries a section reference and a claim to expertise, and it has a review lifecycle
-- against a document. See the model comment in schema.prisma.
--
-- No account required, so there is no userId and no FK to User. `email` is required —
-- a correction we cannot reply to is worth much less than one we can. `ipHash` is
-- SHA-256 for abuse triage; the raw address is never stored (security rule 6).
--
-- Sizing: a few hundred rows at the very most, a few KB each. This is the app
-- database (Neon), not the corpus database — nothing here goes near the storage
-- rules in docs/CLAUDE.md §6.
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb). Confirmed with the
-- whichdb check before running — see docs/CLAUDE.md §16.

CREATE TABLE IF NOT EXISTS "LegislationGuideSuggestion" (
  "id"           TEXT         NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"         TEXT         NOT NULL,
  "email"        TEXT         NOT NULL,
  "credentials"  TEXT,
  "sectionKey"   TEXT         NOT NULL,
  "sectionTitle" TEXT         NOT NULL,
  "suggestion"   TEXT         NOT NULL,
  "status"       TEXT         NOT NULL DEFAULT 'NEW',
  "adminNotes"   TEXT,
  "sentAt"       TIMESTAMP(3),
  "sendError"    TEXT,
  "ipHash"       TEXT,

  CONSTRAINT "LegislationGuideSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegislationGuideSuggestion_status_createdAt_idx"
  ON "LegislationGuideSuggestion" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "LegislationGuideSuggestion_sectionKey_idx"
  ON "LegislationGuideSuggestion" ("sectionKey");
