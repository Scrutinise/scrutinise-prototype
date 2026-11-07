// Restate the licence on the 9 PSSRU CostBenchmark rows (decision, 4 Nov 2026). Data only:
// touches `notes`, nothing else. Dry run by default; --apply writes, then re-reads every row.
//   npx tsx scripts/costing/pssru-licence-apply.ts [--apply]
import { neonPrisma, APPLY } from './util'
import { PSSRU_LICENCE_NOTE } from './pssru-licence'

const SOURCE = 'PSSRU/CoReC Unit Costs of Health and Social Care 2025 (Jones et al., University of Kent)'

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? 'x://none').host
  console.log('db host', host)
  const p = neonPrisma()
  const rows = await p.costBenchmark.findMany({ where: { source: SOURCE }, orderBy: { id: 'asc' } })
  if (rows.length !== 9) throw new Error(`expected 9 PSSRU rows, found ${rows.length}`)
  for (const r of rows) console.log(`  ${r.id}: notes now "${(r.notes ?? '').slice(0, 60)}…"`)
  if (!APPLY) { console.log('DRY RUN — re-run with --apply'); await p.$disconnect(); return }
  const u = await p.costBenchmark.updateMany({ where: { source: SOURCE }, data: { notes: PSSRU_LICENCE_NOTE } })
  console.log(`updated ${u.count}`)
  const back = await p.costBenchmark.findMany({ where: { source: SOURCE }, select: { id: true, notes: true, low: true, high: true } })
  const ok = back.filter((r) => r.notes === PSSRU_LICENCE_NOTE).length
  console.log(`re-read: ${ok}/${back.length} carry the licence note; first: ${back[0].id} → "${back[0].notes?.slice(0, 120)}…"`)
  if (ok !== 9) process.exitCode = 1
  await p.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
