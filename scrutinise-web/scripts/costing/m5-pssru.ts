// ─────────────────────────────────────────────────────────────────────────────
// M5 — PSSRU/CoReC "Unit Costs of Health and Social Care 2025" → HEALTH service
// unit costs (2024/25 prices). Openly published NIHR-funded manual (Kent
// Academic Repository); individual values extracted with full per-row citation.
//
// The manual is a PDF, so extraction is VERIFY-THEN-INSERT: every expected value
// is asserted present in the PDF text at its labelled location (anchored regex)
// before anything is written. If the next edition moves a number, the assert
// fails loudly and the constants below are re-verified by hand — never silently.
//
//   Dry run:  npx tsx scripts/costing/m5-pssru.ts
//   Apply:    npx tsx scripts/costing/m5-pssru.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import { PDFParse } from 'pdf-parse'
import { neonPrisma, download, CACHE_DIR, APPLY } from './util'

const SOURCE_URL =
  'https://kar.kent.ac.uk/115569/1/The%20unit%20costs%20of%20health%20and%20social%20care%202025_Final%20%281st%20June%202026%29.pdf'
const PUB_URL = 'https://kar.kent.ac.uk/115569/'
const SOURCE = 'PSSRU/CoReC Unit Costs of Health and Social Care 2025 (Jones et al., University of Kent)'

interface Check { id: string; metric: string; unit: string; low: number; high: number; anchor: RegExp; method: string }

// Every value below was read from the 2025 manual's own tables; the anchor regex
// re-verifies it against the PDF text on every run.
const ROWS: Check[] = [
  { id: 'm5-gp-consultation', metric: 'GP — per surgery consultation lasting 10 minutes', unit: 'GBP per consultation',
    low: 40, high: 48, anchor: /Per surgery consultation lasting 10\s*minutes\d?\s*£48\s*£40/,
    method: 'Range = [without, with] qualification costs, including direct care staff costs (Table 9.4.2).' },
  { id: 'm5-gp-hour-contact', metric: 'GP — per hour of patient contact', unit: 'GBP per hour',
    low: 239, high: 285, anchor: /Per hour of patient contact\s*£285\s*£239/,
    method: 'Range = [without, with] qualification costs, including direct care staff costs (Table 9.4.2).' },
  { id: 'm5-ae-attendance', metric: 'Emergency care (A&E) — cost per attendance', unit: 'GBP per attendance',
    low: 280, high: 280, anchor: /Emergency care\s*£280/,
    method: 'NHS National Cost Collection 2024/25, via Table 6.1.1.' },
  { id: 'm5-inpatient-elective', metric: 'Hospital elective inpatient stay', unit: 'GBP per stay',
    low: 6620, high: 6620, anchor: /Elective inpatient stays\s*£6,620/,
    method: 'NHS National Cost Collection 2024/25 (per stay, not per bed-day), Table 6.1.1.' },
  { id: 'm5-inpatient-nonelective-long', metric: 'Hospital non-elective inpatient stay (long stay)', unit: 'GBP per stay',
    low: 5395, high: 5395, anchor: /Non-elective inpatient stays \(long stays\)\s*£5,395/,
    method: 'NHS National Cost Collection 2024/25 (per stay, not per bed-day), Table 6.1.1.' },
  { id: 'm5-inpatient-nonelective-short', metric: 'Hospital non-elective inpatient stay (short stay)', unit: 'GBP per stay',
    low: 824, high: 824, anchor: /Non-elective inpatient stays \(short stays\)\s*£824/,
    method: 'NHS National Cost Collection 2024/25 (per stay, not per bed-day), Table 6.1.1.' },
  { id: 'm5-nurse-band5-hour', metric: 'Qualified nurse, Agenda for Change Band 5 (community/hospital) — cost per working hour', unit: 'GBP per hour',
    low: 57, high: 57, anchor: /Cost per working hour, including\s*qualifications\s*£47\s*£57/,
    method: 'Including qualification costs (Table 9.2.1; Band 4 = £47, Band 6 = £68). Community staff nurses are typically Band 5.' },
  { id: 'm5-talking-therapy-contact', metric: 'NHS Talking Therapies (formerly IAPT) — cost per care contact', unit: 'GBP per contact',
    low: 169, high: 169, anchor: /NHS Talking Therapy Care Contact\s*£169/,
    method: 'NHS National Cost Collection 2024/25, via Table 6.1.1.' },
]

// Social worker (adult services) — same "Per hour with/without qualifications"
// labels appear in other sections, so this one is anchored to its own table.
const SW = { id: 'm5-social-worker-hour', metric: 'Social worker (adult services) — cost per hour', unit: 'GBP per hour',
  low: 54, high: 61, method: 'Range = [without, with] qualification costs (Table 10.1.1).' }

async function main() {
  const prisma = neonPrisma()
  const buf = await download(SOURCE_URL, join(CACHE_DIR, 'pssru-2025.pdf'))
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  const text = (await parser.getText()).text

  const failures: string[] = []
  for (const r of ROWS) if (!r.anchor.test(text)) failures.push(`${r.id}: anchor not found (${r.anchor})`)
  // Social worker: verify within the 10.1 table specifically.
  // Window spans Table 10.1.1 up to the next section (10.2) — the table's notes are long.
  const swIdx = text.lastIndexOf('Table 10.1.1')
  const swEnd = text.indexOf('10.2', swIdx)
  const swChunk = swIdx >= 0 ? text.slice(swIdx, swEnd > swIdx ? swEnd : swIdx + 20000) : ''
  if (!/Per hour with qualifications\s*£61/.test(swChunk) || !/Per hour without qualifications\s*£54/.test(swChunk)) {
    failures.push('m5-social-worker-hour: £61/£54 not found within Table 10.1.1')
  }
  if (failures.length) {
    console.error('VERIFY FAIL — values not confirmed in the PDF; re-verify by hand before loading:')
    failures.forEach((f) => console.error(' ', f))
    process.exit(1)
  }

  const all = [...ROWS.map(({ anchor, ...r }) => { void anchor; return r }), SW]
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${SOURCE}: ${all.length} rows, all anchors verified in the PDF (2024/25 prices)`)
  for (const r of all) console.log(`  ${r.id.padEnd(32)} £${r.low.toLocaleString()}${r.high !== r.low ? `–${r.high.toLocaleString()}` : ''} ${r.unit.replace('GBP ', '')}`)

  if (APPLY) {
    for (const r of all) {
      const data = {
        domain: 'health', metric: r.metric, unit: r.unit, low: r.low, high: r.high,
        source: SOURCE, sourceUrl: PUB_URL, year: 2026, method: r.method,
        notes: 'Openly published NIHR-funded manual; value cited with edition + table.',
        priceYear: 2024, category: 'SERVICE_UNIT_COST' as never, region: 'England',
        uprateMethod: 'GDP_DEFLATOR' as never, confidence: 'OFFICIAL_CURRENT' as never,
      }
      await prisma.costBenchmark.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data })
    }
    console.log(`  upserted ${all.length}. CostBenchmark rows now: ${await prisma.costBenchmark.count()}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
