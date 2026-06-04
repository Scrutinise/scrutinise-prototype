import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  const adapter = new PrismaPg({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
  const prisma = new PrismaClient({ adapter } as never)

  const [snapshotCount, doneCount, sizeResult] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM ingest_progress_snapshots
      WHERE "capturedAt" < NOW() - INTERVAL '24 hours'
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM ingest_queue
      WHERE status = 'done' AND "updatedAt" < NOW() - INTERVAL '7 days'
    `,
    prisma.$queryRaw<[{ db_size: string }]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size
    `,
  ])

  console.log(`DB size before: ${sizeResult[0].db_size}`)
  console.log(`Old snapshots to delete: ${snapshotCount[0].count}`)
  console.log(`Old done queue rows to delete: ${doneCount[0].count}`)

  const r1 = await prisma.$executeRaw`
    DELETE FROM ingest_progress_snapshots WHERE "capturedAt" < NOW() - INTERVAL '24 hours'
  `
  console.log(`Deleted ${r1} old progress snapshots`)

  const r2 = await prisma.$executeRaw`
    DELETE FROM ingest_queue WHERE status = 'done' AND "updatedAt" < NOW() - INTERVAL '7 days'
  `
  console.log(`Deleted ${r2} old done queue rows`)

  const after = await prisma.$queryRaw<[{ db_size: string }]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size
  `
  console.log(`DB size after: ${after[0].db_size}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
