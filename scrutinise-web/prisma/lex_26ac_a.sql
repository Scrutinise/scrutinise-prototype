-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-AC part (a) (BRIEF_26AC §3; decisions 368, 370, 374) — scrutiny editions, author's notes, source links.
-- ⚠ DRAFT FOR CCh's GO — NOT APPLIED. ADDITIVE ONLY: three new tables; nothing existing is altered, renamed or dropped.
-- Every statement is IF NOT EXISTS, so applying it twice changes nothing.
--
-- An edition FREEZES the idea into a ProposalVersion (the existing append-only snapshot, minted at "Create scrutiny edition") and adds
-- what only an edition has: its own number per idea, DRAFT → PUBLISHED, what it includes, the round's blind setting, and the record of
-- the pre-publish checklist (what was published anyway). A PUBLISHED edition is never updated: the code refuses it, and a trigger below
-- refuses it in the database too, so a bug cannot change what reviewers were shown.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "scrutiny_edition" (
  "id"                  text PRIMARY KEY,
  "idea_id"             text NOT NULL REFERENCES "Idea"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "number"              integer NOT NULL,                                    -- "Scrutiny edition N", 1, 2, 3 per idea
  "proposal_version_id" text NOT NULL REFERENCES "ProposalVersion"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  "status"              text NOT NULL DEFAULT 'DRAFT',                       -- DRAFT | PUBLISHED
  "include"             jsonb NOT NULL DEFAULT '{}'::jsonb,                  -- which sections the owner included
  "blind"               boolean NOT NULL DEFAULT false,                      -- 369: each reviewer sees only their own until the round closes
  "round_closed_at"     timestamptz,
  "checklist"           jsonb,                                               -- at publish: unlinked sections, unaccepted drafts, uncited figures, each "published anyway"
  "published_at"        timestamptz,
  "published_by"        text REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  "created_by"          text NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "scrutiny_edition_status_ck" CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
  CONSTRAINT "scrutiny_edition_published_ck" CHECK (("status" = 'PUBLISHED') = ("published_at" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "scrutiny_edition_idea_number_key" ON "scrutiny_edition" ("idea_id", "number");
CREATE INDEX IF NOT EXISTS "scrutiny_edition_idea_idx" ON "scrutiny_edition" ("idea_id", "created_at" DESC);

-- 374 — author's notes: owner-written text at the top, or against a heading or an action. Kept per edition (a new edition starts from
-- the previous one's notes); set aside, never deleted.
CREATE TABLE IF NOT EXISTS "scrutiny_author_note" (
  "id"          text PRIMARY KEY,
  "edition_id"  text NOT NULL REFERENCES "scrutiny_edition"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "target_kind" text NOT NULL DEFAULT 'TOP',                                 -- TOP | HEADING | ACTION
  "target_id"   text,                                                        -- the heading's or action's id; null for TOP
  "body"        text NOT NULL,
  "order_index" integer NOT NULL DEFAULT 0,
  "archived_at" timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "scrutiny_author_note_target_ck" CHECK ("target_kind" IN ('TOP', 'HEADING', 'ACTION') AND (("target_kind" = 'TOP') = ("target_id" IS NULL)))
);
CREATE INDEX IF NOT EXISTS "scrutiny_author_note_edition_idx" ON "scrutiny_author_note" ("edition_id", "order_index");

-- 370 — the source-linking exercise: Lex PROPOSES a link between a section or claim and a filed source; the owner accepts or rejects it
-- (beside, never over). Runs on a DRAFT edition only.
CREATE TABLE IF NOT EXISTS "scrutiny_source_link" (
  "id"          text PRIMARY KEY,
  "edition_id"  text NOT NULL REFERENCES "scrutiny_edition"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "target_kind" text NOT NULL,                                               -- SUMMARY | HEADING | ACTION | DRAFT | NOTE
  "target_id"   text,
  "claim"       text,                                                        -- the words the link supports, when narrower than the section
  "source_id"   text NOT NULL REFERENCES "IdeaSource"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  "status"      text NOT NULL DEFAULT 'PROPOSED',                            -- PROPOSED | ACCEPTED | REJECTED
  "proposed_by" text NOT NULL DEFAULT 'LEX',                                 -- LEX | OWNER
  "reason"      text,
  "pence"       double precision,
  "answered_at" timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "scrutiny_source_link_status_ck" CHECK ("status" IN ('PROPOSED', 'ACCEPTED', 'REJECTED'))
);
CREATE INDEX IF NOT EXISTS "scrutiny_source_link_edition_idx" ON "scrutiny_source_link" ("edition_id", "status");

-- 368 — a published edition never changes: refuse any UPDATE of a PUBLISHED row except closing a blind round, and refuse edits to its
-- notes and links once it is published.
CREATE OR REPLACE FUNCTION "scrutiny_edition_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' AND (
       NEW."status" IS DISTINCT FROM OLD."status" OR NEW."number" IS DISTINCT FROM OLD."number"
    OR NEW."proposal_version_id" IS DISTINCT FROM OLD."proposal_version_id" OR NEW."include" IS DISTINCT FROM OLD."include"
    OR NEW."blind" IS DISTINCT FROM OLD."blind" OR NEW."checklist" IS DISTINCT FROM OLD."checklist"
    OR NEW."published_at" IS DISTINCT FROM OLD."published_at") THEN
    RAISE EXCEPTION 'scrutiny edition % is published and cannot change', OLD."id";
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS "scrutiny_edition_frozen" ON "scrutiny_edition";
CREATE TRIGGER "scrutiny_edition_frozen" BEFORE UPDATE ON "scrutiny_edition" FOR EACH ROW EXECUTE FUNCTION "scrutiny_edition_frozen"();

CREATE OR REPLACE FUNCTION "scrutiny_child_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
  SELECT "status" INTO st FROM "scrutiny_edition" WHERE "id" = COALESCE(NEW."edition_id", OLD."edition_id");
  IF st = 'PUBLISHED' THEN RAISE EXCEPTION 'scrutiny edition is published: its notes and source links cannot change'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS "scrutiny_author_note_frozen" ON "scrutiny_author_note";
CREATE TRIGGER "scrutiny_author_note_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "scrutiny_author_note" FOR EACH ROW EXECUTE FUNCTION "scrutiny_child_frozen"();
DROP TRIGGER IF EXISTS "scrutiny_source_link_frozen" ON "scrutiny_source_link";
CREATE TRIGGER "scrutiny_source_link_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "scrutiny_source_link" FOR EACH ROW EXECUTE FUNCTION "scrutiny_child_frozen"();
