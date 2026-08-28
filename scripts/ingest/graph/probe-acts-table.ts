import { getNeonPool, endNeonPool } from '../shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const { rows: cols } = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='corpus_acts' ORDER BY ordinal_position`)
  console.log('corpus_acts:', cols.map((c:any)=>`${c.column_name}:${c.data_type}`).join(', '))
  const { rows: n } = await pool.query(`SELECT COUNT(*)::int n, COUNT(title)::int titled FROM corpus_acts`)
  console.log('rows:', n[0])
  for (const t of ['Climate Change Act 2008','Public Bodies Act 2011','Senior Courts Act 1981','Judicial Review and Courts Act 2022','Coroners and Justice Act 2009','Terrorism Act 2000','Public Order Act 1986','National Security Act 2023','Political Parties, Elections and Referendums Act 2000','House of Commons Disqualification Act 1975','Police, Crime, Sentencing and Courts Act 2022','Charities Act 2011']) {
    const { rows } = await pool.query(`SELECT gid, title FROM corpus_acts WHERE lower(title) = lower($1) LIMIT 3`, [t])
    console.log(`  ${t.padEnd(56)} → ${rows.map((r:any)=>`${r.gid}`).join(', ') || 'NO EXACT TITLE MATCH'}`)
  }
  const { rows: si } = await pool.query(
    `SELECT gid, title FROM corpus_acts WHERE title ILIKE '%2050 Target Amendment%' OR title ILIKE '%Climate Change Act 2008 (2050%' LIMIT 5`)
  console.log('  2019 target order candidates:', si.map((r:any)=>`${r.gid} — ${r.title}`).join(' | ') || 'none in corpus_acts')
  await endNeonPool()
}
main().catch(e=>{console.error(e);process.exit(1)})
