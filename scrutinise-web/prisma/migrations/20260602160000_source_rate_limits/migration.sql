-- CreateTable: per-source rate-limit token buckets shared across all workers
CREATE TABLE "source_rate_limits" (
    "sourceKey"      TEXT        NOT NULL PRIMARY KEY,
    "intervalMs"     INTEGER     NOT NULL,
    "lastIssuedAt"   BIGINT      NOT NULL DEFAULT 0,
    "suspended"      BOOLEAN     NOT NULL DEFAULT false,
    "suspendedUntil" TIMESTAMP(3),
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
