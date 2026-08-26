-- CENTRAL — the topic taxonomy, replaced (2026-08-26)
-- Additive where it can be, and explicit about the four places it is not.
-- Idempotent. Safe to re-run. HAND-WRITTEN, not from `prisma migrate diff`
-- (docs/CLAUDE.md §16 and §21).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- ⚠ THIS CHANGES EXISTING DATA IN THREE WAYS, all reversible only by hand:
--     §2 renames four topic labels ON EXISTING QUESTIONS,
--     §3 deletes the 24 ministerial-department tags,
--     §4 deletes every QuestionTag row that is not on a Community root.
--   Each says below what it counted before it did it.
--
-- WHY. A topic is for browsing a slice you cannot name precisely; finding a
-- specific word is search's job. The list had drifted into 24 department names,
-- which is the wrong axis — a department is who answers, not what a question is
-- about — and they are renamed at every reshuffle, so the tag set would rot on
-- somebody else's timetable. Zero questions ever used one.
--
-- There is deliberately NO "Other". A catch-all absorbs precisely the questions
-- that would have told you which topic is missing. The topic field is optional
-- instead, and the admin Untagged view is the evidence base for adding one.

-- 1 ── the 22 topics, ON THE ROOT ONLY ───────────────────────────────────────
-- Branches inherit. Every read already resolves the root id first, so a
-- per-node copy was never read by anything — it could only drift.
--
-- `promoted` carries the SUBJECT / INTERNAL split rather than a curation call:
-- the chip row has been contexts-only since Stage 2d, so the flag's only
-- remaining job is grouping the "All topics" dropdown.
INSERT INTO "QuestionTag" ("id", "communityId", "kind", "label", "promoted", "sortOrder")
SELECT gen_random_uuid(), c."id", 'TOPIC', v.label, v.promoted, v.ord
FROM "Community" c
CROSS JOIN (VALUES
  ('Immigration & asylum',                 true,  1),
  ('Crime, justice & policing',            true,  2),
  ('Health & care',                        true,  3),
  ('Education',                            true,  4),
  ('Housing',                              true,  5),
  ('Transport & roads',                    true,  6),
  ('Energy & net zero',                    true,  7),
  ('Environment, farming & rural',         true,  8),
  ('Economy & tax',                        true,  9),
  ('Welfare & pensions',                   true, 10),
  ('Business & jobs',                      true, 11),
  ('Culture, media & sport',               true, 12),
  ('Science, technology & digital',        true, 13),
  ('Defence & foreign affairs',            true, 14),
  ('Constitution, devolution & elections', true, 15),
  ('Law & rights',                         true, 16),
  ('Social & moral issues',                true, 17),
  ('Local finance',                        true, 18),
  ('Local services',                       true, 19),
  ('Party conduct',                        false, 1),
  ('Media skills',                         false, 2),
  ('Organising',                           false, 3)
) AS v(label, promoted, ord)
WHERE c."parentCommunityId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "QuestionTag" t
    WHERE t."communityId" = c."id" AND t."kind" = 'TOPIC' AND t."label" = v.label
  );

-- Bring the survivors' promoted/sortOrder into line with the new grouping.
UPDATE "QuestionTag" t
SET "promoted" = v.promoted, "sortOrder" = v.ord
FROM (VALUES
  ('Housing', true, 5), ('Law & rights', true, 16),
  ('Local finance', true, 18), ('Local services', true, 19),
  ('Party conduct', false, 1), ('Media skills', false, 2), ('Organising', false, 3)
) AS v(label, promoted, ord)
WHERE t."kind" = 'TOPIC' AND t."label" = v.label;

-- 2 ── rename four labels, ON THE TAG AND ON EVERY QUESTION USING IT ─────────
-- ⚠ THE QUESTIONS MATTER MORE THAN THE TAG. `Question.topicTags` is a string
--   array, not a foreign key, so renaming the tag alone would strand every
--   question that used the old label — it would keep a topic that no longer
--   exists and match no filter. Counts at the time of writing:
--     Immigration 3 · Energy 2 · Economy 3 · Social issues 3.
DO $$
DECLARE
  m RECORD;
  moved INTEGER;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('Immigration',   'Immigration & asylum'),
      ('Energy',        'Energy & net zero'),
      ('Economy',       'Economy & tax'),
      ('Social issues', 'Social & moral issues')
    ) AS t(old, new)
  LOOP
    UPDATE "Question"
    SET "topicTags" = array_replace("topicTags", m.old, m.new)
    WHERE m.old = ANY("topicTags");
    GET DIAGNOSTICS moved = ROW_COUNT;
    RAISE NOTICE 'topic "%" -> "%": % question(s) moved', m.old, m.new, moved;

    DELETE FROM "QuestionTag" WHERE "kind" = 'TOPIC' AND "label" = m.old;
  END LOOP;
END $$;

-- 3 ── the 24 ministerial departments go ─────────────────────────────────────
-- ⚠ Guarded: if any question ever adopted one, this RAISES rather than dropping
--   a label out from under it. Nothing used them at the time of writing.
DO $$
DECLARE in_use INTEGER;
BEGIN
  SELECT COUNT(*) INTO in_use
  FROM "Question" q
  WHERE EXISTS (
    SELECT 1 FROM unnest(q."topicTags") AS tag
    WHERE tag LIKE 'Department%' OR tag IN (
      'Attorney General’s Office', 'Cabinet Office', 'HM Treasury', 'Home Office',
      'Foreign, Commonwealth and Development Office', 'Ministry of Defence',
      'Ministry of Housing, Communities and Local Government', 'Ministry of Justice',
      'Northern Ireland Office', 'Office of the Advocate General for Scotland',
      'Office of the Leader of the House of Commons',
      'Office of the Leader of the House of Lords', 'Scotland Office',
      'UK Export Finance', 'Wales Office'
    )
  );
  IF in_use > 0 THEN
    RAISE EXCEPTION 'STOP: % question(s) still use a department topic. Remap them before dropping the tags.', in_use;
  END IF;
  RAISE NOTICE 'department topics in use by questions: 0 — safe to drop';
END $$;

DELETE FROM "QuestionTag"
WHERE "kind" = 'TOPIC'
  AND (
    "label" LIKE 'Department%'
    OR "label" IN (
      'Attorney General’s Office', 'Cabinet Office', 'HM Treasury', 'Home Office',
      'Foreign, Commonwealth and Development Office', 'Ministry of Defence',
      'Ministry of Housing, Communities and Local Government', 'Ministry of Justice',
      'Northern Ireland Office', 'Office of the Advocate General for Scotland',
      'Office of the Leader of the House of Commons',
      'Office of the Leader of the House of Lords', 'Scotland Office',
      'UK Export Finance', 'Wales Office'
    )
  );

-- 4 ── tags live on the root; branch copies go ───────────────────────────────
-- ⚠ Safe because nothing reads them: `getTags`, the side-tag query in
--   `listQuestions` and `planImport` all resolve the root id first. The rows
--   existed only because central_stage2b.sql seeded per node, and they could
--   only ever drift apart from the root's.
DO $$
DECLARE doomed INTEGER;
BEGIN
  SELECT COUNT(*) INTO doomed
  FROM "QuestionTag" t
  JOIN "Community" c ON c."id" = t."communityId"
  WHERE c."parentCommunityId" IS NOT NULL;
  RAISE NOTICE 'branch-level tag rows being removed: %', doomed;
END $$;

DELETE FROM "QuestionTag" t
USING "Community" c
WHERE c."id" = t."communityId" AND c."parentCommunityId" IS NOT NULL;

-- 5 ── what the result should be ─────────────────────────────────────────────
DO $$
DECLARE topics INTEGER; contexts INTEGER; roots INTEGER; orphaned INTEGER;
BEGIN
  SELECT COUNT(*) INTO roots FROM "Community" WHERE "parentCommunityId" IS NULL;
  SELECT COUNT(*) INTO topics FROM "QuestionTag" WHERE "kind" = 'TOPIC';
  SELECT COUNT(*) INTO contexts FROM "QuestionTag" WHERE "kind" LIKE 'CONTEXT%';

  -- A question carrying a topic that is no longer in the tag set would be
  -- invisible to the filter that ought to find it. This is the assertion that
  -- the rename in §2 actually landed.
  SELECT COUNT(*) INTO orphaned
  FROM "Question" q
  WHERE EXISTS (
    SELECT 1 FROM unnest(q."topicTags") AS tag
    WHERE NOT EXISTS (
      SELECT 1 FROM "QuestionTag" t
      WHERE t."kind" = 'TOPIC' AND t."label" = tag AND t."communityId" = q."communityId"
    )
  );

  RAISE NOTICE 'roots=% topics=% (expect 22 per root) contexts=% (expect 8 per root)', roots, topics, contexts;
  IF orphaned > 0 THEN
    RAISE EXCEPTION 'STOP: % question(s) carry a topic that is not in the tag set', orphaned;
  END IF;
  RAISE NOTICE 'questions carrying an unknown topic: 0';
END $$;
