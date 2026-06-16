/**
 * v26-normalize-hypotheses.ts — READ-ONLY. Tests the docId-form-difference
 * hypotheses for Migration A.1 against real data, so the classifier rules are
 * grounded. Builds a PERSISTENT scratch table `v26_cs_gids` (distinct legislation
 * gids in corpus_sections) once, reused across runs (drop at A.1 close).
 *
 * Hypotheses under test:
 *  - EUR  `eur/Y/N`  → present in corpus as `eudr/Y/N` or `eudn/Y/N` (retained-eu)
 *                      or as a CELEX number `3{Y}R{NNNN}` / `3{Y}D{NNNN}` (eur-lex).
 *  - UKPGA pre-1963   → present under a regnal-year form (V19 regnal seed).
 *  - UKSI / modern UKPGA → suspected genuine coverage gaps; spot-verify absence.
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
    max: 4, statement_timeout: 600_000, query_timeout: 600_000,
    idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000, keepAlive: true,
  })

  // 1. persistent scratch table (build once)
  const exists = await pool.query(`SELECT to_regclass('public.v26_cs_gids') t`)
  if (!exists.rows[0].t) {
    console.log('building v26_cs_gids ...')
    const t0 = Date.now()
    await pool.query(`CREATE TABLE v26_cs_gids AS
      SELECT DISTINCT split_part(id, ':', 2) AS gid FROM corpus_sections WHERE corpus = ANY($1)`, [LEG_CORPORA])
    await pool.query(`CREATE INDEX ON v26_cs_gids(gid)`)
    console.log(`built (${((Date.now()-t0)/1000).toFixed(1)}s)`)
  }
  console.log('v26_cs_gids count:', (await pool.query(`SELECT count(*)::int n FROM v26_cs_gids`)).rows[0].n)

  // 2. EUR normalization
  console.log('\n=== EUR (2108 non-matching) — candidate alternate forms present? ===')
  const eur = await pool.query(`
    WITH nm AS (
      SELECT li."legislationGovUkId" gid,
             split_part(li."legislationGovUkId",'/',2) y,
             split_part(li."legislationGovUkId",'/',3) num
      FROM "LegislationItem" li
      WHERE li."legislationType"='EUR'
        AND NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
    )
    SELECT count(*)::int total,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudr/'||nm.y||'/'||nm.num))::int via_eudr,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eudn/'||nm.y||'/'||nm.num))::int via_eudn,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid='eur/'||nm.y||'/'||nm.num))::int via_eur_other,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.y||'R%'||lpad(nm.num,4,'0')))::int via_celex_R,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid LIKE '3'||nm.y||'D%'||lpad(nm.num,4,'0')))::int via_celex_D
    FROM nm`)
  console.table(eur.rows)

  // 3. UKPGA split by year
  console.log('\n=== UKPGA (8908 non-matching) — pre-1963 vs modern ===')
  const ukpga = await pool.query(`
    WITH nm AS (
      SELECT li."legislationGovUkId" gid, split_part(li."legislationGovUkId",'/',2) y
      FROM "LegislationItem" li
      WHERE li."legislationType"='UKPGA'
        AND NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
    )
    SELECT
      count(*) FILTER (WHERE y ~ '^[0-9]+$' AND y::int < 1963)::int pre1963,
      count(*) FILTER (WHERE y ~ '^[0-9]+$' AND y::int BETWEEN 1963 AND 1999)::int y1963_1999,
      count(*) FILTER (WHERE y ~ '^[0-9]+$' AND y::int >= 2000)::int y2000plus,
      count(*) FILTER (WHERE y !~ '^[0-9]+$')::int nonnumeric_year
    FROM nm`)
  console.table(ukpga.rows)

  console.log('\n=== regnal-form gids present in primary-acts-pre-2000 (non-numeric year part) — sample ===')
  const regnal = await pool.query(`
    SELECT DISTINCT split_part(id,':',2) gid FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000'
      AND split_part(split_part(id,':',2),'/',2) !~ '^[0-9]+$'
    LIMIT 20`)
  console.log('  ' + (regnal.rows.map(r=>r.gid).join('\n  ') || '(none — pre-1963 acts use numeric form)'))
  const regnalCount = await pool.query(`
    SELECT count(DISTINCT split_part(id,':',2))::int n FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000'
      AND split_part(split_part(id,':',2),'/',2) !~ '^[0-9]+$'`)
  console.log('  distinct non-numeric-year docs in primary-acts-pre-2000:', regnalCount.rows[0].n)

  // modern UKPGA non-match: are these real gaps? sample + count by year
  console.log('\n=== modern non-matching UKPGA (>=2000) by year ===')
  const modUkpga = await pool.query(`
    SELECT split_part(li."legislationGovUkId",'/',2) y, count(*)::int n
    FROM "LegislationItem" li
    WHERE li."legislationType"='UKPGA'
      AND split_part(li."legislationGovUkId",'/',2) ~ '^[0-9]+$'
      AND split_part(li."legislationGovUkId",'/',2)::int >= 2000
      AND NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
    GROUP BY 1 ORDER BY 1`)
  console.table(modUkpga.rows)

  // 4. UKSI by year bucket
  console.log('\n=== UKSI (27554 non-matching) by year bucket ===')
  const uksi = await pool.query(`
    WITH nm AS (
      SELECT split_part(li."legislationGovUkId",'/',2) y
      FROM "LegislationItem" li
      WHERE li."legislationType"='UKSI'
        AND NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
    )
    SELECT
      count(*) FILTER (WHERE y ~ '^[0-9]+$' AND y::int < 2010)::int pre2010,
      count(*) FILTER (WHERE y ~ '^[0-9]+$' AND y::int >= 2010)::int y2010plus,
      count(*) FILTER (WHERE y !~ '^[0-9]+$')::int nonnumeric
    FROM nm`)
  console.table(uksi.rows)

  // are non-matching UKSI present under a NI/scottish/welsh regional sub-typing? (nisr/ssi/wsi)
  console.log('\n=== UKSI non-match — present under regional sub-type form? (sample-check 5000) ===')
  const uksiAlt = await pool.query(`
    WITH nm AS (
      SELECT li."legislationGovUkId" gid,
             split_part(li."legislationGovUkId",'/',2) y, split_part(li."legislationGovUkId",'/',3) num
      FROM "LegislationItem" li
      WHERE li."legislationType"='UKSI'
        AND NOT EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid=li."legislationGovUkId")
      ORDER BY random() LIMIT 5000
    )
    SELECT count(*)::int sampled,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM v26_cs_gids g WHERE g.gid IN
        ('nisr/'||nm.y||'/'||nm.num,'ssi/'||nm.y||'/'||nm.num,'wsi/'||nm.y||'/'||nm.num,'nisi/'||nm.y||'/'||nm.num)))::int via_regional
    FROM nm`)
  console.table(uksiAlt.rows)

  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
