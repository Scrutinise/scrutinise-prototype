// Generic idempotent upsert helpers shared by every source's real (DB-writing)
// ingest path. Kept separate from measure-pilot.ts, which never calls these —
// that script only fetches+parses+counts (see its header comment for why).
import { getStatsPrisma } from './db'
import { computeSeriesKey } from './series-key'
import type { StatPeriodType, StatRefreshStatus } from '../generated/stats-client'

export interface SeriesKey {
  datasetId: string
  sourceSeriesId: string | null
  geography: string
  measure: string
  unit: string
  cofogFunctionCode: string | null
  forecastVintage: string | null
  seriesLabel: string
  /** Per-series override of the dataset's commercial-use exclusion. Omit/null = inherit. */
  commercialUseExcluded?: boolean | null
}

export interface ObservationInput {
  periodType: StatPeriodType
  periodStart: Date
  periodLabel: string
  value: number
  status: string | null
}

/**
 * Ensure a COFOG code exists in the reference table before a series FKs to it.
 *
 * `stat_series.cofogFunctionCode` is a REAL foreign key to `stat_cofog_function.code`
 * (STATS_SCHEMA.md previously described sub-codes as un-FK'd free text — that was
 * wrong, and the mismatch is what failed the whole PESA refresh with P2003 on the
 * first live run, 1 Aug 2026). `seed-catalogue.ts` only seeds the 10 top-level codes,
 * but PESA Table 5.2 reports against 59 sub-functions. Rather than hardcode a list
 * that drifts every time a source adds a breakdown, sub-function rows are created on
 * demand from the source's own row label, with `parent` derived from the code.
 */
export async function ensureCofogFunction(code: string, name: string | null): Promise<void> {
  const prisma = getStatsPrisma()
  const parent = code.includes('.') ? code.split('.')[0] : null
  await prisma.statCofogFunction.upsert({
    where: { code },
    create: { code, parent, name: name ?? code },
    // Never overwrite a seeded top-level name with a source's row label; only fill a gap.
    update: name && parent ? { name } : {},
  })
}

/**
 * Upsert a series on its deterministic `seriesKey` and return its id.
 *
 * This is a REAL upsert, not find-then-create. The previous version matched on the natural
 * key and returned early on a hit, so a series whose unit or source id had since been
 * corrected kept the stale value forever; and because that key put `sourceSeriesId` (null
 * for 86% of rows) inside a Postgres unique index that treats NULLs as distinct, it never
 * actually prevented duplicates either.
 *
 * The update deliberately refreshes exactly the fields that are NOT part of the identity —
 * unit, sourceSeriesId, commercialUseExcluded. That is the whole point of leaving them out
 * of the key: a repair to any of them lands on the existing row instead of forking a new one
 * beside it. (See lib/series-key.ts.)
 */
export async function upsertSeries(key: SeriesKey): Promise<string> {
  const prisma = getStatsPrisma()
  const seriesKey = computeSeriesKey(key)
  const row = await prisma.statSeries.upsert({
    where: { seriesKey },
    create: {
      seriesKey,
      datasetId: key.datasetId,
      sourceSeriesId: key.sourceSeriesId,
      geography: key.geography,
      measure: key.measure,
      unit: key.unit,
      cofogFunctionCode: key.cofogFunctionCode,
      forecastVintage: key.forecastVintage,
      seriesLabel: key.seriesLabel,
      commercialUseExcluded: key.commercialUseExcluded ?? null,
    },
    update: {
      unit: key.unit,
      sourceSeriesId: key.sourceSeriesId,
      commercialUseExcluded: key.commercialUseExcluded ?? null,
    },
    select: { id: true },
  })
  return row.id
}

/** Upsert one observation onto an existing series id (idempotent on [seriesId, periodStart]). */
export async function upsertObservation(
  seriesId: string,
  geography: string,
  unit: string,
  cofogFunctionCode: string | null,
  obs: ObservationInput,
): Promise<void> {
  const prisma = getStatsPrisma()
  await prisma.statObservation.upsert({
    where: { seriesId_periodType_periodStart: { seriesId, periodType: obs.periodType, periodStart: obs.periodStart } },
    create: {
      seriesId,
      periodType: obs.periodType,
      periodStart: obs.periodStart,
      periodLabel: obs.periodLabel,
      value: obs.value,
      status: obs.status,
      geography,
      cofogFunctionCode,
      unit,
    },
    update: {
      value: obs.value,
      status: obs.status,
      periodLabel: obs.periodLabel,
    },
  })
}

// ─── BULK WRITE PATH ─────────────────────────────────────────────────────────
//
// WHY THIS EXISTS. `upsertSeries`/`upsertObservation` above issue ONE round trip per row.
// Against pooled Neon that measured ~10 series/minute on `obr-historical-forecasts` — 3.5
// hours for one dataset of 2,807 series / 20,482 observations, and it would have been ~11
// hours for IMF's 65,985 rows. The per-row helpers are kept because they are clearer for
// small sources and are what `ensureCofogFunction` and the tests use; anything at scale
// should come through `ingestRows` below, which issues one statement per ~500 rows instead.
//
// Both paths share the SAME conflict targets — `seriesKey` for series, (seriesId,
// periodType, periodStart) for observations — so they are interchangeable and equally
// idempotent. If you change one, change the other.

/** One source row: which series it belongs to, and the value it carries. */
export interface IngestRow {
  series: SeriesKey
  obs: ObservationInput
}

const SERIES_CHUNK = 500
const OBS_CHUNK = 500

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

/**
 * Bulk-upsert series on `seriesKey`, returning seriesKey -> id for every one of them.
 *
 * `id` is supplied here rather than defaulted: Prisma's `@default(cuid())` is generated in
 * the client, not by Postgres, so a raw INSERT has to provide one. New rows therefore get a
 * UUID where older rows carry a cuid. That is deliberate and harmless — `id` is explicitly an
 * opaque, non-stable handle (see lib/series-key.ts); `seriesKey` is the identity, and nothing
 * parses the id's format. `updatedAt` is likewise set explicitly because `@updatedAt` is a
 * client-side behaviour with no database default behind it.
 */
export async function upsertSeriesBatch(keys: SeriesKey[]): Promise<Map<string, string>> {
  const prisma = getStatsPrisma()
  const out = new Map<string, string>()

  // De-duplicate within the batch first. Postgres refuses "ON CONFLICT DO UPDATE command
  // cannot affect row a second time" if one statement carries the same conflict target twice,
  // and a source that reports the same series in two sheets would otherwise fail the run.
  const unique = new Map<string, SeriesKey>()
  for (const k of keys) if (!unique.has(computeSeriesKey(k))) unique.set(computeSeriesKey(k), k)

  for (const part of chunk([...unique.entries()], SERIES_CHUNK)) {
    const params: unknown[] = []
    const values: string[] = []
    for (const [seriesKey, k] of part) {
      const i = params.length
      params.push(
        crypto.randomUUID(), seriesKey, k.datasetId, k.sourceSeriesId, k.geography, k.measure,
        k.unit, k.cofogFunctionCode, k.forecastVintage, k.seriesLabel, k.commercialUseExcluded ?? null,
      )
      values.push(
        `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, ` +
        `$${i + 8}, $${i + 9}, $${i + 10}, $${i + 11}::boolean, now(), now())`,
      )
    }
    const rows = await prisma.$queryRawUnsafe<{ seriesKey: string; id: string }[]>(
      `INSERT INTO "stat_series"
         ("id","seriesKey","datasetId","sourceSeriesId","geography","measure","unit",
          "cofogFunctionCode","forecastVintage","seriesLabel","commercialUseExcluded",
          "createdAt","updatedAt")
       VALUES ${values.join(',')}
       ON CONFLICT ("seriesKey") DO UPDATE SET
         -- Only the NON-identity fields are refreshed; everything in the conflict target is
         -- by definition already equal. This is what lets a unit repair land on the existing
         -- row instead of forking a duplicate beside it.
         "unit" = EXCLUDED."unit",
         "sourceSeriesId" = EXCLUDED."sourceSeriesId",
         "commercialUseExcluded" = EXCLUDED."commercialUseExcluded",
         "updatedAt" = now()
       RETURNING "seriesKey", "id"`,
      ...params,
    )
    for (const r of rows) out.set(r.seriesKey, r.id)
  }
  return out
}

/** Bulk-upsert observations, idempotent on (seriesId, periodType, periodStart). */
export async function upsertObservationsBatch(
  rows: Array<{ seriesId: string; geography: string; unit: string; cofogFunctionCode: string | null; obs: ObservationInput }>,
): Promise<number> {
  const prisma = getStatsPrisma()
  // Same de-duplication requirement as above, on the observation's own conflict target.
  // Last write wins, matching the per-row path's behaviour.
  const unique = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    unique.set(`${r.seriesId}${r.obs.periodType}${r.obs.periodStart.toISOString()}`, r)
  }

  let written = 0
  for (const part of chunk([...unique.values()], OBS_CHUNK)) {
    const params: unknown[] = []
    const values: string[] = []
    for (const r of part) {
      const i = params.length
      params.push(
        r.seriesId, r.obs.periodType, r.obs.periodStart, r.obs.periodLabel, r.obs.value,
        r.obs.status, r.geography, r.cofogFunctionCode, r.unit,
      )
      values.push(
        `($${i + 1}, $${i + 2}::"stat_period_type", $${i + 3}::timestamp, $${i + 4}, ` +
        `$${i + 5}::numeric, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9}, now())`,
      )
    }
    written += await prisma.$executeRawUnsafe(
      `INSERT INTO "stat_observation"
         ("seriesId","periodType","periodStart","periodLabel","value","status",
          "geography","cofogFunctionCode","unit","createdAt")
       VALUES ${values.join(',')}
       ON CONFLICT ("seriesId","periodType","periodStart") DO UPDATE SET
         "value" = EXCLUDED."value",
         "status" = EXCLUDED."status",
         "periodLabel" = EXCLUDED."periodLabel"`,
      ...params,
    )
  }
  return written
}

/**
 * The standard write path: hand it every row a source produced and it does the rest.
 *
 * Returns the ATTEMPTED counts — distinct series and rows offered to the database. verify.ts
 * reconciles those against what is actually stored, and a gap means rows collided on the
 * observation unique key and overwrote each other. That reconciliation is what caught 533 lost
 * CDID rows and 60 lost tax-gap rows behind a green SUCCESS on 1 Aug 2026, so the count
 * returned here must stay "what we tried to write", never "what survived".
 */
export async function ingestRows(rows: IngestRow[]): Promise<{ series: number; observations: number }> {
  if (rows.length === 0) return { series: 0, observations: 0 }
  const idByKey = await upsertSeriesBatch(rows.map((r) => r.series))
  const obs = rows.map((r) => {
    const seriesId = idByKey.get(computeSeriesKey(r.series))
    if (!seriesId) throw new Error(`series upsert did not return an id for "${r.series.seriesLabel}" (${r.series.datasetId})`)
    return {
      seriesId,
      geography: r.series.geography,
      unit: r.series.unit,
      cofogFunctionCode: r.series.cofogFunctionCode,
      obs: r.obs,
    }
  })
  await upsertObservationsBatch(obs)
  return { series: idByKey.size, observations: rows.length }
}

export async function startRefreshLog(datasetId: string): Promise<string> {
  const prisma = getStatsPrisma()
  const log = await prisma.statRefreshLog.create({ data: { datasetId } })
  return log.id
}

export async function finishRefreshLog(
  logId: string,
  datasetId: string,
  status: StatRefreshStatus,
  counts: { seriesUpserted: number; observationsUpserted: number },
  errorMessage?: string,
): Promise<void> {
  const prisma = getStatsPrisma()
  await prisma.statRefreshLog.update({
    where: { id: logId },
    data: {
      finishedAt: new Date(),
      status,
      seriesUpserted: counts.seriesUpserted,
      observationsUpserted: counts.observationsUpserted,
      errorMessage,
    },
  })
  if (status !== 'FAILURE') {
    await prisma.statDataset.update({
      where: { id: datasetId },
      data: { lastRefreshedAt: new Date(), lastCheckedAt: new Date() },
    })
  } else {
    await prisma.statDataset.update({ where: { id: datasetId }, data: { lastCheckedAt: new Date() } })
  }
}
