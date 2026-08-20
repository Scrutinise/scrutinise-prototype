/**
 * probe-3b-matters.ts — GRAPH 3B §3. Which contested matters do we ACTUALLY hold divisions for?
 *
 * The brief: "~10 well-known contested matters we actually hold divisions for — remembering the
 * record starts March 2016, so choose accordingly." So the list is read out of the corpus, not
 * recalled. Read-only.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
export {}
async function main() {
  const pool = getNeonPool()
  try {
    console.log('── coverage')
    const { rows: [c] } = await pool.query(`
      SELECT MIN(division_date) FILTER (WHERE house='commons')::text AS commons_from,
             MAX(division_date) FILTER (WHERE house='commons')::text AS commons_to,
             MIN(division_date) FILTER (WHERE house='lords')::text AS lords_from,
             COUNT(*)::text AS n FROM divisions`)
    console.log('   ', JSON.stringify(c))

    console.log('\n── the bills with the most divisions since 2016-03-09, most-split first')
    const { rows } = await pool.query(`
      SELECT d.bill_title, COUNT(*)::text AS divisions,
             MIN(d.division_date)::text AS from_d, MAX(d.division_date)::text AS to_d,
             COUNT(*) FILTER (WHERE c.free_vote_like)::text AS free_vote_like
        FROM divisions d
        LEFT JOIN position_division_class c ON c.house=d.house AND c.division_id=d.division_id
       WHERE d.bill_title IS NOT NULL AND d.division_date >= '2016-03-09'
       GROUP BY 1 HAVING COUNT(*) >= 4
       ORDER BY COUNT(*) DESC LIMIT 45`)
    for (const r of rows) console.log(`   ${String(r.divisions).padStart(4)} div  fv=${String(r.free_vote_like).padStart(3)}  ${r.from_d}→${r.to_d}  ${r.bill_title}`)

    console.log('\n── divisions matching well-known contested topics (title or bill_title)')
    const topics = ['Rwanda','Safety of Rwanda','Illegal Migration','Nationality and Borders','Tobacco and Vapes',
      'Terminally Ill Adults','Assisted Dying','European Union (Withdrawal','Withdrawal Agreement','Trade Union',
      'Northern Ireland Protocol','Retained EU Law','Public Order','Police, Crime, Sentencing','Elections Bill',
      'Health and Care','Universal Credit','Welfare','Online Safety','Hunting','Fracking','HS2','Grammar','Fire and Rehire',
      'Environment Bill','Sewage','Water','Free School Meals','Overseas Operations','Judicial Review','Bill of Rights']
    for (const t of topics) {
      const { rows: [x] } = await pool.query(`
        SELECT COUNT(*)::text AS n, MIN(division_date)::text AS f, MAX(division_date)::text AS l
          FROM divisions WHERE (title ILIKE '%'||$1||'%' OR bill_title ILIKE '%'||$1||'%')
            AND division_date >= '2016-03-09'`, [t])
      if (Number(x.n) > 0) console.log(`   ${String(x.n).padStart(4)}  ${t.padEnd(32)} ${x.f} → ${x.l}`)
      else console.log(`      0  ${t.padEnd(32)} ⛔ NOT HELD`)
    }
  } finally { await endNeonPool() }
}
main().catch(e => { console.error(e); process.exit(1) })
