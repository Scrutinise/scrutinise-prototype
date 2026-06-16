import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}
async function main() {
  const p = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, query_timeout: 60000, statement_timeout: 60000 })
  const plan = await p.query(`EXPLAIN
    SELECT ls.id FROM "LegislationSection" ls JOIN "LegislationItem" li ON ls."legislationItemId"=li.id
    WHERE ls."ftsVector" @@ plainto_tsquery('english','data protection')
    ORDER BY ts_rank(ls."ftsVector", plainto_tsquery('english','data protection')) DESC, ls."amendmentCount" ASC LIMIT 5`)
  console.log(plan.rows.map((r: any) => r['QUERY PLAN']).join('\n'))
  await p.end()
}
main().catch(e => { console.error(e); process.exit(1) })
