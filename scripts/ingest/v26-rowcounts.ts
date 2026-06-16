/**
 * v26-rowcounts.ts — READ-ONLY. True count(*) for every shared public table on
 * Railway (copy source) vs Neon (target), so Migration B's copy scope is exact.
 * n_live_tup was stale (never ANALYZEd) — this uses real counts.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

function mk(url: string) {
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 5,
    statement_timeout: 120_000, query_timeout: 120_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })
}
async function tnames(p: Pool): Promise<string[]> {
  return (await p.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'v26_%' ORDER BY 1`)).rows.map(r => r.tablename)
}
async function count(p: Pool, t: string): Promise<number | string> {
  try { return (await p.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n } catch (e: any) { return 'ERR:' + e.message.split('\n')[0].slice(0, 30) }
}

async function main() {
  const rail = mk(process.env.DATABASE_URL!)
  const neon = mk(process.env.NEON_DATABASE_URL!)
  const rTables = await tnames(rail)
  const nTables = new Set(await tnames(neon))

  const rows: { table: string; railway: number | string; neon: number | string }[] = []
  for (const t of rTables) {
    const [rc, nc] = await Promise.all([count(rail, t), nTables.has(t) ? count(neon, t) : Promise.resolve('(absent)')])
    rows.push({ table: t, railway: rc, neon: nc })
  }
  // show only tables with data on Railway, or a mismatch
  console.log('=== tables with Railway rows > 0, OR Railway≠Neon ===')
  console.table(rows.filter(r => (typeof r.railway === 'number' && r.railway > 0) || r.railway !== r.neon))

  console.log('\n=== copy candidates: Railway rows that are NOT already on Neon (railway > neon) ===')
  console.table(rows.filter(r => typeof r.railway === 'number' && typeof r.neon === 'number' && r.railway > r.neon))

  await rail.end(); await neon.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
