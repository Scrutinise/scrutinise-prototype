// ─────────────────────────────────────────────────────────────────────────────
// M4 — GMCA Unit Cost Database → SERVICE_UNIT_COST / outcome benchmark rows.
//
// LICENCE (STEP 1 finding, from the workbook's own Introduction sheet):
//   "This work is licensed under the Creative Commons Attribution 4.0
//    International License" — © Greater Manchester Combined Authority 2026.
//   CC BY 4.0 permits reuse incl. commercial WITH ATTRIBUTION. Attribution is
//   satisfied structurally: every row carries source (edition + entry code),
//   sourceUrl, and a CC BY note. NOT Crown copyright — do not relicense as OGL.
//
// GATE: per the manifest ("REPORT BACK before ingesting") this script's --apply
// runs only after Charlie's go on the licence report.
//
// Source: GMCA UCD v3.0 (latest edition; supersedes v2.3.1). Extraction is by
// COST CODE across six theme sheets, so the selection is explicit + reviewable.
// We store each entry's ORIGINAL fiscal value + ORIGINAL price year ("2010/11"
// → 2010) and let OUR deflator uprate — one uprating pipeline, no double count.
//
//   Dry run:  npx tsx scripts/costing/m4-gmca.ts
//   Apply:    npx tsx scripts/costing/m4-gmca.ts --apply     (gated — see above)
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import * as XLSX from 'xlsx'
import { neonPrisma, download, CACHE_DIR, APPLY } from './util'

const SOURCE_URL = 'https://www.greatermanchester-ca.gov.uk/media/sbdg15pr/gmca-unit-cost-database-v3-0-final.xlsx'
const PUB_URL = 'https://www.greatermanchester-ca.gov.uk/what-we-do/research/research-cost-benefit-analysis/'
const EDITION = 'GMCA Unit Cost Database v3.0 (2026)'
const CC_NOTE = '© GMCA 2026, licensed CC BY 4.0 (attribution in this row). Original price year; uprated via GDP deflator.'

// The ~30 selected entries (manifest STEP 2): top-level, most reusable, avoiding
// overlap with the Home Office 2019/20 crime unit costs already loaded (v2-*).
const SELECTION: Record<string, string[]> = {
  'Crime': ['CR1.0', 'CR2.0', 'CR2.6'],
  'Education & Skills': ['E&S1.0', 'E&S2.0'],
  'Employment & Economy': ['E&E1.0', 'E&E1.0.1', 'E&E1.1', 'E&E10.0', 'E&E10.1'],
  'Housing': ['HO1.0', 'HO3.0', 'HO4.1', 'HO6.0', 'HO7.0'],
  'Health': ['HE2.0', 'HE3.0', 'HE3.0.2', 'HE16.0', 'HE17.0', 'HE6.12', 'HE23.1', 'HE23.6', 'HE11.2', 'HE9.1'],
  'Social Services': ['SS1.0', 'SS2.0', 'SS3.0', 'SS3.1', 'SS4.0'],
}

const THEME_META: Record<string, { domain: string; category: string }> = {
  'Crime': { domain: 'crime', category: 'CRIME' },
  'Education & Skills': { domain: 'education', category: 'EDUCATION' },
  'Employment & Economy': { domain: 'employment', category: 'EMPLOYMENT_ECONOMY' },
  'Housing': { domain: 'housing', category: 'HOUSING' },
  'Health': { domain: 'health', category: 'SERVICE_UNIT_COST' },
  'Social Services': { domain: 'social-services', category: 'SERVICE_UNIT_COST' },
}

const idOf = (code: string) => 'm4-' + code.toLowerCase().replace(/&/g, '').replace(/\./g, '-')

async function main() {
  const prisma = neonPrisma()
  const buf = await download(SOURCE_URL, join(CACHE_DIR, 'gmca-ucd-v3.xlsx'))
  const wb = XLSX.read(buf, { type: 'buffer' })

  // Licence guard: refuse to run if the CC BY marker ever disappears from the file.
  const intro = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames.find((n) => n.trim() === 'Introduction')!], { header: 1, raw: false })
  const licenceLine = intro.flat().find((v) => typeof v === 'string' && /Creative Commons Attribution 4\.0/i.test(v))
  if (!licenceLine) throw new Error('CC BY 4.0 licence statement NOT found in the workbook — re-check terms before any ingest.')

  const out: { id: string; theme: string; code: string; detail: string; unit: string; agency: string; value: number; priceYear: number }[] = []
  for (const [theme, codes] of Object.entries(SELECTION)) {
    const sheet = wb.SheetNames.find((n) => n.trim() === theme)
    if (!sheet) throw new Error(`sheet ${theme} missing`)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, raw: true })
    for (const code of codes) {
      const r = rows.find((x) => typeof x?.[2] === 'string' && (x[2] as string).trim() === code)
      if (!r) throw new Error(`${theme}: cost code ${code} not found — edition layout changed?`)
      const value = typeof r[7] === 'number' ? r[7] : null // original fiscal estimated cost
      const yearStr = typeof r[8] === 'string' ? r[8] : String(r[8] ?? '')
      const ym = yearStr.match(/^(\d{4})/)
      if (value == null || !ym) throw new Error(`${code}: fiscal value/year not parseable (value=${r[7]}, year=${r[8]})`)
      out.push({
        id: idOf(code), theme, code,
        detail: String(r[3] ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim(),
        unit: String(r[4] ?? '').trim(),
        agency: [r[5], r[6]].filter(Boolean).join(' / '),
        value, priceYear: parseInt(ym[1], 10),
      })
    }
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${EDITION}, ${out.length} entries (licence: CC BY 4.0 confirmed in-file)`)
  for (const e of out) {
    console.log(`  ${e.id.padEnd(14)} ${e.code.padEnd(9)} £${Math.round(e.value).toLocaleString().padStart(10)}  ${e.priceYear}  ${e.unit.padEnd(22)} ${e.detail.slice(0, 66)}`)
  }

  if (APPLY) {
    for (const e of out) {
      const meta = THEME_META[e.theme]
      const round2 = Math.round(e.value * 100) / 100
      const data = {
        domain: meta.domain,
        metric: `${e.detail.slice(0, 180)} (GMCA ${e.code})`,
        unit: `GBP ${e.unit.toLowerCase()}`,
        low: round2, high: round2,
        source: `${EDITION}, entry ${e.code}`,
        sourceUrl: PUB_URL,
        year: 2026,
        method: `Fiscal unit cost; borne by ${e.agency || 'multiple agencies'}. Quality-assured compilation (Green Book supplementary guidance since 2014).`,
        notes: CC_NOTE,
        priceYear: e.priceYear,
        category: meta.category as never,
        region: 'England',
        uprateMethod: 'GDP_DEFLATOR' as never,
        confidence: (e.priceYear >= 2015 ? 'OFFICIAL_CURRENT' : 'OFFICIAL_DATED') as never,
      }
      await prisma.costBenchmark.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: data })
    }
    console.log(`  upserted ${out.length} rows. CostBenchmark rows now: ${await prisma.costBenchmark.count()}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
