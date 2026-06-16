/**
 * v26-normalize-explore.ts — READ-ONLY exploration for Migration A.1.
 *
 * Grounds the legacy-gid normalization in real data BEFORE writing the
 * classifier. Builds the set of distinct legislation gids present in
 * corpus_sections, anti-joins LegislationItem to find the non-matching set,
 * breaks it down by type, and samples actual gid forms on BOTH sides so the
 * docId-form-difference rules (ukpga calendar/chrome, eudn/eudr vs celex,
 * nisi/nia sub-typing) can be written against observed forms, not guesses.
 *
 * Dedicated pool with long timeouts — the DISTINCT extraction scans ~1.3M rows.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const LEG_CORPORA = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010',
  'si-2010plus', 'regional', 'retained-eu', 'eur-lex']

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
    statement_timeout: 600_000,
    query_timeout: 600_000,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  })

  console.log('=== building TEMP cs_gids (distinct legislation gids in corpus_sections) ===')
  const t0 = Date.now()
  await pool.query(`
    CREATE TEMP TABLE cs_gids AS
    SELECT DISTINCT split_part(id, ':', 2) AS gid
    FROM corpus_sections
    WHERE corpus = ANY($1)`, [LEG_CORPORA])
  await pool.query(`CREATE INDEX ON cs_gids(gid)`)
  const gidCount = await pool.query(`SELECT count(*)::int n FROM cs_gids`)
  console.log(`cs_gids: ${gidCount.rows[0].n} distinct docIds (${((Date.now()-t0)/1000).toFixed(1)}s)`)

  console.log('\n=== LegislationItem total + non-matching (exact gid) ===')
  const tot = await pool.query(`SELECT count(*)::int n FROM "LegislationItem"`)
  const nonmatch = await pool.query(`
    SELECT count(*)::int n FROM "LegislationItem" li
    WHERE NOT EXISTS (SELECT 1 FROM cs_gids g WHERE g.gid = li."legislationGovUkId")`)
  console.log(`LegislationItem total: ${tot.rows[0].n}; non-matching (exact): ${nonmatch.rows[0].n}`)

  console.log('\n=== non-matching by legislationType ===')
  const byType = await pool.query(`
    SELECT li."legislationType" t, count(*)::int n
    FROM "LegislationItem" li
    WHERE NOT EXISTS (SELECT 1 FROM cs_gids g WHERE g.gid = li."legislationGovUkId")
    GROUP BY li."legislationType" ORDER BY n DESC`)
  console.table(byType.rows)

  console.log('\n=== sample non-matching gids per type (15 each) ===')
  for (const r of byType.rows) {
    const s = await pool.query(`
      SELECT li."legislationGovUkId" gid FROM "LegislationItem" li
      WHERE li."legislationType"=$1
        AND NOT EXISTS (SELECT 1 FROM cs_gids g WHERE g.gid = li."legislationGovUkId")
      ORDER BY random() LIMIT 15`, [r.t])
    console.log(`\n[${r.t}] (${r.n} non-matching):`)
    console.log('  ' + s.rows.map(x => x.gid).join('\n  '))
  }

  console.log('\n=== sample ACTUAL cs gids present per corpus (12 each) ===')
  for (const c of LEG_CORPORA) {
    const s = await pool.query(`
      SELECT DISTINCT split_part(id,':',2) gid FROM corpus_sections
      WHERE corpus=$1 ORDER BY 1 LIMIT 12`, [c])
    console.log(`\n[${c}]:`)
    console.log('  ' + s.rows.map(x => x.gid).join('\n  '))
  }

  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
