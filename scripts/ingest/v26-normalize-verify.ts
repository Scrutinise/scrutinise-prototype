/**
 * v26-normalize-verify.ts — READ-ONLY. Resolves the genuine coverage-gap list
 * for Migration A.1 with PRECISE union coverage + a fetchability reality-check.
 *
 *  1. EUR genuine gaps  = non-matching EUR NOT covered by eudr/eudn/celex forms.
 *  2. UKSI genuine gaps = non-matching UKSI NOT covered by regional sub-type forms.
 *  3. UKPGA: pre-1963 = calendar↔regnal form diff (covered); modern = candidate gaps.
 *  4. For the genuine-gap candidates: does the LEGACY store actually hold text
 *     (originalText / compilationStatus)? Distinguishes real content from
 *     metadata-only relics.
 *  5. Live TNA probe of a sample (data.feed formats) — are they fetchable?
 *
 * Requires v26_cs_gids (built by v26-normalize-hypotheses.ts).
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { discoverFormats } from './sources/tna-legislation'

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4, statement_timeout: 600_000, query_timeout: 600_000,
    idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000, keepAlive: true,
  })

  if (!(await pool.query(`SELECT to_regclass('public.v26_cs_gids') t`)).rows[0].t) {
    console.error('v26_cs_gids missing — run v26-normalize-hypotheses.ts first'); process.exit(1)
  }

  // 1. EUR genuine gaps (precise union)
  console.log('=== EUR genuine gaps (not covered by ANY alternate form) ===')
  const eur = await pool.query(`
    WITH nm AS (
      SELECT li."legislationGovUkId" gid, split_part(li."legislationGovUkId",'/',2) y, split_part(li."legislationGovUkId",'/',3) num
      FROM "LegislationItem" li
      WHERE li."legislationType"='EUR'
        AND NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
    )
    SELECT count(*)::int total,
      count(*) FILTER (WHERE
        EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudr/'||nm.y||'/'||nm.num)
        OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudn/'||nm.y||'/'||nm.num)
        OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.y||'R%'||lpad(nm.num,4,'0'))
        OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.y||'D%'||lpad(nm.num,4,'0'))
      )::int covered,
      count(*) FILTER (WHERE NOT (
        EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudr/'||nm.y||'/'||nm.num)
        OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudn/'||nm.y||'/'||nm.num)
        OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.y||'R%'||lpad(nm.num,4,'0'))
        OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.y||'D%'||lpad(nm.num,4,'0'))
      ))::int genuine_gap
    FROM nm`)
  console.table(eur.rows)

  // 2. UKSI genuine gaps (precise union over regional sub-type forms)
  console.log('=== UKSI genuine gaps (not covered by regional sub-type form) ===')
  const uksi = await pool.query(`
    WITH nm AS (
      SELECT li."legislationGovUkId" gid, split_part(li."legislationGovUkId",'/',2) y, split_part(li."legislationGovUkId",'/',3) num
      FROM "LegislationItem" li
      WHERE li."legislationType"='UKSI'
        AND NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
    )
    SELECT count(*)::int total,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid IN
        ('nisr/'||nm.y||'/'||nm.num,'ssi/'||nm.y||'/'||nm.num,'wsi/'||nm.y||'/'||nm.num,'nisi/'||nm.y||'/'||nm.num)))::int covered_regional,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid IN
        ('nisr/'||nm.y||'/'||nm.num,'ssi/'||nm.y||'/'||nm.num,'wsi/'||nm.y||'/'||nm.num,'nisi/'||nm.y||'/'||nm.num)))::int genuine_gap
    FROM nm`)
  console.table(uksi.rows)

  // 3/4. Legacy text/compilation reality for the genuine-gap candidates.
  // Candidate set = non-matching items EXCLUDING pre-1963 UKPGA (form diff) and
  // EXCLUDING UKSI/EUR covered by alt forms.
  console.log('=== genuine-gap candidates: legacy compilationStatus + originalText reality ===')
  const reality = await pool.query(`
    WITH cand AS (
      SELECT li.id, li."legislationGovUkId" gid, li."legislationType" t, li."compilationStatus" cs,
             li."sectionCount" sc, li."compiledSectionCount" csc,
             split_part(li."legislationGovUkId",'/',2) y, split_part(li."legislationGovUkId",'/',3) num
      FROM "LegislationItem" li
      WHERE NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
        AND NOT (li."legislationType"='UKPGA' AND split_part(li."legislationGovUkId",'/',2) ~ '^[0-9]+$'
                 AND split_part(li."legislationGovUkId",'/',2)::int < 1963)
    ), cand2 AS (
      SELECT * FROM cand WHERE NOT (
        t='UKSI' AND EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid IN
          ('nisr/'||y||'/'||num,'ssi/'||y||'/'||num,'wsi/'||y||'/'||num,'nisi/'||y||'/'||num)))
        AND NOT (t='EUR' AND (
          EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudr/'||y||'/'||num)
          OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudn/'||y||'/'||num)
          OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||y||'R%'||lpad(num,4,'0'))
          OR EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||y||'D%'||lpad(num,4,'0'))))
    )
    SELECT t, cs, count(*)::int n,
      count(*) FILTER (WHERE sc > 0)::int has_sections
    FROM cand2 GROUP BY t, cs ORDER BY t, n DESC`)
  console.table(reality.rows)

  // how many candidate items have ANY legacy section with non-empty originalText?
  console.log('=== candidates with ≥1 legacy section holding originalText ===')
  const withText = await pool.query(`
    WITH cand AS (
      SELECT li.id, li."legislationType" t,
             split_part(li."legislationGovUkId",'/',2) y, split_part(li."legislationGovUkId",'/',3) num
      FROM "LegislationItem" li
      WHERE NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
        AND NOT (li."legislationType"='UKPGA' AND split_part(li."legislationGovUkId",'/',2) ~ '^[0-9]+$'
                 AND split_part(li."legislationGovUkId",'/',2)::int < 1963)
        AND NOT (li."legislationType"='UKSI' AND EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid IN
          ('nisr/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3),
           'ssi/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3),
           'wsi/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3),
           'nisi/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3))))
    )
    SELECT count(DISTINCT cand.id)::int total_candidates,
      count(DISTINCT cand.id) FILTER (WHERE s.id IS NOT NULL)::int with_legacy_text
    FROM cand
    LEFT JOIN LATERAL (
      SELECT ls.id FROM "LegislationSection" ls
      WHERE ls."legislationItemId"=cand.id AND ls."originalText" IS NOT NULL AND length(ls."originalText")>0
      LIMIT 1) s ON true`)
  console.table(withText.rows)

  // 5. live TNA fetchability probe (sample 20 genuine-gap candidates)
  console.log('=== live TNA probe: data.feed formats for 20 sample candidates ===')
  const sample = await pool.query(`
    WITH cand AS (
      SELECT li."legislationGovUkId" gid, li."legislationType" t,
             split_part(li."legislationGovUkId",'/',2) y, split_part(li."legislationGovUkId",'/',3) num
      FROM "LegislationItem" li
      WHERE NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
        AND NOT (li."legislationType"='UKPGA' AND split_part(li."legislationGovUkId",'/',2) ~ '^[0-9]+$'
                 AND split_part(li."legislationGovUkId",'/',2)::int < 1963)
        AND NOT (li."legislationType"='UKSI' AND EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid IN
          ('nisr/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3),
           'ssi/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3),
           'wsi/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3),
           'nisi/'||split_part(li."legislationGovUkId",'/',2)||'/'||split_part(li."legislationGovUkId",'/',3))))
    )
    SELECT gid, t FROM cand ORDER BY random() LIMIT 20`)
  for (const r of sample.rows) {
    const fmts = await discoverFormats(r.gid)
    console.log(`  ${r.gid} [${r.t}] → ${fmts.length ? fmts.join(',') : '(no feed / absent)'}`)
  }

  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
