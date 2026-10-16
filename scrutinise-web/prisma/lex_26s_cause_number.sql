-- LEX 26-S decision 159 (17 Oct 2026) — CAUSE NUMBERS ARE ASSIGNED BY THE DATABASE, AND A DUPLICATE CANNOT BE STORED.
--
-- WHAT WENT WRONG. `check:lex-25s` was red on real data: idea 9910c16e (a soft-deleted 25-W scratch idea) had an unnumbered cause and two
-- causes numbered 4; idea f73f3928 ("Diversity, equity and inclusion practice in the civil service") had two causes numbered 2. The pairs were
-- 20ms apart. The cause was in `createCauses`: it numbered a parent `n++` and its sub-causes `n + i` without advancing `n` past them, so the
-- NEXT parent took the first sub-cause's number — deterministic, not only a race — and `max+1` computed in the app is a race in any case.
-- (Nothing cited the duplicated numbers: no evidence row names `causes:2/4` on either idea, no challenge text says "cause 2/4"; notes cite
-- causes by id.)
--
-- THE FIX, as lex_action_number_trg / lex_source_number_trg do it — and stronger: one past the highest number in the idea, assigned by the
-- database when the creator leaves it NULL, under a per-idea ADVISORY LOCK (those two take no lock, and say a racing duplicate is "visible
-- rather than destructive"; here it is made impossible), plus (second file, after the deploy) a UNIQUE index so a duplicate cannot be stored at all.
-- ⚠ "Never reused" holds as far as the table does: a cause hard-deleted from the top of the list frees its number (removeCause deletes the
--   row). Making that absolute needs a counter table; not done here, said here.
-- ⚠ No partial or expression index (CLAUDE.md §21 register unchanged): the unique index is plain, so `prisma migrate diff` can see it.
-- ⚠ Apply with `npx tsx scripts/whichdb.ts` first (§16); commit with schema.prisma in one commit.

-- 1 · REPAIR the three rows (each guarded by its id AND its current state, so a re-run changes nothing).
--     f73f3928: the later root (created last) takes the next number.   9910c16e: the later root, then the unnumbered one.
UPDATE "DiagnosisCause" SET "number" = 3 WHERE "id" = '5451b888-2dd0-487c-930c-845f8de0a32d' AND "number" = 2;
UPDATE "DiagnosisCause" SET "number" = 5 WHERE "id" = '469925ae-8ed7-41da-8bb3-18720ad40456' AND "number" = 4;
UPDATE "DiagnosisCause" SET "number" = 6 WHERE "id" = 'c3f7613d-7be6-40be-a7da-020b0a98d0a6' AND "number" IS NULL;

-- 2 · THE TRIGGER
CREATE OR REPLACE FUNCTION lex_cause_number() RETURNS trigger AS $$
BEGIN
  IF NEW."number" IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('lex_cause_number:' || NEW."ideaId"));
    SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number" FROM "DiagnosisCause" WHERE "ideaId" = NEW."ideaId";
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lex_cause_number_trg ON "DiagnosisCause";
CREATE TRIGGER lex_cause_number_trg BEFORE INSERT ON "DiagnosisCause" FOR EACH ROW EXECUTE FUNCTION lex_cause_number();

-- 3 · THE UNIQUE GUARD is a SECOND file (prisma/lex_26s_cause_number_unique.sql), applied only AFTER the code that stops numbering causes in the app
--     is deployed: the code in production today still numbers sub-causes colliding with the next parent, and a unique index under it would make
--     such a build throw. Order: this file → push → deployment read back → the unique file.
