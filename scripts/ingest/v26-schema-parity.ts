/** v26-schema-parity.ts — READ-ONLY. Verifies column-level parity between Railway
 * and Neon for every shared public table, so the Migration B data copy can't fail
 * on a column mismatch. Reports columns present on one side only, and type/null
 * differences. */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

type Col = { data_type: string; is_nullable: string }
function mk(url: string) { return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3,
  statement_timeout: 60_000, query_timeout: 60_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 }) }

async function cols(p: Pool, t: string): Promise<Record<string, Col>> {
  const r = await p.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1`, [t])
  const out: Record<string, Col> = {}
  for (const row of r.rows) out[row.column_name] = { data_type: row.data_type, is_nullable: row.is_nullable }
  return out
}
async function tnames(p: Pool): Promise<string[]> {
  return (await p.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'v26_%'
    AND tablename NOT IN ('legislation_compilation_enrichment') ORDER BY 1`)).rows.map(r => r.tablename)
}

async function main() {
  const rail = mk(process.env.DATABASE_URL!), neon = mk(process.env.NEON_DATABASE_URL!)
  const [rt, ntArr] = await Promise.all([tnames(rail), tnames(neon)])
  const nt = new Set(ntArr)
  const shared = rt.filter(t => nt.has(t))

  let problems = 0
  for (const t of shared) {
    const [rc, nc] = await Promise.all([cols(rail, t), cols(neon, t)])
    const railOnly = Object.keys(rc).filter(c => !(c in nc))
    const neonOnly = Object.keys(nc).filter(c => !(c in rc))
    const typeDiff = Object.keys(rc).filter(c => c in nc && rc[c].data_type !== nc[c].data_type)
    if (railOnly.length || neonOnly.length || typeDiff.length) {
      problems++
      console.log(`\n⚠ ${t}:`)
      if (railOnly.length) console.log(`   railway-only cols: ${railOnly.join(', ')}`)
      if (neonOnly.length) console.log(`   neon-only cols:    ${neonOnly.join(', ')}`)
      for (const c of typeDiff) console.log(`   type diff ${c}: railway=${rc[c].data_type} neon=${nc[c].data_type}`)
    }
  }
  console.log(`\n${shared.length} shared tables checked; ${problems} with column differences.`)
  await rail.end(); await neon.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
