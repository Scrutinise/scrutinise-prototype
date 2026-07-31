import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const u = new URL(url)
  console.log('host:', u.hostname)
  console.log('database:', u.pathname.replace('/', ''))

  const adapter = new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const prisma = new PrismaClient({ adapter } as never)

  const rows = await prisma.$queryRaw<{ migration_name: string, finished_at: Date | null, rolled_back_at: Date | null }[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at DESC
    LIMIT 5
  `
  console.log('\nlast 5 _prisma_migrations rows (most recent first):')
  for (const r of rows) {
    console.log(`  ${r.migration_name}  finished_at=${r.finished_at ? new Date(r.finished_at).toISOString() : 'NULL'}  rolled_back_at=${r.rolled_back_at ? new Date(r.rolled_back_at).toISOString() : 'null'}`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })
