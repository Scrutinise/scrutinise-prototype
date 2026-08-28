-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-L §3c — RE-FILE THE PROGNOSIS ROWS ALREADY IN THE DATABASE.
--
-- ⚠⚠ PREPARED, NOT RUN. This is Charlie's to execute, in one command:
--
--     npx tsx --env-file=.env scripts/apply-sql.ts prisma/lex_25l_backfill_prognosis.sql
--
-- WHY IT IS SEPARATE FROM `lex_25l.sql`. That file is additive and idempotent; this one
-- REWRITES STORED ROWS. `heading-map.ts`'s standing rule is that the stored tag always
-- wins over the config lookup, precisely so that moving a producer to a new heading cannot
-- silently rewrite what earlier rows meant. This is the deliberate exception, and it needs
-- to be a decision rather than a side effect of a deploy.
--
-- WHY IT IS DEFENSIBLE ANYWAY. The rule protects a tag that recorded what the producer MEANT.
-- These rows do not: `recordPrognosis` wrote `headingKey: 'AGAINST'` for want of anywhere
-- better, and the result is that "how hard will this be to pass" has been sitting under
-- "The strongest case against" — which is why Charlie could not find it. The tag recorded a
-- missing heading, not an intention.
--
-- ⚠ SCOPED THREE WAYS, and each one matters:
--   1. `passKey = 'SMART'`      — only the smart pass's rows, never the adversarial pass's,
--                                 which belong under AGAINST and always did.
--   2. `headingKey = 'AGAINST'` — only rows that have not already been re-filed, so a second
--                                 run changes nothing.
--   3. `title IN (…)`           — only the six titles `recordPrognosis` actually writes. A
--                                 match on passKey alone would sweep up anything the smart
--                                 pass may write under AGAINST in future.
--
-- ⚠ REVERSIBLE. The DOWN block at the bottom restores every row this touches, and it is
-- exact because the selection is by title rather than by a timestamp window.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- What is about to change, printed before it changes. A backfill whose scope nobody read is
-- a backfill nobody can defend afterwards.
SELECT "headingKey", "title", count(*) AS rows
FROM "EvidenceItem"
WHERE "passKey" = 'SMART'
  AND "headingKey" = 'AGAINST'
  AND "title" IN (
    'How hard this will be to pass',
    'The barriers this will actually meet',
    'How likely this is to succeed',
    'What is most likely to go wrong',
    'What I would cut',
    'What to read first'
  )
GROUP BY 1, 2
ORDER BY 2;

-- ── The reading list goes to KEY_SOURCES ────────────────────────────────────
UPDATE "EvidenceItem"
SET "headingKey" = 'KEY_SOURCES'
WHERE "passKey" = 'SMART'
  AND "headingKey" = 'AGAINST'
  AND "title" = 'What to read first';

-- ── Everything else the prognosis writes goes to HOW_HARD ───────────────────
UPDATE "EvidenceItem"
SET "headingKey" = 'HOW_HARD'
WHERE "passKey" = 'SMART'
  AND "headingKey" = 'AGAINST'
  AND "title" IN (
    'How hard this will be to pass',
    'The barriers this will actually meet',
    'How likely this is to succeed',
    'What is most likely to go wrong',
    'What I would cut'
  );

-- What it did. ⚠ READ THIS BEFORE COMMITTING — if the counts are not what the SELECT above
-- predicted, `ROLLBACK;` instead.
SELECT "headingKey", count(*) AS rows
FROM "EvidenceItem"
WHERE "passKey" = 'SMART' AND "headingKey" IN ('HOW_HARD', 'KEY_SOURCES', 'AGAINST')
GROUP BY 1 ORDER BY 1;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- DOWN — exact, because the selection is by title and not by a time window.
--
-- UPDATE "EvidenceItem" SET "headingKey" = 'AGAINST'
-- WHERE "passKey" = 'SMART' AND "headingKey" IN ('HOW_HARD', 'KEY_SOURCES');
-- ─────────────────────────────────────────────────────────────────────────────
