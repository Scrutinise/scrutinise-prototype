/**
 * V2.76-B Phase 4 — Full verification (post Phase 3A + 3B).
 * Runs diagnostic SQL queries, spot-checks 20 random COUNT_DIFF acts,
 * and prints a structured report for inclusion in handoff_summary.md.
 */
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { r2Exists, tnaXmlKey as makeTnaKey } from '../../legislation/r2-client'
import { CompilationStatus } from '@prisma/client'

const PHASE2_PATH = path.join(__dirname, 'phase2-results.json')

async function main() {
  console.log('=== V2.76-B PHASE 4 VERIFICATION REPORT ===')
  console.log(`Run at: ${new Date().toISOString()}\n`)

  // ── 1. Top-level corpus counts ──────────────────────────────────────────────
  const [totalItems, itemsWithSections, printOnlyItems, totalSections] = await Promise.all([
    prisma.legislationItem.count(),
    prisma.legislationItem.count({ where: { sections: { some: {} } } }),
    prisma.legislationItem.count({ where: { compilationStatus: CompilationStatus.PRINT_ONLY } }),
    prisma.legislationSection.count(),
  ])

  console.log('── 1. Corpus overview ──')
  console.log(`  LegislationItem total:      ${totalItems}`)
  console.log(`  Items with sections:        ${itemsWithSections}`)
  console.log(`  PRINT_ONLY items:           ${printOnlyItems}  (expected 9043)`)
  console.log(`  LegislationSection total:   ${totalSections}`)

  // ── 2. Section key coverage ─────────────────────────────────────────────────
  const [withTnaKey, withOriginalKey, withBothKeys, withNeitherKey] = await Promise.all([
    prisma.legislationSection.count({ where: { tnaXmlKey: { not: null } } }),
    prisma.legislationSection.count({ where: { originalXmlKey: { not: null } } }),
    prisma.legislationSection.count({ where: { tnaXmlKey: { not: null }, originalXmlKey: { not: null } } }),
    prisma.legislationSection.count({ where: { tnaXmlKey: null, originalXmlKey: null } }),
  ])

  const preV276BNeither = 21850
  const preV276BWithTna = 31932  // after Phase 3A

  console.log('\n── 2. Section key coverage ──')
  console.log(`  With tnaXmlKey:             ${withTnaKey}  (was ${preV276BWithTna} after Phase 3A)`)
  console.log(`  With originalXmlKey:        ${withOriginalKey}`)
  console.log(`  With both keys:             ${withBothKeys}`)
  console.log(`  NEITHER key:                ${withNeitherKey}  (was ${preV276BNeither} pre-V2.76-B, delta = −${preV276BNeither - withNeitherKey})`)
  console.log(`  Coverage (tna or original): ${totalSections - withNeitherKey} / ${totalSections} (${((totalSections - withNeitherKey) / totalSections * 100).toFixed(1)}%)`)

  // ── 3. Companies Act 2006 spot-check ────────────────────────────────────────
  const co2006 = await prisma.legislationItem.findUnique({
    where: { legislationGovUkId: 'ukpga/2006/46' },
    include: { _count: { select: { sections: true } } },
  })
  console.log('\n── 3. Companies Act 2006 (ukpga/2006/46) ──')
  console.log(`  Section rows:               ${co2006?._count.sections}  (expected 1665)`)
  console.log(`  Compilation status:         ${co2006?.compilationStatus}`)

  const co2006SampleSections = ['1', '10', '100', '500', '1000', '1665']
  process.stdout.write(`  R2 spot-check: `)
  const r2Results: string[] = []
  for (const s of co2006SampleSections) {
    const key = makeTnaKey('ukpga/2006/46', s)
    const exists = await r2Exists(key)
    r2Results.push(`s.${s}=${exists ? 'OK' : 'MISS'}`)
  }
  console.log(r2Results.join(' | '))

  // ── 4. PATCH_GAPS acts verification ─────────────────────────────────────────
  const patchActChecks = [
    { actId: 'ukpga/2015/21', label: 'Corporation Tax (NI) Act 2015' },
    { actId: 'ukpga/2000/6',  label: 'Postal Services Act 2000' },
    { actId: 'ukpga/1900/12', label: 'Commonwealth of Australia Constitution Act 1900' },
  ]
  console.log('\n── 4. Key acts — neither-key remaining ──')
  for (const { actId, label } of patchActChecks) {
    const item = await prisma.legislationItem.findUnique({
      where: { legislationGovUkId: actId },
      select: { id: true },
    })
    if (!item) { console.log(`  ${actId}: NOT FOUND`); continue }
    const [neither, withTna, total] = await Promise.all([
      prisma.legislationSection.count({ where: { legislationItemId: item.id, tnaXmlKey: null, originalXmlKey: null } }),
      prisma.legislationSection.count({ where: { legislationItemId: item.id, tnaXmlKey: { not: null } } }),
      prisma.legislationSection.count({ where: { legislationItemId: item.id } }),
    ])
    console.log(`  ${actId} (${label})`)
    console.log(`    total=${total}  tnaKey=${withTna}  neither=${neither}`)
  }

  // ── 5. Phase 3B COUNT_DIFF retry acts ───────────────────────────────────────
  const retryActs = ['ukpga/1968/73', 'ukpga/1974/37', 'ukpga/1988/33', 'ukpga/1992/19']
  console.log('\n── 5. Phase 3B retry acts (were errored) ──')
  for (const actId of retryActs) {
    const item = await prisma.legislationItem.findUnique({
      where: { legislationGovUkId: actId },
      select: { id: true },
    })
    if (!item) { console.log(`  ${actId}: NOT FOUND`); continue }
    const [neither, withTna, total] = await Promise.all([
      prisma.legislationSection.count({ where: { legislationItemId: item.id, tnaXmlKey: null, originalXmlKey: null } }),
      prisma.legislationSection.count({ where: { legislationItemId: item.id, tnaXmlKey: { not: null } } }),
      prisma.legislationSection.count({ where: { legislationItemId: item.id } }),
    ])
    console.log(`  ${actId}: total=${total}  tnaKey=${withTna}  neither=${neither}`)
  }

  // ── 6. Random 20-act spot-check from COUNT_DIFF acts ────────────────────────
  console.log('\n── 6. Random 20-act COUNT_DIFF spot-check ──')
  const phase2Acts: Array<{ actId: string; category: string }> = JSON.parse(fs.readFileSync(PHASE2_PATH, 'utf-8')).acts
  const countDiffActIds = phase2Acts.filter(a => a.category === 'COUNT_DIFF').map(a => a.actId)

  // Deterministic shuffle (seed = 2766)
  const shuffled = [...countDiffActIds]
  let seed = 2766
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(seed) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const sample = shuffled.slice(0, 20)

  let spotPassCount = 0
  for (const actId of sample) {
    const item = await prisma.legislationItem.findUnique({
      where: { legislationGovUkId: actId },
      select: { id: true },
    })
    if (!item) { console.log(`  ${actId}: NOT FOUND in Railway`); continue }
    const [neither, total] = await Promise.all([
      prisma.legislationSection.count({ where: { legislationItemId: item.id, tnaXmlKey: null, originalXmlKey: null } }),
      prisma.legislationSection.count({ where: { legislationItemId: item.id } }),
    ])
    const keyed = total - neither
    const pct = total > 0 ? (keyed / total * 100).toFixed(0) : '0'
    const pass = neither === 0
    if (pass) spotPassCount++
    console.log(`  ${pass ? 'PASS' : 'PART'} ${actId}: ${keyed}/${total} keyed (${pct}%)${neither > 0 ? `  neither=${neither}` : ''}`)
  }
  console.log(`  Spot-check: ${spotPassCount}/20 fully keyed`)

  // ── 7. Summary delta table ───────────────────────────────────────────────────
  console.log('\n── 7. V2.76-B state delta summary ──')
  console.log('  Metric                        | Pre-V2.76-B | Post-V2.76-B (this run)')
  console.log('  ------------------------------|-------------|------------------------')
  console.log(`  LegislationItem total         |      11,768 | ${String(totalItems).padStart(11)}`)
  console.log(`  Items with section data       |       4,340 | ${String(itemsWithSections).padStart(11)}`)
  console.log(`  Total LegislationSection rows |     168,970 | ${String(totalSections).padStart(11)}`)
  console.log(`  tnaXmlKey sections            |      29,164 | ${String(withTnaKey).padStart(11)}`)
  console.log(`  NEITHER-key sections          |      21,850 | ${String(withNeitherKey).padStart(11)}`)
  console.log(`  PRINT_ONLY items              |           0 | ${String(printOnlyItems).padStart(11)}`)

  console.log('\n=== VERIFICATION COMPLETE ===')

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
