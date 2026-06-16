/** v26-fts-state.ts — READ-ONLY. Confirms Neon's legacy search index is intact
 * for the Migration B search repoint: ftsVector populated on both tables, GIN
 * indexes present, and a live @@ query returns hits. */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

async function main() {
  const p = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 120_000, query_timeout: 120_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })

  for (const t of ['LegislationSection', 'OperationalSection']) {
    const r = await p.query(`SELECT count(*)::int total, count(*) FILTER (WHERE "ftsVector" IS NOT NULL)::int populated FROM "${t}"`)
    console.log(`${t}: ${r.rows[0].populated}/${r.rows[0].total} ftsVector populated`)
  }
  console.log('\nGIN indexes:')
  const idx = await p.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public'
    AND indexname IN ('LegislationSection_ftsVector_idx','OperationalSection_ftsVector_idx')`)
  console.log('  ' + idx.rows.map(r => r.indexname).join('\n  '))

  console.log('\nlive @@ probe (legislation_english + english):')
  for (const cfg of ['english', 'legislation_english']) {
    try {
      const a = await p.query(`SELECT count(*)::int n FROM "LegislationSection" WHERE "ftsVector" @@ plainto_tsquery('${cfg}','data protection')`)
      const b = await p.query(`SELECT count(*)::int n FROM "OperationalSection" WHERE "ftsVector" @@ plainto_tsquery('${cfg}','police')`)
      console.log(`  [${cfg}] LegislationSection 'data protection' → ${a.rows[0].n} | OperationalSection 'police' → ${b.rows[0].n}`)
    } catch (e: any) { console.log(`  [${cfg}] ERR ${e.message.split('\n')[0]}`) }
  }
  await p.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
