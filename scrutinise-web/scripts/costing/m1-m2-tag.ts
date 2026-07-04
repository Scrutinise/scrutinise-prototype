// ─────────────────────────────────────────────────────────────────────────────
// M1 + M2 — DfT TAG Data Book → LIFE_SAFETY + TIME benchmark rows.
//
// Source: TAG Data Book (this run: May 2026 v2.03, tag-data-book-v2-03.xlsm).
// On a new edition: update SOURCE_URL/CACHE_NAME and re-run — extraction is
// label-based, not cell-coordinate-based, so it survives row drift.
//
//   M1  A4.1.1  average value of prevention PER CASUALTY (fatal = the live VPF,
//               serious, slight, average) — REPLACES the v1 provisional £2m VPF.
//       A4.1.4  average value of prevention PER ACCIDENT (fatal/serious/slight,
//               "All" road-class column).
//   M2  A1.3.1  values of time: working (employers' business, car driver) +
//               non-working (commuting / other). Stored as a RANGE
//               [factor cost, market price] — both are published values.
//
// Uprating: TAG uprates these by GDP per head (income elasticity), so rows carry
// uprateMethod GDP_PER_HEAD (falls back to the deflator until a per-head series
// exists — playbook §11b).
//
//   Dry run:  npx tsx scripts/costing/m1-m2-tag.ts
//   Apply:    npx tsx scripts/costing/m1-m2-tag.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import * as XLSX from 'xlsx'
import { neonPrisma, download, CACHE_DIR, APPLY } from './util'

const SOURCE_URL =
  'https://assets.publishing.service.gov.uk/media/6a17100db95db968c8f3bb51/tag-data-book-v2-03.xlsm'
const CACHE_NAME = 'tag-data-book-v2-03.xlsm'
const PUB_URL = 'https://www.gov.uk/government/publications/tag-data-book'

type Row = unknown[]
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`sheet ${name} missing — data book layout changed?`)
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true })
}

/** First row whose col-0 label (trimmed) equals `label`. */
function rowByLabel(rows: Row[], label: string): Row {
  const r = rows.find((x) => typeof x?.[0] === 'string' && (x[0] as string).trim() === label)
  if (!r) throw new Error(`row labelled "${label}" not found — data book layout changed?`)
  return r
}

function priceYearOf(rows: Row[]): number {
  const r = rowByLabel(rows, 'Price year:')
  const y = num(r[1])
  if (!y) throw new Error('Price year: cell is not numeric')
  return y
}

async function main() {
  const prisma = neonPrisma()
  const buf = await download(SOURCE_URL, join(CACHE_DIR, CACHE_NAME))
  const wb = XLSX.read(buf, { type: 'buffer', sheets: ['Cover', 'A4.1.1', 'A4.1.4', 'A1.3.1'] })

  const cover = sheetRows(wb, 'Cover')
  const version = (cover.flat().find((v) => typeof v === 'string' && /v\d+\.\d+/.test(v)) as string) ?? 'unknown'

  // ── M1: A4.1.1 per casualty (Total column = index 6) ─────────────────────────
  const a411 = sheetRows(wb, 'A4.1.1')
  const py411 = priceYearOf(a411)
  const perCasualty = {
    fatal: num(rowByLabel(a411, 'Fatal')[6]),
    serious: num(rowByLabel(a411, 'Serious')[6]),
    slight: num(rowByLabel(a411, 'Slight')[6]),
    average: num(rowByLabel(a411, 'Average, all casualties')[6]),
  }

  // ── M1: A4.1.4 per accident ("All" road-class column = index 6) ──────────────
  const a414 = sheetRows(wb, 'A4.1.4')
  const py414 = priceYearOf(a414)
  const perAccident = {
    fatal: num(rowByLabel(a414, 'Fatal')[6]),
    serious: num(rowByLabel(a414, 'Serious')[6]),
    slight: num(rowByLabel(a414, 'Slight')[6]),
  }

  // ── M2: A1.3.1 values of time (factor cost idx 3, market price idx 5) ────────
  const a131 = sheetRows(wb, 'A1.3.1')
  const py131 = priceYearOf(a131)
  const vot = (label: string) => {
    const r = rowByLabel(a131, label)
    return { low: num(r[3]), high: num(r[5]) }
  }
  const working = vot('Car driver')
  const commuting = vot('Commuting')
  const other = vot('Other')

  // Sanity: everything numeric, per-casualty fatal in a plausible VPF band.
  const all = [...Object.values(perCasualty), ...Object.values(perAccident), working.low, working.high, commuting.low, commuting.high, other.low, other.high]
  if (all.some((v) => v == null)) throw new Error('one or more values failed to extract — inspect the sheets')
  if (perCasualty.fatal! < 1_500_000 || perCasualty.fatal! > 6_000_000) throw new Error(`fatal per-casualty £${perCasualty.fatal} outside plausibility band`)

  const round2 = (v: number) => Math.round(v * 100) / 100
  const src = (table: string) => `DfT TAG Data Book ${version}, Table ${table}`
  const common = { domain: 'transport-safety', region: 'UK', year: 2026, sourceUrl: PUB_URL, confidence: 'OFFICIAL_CURRENT' as never }

  const rows = [
    { id: 'm1-vpf-casualty-fatal', metric: 'Value of a prevented fatality (VPF) — average value of prevention per fatal casualty', unit: 'GBP per casualty', low: perCasualty.fatal!, high: perCasualty.fatal!, priceYear: py411, category: 'LIFE_SAFETY', uprateMethod: 'GDP_PER_HEAD', source: src('A4.1.1'), method: 'Willingness-to-pay + net output + medical/ambulance (NERA 2011 presentation). Uprated by GDP per head.', notes: 'REPLACES the v1 provisional £2m row. CONTESTED evidence base (Thomas & Vaughan 2015 critiques) — surface to users.' },
    { id: 'm1-casualty-serious', metric: 'Average value of prevention per serious casualty', unit: 'GBP per casualty', low: perCasualty.serious!, high: perCasualty.serious!, priceYear: py411, category: 'LIFE_SAFETY', uprateMethod: 'GDP_PER_HEAD', source: src('A4.1.1'), method: 'WTP + net output + medical/ambulance.', notes: '' },
    { id: 'm1-casualty-slight', metric: 'Average value of prevention per slight casualty', unit: 'GBP per casualty', low: perCasualty.slight!, high: perCasualty.slight!, priceYear: py411, category: 'LIFE_SAFETY', uprateMethod: 'GDP_PER_HEAD', source: src('A4.1.1'), method: 'WTP + net output + medical/ambulance.', notes: '' },
    { id: 'm1-casualty-average', metric: 'Average value of prevention per casualty (all severities)', unit: 'GBP per casualty', low: perCasualty.average!, high: perCasualty.average!, priceYear: py411, category: 'LIFE_SAFETY', uprateMethod: 'GDP_PER_HEAD', source: src('A4.1.1'), method: 'Severity-weighted average.', notes: '' },
    { id: 'm1-accident-fatal', metric: 'Average value of prevention per fatal road accident (all road classes)', unit: 'GBP per accident', low: perAccident.fatal!, high: perAccident.fatal!, priceYear: py414, category: 'LIFE_SAFETY', uprateMethod: 'GDP_PER_HEAD', source: src('A4.1.4'), method: 'Casualty values + accident-related costs (insurance, damage, police); COBALT values.', notes: '' },
    { id: 'm1-accident-serious', metric: 'Average value of prevention per serious road accident (all road classes)', unit: 'GBP per accident', low: perAccident.serious!, high: perAccident.serious!, priceYear: py414, category: 'LIFE_SAFETY', uprateMethod: 'GDP_PER_HEAD', source: src('A4.1.4'), method: 'As fatal-accident row.', notes: '' },
    { id: 'm1-accident-slight', metric: 'Average value of prevention per slight road accident (all road classes)', unit: 'GBP per accident', low: perAccident.slight!, high: perAccident.slight!, priceYear: py414, category: 'LIFE_SAFETY', uprateMethod: 'GDP_PER_HEAD', source: src('A4.1.4'), method: 'As fatal-accident row.', notes: '' },
    { id: 'm2-vot-working-car', metric: 'Value of travel time: working (employers’ business), car driver', unit: 'GBP per hour', low: working.low!, high: working.high!, priceYear: py131, category: 'TIME', uprateMethod: 'GDP_PER_HEAD', source: src('A1.3.1'), method: 'Range = [resource/factor cost, market price]. 2014/15 VTTS study. Grows ~1.5%/yr real in appraisal.', notes: '' },
    { id: 'm2-vot-commuting', metric: 'Value of travel time: commuting (non-working)', unit: 'GBP per hour', low: commuting.low!, high: commuting.high!, priceYear: py131, category: 'TIME', uprateMethod: 'GDP_PER_HEAD', source: src('A1.3.1'), method: 'Range = [factor cost, market price]. Appraisal uses market price for non-working time.', notes: '' },
    { id: 'm2-vot-other', metric: 'Value of travel time: other non-working', unit: 'GBP per hour', low: other.low!, high: other.high!, priceYear: py131, category: 'TIME', uprateMethod: 'GDP_PER_HEAD', source: src('A1.3.1'), method: 'Range = [factor cost, market price]. Appraisal uses market price for non-working time.', notes: '' },
  ]

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — TAG Data Book ${version} (price years: A4.1.1=${py411}, A4.1.4=${py414}, A1.3.1=${py131})`)
  for (const r of rows) console.log(`  ${r.id.padEnd(24)} £${round2(r.low).toLocaleString()}${r.high !== r.low ? `–${round2(r.high).toLocaleString()}` : ''} ${r.unit.replace('GBP ', '')}`)

  if (APPLY) {
    for (const r of rows) {
      const { id, ...rest } = r
      const data = { ...rest, low: round2(r.low), high: round2(r.high), category: r.category as never, uprateMethod: r.uprateMethod as never, ...common }
      await prisma.costBenchmark.upsert({ where: { id }, create: { id, ...data }, update: data })
    }
    // The provisional v1 VPF row is replaced by m1-vpf-casualty-fatal.
    const gone = await prisma.costBenchmark.deleteMany({ where: { id: 'v1-vpf' } })
    console.log(`  upserted ${rows.length} rows; deleted v1-vpf (${gone.count}).`)
    console.log(`  CostBenchmark rows now: ${await prisma.costBenchmark.count()}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
