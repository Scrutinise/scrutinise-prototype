-- GRAPH 7 (22 Oct 2026) — the idea↔law join. BRIEF_GRAPH_7.md §1 is the specification of intent; this file is the DDL of record.
--
-- One row says which law an idea (or one of its coherent actions) concerns, how it stands to it, who said so, and against
-- which version of the law. Everything the graph panels show for an idea hangs off these rows.
--
-- Additive: one new table, four CHECK constraints, three partial indexes. Nothing is dropped. Rows are never deleted: a wrong
-- attachment is superseded (`superseded_by`), and both foreign keys onto Lex's tables are RESTRICT, so neither an idea nor an
-- action can be hard-deleted out from under a link that names it.
--
-- ⚠ ids are TEXT uuids, written by Prisma (`@default(uuid())`), as every other Lex-written table here. "Idea" and
--   "LexCoherentAction" are the real table names: neither model is @@map-ped (schema.prisma, `model Idea` and
--   `model LexCoherentAction`).
-- ⚠⚠ THE THREE INDEXES ARE PARTIAL (WHERE superseded_by IS NULL). Prisma cannot declare a partial index, so `prisma migrate
--   diff` would propose DROPPING them. They are in the docs/CLAUDE.md §21 register; never apply a migrate diff here.
-- ⚠ The CHECK constraints are the enforcement of the vocabularies. lib/lex/idea-law-pure.ts holds the same lists for the
--   application, and check:idea-law asserts the two agree by reading the constraint definitions back from pg_constraint.
-- ⚠ Apply with `npx tsx scripts/whichdb.ts` FIRST (docs/CLAUDE.md §16), and push this file WITH schema.prisma in one commit.
CREATE TABLE IF NOT EXISTS idea_law_link (
  id              TEXT        PRIMARY KEY,
  idea_id         TEXT        NOT NULL REFERENCES "Idea"(id) ON DELETE RESTRICT,
  action_id       TEXT        NULL     REFERENCES "LexCoherentAction"(id) ON DELETE RESTRICT,
  target_kind     TEXT        NOT NULL,
  doc_uri         TEXT        NOT NULL,
  provision_path  TEXT        NULL,
  relation        TEXT        NOT NULL,
  source          TEXT        NOT NULL,
  source_detail   TEXT        NULL,
  note            TEXT        NULL,
  as_at           DATE        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by   TEXT        NULL     REFERENCES idea_law_link(id) ON DELETE RESTRICT,

  CONSTRAINT idea_law_link_relation_check
    CHECK (relation IN ('amends', 'repeals', 'modifies', 'relies_on', 'constrains', 'precedent', 'context')),
  CONSTRAINT idea_law_link_source_check
    CHECK (source IN ('hand', 'drafting_instruction', 'extraction')),
  CONSTRAINT idea_law_link_target_kind_check
    CHECK (target_kind IN ('act', 'provision', 'instrument', 'bill', 'document')),
  -- A hand row with no reason is a row nobody can audit in six months.
  CONSTRAINT idea_law_link_hand_note_check
    CHECK (source <> 'hand' OR (note IS NOT NULL AND btrim(note) <> '')),
  -- A provision row names its provision; nothing else does.
  CONSTRAINT idea_law_link_provision_check
    CHECK ((target_kind = 'provision') = (provision_path IS NOT NULL)),
  -- The id form, per kind: no host, no leading slash. 'bill/4019', 'doc/<corpus>/<doc id>', otherwise type/year/number.
  CONSTRAINT idea_law_link_doc_uri_check
    CHECK (
      doc_uri !~ '^(https?:|/)'
      AND (target_kind <> 'bill'     OR doc_uri ~ '^bill/[0-9]+$')
      AND (target_kind <> 'document' OR doc_uri ~ '^doc/[a-z0-9-]+/.+$')
      AND (target_kind IN ('bill', 'document') OR doc_uri ~ '^[a-z]+/[A-Za-z0-9-]+(/[A-Za-z0-9-]+)+$')
    ),
  CONSTRAINT idea_law_link_not_self_superseded CHECK (superseded_by IS NULL OR superseded_by <> id)
);

-- ⚠ PARTIAL — docs/CLAUDE.md §21. Live rows only, so superseded history does not slow the panel's read.
CREATE INDEX IF NOT EXISTS idea_law_link_idea_live_idx      ON idea_law_link (idea_id)                  WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idea_law_link_target_live_idx    ON idea_law_link (doc_uri, provision_path)  WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idea_law_link_action_live_idx    ON idea_law_link (action_id)                WHERE superseded_by IS NULL;
