-- LEX 26-V1 (23 Oct 2026) — DOCUMENTS ON ACTIONS. BRIEF_26V §2 (decisions 240, 241, 245, 246, 251); this file is the DDL of record.
--
-- An action owns documents (action → document → part, numbered 38.2.1; a part is a numbered section of a document's current version and has
-- no row of its own). A document has a kind, a number within its action, a D-number (D.<action number>.<document number>, derived, never
-- stored, never in the [Ref: n] series), a status, and versions. Lex's drafts are PROPOSALS beside the versions, never over them.
--
-- Additive: two new tables, CHECK constraints, plain (non-partial) indexes. Nothing is dropped. NOTHING IS EVER DELETED: a version is
-- appended; a proposal is answered (ACCEPTED / DISMISSED) and kept; a document is SUPERSEDED, not removed. Every foreign key is RESTRICT.
--
-- ⚠ ids are TEXT uuids written by Prisma (`@default(uuid())`). "Idea" and "LexCoherentAction" are the real table names.
-- ⚠ No Prisma relation fields on Idea / LexCoherentAction on purpose (as `headingId`): the FKs live here, so the shared models are untouched.
-- ⚠ No partial or expression index here, so nothing for the docs/CLAUDE.md §21 register.
-- ⚠ Apply with `npx tsx scripts/whichdb.ts` FIRST (docs/CLAUDE.md §16), and commit this file WITH schema.prisma (root CLAUDE.md).

CREATE TABLE IF NOT EXISTS action_document (
  id            TEXT        PRIMARY KEY,
  idea_id       TEXT        NOT NULL REFERENCES "Idea"(id) ON DELETE RESTRICT,
  action_id     TEXT        NOT NULL REFERENCES "LexCoherentAction"(id) ON DELETE RESTRICT,
  number        INTEGER     NOT NULL,
  kind          TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'DRAFTED',
  -- The version the owner accepted (status ACCEPTED). A later version takes the document back to DRAFTED.
  accepted_v    INTEGER     NULL,
  -- 251: a generated document is stale when the data it was generated from has moved on (the effects load date). Said in words.
  stale_at      TIMESTAMPTZ NULL,
  stale_reason  TEXT        NULL,
  superseded_by TEXT        NULL     REFERENCES action_document(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT action_document_number_check CHECK (number >= 1),
  CONSTRAINT action_document_kind_check
    CHECK (kind IN ('DRAFT_CLAUSE', 'COLLISION_REPORT', 'CONSEQUENTIAL_SCHEDULE', 'CODE_TEXT', 'SPECIFICATION', 'COSTING', 'OPERATING_TEXT', 'BACKGROUND_NOTE')),
  CONSTRAINT action_document_status_check CHECK (status IN ('DRAFTED', 'ACCEPTED', 'SUPERSEDED')),
  CONSTRAINT action_document_accepted_check CHECK ((status = 'ACCEPTED') = (accepted_v IS NOT NULL)),
  CONSTRAINT action_document_superseded_check CHECK ((status = 'SUPERSEDED') = (superseded_by IS NOT NULL)),
  CONSTRAINT action_document_stale_check CHECK ((stale_at IS NULL) = (stale_reason IS NULL)),
  CONSTRAINT action_document_title_check CHECK (btrim(title) <> ''),
  CONSTRAINT action_document_number_unique UNIQUE (action_id, number)
);
CREATE INDEX IF NOT EXISTS action_document_idea_idx   ON action_document (idea_id);
CREATE INDEX IF NOT EXISTS action_document_action_idx ON action_document (action_id);

CREATE TABLE IF NOT EXISTS action_document_version (
  id                 TEXT        PRIMARY KEY,
  document_id        TEXT        NOT NULL REFERENCES action_document(id) ON DELETE RESTRICT,
  -- VERSION: the document's text as it stands (numbered 1, 2, …). PROPOSAL: Lex's draft beside it (numbered in its own series).
  role               TEXT        NOT NULL,
  v                  INTEGER     NOT NULL,
  -- Who wrote it. GENERATED: built from data with no model call (a collision report, the consequential schedule).
  author             TEXT        NOT NULL,
  author_user_id     TEXT        NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The text the document shows and prints; its numbered parts are read from it.
  body               TEXT        NOT NULL DEFAULT '',
  file_key           TEXT        NULL,
  -- Kind-specific structure: a drafting instruction's fields; a collision report's rows (with depth); the schedule's flattened rows.
  payload            JSONB       NULL,
  -- What it drew on: [Ref: n] numbers and corpus ids. Evidence only — a D-number is never in here (241).
  sources            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- A proposal's own account: why, and what it cost.
  reason             TEXT        NULL,
  pence              NUMERIC     NULL,
  answered_at        TIMESTAMPTZ NULL,
  answer             TEXT        NULL,
  -- 251: the effects data a generated version was built from.
  effects_load_date  DATE        NULL,

  CONSTRAINT action_document_version_role_check CHECK (role IN ('VERSION', 'PROPOSAL')),
  CONSTRAINT action_document_version_author_check CHECK (author IN ('LEX', 'OWNER', 'COLLABORATOR', 'GENERATED')),
  CONSTRAINT action_document_version_v_check CHECK (v >= 1),
  CONSTRAINT action_document_version_answer_check CHECK (answer IS NULL OR answer IN ('ACCEPTED', 'DISMISSED')),
  CONSTRAINT action_document_version_answered_check CHECK ((answer IS NULL) = (answered_at IS NULL)),
  CONSTRAINT action_document_version_answer_role_check CHECK (answer IS NULL OR role = 'PROPOSAL'),
  CONSTRAINT action_document_version_unique UNIQUE (document_id, role, v)
);
CREATE INDEX IF NOT EXISTS action_document_version_document_idx ON action_document_version (document_id);
