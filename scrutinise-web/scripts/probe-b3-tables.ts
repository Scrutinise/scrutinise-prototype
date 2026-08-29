import { prisma } from '../lib/prisma'
async function main() {
  const t = await prisma.$queryRaw<any[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND (table_name ILIKE '%case%' OR table_name ILIKE '%judg%' OR table_name ILIKE '%citation%' OR table_name ILIKE '%ref%')
    ORDER BY 1`
  console.log('candidate tables:', t.map(r => r.table_name).join(', '))
  for (const n of t.map(r => r.table_name)) {
    try {
      const c = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int n FROM "${n}"`)
      const cols = await prisma.$queryRawUnsafe<any[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name='${n}' ORDER BY ordinal_position`)
      console.log(`  ${n}: ${c[0].n} rows — ${cols.map((x:any)=>x.column_name).join(', ')}`)
    } catch (e) { console.log(`  ${n}: ${(e as Error).message.slice(0,80)}`) }
  }
  // court field?
  const s = await prisma.$queryRaw<any[]>`
    SELECT id, "sectionTitle", "itemDate", jurisdiction, "r2Key", "wordCount"
    FROM corpus_sections WHERE corpus='tna-caselaw' ORDER BY md5(id) LIMIT 3`
  console.log('\ntna-caselaw sample:'); for (const r of s) console.log(' ', JSON.stringify(r).slice(0, 300))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
