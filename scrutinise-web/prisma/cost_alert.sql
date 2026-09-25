-- cost_alert.sql — S22 "Alerts". DDL OF RECORD for the cost-alert dedupe table.
-- Additive, idempotent; there is no DROP in this file. Applied by scripts/apply-sql.ts,
-- which prints the target host first (docs/CLAUDE.md §16).
--
-- ⚠ WHY A TABLE, NOT JUST "CHECK IF total >= threshold": "once when it passes $20 and once
-- at $50" is a STATEFUL claim — the job runs daily, MTD spend stays above $20 for the rest
-- of the month once it crosses, and a check with no memory would email Charlie every day
-- for three weeks. One row per (month, threshold) sent, with a UNIQUE constraint so a
-- double-run (the job fired twice, a retry) cannot double-send even under a race —
-- `ON CONFLICT DO NOTHING` in the script relies on this.
CREATE TABLE IF NOT EXISTS "CostAlertSent" (
  id            BIGSERIAL PRIMARY KEY,
  -- 'YYYY-MM', UTC — see CLAUDE.md's UTC-only rule for exactly this class of off-by-one.
  month         TEXT NOT NULL,
  -- DECIMAL, not INTEGER: S22's own proof step runs the job with a $0.01 threshold to show
  -- it can fire without waiting for real spend to reach $20, and an integer column would
  -- reject that value outright.
  "thresholdUsd" DECIMAL(10,2) NOT NULL,
  "sentAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Resend's own id for the sent message — the same "evidence, not an absence of errors"
  -- discipline lib/email.ts's SendResult already applies everywhere else.
  "providerId"   TEXT,
  UNIQUE (month, "thresholdUsd")
);
