-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "stat_source" AS ENUM ('ONS', 'OBR', 'HMT_PESA', 'HMRC');

-- CreateEnum
CREATE TYPE "stat_refresh_cadence" AS ENUM ('MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL', 'IRREGULAR', 'STATIC');

-- CreateEnum
CREATE TYPE "stat_period_type" AS ENUM ('ANNUAL', 'FINANCIAL_YEAR', 'QUARTERLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "stat_refresh_status" AS ENUM ('SUCCESS', 'NO_CHANGE', 'FAILURE');

-- CreateTable
CREATE TABLE "stat_cofog_function" (
    "code" TEXT NOT NULL,
    "parent" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "stat_cofog_function_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "stat_dataset" (
    "id" TEXT NOT NULL,
    "source" "stat_source" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cofogRelevant" BOOLEAN NOT NULL DEFAULT false,
    "licence" TEXT NOT NULL,
    "licenceUrl" TEXT,
    "licenceVerifiedAt" TIMESTAMP(3) NOT NULL,
    "commercialUseExcluded" BOOLEAN NOT NULL DEFAULT false,
    "refreshCadence" "stat_refresh_cadence" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceEditionOrVersion" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stat_dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_dimension" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codeList" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stat_dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_series" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "sourceSeriesId" TEXT,
    "seriesLabel" TEXT NOT NULL,
    "geography" TEXT NOT NULL DEFAULT 'GB',
    "measure" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "cofogFunctionCode" TEXT,
    "forecastVintage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stat_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_observation" (
    "id" BIGSERIAL NOT NULL,
    "seriesId" TEXT NOT NULL,
    "periodType" "stat_period_type" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "status" TEXT,
    "geography" TEXT NOT NULL,
    "cofogFunctionCode" TEXT,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stat_observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_refresh_log" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "stat_refresh_status",
    "observationsUpserted" INTEGER NOT NULL DEFAULT 0,
    "seriesUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "stat_refresh_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stat_dimension_datasetId_name_key" ON "stat_dimension"("datasetId", "name");

-- CreateIndex
CREATE INDEX "stat_series_datasetId_idx" ON "stat_series"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "stat_series_datasetId_sourceSeriesId_geography_cofogFunctio_key" ON "stat_series"("datasetId", "sourceSeriesId", "geography", "cofogFunctionCode", "forecastVintage", "measure");

-- CreateIndex
CREATE INDEX "stat_observation_seriesId_periodStart_idx" ON "stat_observation"("seriesId", "periodStart");

-- CreateIndex
CREATE INDEX "stat_observation_geography_cofogFunctionCode_periodStart_idx" ON "stat_observation"("geography", "cofogFunctionCode", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "stat_observation_seriesId_periodStart_key" ON "stat_observation"("seriesId", "periodStart");

-- CreateIndex
CREATE INDEX "stat_refresh_log_datasetId_startedAt_idx" ON "stat_refresh_log"("datasetId", "startedAt");

-- AddForeignKey
ALTER TABLE "stat_dimension" ADD CONSTRAINT "stat_dimension_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "stat_dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_series" ADD CONSTRAINT "stat_series_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "stat_dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_series" ADD CONSTRAINT "stat_series_cofogFunctionCode_fkey" FOREIGN KEY ("cofogFunctionCode") REFERENCES "stat_cofog_function"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_observation" ADD CONSTRAINT "stat_observation_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "stat_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_refresh_log" ADD CONSTRAINT "stat_refresh_log_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "stat_dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

