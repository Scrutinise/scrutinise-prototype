-- Add isComplete flag to source_rate_limits so workers can skip exhausted sources
-- and stop polling for work that doesn't exist.
ALTER TABLE source_rate_limits ADD COLUMN "isComplete" boolean NOT NULL DEFAULT false;
