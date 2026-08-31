-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-N §4 — REPOINT THE ROWS FILED UNDER THE RETIRED HEADING.
--
-- §4: *"Delete 'The strongest case against'. Neither example under it was a case against; the
-- good material belongs in Challenges or Who has argued about this."*
--
-- ⚠⚠ THE PANEL IS ALREADY CORRECT WITHOUT THIS. `liveHeading()` redirects `AGAINST` → `ARGUED`
-- on every read, so nothing is invisible while this file is unrun — which is why it is a
-- separate, deliberate step rather than something bundled into a deploy. Charlie runs it.
--
-- ⚠ WHAT IT BUYS is that the STORED tag and the RENDERED heading stop disagreeing. A redirect
-- applied at read time is a permanent translation layer: the next reader written against the
-- column — a report, an export, an analysis query — will see `AGAINST` and file it under a
-- heading that no longer exists, and nothing will error. This is the same shape as 25-L's
-- prepared-and-unrun `lex_25l_backfill_prognosis.sql`, for the same reason.
--
-- ⚠ AND IT IS SAFE TO RUN TWICE. The WHERE clause matches only the old value.
--
-- ⚠⚠ RUN THE COUNT FIRST AND KEEP THE NUMBER. `check:lex-25n` asserts that no evidence row
-- resolves to a null heading afterwards; the count below is what makes "nothing was lost"
-- checkable rather than assumed.
--
-- Apply against Neon (ep-old-dust-aboxi69a) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. How many rows are about to move. Read this, write it down, then run step 2.
SELECT count(*) AS rows_under_the_retired_heading
FROM "EvidenceItem"
WHERE "headingKey" = 'AGAINST';

-- 2. The move.
UPDATE "EvidenceItem"
SET "headingKey" = 'ARGUED'
WHERE "headingKey" = 'AGAINST';

-- 3. The read-back. Must be 0 for the first, and >= the step-1 count for the second.
SELECT count(*) AS still_under_the_retired_heading
FROM "EvidenceItem"
WHERE "headingKey" = 'AGAINST';

SELECT count(*) AS now_under_argued
FROM "EvidenceItem"
WHERE "headingKey" = 'ARGUED';
