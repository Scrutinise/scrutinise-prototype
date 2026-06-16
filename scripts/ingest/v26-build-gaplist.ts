/**
 * v26-build-gaplist.ts — Migration A.1 deliverable. Materializes the categorized
 * non-matching legacy item set into a persistent table `v26_nonmatch`, splitting
 * docId-form differences (already covered) from genuine coverage gaps (the A.2
 * seed list). Staged so each step is an indexed pass, not a correlated re-scan.
 *
 * Categories:
 *   form-ukpga-regnal  pre-1963 UKPGA — present under regnal docId (calendar↔regnal)
 *   form-eur-altform   EUR present as eudr/eudn/CELEX in retained-eu / eur-lex
 *   form-uksi-regional UKSI present under nisr/ssi/wsi/nisi sub-type form
 *   gap                genuinely absent from corpus_sections → gap-fill candidate
 *
 * Requires v26_cs_gids (v26-normalize-hypotheses.ts). Idempotent (drops+rebuilds).
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false },
    max: 3, statement_timeout: 600_000, query_timeout: 600_000,
    idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000, keepAlive: true,
  })
  if (!(await pool.query(`SELECT to_regclass('public.v26_cs_gids') t`)).rows[0].t) {
    console.error('v26_cs_gids missing — run v26-normalize-hypotheses.ts first'); process.exit(1)
  }

  console.log('1. building v26_nonmatch (indexed anti-join) ...')
  await pool.query(`DROP TABLE IF EXISTS v26_nonmatch`)
  let t0 = Date.now()
  await pool.query(`
    CREATE TABLE v26_nonmatch AS
    SELECT li.id, li."legislationGovUkId" gid, li."legislationType"::text t,
           li.title, li.year, li."compilationStatus"::text cstatus, li."sectionCount" sc,
           split_part(li."legislationGovUkId",'/',2) ypart,
           split_part(li."legislationGovUkId",'/',3) numpart,
           NULL::text category
    FROM "LegislationItem" li
    WHERE NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid = li."legislationGovUkId")`)
  await pool.query(`CREATE INDEX ON v26_nonmatch(category)`)
  console.log(`   v26_nonmatch: ${(await pool.query(`SELECT count(*)::int n FROM v26_nonmatch`)).rows[0].n} rows (${((Date.now()-t0)/1000).toFixed(1)}s)`)

  console.log('2. categorising form-differences ...')
  // a) pre-1963 UKPGA → regnal form
  await pool.query(`UPDATE v26_nonmatch SET category='form-ukpga-regnal'
    WHERE t='UKPGA' AND ypart ~ '^[0-9]+$' AND ypart::int < 1963`)
  // b) EUR alt forms (eudr/eudn/celex)
  await pool.query(`UPDATE v26_nonmatch nm SET category='form-eur-altform'
    WHERE category IS NULL AND t='EUR' AND (
      EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudr/'||nm.ypart||'/'||nm.numpart)
      OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudn/'||nm.ypart||'/'||nm.numpart)
      OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.ypart||'R%'||lpad(nm.numpart,4,'0'))
      OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.ypart||'D%'||lpad(nm.numpart,4,'0')))`)
  // c) UKSI regional sub-type forms
  await pool.query(`UPDATE v26_nonmatch nm SET category='form-uksi-regional'
    WHERE category IS NULL AND t='UKSI' AND EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid IN
      ('nisr/'||nm.ypart||'/'||nm.numpart,'ssi/'||nm.ypart||'/'||nm.numpart,
       'wsi/'||nm.ypart||'/'||nm.numpart,'nisi/'||nm.ypart||'/'||nm.numpart))`)
  // d) everything else = genuine gap
  await pool.query(`UPDATE v26_nonmatch SET category='gap' WHERE category IS NULL`)

  console.log('\n=== category breakdown ===')
  console.table((await pool.query(`SELECT category, count(*)::int n FROM v26_nonmatch GROUP BY category ORDER BY n DESC`)).rows)

  console.log('\n=== genuine gaps by type ===')
  console.table((await pool.query(`SELECT t, count(*)::int n FROM v26_nonmatch WHERE category='gap' GROUP BY t ORDER BY n DESC`)).rows)

  console.log('\n=== genuine gaps: legacy compilationStatus (does the legacy store hold real content?) ===')
  console.table((await pool.query(`SELECT cstatus, count(*)::int n, count(*) FILTER (WHERE sc>0)::int has_sections
    FROM v26_nonmatch WHERE category='gap' GROUP BY cstatus ORDER BY n DESC`)).rows)

  console.log('\n=== genuine gaps with ≥1 legacy section holding originalText ===')
  console.table((await pool.query(`
    SELECT count(*)::int total_gap,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "LegislationSection" ls
        WHERE ls."legislationItemId"=nm.id AND ls."originalText" IS NOT NULL AND length(ls."originalText")>0))::int with_legacy_text
    FROM v26_nonmatch nm WHERE category='gap'`)).rows)

  console.log('\n=== genuine gaps by year bucket ===')
  console.table((await pool.query(`SELECT
      count(*) FILTER (WHERE year < 1980)::int pre1980,
      count(*) FILTER (WHERE year BETWEEN 1980 AND 1999)::int y80_99,
      count(*) FILTER (WHERE year BETWEEN 2000 AND 2009)::int y00_09,
      count(*) FILTER (WHERE year >= 2010)::int y10plus
    FROM v26_nonmatch WHERE category='gap'`)).rows)

  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
