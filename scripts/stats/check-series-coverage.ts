import { getStatsPrisma } from './lib/db'
async function main() {
  const p = getStatsPrisma()
  const rows = await p.$queryRaw<{ datasetid: string; total: bigint; derived: bigint; unknown_unit: bigint; nullsrc: bigint }[]>`
    SELECT "datasetId" AS datasetid, count(*) AS total,
           count(*) FILTER (WHERE "sourceSeriesId" LIKE 'derived:%') AS derived,
           count(*) FILTER (WHERE unit = 'UNKNOWN') AS unknown_unit,
           count(*) FILTER (WHERE "sourceSeriesId" IS NULL) AS nullsrc
    FROM stat_series GROUP BY 1 ORDER BY 1
  `
  for (const r of rows) console.log(`  ${r.datasetid.padEnd(30)} total=${String(r.total).padStart(5)} derived=${String(r.derived).padStart(5)} nullSrc=${String(r.nullsrc).padStart(5)} unitUNKNOWN=${r.unknown_unit}`)
  const logs = await p.$queryRaw<{ datasetid: string; started: Date; finished: Date | null; status: string | null; obs: number }[]>`
    SELECT "datasetId" AS datasetid, "startedAt" AS started, "finishedAt" AS finished, status::text AS status, "observationsUpserted" AS obs
    FROM stat_refresh_log ORDER BY "startedAt" DESC LIMIT 6
  `
  console.log('\n  recent refresh log:')
  for (const l of logs) console.log(`    ${new Date(l.started).toISOString().slice(11,19)} ${l.datasetid.padEnd(28)} status=${l.status ?? 'RUNNING'} obs=${l.obs} finished=${l.finished ? new Date(l.finished).toISOString().slice(11,19) : '-'}`)
  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
