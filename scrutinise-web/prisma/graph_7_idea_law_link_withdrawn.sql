-- GRAPH 7 follow-up (22 Oct 2026) — a link can be WITHDRAWN as well as superseded. Asked for by LEX 26-U §5.
--
-- When an owner saves version N+1 of an action's drafting instruction, a v N row whose (relation, doc_uri, provision_path)
-- reappears is superseded by the new row. A v N row whose target is gone from v N+1 has nothing to point at, since
-- superseded_by is a self-FK, so it is withdrawn instead: withdrawn_at + withdrawn_detail, never deleted.
--
-- "Live" is now   superseded_by IS NULL AND withdrawn_at IS NULL   — in ideaLawSet, in attachHandRows, and in the three
-- partial indexes, which are dropped and recreated here under the same names with the wider predicate.
--
-- Additive: two nullable columns, two CHECK constraints, three indexes rebuilt. No row is changed.
-- ⚠⚠ THE INDEXES ARE PARTIAL — docs/CLAUDE.md §21. Never apply a `prisma migrate diff` here.
-- ⚠ Apply with `npm run whichdb` FIRST (docs/CLAUDE.md §16), and push this file WITH schema.prisma in one commit.
BEGIN;

ALTER TABLE idea_law_link ADD COLUMN IF NOT EXISTS withdrawn_at     TIMESTAMPTZ NULL;
ALTER TABLE idea_law_link ADD COLUMN IF NOT EXISTS withdrawn_detail TEXT        NULL;

ALTER TABLE idea_law_link DROP CONSTRAINT IF EXISTS idea_law_link_withdrawn_pair_check;
-- A withdrawal says why, and a reason without a withdrawal is meaningless.
ALTER TABLE idea_law_link ADD CONSTRAINT idea_law_link_withdrawn_pair_check
  CHECK ((withdrawn_at IS NULL) = (withdrawn_detail IS NULL)
         AND (withdrawn_detail IS NULL OR btrim(withdrawn_detail) <> ''));

ALTER TABLE idea_law_link DROP CONSTRAINT IF EXISTS idea_law_link_superseded_or_withdrawn_check;
-- A row is retired one way or the other, never both.
ALTER TABLE idea_law_link ADD CONSTRAINT idea_law_link_superseded_or_withdrawn_check
  CHECK (superseded_by IS NULL OR withdrawn_at IS NULL);

-- ⚠ PARTIAL — docs/CLAUDE.md §21. Live rows only.
DROP INDEX IF EXISTS idea_law_link_idea_live_idx;
DROP INDEX IF EXISTS idea_law_link_target_live_idx;
DROP INDEX IF EXISTS idea_law_link_action_live_idx;
CREATE INDEX idea_law_link_idea_live_idx   ON idea_law_link (idea_id)                 WHERE superseded_by IS NULL AND withdrawn_at IS NULL;
CREATE INDEX idea_law_link_target_live_idx ON idea_law_link (doc_uri, provision_path) WHERE superseded_by IS NULL AND withdrawn_at IS NULL;
CREATE INDEX idea_law_link_action_live_idx ON idea_law_link (action_id)               WHERE superseded_by IS NULL AND withdrawn_at IS NULL;

COMMIT;
