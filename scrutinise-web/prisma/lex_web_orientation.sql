-- LEX — Web/X orientation, Stage 0 (2026-08-06)
-- Additive + idempotent. Safe to re-run.
--
-- One nullable JSONB column: the §6d orientation record written alongside the
-- Page-1 background briefing.
--
--   Idea.orientation — { ranAt, recencyDays, recency{recentDevelopments[],
--     liveControversies[], politicalRisks[], whoIsTalking[], salience, sources[]},
--     comparative[], argumentsMined[], calls[], failed, noiseFilter,
--     totalMs, totalCostUsd }
--
-- REFERENCES AND EXTRACTS ONLY — dated, attributed items and their source URL,
-- the same rule `legislationRefs` and `stageSearches` already follow. No page
-- bodies, no corpus text.
--
-- Sizing: one row per idea, a few KB. Nothing here goes near the Railway
-- storage rules in docs/CLAUDE.md §6 — this is the app database.
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb). Confirm with
-- scripts/whichdb.ts before running — see docs/CLAUDE.md §16.

ALTER TABLE "Idea"
  ADD COLUMN IF NOT EXISTS "orientation" JSONB;
