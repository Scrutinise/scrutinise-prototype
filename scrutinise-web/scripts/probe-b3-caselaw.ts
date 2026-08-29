/** probe-b3-caselaw.ts — what case-law is actually held, and how is it queried? */
import { prisma } from '../lib/prisma'
async function main() {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT corpus, COUNT(*)::int n,
           MIN("itemDate")::text earliest, MAX("itemDate")::text latest,
           COUNT(*) FILTER (WHERE "r2Key" IS NOT NULL)::int with_key
    FROM corpus_sections
    WHERE corpus IN ('caselaw','caselaw-fcl','tna-caselaw','et-decisions','tax-tribunals','bailii')
    GROUP BY 1 ORDER BY 2 DESC`
  console.table(rows)
  const all = await prisma.$queryRaw<any[]>`
    SELECT corpus, COUNT(*)::int n FROM corpus_sections
    WHERE corpus ILIKE '%case%' OR corpus ILIKE '%judg%' OR corpus ILIKE '%tribunal%' OR corpus ILIKE '%bailii%'
    GROUP BY 1 ORDER BY 2 DESC`
  console.log('anything case-shaped:'); console.table(all)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
