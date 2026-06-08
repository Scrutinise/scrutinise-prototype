import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const adapter = new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const prisma = new PrismaClient({ adapter } as never)

  console.log('\n=== D1a: corpus_sections columns ===')
  const cols = await prisma.$queryRaw<{column_name:string}[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'corpus_sections' ORDER BY ordinal_position
  `
  console.log('  ' + cols.map(c => c.column_name).join(', '))

  console.log('\n=== D1b: corpus_sections by corpus ===')
  const byCorpus = await prisma.$queryRaw<any[]>`
    SELECT corpus, COUNT(*)::int as sections, MAX("createdAt") as latest
    FROM corpus_sections
    GROUP BY corpus
    ORDER BY sections DESC
  `
  for (const r of byCorpus) {
    console.log(`  ${String(r.corpus).padEnd(38)} ${String(r.sections).padStart(9)}  latest: ${new Date(r.latest).toISOString()}`)
  }

  const [total] = await prisma.$queryRaw<[{total:bigint}]>`SELECT COUNT(*)::bigint as total FROM corpus_sections`
  console.log(`\n  TOTAL corpus_sections rows: ${total.total}`)

  const [dbSize] = await prisma.$queryRaw<[{db_size:string}]>`SELECT pg_size_pretty(pg_database_size('railway')) as db_size`
  console.log(`  DB size: ${dbSize.db_size}`)

  const [tableSize] = await prisma.$queryRaw<[{table_size:string}]>`SELECT pg_size_pretty(pg_relation_size('corpus_sections')) as table_size`
  console.log(`  corpus_sections table size: ${tableSize.table_size}`)

  // compiledText size specifically
  const [ctSize] = await prisma.$queryRaw<[{ct_size:string; ct_rows:bigint}]>`
    SELECT pg_size_pretty(SUM(LENGTH(COALESCE("compiledText",''))::bigint)) as ct_size,
           COUNT(CASE WHEN "compiledText" IS NOT NULL THEN 1 END)::bigint as ct_rows
    FROM corpus_sections
  `
  console.log(`  compiledText: ${ctSize.ct_rows} rows with data, raw text size ~${ctSize.ct_size}`)

  console.log('\n=== D4: pending queue by corpus + priority ===')
  const pending = await prisma.$queryRaw<any[]>`
    SELECT corpus, priority, COUNT(*)::int as count
    FROM ingest_queue
    WHERE status = 'pending'
    GROUP BY corpus, priority
    ORDER BY priority ASC, corpus
  `
  if (pending.length === 0) {
    console.log('  (no pending rows)')
  }
  for (const r of pending) {
    console.log(`  pri ${r.priority}  ${String(r.corpus).padEnd(38)} ${String(r.count).padStart(7)}`)
  }
  const [pendTotal] = await prisma.$queryRaw<[{count:bigint}]>`SELECT COUNT(*)::bigint as count FROM ingest_queue WHERE status='pending'`
  const [claimedTotal] = await prisma.$queryRaw<[{count:bigint}]>`SELECT COUNT(*)::bigint as count FROM ingest_queue WHERE status='claimed'`
  const [doneTotal] = await prisma.$queryRaw<[{count:bigint}]>`SELECT COUNT(*)::bigint as count FROM ingest_queue WHERE status='done'`
  console.log(`\n  pending: ${pendTotal.count}  claimed: ${claimedTotal.count}  done: ${doneTotal.count}`)

  console.log('\n=== D5: corpus_sections created last 4 hours ===')
  const recent = await prisma.$queryRaw<any[]>`
    SELECT corpus, COUNT(*)::int as count, MAX("createdAt") as latest
    FROM corpus_sections
    WHERE "createdAt" > NOW() - INTERVAL '4 hours'
    GROUP BY corpus
    ORDER BY count DESC
  `
  if (recent.length === 0) {
    console.log('  (none in last 4 hours)')
  }
  for (const r of recent) {
    console.log(`  ${String(r.corpus).padEnd(38)} ${String(r.count).padStart(9)}  latest: ${new Date(r.latest).toISOString()}`)
  }

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
