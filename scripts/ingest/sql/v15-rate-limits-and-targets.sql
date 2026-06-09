-- V15 SQL: rate limit updates + committees corpus_targets
-- Run in Railway dashboard → scrutinise-db → Query tab (rate limits)
-- Run in Neon dashboard → SQL editor (corpus_targets)
-- Verify 429 absence in Railway worker logs before increasing TNA cap.

-- ── Part 2: Increase concurrent worker caps ──────────────────────────────────
-- Run in Railway DB (scrutinise-db Query tab)

-- eur-lex: was 3, increase to 8 (600 pending rows, 17 idle workers)
UPDATE source_rate_limits SET "maxConcurrentWorkers" = 8 WHERE "sourceKey" = 'eur-lex';

-- tna-legislation: increase to 15 only if no 429 errors in recent logs
-- (check Railway worker logs first — uncomment if no 429s seen)
-- UPDATE source_rate_limits SET "maxConcurrentWorkers" = 15 WHERE "sourceKey" = 'tna-legislation';

-- lda-parliament: reduce to 2 (pages 272+ consistently 524 even at pageSize=100)
UPDATE source_rate_limits SET "maxConcurrentWorkers" = 2 WHERE "sourceKey" = 'lda-parliament';

-- committees-portal: add rate limit for new source (500ms, max 3 concurrent)
INSERT INTO source_rate_limits ("sourceKey", "intervalMs", "maxConcurrentWorkers")
VALUES ('committees-portal', 500, 3)
ON CONFLICT ("sourceKey") DO UPDATE
  SET "intervalMs" = 500, "maxConcurrentWorkers" = 3;

-- Verify:
SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "isComplete"
FROM source_rate_limits
ORDER BY "sourceKey";


-- ── Part 3d: Add committees corpus_targets ───────────────────────────────────
-- Run in Neon DB (SQL editor)

INSERT INTO corpus_targets
  (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason)
VALUES
  ('committees-reports', 'Parliamentary Committee Reports', 9959, true, 2, false, NULL),
  ('committees-evidence', 'Parliamentary Committee Evidence (Other Publications)', 40794, true, 3, false, NULL)
ON CONFLICT (corpus_key) DO UPDATE
  SET blocked = false,
      blocked_reason = NULL,
      display_label = EXCLUDED.display_label,
      est_sections = EXCLUDED.est_sections,
      est_is_confirmed = EXCLUDED.est_is_confirmed;

-- Mark old blocked committees entries as retired
-- (only if committees-a and committees-b exist)
UPDATE corpus_targets
  SET retired = true, blocked = true,
      blocked_reason = 'Retired — replaced by committees-reports/committees-evidence via portal scraper (V15)'
WHERE corpus_key IN ('committees-a', 'committees-b');


-- ── Part 4c: Reset current LDA failed rows after page-size fix deploy ────────
-- Run in Railway DB after deploying the lda-parliament.ts change
-- Do NOT run before deploy — workers need the new pageSize=100 code

-- Reset failed LDA written questions rows (37 rows per brief)
-- Excludes specialist-queue rows (archived after 3+ attempts)
UPDATE ingest_queue
  SET status = 'pending',
      "lastError" = NULL,
      "claimedBy" = NULL,
      "claimedAt" = NULL
WHERE status = 'failed'
  AND corpus IN ('lda-commonswrittenquestions', 'lda-lordswrittenquestions')
  AND "lastError" NOT LIKE 'specialist-queue:%'
  AND ("lastError" LIKE '%524%' OR "lastError" LIKE '%timeout%');

-- Verify reset count:
SELECT corpus, COUNT(*) FROM ingest_queue
WHERE corpus IN ('lda-commonswrittenquestions', 'lda-lordswrittenquestions')
  AND status = 'pending'
GROUP BY corpus;
