-- STABLE SERIES IDENTITY (2026-08-04)
--
-- `stat_series.id` is a cuid: unique, but not stable across re-ingests. A changed series key
-- mints a new row beside the old one and the upsert can no longer reach the old one — which is
-- how 27 stale HMRC tax-gap series came to double-count 540 observations on 1 Aug 2026. The
-- natural key cannot stand in: 3,404 series collapse onto 3,244 distinct
-- (datasetId, measure, geography, cofogFunctionCode, forecastVintage) tuples because
-- sourceSeriesId is NULL for 2,925 of them and the distinguishing detail lives in seriesLabel.
--
-- `seriesKey` is a deterministic sha-256 over the six identity fields, computed identically in
-- TypeScript by lib/series-key.ts (read that file for why `unit` and `sourceSeriesId` are
-- deliberately OUT of the key). The search thread indexes the stats catalogue against this.

-- 1. the column
ALTER TABLE "stat_series" ADD COLUMN "seriesKey" TEXT;

-- 2. backfill — U+001F separates fields, U+001E stands in for a NULL. Both are C0 control
--    characters that cannot occur in a spreadsheet label, a slug or an ISO code, so no value
--    can impersonate a separator or a null.
UPDATE "stat_series" SET "seriesKey" = encode(sha256(convert_to(
  "datasetId"                            || E'\x1f' ||
  measure                                || E'\x1f' ||
  geography                              || E'\x1f' ||
  coalesce("cofogFunctionCode", E'\x1e') || E'\x1f' ||
  coalesce("forecastVintage",  E'\x1e')  || E'\x1f' ||
  "seriesLabel"
, 'UTF8')), 'hex');

-- 3. fail loudly and legibly on a collision rather than letting CREATE UNIQUE INDEX report it
--    as an opaque constraint violation. A collision here means two rows are the same series
--    under this definition — decide which survives before this migration can run.
DO $$
DECLARE dupes INT;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT "seriesKey" FROM "stat_series" GROUP BY 1 HAVING count(*) > 1
  ) t;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'seriesKey collision on % key(s): two or more stat_series rows share (datasetId, measure, geography, cofogFunctionCode, forecastVintage, seriesLabel). De-duplicate before migrating — see lib/series-key.ts.', dupes;
  END IF;
END $$;

-- 4. make it the identity
ALTER TABLE "stat_series" ALTER COLUMN "seriesKey" SET NOT NULL;
CREATE UNIQUE INDEX "stat_series_seriesKey_key" ON "stat_series"("seriesKey");

-- 5. retire the superseded constraint. It was near-inert where it mattered: Postgres treats
--    NULLs as distinct in a unique index, and sourceSeriesId is NULL for 86% of rows, so it
--    never stopped the duplicate-series class it was meant to. Keeping two competing
--    definitions of series identity is how they drift apart.
DROP INDEX "stat_series_datasetId_sourceSeriesId_geography_cofogFunctio_key";
