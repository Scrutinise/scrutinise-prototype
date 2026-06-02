-- CreateTable: append-only time-series for ingest progress per scheduler run
CREATE TABLE "ingest_progress_snapshots" (
    "id"                SERIAL PRIMARY KEY,
    "capturedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workerLabel"       TEXT NOT NULL,
    "sourceKey"         TEXT NOT NULL,
    "sectionsCompiled"  INTEGER NOT NULL,
    "sectionsEstimated" INTEGER NOT NULL,
    "phase"             TEXT NOT NULL
);

CREATE INDEX "ingest_progress_snapshots_capturedAt_idx" ON "ingest_progress_snapshots"("capturedAt");
CREATE INDEX "ingest_progress_snapshots_sourceKey_idx"  ON "ingest_progress_snapshots"("sourceKey");
