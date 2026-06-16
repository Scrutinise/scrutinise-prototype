/**
 * v26-db-inventory.ts — READ-ONLY. Compares Neon vs Railway for Migration B:
 *  - public tables on each (which app tables are missing on Neon)
 *  - _prisma_migrations state on each (is there a baseline?)
 *  - row counts for the app tables on Railway (the copy volume)
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

function mk(url: string) {
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 120_000, query_timeout: 120_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })
}

async function tables(p: Pool): Promise<string[]> {
  const r = await p.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`)
  return r.rows.map(x => x.tablename)
}

async function main() {
  const neon = mk(process.env.NEON_DATABASE_URL!)
  const rail = mk(process.env.DATABASE_URL!)

  const [nt, rt] = await Promise.all([tables(neon), tables(rail)])
  const ns = new Set(nt), rs = new Set(rt)

  console.log(`Neon: ${nt.length} public tables | Railway: ${rt.length} public tables`)
  console.log('\n=== tables on RAILWAY but MISSING on NEON (must be created for Migration B) ===')
  const missing = rt.filter(t => !ns.has(t))
  console.log(missing.join('\n') || '(none)')
  console.log('\n=== tables on NEON but not on Railway ===')
  console.log(nt.filter(t => !rs.has(t)).join('\n') || '(none)')

  for (const [name, p] of [['NEON', neon], ['RAILWAY', rail]] as const) {
    try {
      const m = await p.query(`SELECT migration_name, finished_at IS NOT NULL applied FROM _prisma_migrations ORDER BY started_at`)
      console.log(`\n=== _prisma_migrations on ${name} (${m.rowCount} rows) ===`)
      for (const r of m.rows) console.log(`  ${r.applied ? '✓' : '…'} ${r.migration_name}`)
    } catch (e: any) {
      console.log(`\n=== _prisma_migrations on ${name}: NOT PRESENT (${e.message.split('\n')[0]}) ===`)
    }
  }

  // Railway row counts for the app tables missing on Neon (copy volume)
  console.log('\n=== Railway row counts (n_live_tup estimate) for migration-B tables ===')
  const counts = await rail.query(`
    SELECT relname, n_live_tup::int rows FROM pg_stat_user_tables
    WHERE schemaname='public' ORDER BY n_live_tup DESC`)
  console.table(counts.rows.filter((r: any) => r.rows > 0).slice(0, 60))

  await neon.end(); await rail.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
