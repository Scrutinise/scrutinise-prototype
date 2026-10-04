-- LEX 26-Q (4 Oct 2026) — every NEW coherent action gets its stable number at the database, not in each of the six places
-- that create one (the build, the user, gap-check acceptance, consolidation's action ideas, the policy→action moves, scripts).
-- A creator that forgets would otherwise leave an action nobody can name ("put 7 and 12 under Transparency").
-- One past the highest number EVER used in the idea (a ruled-out or archived row keeps its number, so a number is never reused).
-- Two inserts racing in one idea could take the same number; that is rare, and a duplicate is visible rather than destructive.
CREATE OR REPLACE FUNCTION lex_action_number() RETURNS trigger AS $$
BEGIN
  IF NEW."number" IS NULL THEN
    SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number" FROM "LexCoherentAction" WHERE "ideaId" = NEW."ideaId";
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lex_action_number_trg ON "LexCoherentAction";
CREATE TRIGGER lex_action_number_trg BEFORE INSERT ON "LexCoherentAction" FOR EACH ROW EXECUTE FUNCTION lex_action_number();
