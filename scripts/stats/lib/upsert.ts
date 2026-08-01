// Generic idempotent upsert helpers shared by every source's real (DB-writing)
// ingest path. Kept separate from measure-pilot.ts, which never calls these —
// that script only fetches+parses+counts (see its header comment for why).
import { getStatsPrisma } from './db'
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

/** Upsert a series (by its unique-key tuple) and return its id. */
export async function upsertSeries(key: SeriesKey): Promise<string> {
  const prisma = getStatsPrisma()
  const existing = await prisma.statSeries.findFirst({
    where: {
      datasetId: key.datasetId,
      sourceSeriesId: key.sourceSeriesId,
      geography: key.geography,
      cofogFunctionCode: key.cofogFunctionCode,
      forecastVintage: key.forecastVintage,
      measure: key.measure,
    },
  })
  if (existing) return existing.id
  const created = await prisma.statSeries.create({
    data: {
      datasetId: key.datasetId,
      sourceSeriesId: key.sourceSeriesId,
      geography: key.geography,
      measure: key.measure,
      unit: key.unit,
      cofogFunctionCode: key.cofogFunctionCode,
      forecastVintage: key.forecastVintage,
      seriesLabel: key.seriesLabel,
    },
  })
  return created.id
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
