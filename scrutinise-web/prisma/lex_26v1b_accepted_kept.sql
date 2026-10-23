-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-V1b (decision 263) — a document KEEPS the version its owner last accepted when a later version is saved.
--
-- 26-V1 (prisma/lex_26v_action_documents.sql) tied the two together both ways: status = 'ACCEPTED' exactly when accepted_v is set. So a new
-- version had to null accepted_v, and the screen could no longer say "accepted at version 1, then changed — accept again" — it said only
-- "drafted, not accepted", as if the owner had never signed it off. 263 asks for the first.
--
-- The rule now runs ONE way: an ACCEPTED document names its accepted version; a DRAFTED (or SUPERSEDED) one may keep the last one accepted.
-- Compatible with the code before it (which always nulls accepted_v on DRAFTED), so applying it first breaks nothing.
-- Applied to Neon (ep-old-dust-aboxi69a) with scripts/apply-sql.ts after scripts/whichdb.ts, 23 Oct 2026.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE action_document DROP CONSTRAINT action_document_accepted_check;
ALTER TABLE action_document ADD CONSTRAINT action_document_accepted_check CHECK (status <> 'ACCEPTED' OR accepted_v IS NOT NULL);
