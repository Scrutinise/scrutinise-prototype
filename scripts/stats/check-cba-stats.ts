// check-cba-stats.ts — BRIEF_INGEST_CBA_1_EXECUTE §3 (decision 329). Reads the stats DB (and, for one
// cross-check, the main Neon DeflatorSeries) and asserts what the brief requires of the three tables.
//
//   npx tsx --tsconfig ../tsconfig.json check-cba-stats.ts --snapshot <file>   save pesa values (before a re-run)
//   npx tsx --tsconfig ../tsconfig.json check-cba-stats.ts [--against <file>]  run the assertions
//
// Every assertion states what it counted. Each has a CONTROL that must come out the other way, run on
// data where the property is known not to hold, so a query that can see nothing cannot pass.
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { getStatsPrisma } from './lib/db'

const CBA = ['pesa-ch5-function', 'css-2026', 'hmt-gdp-deflators', 'gb-optimism-bias-table-1']
let failed = 0, ran = 0, controls = 0, dead = 0
function assert(name: string, ok: boolean, counted: string) {
  ran++
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${counted}`)
}
function control(name: string, firedWhenTrue: boolean, counted: string) {
  controls++
  if (!firedWhenTrue) dead++
  console.log(`${firedWhenTrue ? 'CTRL fired' : 'CTRL DEAD '}  ${name} — ${counted}`)
}

async function pesaValues(): Promise<Record<string, string>> {
  const rows = await getStatsPrisma().$queryRawUnsafe<any[]>(
    `SELECT s."seriesKey" k, o."periodType"::text pt, o."periodStart" ps, o.value::text v
       FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId" WHERE s."datasetId" = 'pesa-ch5-function'`)
  return Object.fromEntries(rows.map((r) => [`${r.k}|${r.pt}|${new Date(r.ps).toISOString()}`, r.v]))
}

async function main() {
  const prisma = getStatsPrisma()
  const snapAt = process.argv.indexOf('--snapshot')
  if (snapAt > 0) {
    const v = await pesaValues()
    fs.writeFileSync(process.argv[snapAt + 1], JSON.stringify(v))
    console.log(`snapshot: ${Object.keys(v).length} pesa observations → ${process.argv[snapAt + 1]}`)
    return prisma.$disconnect()
  }

  // 1. release date + price basis on every row of the three datasets; control = an older dataset lacks them
  const miss = await prisma.$queryRawUnsafe<any[]>(
    `SELECT s."datasetId" d, count(*)::int n, count(*) FILTER (WHERE o."releaseDate" IS NULL OR o."priceBasis" IS NULL)::int missing
       FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId" GROUP BY 1 ORDER BY 1`)
  for (const d of CBA) {
    const r = miss.find((x) => x.d === d)
    assert(`${d}: every observation has a release date and a price basis`, !!r && r.n > 0 && r.missing === 0, `${r?.n ?? 0} rows, ${r?.missing ?? '?'} missing`)
  }
  const older = miss.find((x) => x.d === 'hmrc-receipts')
  control('the same count finds rows WITHOUT them in an older dataset (hmrc-receipts)', !!older && older.missing > 0, `${older?.missing ?? 0} of ${older?.n ?? 0} missing`)

  // 2. suppression is a state: markers are c|n, carry the table's own text, and never coexist with a value
  const sup = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.marker, count(*)::int n, count(*) FILTER (WHERE c."markerText" NOT LIKE '[' || c.marker || '] = %')::int badtext
       FROM stat_suppressed_cell c GROUP BY 1 ORDER BY 1`)
  const total = sup.reduce((a, r) => a + r.n, 0)
  assert('suppressed cells exist and every one carries its table\'s own definition', total > 0 && sup.every((r) => r.badtext === 0), JSON.stringify(sup))
  const [ov] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int n FROM stat_suppressed_cell c JOIN stat_observation o
       ON o."seriesId" = c."seriesId" AND o."periodType" = c."periodType" AND o."periodStart" = c."periodStart"`)
  assert('no cell is both a value and a suppressed state', ov.n === 0, `${ov.n} overlapping`)
  const [zeroes] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int n FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
      WHERE s."datasetId" = 'css-2026' AND s.unit = 'GBP' AND o.value = 0`)
  assert('no Civil Service median salary is stored as £0 (a suppressed cell read as zero)', zeroes.n === 0, `${zeroes.n} zero salaries`)
  const [realZero] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int n FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
      WHERE s."datasetId" = 'css-2026' AND s.unit = 'HEADCOUNT' AND o.value = 0`)
  control('the zero query does find zeroes where the publisher printed 0 (headcount)', realZero.n > 0, `${realZero.n} zero headcounts`)
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO stat_suppressed_cell ("seriesId","periodType","periodStart","periodLabel",marker,"markerText","releaseDate","priceBasis")
      SELECT "seriesId","periodType",'1900-01-01'::timestamp,'x','z','x',now(),'x' FROM stat_suppressed_cell LIMIT 1`)
    control('the marker CHECK refuses a marker other than c|n', false, 'an invalid marker was ACCEPTED')
    await prisma.$executeRawUnsafe(`DELETE FROM stat_suppressed_cell WHERE marker = 'z'`)
  } catch (e: any) {
    // A free period (1900), so ONLY the CHECK can refuse it — a unique violation would make this control meaningless.
    const m = String(e?.message ?? e)
    control('the marker CHECK refuses a marker other than c|n', /stat_suppressed_cell_marker_check/.test(m), (m.match(/stat_suppressed_cell_\w+/)?.[0] ?? m.slice(-160)))
  }

  // 3. no derived figures: no forecast deflator INDEX (only % changes are published for forecast years)
  const fc = await prisma.$queryRawUnsafe<any[]>(
    `SELECT s.measure, o.status, count(*)::int n FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
      WHERE s."datasetId" = 'hmt-gdp-deflators' GROUP BY 1,2 ORDER BY 1,2`)
  const fIdx = fc.find((r) => r.measure === 'gdp_deflator_index' && r.status === 'forecast')
  assert('no deflator index is stored for a forecast year', !fIdx, JSON.stringify(fc))
  control('forecast rows are visible to this query (the % change series)', fc.some((r) => r.measure === 'gdp_deflator_pct_change' && r.status === 'forecast' && r.n > 0), 'forecast pct rows')

  // 4. the June 2026 release equals what DeflatorSeries (main DB) was loaded from, year by year
  const june = await prisma.$queryRawUnsafe<any[]>(
    `SELECT extract(year from o."periodStart")::int y, o.value::float8 v FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
      WHERE s."datasetId" = 'hmt-gdp-deflators' AND s.measure = 'gdp_deflator_index' AND o."periodType" = 'FINANCIAL_YEAR'
        AND s."forecastVintage" LIKE 'June 2026%' ORDER BY 1`)
  const octo = await prisma.$queryRawUnsafe<any[]>(
    `SELECT extract(year from o."periodStart")::int y, o.value::float8 v FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
      WHERE s."datasetId" = 'hmt-gdp-deflators' AND s.measure = 'gdp_deflator_index' AND o."periodType" = 'FINANCIAL_YEAR'
        AND s."forecastVintage" LIKE 'October 2026%' ORDER BY 1`)
  require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
  const main = new Client({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await main.connect()
  const held = (await main.query(`SELECT year, index FROM "DeflatorSeries" ORDER BY year`)).rows as { year: number; index: number }[]
  await main.end()
  const rel = (xs: { y: number; v: number }[], base: number) => { const b = xs.find((x) => x.y === base)!.v; return new Map(xs.map((x) => [x.y, x.v / b])) }
  const hb = held.find((h) => h.year === 2019)!.index
  const cmp = (m: Map<number, number>) => held.filter((h) => m.has(h.year)).map((h) => Math.abs(h.index / hb / m.get(h.year)! - 1))
  const dj = cmp(rel(june, 2019)), dO = cmp(rel(octo, 2019))
  const maxJ = Math.max(...dj), maxO = Math.max(...dO)
  assert('June 2026 FY index = main-DB DeflatorSeries on every held year (rebased 2019-20, tolerance 1e-6)', dj.length === held.length && maxJ < 1e-6,
    `${dj.length}/${held.length} years compared, max relative difference ${maxJ.toExponential(2)}`)
  control('the same comparison detects a different release (October 2026 vs DeflatorSeries)', maxO > 1e-4, `max relative difference ${(maxO * 100).toFixed(3)}%`)

  // 5. pesa values unchanged by the re-run (if a snapshot is given)
  const ag = process.argv.indexOf('--against')
  if (ag > 0) {
    const before: Record<string, string> = JSON.parse(fs.readFileSync(process.argv[ag + 1], 'utf8'))
    const after = await pesaValues()
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    let changed = 0, added = 0, gone = 0
    for (const k of keys) { if (!(k in before)) added++; else if (!(k in after)) gone++; else if (Number(before[k]) !== Number(after[k])) changed++ }
    assert('pesa re-run changed no value, added and removed no observation', changed === 0 && added === 0 && gone === 0,
      `${Object.keys(before).length} before, ${Object.keys(after).length} after: ${changed} changed, ${added} added, ${gone} removed`)
    const k0 = Object.keys(before)[0]
    const mutated = { ...before, [k0]: String(Number(before[k0]) + 1) }
    control('the comparison detects a single changed value', Number(mutated[k0]) !== Number(after[k0]), `mutated ${k0.slice(0, 16)}…`)
  } else console.log('NOT RUN  pesa re-run comparison — no --against snapshot given')

  console.log(`\n${ran} ran, ${ran - failed} passed, ${failed} failed; ${controls} controls, ${dead} dead`)
  if (failed || dead) process.exitCode = 1
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
