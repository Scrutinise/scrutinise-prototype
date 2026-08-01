-- DropIndex
DROP INDEX "stat_observation_seriesId_periodStart_key";

-- CreateIndex
CREATE UNIQUE INDEX "stat_observation_seriesId_periodType_periodStart_key" ON "stat_observation"("seriesId", "periodType", "periodStart");

