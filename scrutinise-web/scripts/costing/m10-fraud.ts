// ─────────────────────────────────────────────────────────────────────────────
// M10 — Home Office "Economic and social cost of fraud 2023 to 2024" → CRIME
// rows superseding the fraud component of the 2019/20 series (v2-fraud-individual
// is DELETED — the v2 file's own supersession note says this edition replaces it).
//
// Source: gov.uk HTML. Unit costs are parsed from the anticipation/consequence/
// response tables and cross-checked against the document's own summary total
// (individuals £2,884) before anything is written. YE March 2024 prices.
//
// M9 NOTE (documented blocker): the companion "Amendments to unit costs" doc is
// linked from the 2019/20 crime publication but its gov.uk URL 404s (both path
// variants) and site search cannot find it — extraction blocked until the page
// is live. Re-check on the next pass.
//
//   Dry run:  npx tsx scripts/costing/m10-fraud.ts
//   Apply:    npx tsx scripts/costing/m10-fraud.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import { neonPrisma, download, CACHE_DIR, APPLY } from './util'

const PAGE_URL =
  'https://www.gov.uk/government/publications/economic-and-social-cost-of-fraud-2023-to-2024/economic-and-social-cost-of-fraud-2023-to-2024'
const SOURCE = 'Home Office, Economic and social cost of fraud 2023 to 2024'

function tableTotals(h: string): { indiv: number; biz: number } {
  const tables = [...h.matchAll(/<table>[\s\S]*?<\/table>/g)].map((m) => m[0]).filter((t) => /unit cost/i.test(t))
  if (tables.length < 6) throw new Error(`expected 6 unit-cost tables, found ${tables.length}`)
  const totalRow = (t: string, label: RegExp): number => {
    const rows = [...t.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map((r) =>
      [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').trim()))
    const row = rows.find((r) => label.test(r[0] ?? ''))
    if (!row) throw new Error(`total row ${label} missing`)
    const v = Number((row[2] ?? '').replace(/[£,]/g, ''))
    if (!isFinite(v)) throw new Error(`unparseable unit cost in ${label}: ${row[2]}`)
    return v
  }
  // Tables 0-2 = individuals (anticipation/consequence/response); 3-5 = businesses.
  const indiv = totalRow(tables[0], /^Total anticipation/i) + totalRow(tables[1], /^Total consequence/i) + totalRow(tables[2], /^Total response/i)
  const biz = totalRow(tables[3], /^Total anticipation/i) + totalRow(tables[4], /^Total consequence/i) + totalRow(tables[5], /^Total response/i)
  return { indiv, biz }
}

async function main() {
  const prisma = neonPrisma()
  const buf = await download(PAGE_URL, join(CACHE_DIR, 'fraud-2023-24.html'))
  let h = buf.toString('utf8')
  h = h.split('\\u003c').join('<').split('\\u003e').join('>').split('\\"').join('"')

  const { indiv, biz } = tableTotals(h)
  // Cross-checks against the document's own summary statements.
  if (!h.includes('£2,884')) throw new Error('summary figure £2,884 not found — components may have changed')
  if (indiv !== 2884) throw new Error(`individuals components sum to £${indiv}, expected £2,884`)
  if (!/£14\.4 billion/.test(h.replace(/<[^>]+>/g, ' '))) throw new Error('£14.4 billion total not found')

  const rows = [
    { id: 'm10-fraud-individual', metric: 'Unit cost: fraud against individuals', unit: 'GBP per offence', low: indiv, high: indiv,
      method: 'Anticipation £274 + consequence £2,256 + response £354.',
      notes: 'SUPERSEDES the 2019/20-series fraud row (v2). Per all incidents incl. unreported (CSEW-based).' },
    { id: 'm10-fraud-business', metric: 'Unit cost: fraud against businesses', unit: 'GBP per offence', low: biz, high: biz,
      method: 'Anticipation £1,145 + consequence £763 + response £262.',
      notes: 'Business survey coverage caveats apply — see publication.' },
    { id: 'm10-fraud-total', metric: 'Total economic and social cost of fraud, England & Wales, YE March 2024 (context anchor)', unit: 'GBP per year', low: 14_400_000_000, high: 14_400_000_000,
      method: 'Individuals + businesses.', notes: 'Context/scale anchor, not a unit cost.' },
  ]

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${SOURCE} (YE March 2024 prices; individuals £${indiv}, businesses £${biz})`)
  for (const r of rows) console.log(`  ${r.id.padEnd(22)} £${r.low.toLocaleString()}`)

  if (APPLY) {
    for (const r of rows) {
      const data = {
        domain: 'crime', metric: r.metric, unit: r.unit, low: r.low, high: r.high,
        source: SOURCE, sourceUrl: PAGE_URL, year: 2026, method: r.method, notes: r.notes,
        priceYear: 2023, category: 'CRIME' as never, region: 'England and Wales',
        uprateMethod: 'GDP_DEFLATOR' as never, confidence: 'OFFICIAL_CURRENT' as never,
      }
      await prisma.costBenchmark.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data })
    }
    const gone = await prisma.costBenchmark.deleteMany({ where: { id: 'v2-fraud-individual' } })
    console.log(`  upserted ${rows.length}; deleted superseded v2-fraud-individual (${gone.count}).`)
    console.log(`  CostBenchmark rows now: ${await prisma.costBenchmark.count()}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
