-- Add workerId to ingest_progress_snapshots.
-- NULL = scheduler-written (per-corpus aggregate).
-- Non-null = worker-written (per-worker session snapshot).
ALTER TABLE ingest_progress_snapshots ADD COLUMN "workerId" integer;
CREATE INDEX idx_progress_snapshots_worker_id ON ingest_progress_snapshots ("workerId");
