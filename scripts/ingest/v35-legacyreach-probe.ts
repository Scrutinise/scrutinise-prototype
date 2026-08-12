require('dotenv').config({ path: 'C:/Code/scrutinise-prototype/scrutinise-web/.env' })
import { Pool } from 'pg'
async function main(){
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false}, max:2, statement_timeout: 240_000 })
  // Exactly the shape lib/search.ts uses (path G): FTS over LegislationSection joined to Item.
  for (const q of ['directors duties company', 'personal data processing lawful basis']) {
    const { rows } = await pool.query(
      `SELECT li."legislationGovUkId" AS act, li.title, ls."sectionNumber",
              ts_rank_cd(ls."ftsVector", plainto_tsquery('english',$1)) AS rank
         FROM "LegislationSection" ls JOIN "LegislationItem" li ON ls."legislationItemId"=li.id
        WHERE ls."ftsVector" @@ plainto_tsquery('english',$1)
        ORDER BY rank DESC LIMIT 8`, [q])
    console.log(`\n── legacy path (lib/search.ts shape) — "${q}"`)
    for (const r of rows) console.log(`   ${r.act.padEnd(18)} s.${String(r.sectionNumber).padEnd(6)} ${String(r.title).slice(0,58)}`)
    const notInCorpus = await pool.query(
      `SELECT count(*)::int n FROM (
         SELECT li."legislationGovUkId" g FROM "LegislationSection" ls JOIN "LegislationItem" li ON ls."legislationItemId"=li.id
          WHERE ls."ftsVector" @@ plainto_tsquery('english',$1)
          ORDER BY ts_rank_cd(ls."ftsVector", plainto_tsquery('english',$1)) DESC LIMIT 20) t
       JOIN corpus_acts a ON a.gid=t.g WHERE NOT a.in_corpus`, [q])
    console.log(`   ⇒ of the top 20, ${notInCorpus.rows[0].n} are from instruments the CORPUS DOES NOT HAVE`)
  }
  await pool.end()
}
main().catch(e=>{console.error(e.message);process.exit(1)})
