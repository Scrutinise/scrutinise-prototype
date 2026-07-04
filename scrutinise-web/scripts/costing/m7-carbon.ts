// ─────────────────────────────────────────────────────────────────────────────
// M7 — DESNZ carbon values → ENVIRONMENT rows (£/tCO2e, £2020 prices).
//
// Source: "Valuation of greenhouse gas emissions: for policy appraisal and
// evaluation", Annex 1 table (single economy-wide series since the 2021 review;
// low/central/high). HTML — parsed from the live guidance page.
// Loads the appraisal year requested by the manifest: current year + 2030.
//
//   Dry run:  npx tsx scripts/costing/m7-carbon.ts
//   Apply:    npx tsx scripts/costing/m7-carbon.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import { neonPrisma, download, CACHE_DIR, APPLY } from './util'

const PAGE_URL =
  'https://www.gov.uk/government/publications/valuing-greenhouse-gas-emissions-in-policy-appraisal/valuation-of-greenhouse-gas-emissions-for-policy-appraisal-and-evaluation'
const SOURCE = 'DESNZ, Valuation of greenhouse gas emissions for policy appraisal and evaluation (Annex 1)'

const YEARS = [2026, 2030] // emission years to load (manifest: current year and 2030)

async function main() {
  const prisma = neonPrisma()
  const buf = await download(PAGE_URL, join(CACHE_DIR, 'carbon-guidance.html'))
  let h = buf.toString('utf8')
  // gov.uk embeds the content JSON-escaped in places — normalise both forms.
  h = h.split('\\u003c').join('<').split('\\u003e').join('>').split('\\"').join('"')

  const hidx = h.search(/<h2[^>]*id="annex-1-carbon-values[^"]*"/)
  if (hidx < 0) throw new Error('Annex 1 heading not found — page layout changed?')
  const chunk = h.slice(hidx, h.indexOf('</table>', hidx))
  const rows = [...chunk.matchAll(/<tr>\s*<td>(\d{4})<\/td>\s*<td>([\d.]+)<\/td>\s*<td>([\d.]+)<\/td>\s*<td>([\d.]+)<\/td>/g)]
    .map((m) => ({ year: +m[1], low: +m[2], central: +m[3], high: +m[4] }))
  if (rows.length < 20) throw new Error(`only ${rows.length} annex rows parsed — check the page`)

  const picks = YEARS.map((y) => {
    const r = rows.find((x) => x.year === y)
    if (!r) throw new Error(`year ${y} missing from Annex 1`)
    if (Math.abs(r.central - (r.low + r.high) / 2) > 2) throw new Error(`year ${y}: central ${r.central} not midway of ${r.low}/${r.high}`)
    return r
  })

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${SOURCE} (£2020 prices; series ${rows[0].year}–${rows[rows.length - 1].year})`)
  for (const p of picks) console.log(`  m7-carbon-${p.year}: low £${p.low} / central £${p.central} / high £${p.high} per tCO2e`)

  if (APPLY) {
    for (const p of picks) {
      const id = `m7-carbon-${p.year}`
      const data = {
        domain: 'environment',
        metric: `Carbon value — emissions in ${p.year} (economy-wide series)`,
        unit: 'GBP per tCO2e',
        low: p.low, high: p.high,
        source: SOURCE, sourceUrl: PAGE_URL, year: 2023,
        method: `Central £${p.central}; low/high = ±50% sensitivities. Single economy-wide series (traded/non-traded unified in the 2021 review), target-consistent abatement-cost approach.`,
        notes: 'Values rise over time toward net-zero; use the value for the year the emission change occurs.',
        priceYear: 2020, category: 'ENVIRONMENT' as never, region: 'UK',
        uprateMethod: 'GDP_DEFLATOR' as never, confidence: 'OFFICIAL_CURRENT' as never,
      }
      await prisma.costBenchmark.upsert({ where: { id }, create: { id, ...data }, update: data })
    }
    console.log(`  upserted ${picks.length}. CostBenchmark rows now: ${await prisma.costBenchmark.count()}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
