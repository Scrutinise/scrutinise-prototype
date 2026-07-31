// Cadence-aware refresh runner — one run-and-exit pass, meant to be invoked by an
// external cron (Railway cron service, same idea as scripts/operational's pattern,
// scoped to this DB). Not an always-on daemon: each source's cadence is
// monthly-or-slower, so a periodic invocation (e.g. daily) that checks due-ness
// and no-ops otherwise is the right shape — see docs/STATS_REFRESH.md.
//
// Usage: npx tsx --tsconfig ../tsconfig.json refresh-scheduler.ts [--force <datasetId>]
import { getStatsPrisma } from './lib/db'
import { startRefreshLog, finishRefreshLog } from './lib/upsert'
import { INGEST_HANDLERS } from './ingest-handlers'

const CADENCE_MS: Record<string, number> = {
  MONTHLY: 25 * 24 * 3600 * 1000, // slightly under a calendar month so a fixed daily cron doesn't drift
  QUARTERLY: 85 * 24 * 3600 * 1000,
  BIANNUAL: 170 * 24 * 3600 * 1000,
  ANNUAL: 350 * 24 * 3600 * 1000,
  IRREGULAR: 30 * 24 * 3600 * 1000, // check monthly, upsert is idempotent so a spurious check just no-ops
  STATIC: Number.POSITIVE_INFINITY,
}

function isDue(cadence: string, lastRefreshedAt: Date | null): boolean {
  if (!lastRefreshedAt) return true
  const interval = CADENCE_MS[cadence] ?? CADENCE_MS.MONTHLY
  return Date.now() - lastRefreshedAt.getTime() >= interval
}

async function main() {
  const forceIdx = process.argv.indexOf('--force')
  const forceId = forceIdx !== -1 ? process.argv[forceIdx + 1] : null

  const prisma = getStatsPrisma()
  const datasets = await prisma.statDataset.findMany()
  if (datasets.length === 0) {
    console.log('No StatDataset rows found — run seed-catalogue.ts first.')
    return
  }

  for (const ds of datasets) {
    const due = forceId === ds.id || isDue(ds.refreshCadence, ds.lastRefreshedAt)
    if (!due) {
      console.log(`SKIP  ${ds.id} — not due (cadence=${ds.refreshCadence}, last=${ds.lastRefreshedAt?.toISOString() ?? 'never'})`)
      continue
    }
    const handler = INGEST_HANDLERS[ds.id]
    if (!handler) {
      console.log(`WARN  ${ds.id} — due for refresh but no handler registered in ingest-handlers.ts`)
      continue
    }
    console.log(`RUN   ${ds.id}...`)
    const logId = await startRefreshLog(ds.id)
    try {
      const result = await handler()
      await finishRefreshLog(logId, ds.id, 'SUCCESS', {
        seriesUpserted: result.series,
        observationsUpserted: result.observations,
      })
      console.log(`OK    ${ds.id} — ${result.series} series, ${result.observations} observations upserted`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await finishRefreshLog(logId, ds.id, 'FAILURE', { seriesUpserted: 0, observationsUpserted: 0 }, message)
      console.error(`FAIL  ${ds.id} — ${message}`)
      // Deliberately no retry loop here (docs/CLAUDE.md §13's retry-logic policy:
      // don't retry deterministic failures automatically) — next scheduled run
      // will pick it back up, and the failure is visible in StatRefreshLog.
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
