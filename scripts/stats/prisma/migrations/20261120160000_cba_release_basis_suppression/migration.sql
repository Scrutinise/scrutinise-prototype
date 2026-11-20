-- CBA-1 EXECUTE §3 (decision 329), 20 Nov 2026 — release date, price basis and suppression state.
--
-- Additive only: two enum values, two NULLABLE columns, one new table. No existing row changes.
--
-- 1. Per-ROW release date and price basis on stat_observation. Nullable because the six older datasets
--    were loaded without them; the three CBA datasets (pesa-ch5-function, css-2026, hmt-gdp-deflators)
--    carry both on every row, asserted by scripts/stats/check-cba-stats.ts.
-- 2. stat_suppressed_cell: a publisher's [c] / [n] is a STATE, never an amount. Not a nullable
--    stat_observation.value, because every existing reader does Number(r.value) and would turn the
--    NULL into 0. A cell lives in stat_observation XOR here.
--
-- Rollback: DROP TABLE "stat_suppressed_cell"; ALTER TABLE "stat_observation" DROP COLUMN "priceBasis",
-- DROP COLUMN "releaseDate";  (enum values cannot be dropped in Postgres; unused values are inert.)

ALTER TYPE "stat_source" ADD VALUE 'CABINET_OFFICE';
ALTER TYPE "stat_source" ADD VALUE 'HMT';

ALTER TABLE "stat_observation" ADD COLUMN "priceBasis" TEXT,
ADD COLUMN "releaseDate" DATE;

CREATE TABLE "stat_suppressed_cell" (
    "id" BIGSERIAL NOT NULL,
    "seriesId" TEXT NOT NULL,
    "periodType" "stat_period_type" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "markerText" TEXT NOT NULL,
    "releaseDate" DATE NOT NULL,
    "priceBasis" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stat_suppressed_cell_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stat_suppressed_cell_marker_check" CHECK ("marker" IN ('c', 'n'))
);

CREATE UNIQUE INDEX "stat_suppressed_cell_seriesId_periodType_periodStart_key" ON "stat_suppressed_cell"("seriesId", "periodType", "periodStart");

ALTER TABLE "stat_suppressed_cell" ADD CONSTRAINT "stat_suppressed_cell_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "stat_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
