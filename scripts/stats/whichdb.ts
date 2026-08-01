// Stats-DB equivalent of scripts/whichdb.ts — run this BEFORE any migrate/DDL against
// the stats database (docs/CLAUDE.md §16). It must print the stats project's host, never
// the corpus/app Neon host (ep-old-dust-aboxi69a...). If it does, STOP.
// Usage: npx tsx --tsconfig ../tsconfig.json whichdb.ts   (from scripts/stats/)
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/stats-client'

// The corpus/app Neon endpoint. If the stats URL resolves here, something is very wrong.
const CORPUS_HOST_FRAGMENT = 'old-dust'

async function main() {
  const pooled = process.env.STATS_DATABASE_URL
  const direct = process.env.STATS_DIRECT_URL
  if (!pooled) throw new Error('STATS_DATABASE_URL not set')

  for (const [label, url] of [['STATS_DATABASE_URL (pooled)', pooled], ['STATS_DIRECT_URL', direct]] as const) {
    if (!url) { console.log(`${label}: (unset)`); continue }
    const u = new URL(url)
    console.log(`${label}:`)
    console.log(`  host:     ${u.hostname}`)
    console.log(`  database: ${u.pathname.replace('/', '')}`)
    if (u.hostname.includes(CORPUS_HOST_FRAGMENT)) {
      throw new Error(`REFUSING TO CONTINUE — ${label} points at the corpus/app Neon endpoint (${u.hostname}). See docs/CLAUDE.md §16.`)
    }
  }

  const adapter = new PrismaPg({ connectionString: pooled, ssl: { rejectUnauthorized: false } })
  const prisma = new PrismaClient({ adapter })

  const [{ db, usr }] = await prisma.$queryRaw<{ db: string, usr: string }[]>`
    SELECT current_database() AS db, current_user AS usr
  `
  console.log(`\nconnected: database=${db} user=${usr}`)

  try {
    const rows = await prisma.$queryRaw<{ migration_name: string, finished_at: Date | null, rolled_back_at: Date | null }[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
      LIMIT 5
    `
    console.log('\nlast 5 _prisma_migrations rows (most recent first):')
    if (rows.length === 0) console.log('  (none — migrations table exists but is empty)')
    for (const r of rows) {
      console.log(`  ${r.migration_name}  finished_at=${r.finished_at ? new Date(r.finished_at).toISOString() : 'NULL'}  rolled_back_at=${r.rolled_back_at ? new Date(r.rolled_back_at).toISOString() : 'null'}`)
    }
  } catch {
    console.log('\n_prisma_migrations: not present (expected on a freshly provisioned, un-migrated DB)')
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
