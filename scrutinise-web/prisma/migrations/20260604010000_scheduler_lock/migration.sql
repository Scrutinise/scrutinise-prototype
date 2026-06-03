-- Add scheduler_lock table — single-row mutex to prevent duplicate scheduler email runs.
-- process_id is a TEXT random UUID generated per process startup (not PID — Railway
-- containers all start as PID 1, which would break equality checks across containers).
CREATE TABLE scheduler_lock (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  locked_at  TIMESTAMPTZ NOT NULL,
  process_id TEXT        NOT NULL,
  CONSTRAINT single_row CHECK (id = 1)
);
