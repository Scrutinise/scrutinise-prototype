/**
 * v28-title-extract.ts — V28 §1.3 (TIME-CRITICAL, pre-DROP gate).
 *
 * Carries sectionTitle (and a first-approximation itemDate) into the legislation
 * & caselaw rows of corpus_sections BEFORE the V26 §6 DROP deletes the legacy
 * `LegislationSection` table (~25 Jun). Section headings ("Power to enter
 * premises") are high-signal for ranking; the search thread re-indexes to pick
 * them up.
 *
 * WHAT THE LEGACY TABLE ACTUALLY HOLDS (verified 19 Jun 2026):
 *  - LegislationSection.sectionTitle  — present for 760,919 (gid, sectionNumber)
 *    pairs across 75,451 gids. THIS is the title source.
 *  - LegislationItem.enactmentDate    — 0 / 135,531 populated; LegislationSection
 *    has no date-of-law column either. So itemDate is NOT recoverable from the
 *    legacy table (the brief's premise was optimistic). We derive itemDate from
 *    the gid year instead (ukpga/1988/50 → 1988-01-01), which is accurate and
 *    covers 92% of legislation rows + the caselaw neutral-citation year.
 *
 * JOIN: corpus_sections id = "{corpus}:{gid}:{sectionRef}". gid carries no ':'
 * so split_part(id,':',2)=gid, split_part(id,':',3)=sectionRef. Match
 *   sectionRef 'section-{N}'  ↔ legacy sectionNumber '{N}'
 *   sectionRef 'article-{N}'  ↔ legacy sectionNumber 'Article {N}'
 * The 1.16M schedule/paragraph sub-unit rows have no legacy equivalent (the
 * legacy compile pipeline worked at section granularity) — expected partial
 * coverage (~19% gain titles; reported).
 *
 * Uses a DEDICATED pool with statement_timeout 600s and NO 60s client
 * query_timeout (the shared pool's cap would kill these multi-100k UPDATEs —
 * the same timeout class as the V27 §1 / V28 §2 ops bug). Per-corpus batching
 * keeps each statement bounded.
 *
 *   --measure   report projected coverage, change nothing
 *   --apply     run the title + itemDate UPDATEs (idempotent: only NULL targets)
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const LEG_CORPORA = [
  'primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus',
  'regional', 'retained-eu', 'eur-lex', 'explanatory-notes', 'explanatory-memoranda',
]

function pool(): Pool {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 4,
    statement_timeout: 600_000,   // 10 min — these are 100k–420k-row UPDATEs
    // no client query_timeout: the shared pool's 60s cap is what we're avoiding
    keepAlive: true,
  })
}

// Materialize the legacy (gid, sectionNumber) → title map once into a temp table
// so each per-corpus title UPDATE is a fast indexed join, not a re-scan of 914k
// legacy rows. Dedup: one arbitrary title per (gid, sectionNumber).
const BUILD_LEG_TEMP = `
  CREATE TEMP TABLE _leg_titles ON COMMIT DROP AS
    SELECT li."legislationGovUkId" AS gid,
           ls."sectionNumber" AS secnum,
           (array_agg(ls."sectionTitle"))[1] AS title
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
    WHERE ls."sectionTitle" IS NOT NULL AND ls."sectionTitle" <> ''
      AND ls."sectionNumber" NOT LIKE '%object Object%'
    GROUP BY 1, 2;
  CREATE INDEX ON _leg_titles (gid, secnum);
`

async function measure() {
  const p = pool()
  const c = await p.connect()
  try {
    const tot = await c.query(`SELECT COUNT(*)::text n FROM corpus_sections WHERE corpus = ANY($1)`, [LEG_CORPORA])
    await c.query('BEGIN')
    await c.query(BUILD_LEG_TEMP)
    const m = await c.query(`
      SELECT COUNT(*)::text matched FROM corpus_sections cs JOIN _leg_titles l
        ON split_part(cs.id,':',2)=l.gid
       AND (split_part(cs.id,':',3)='section-'||l.secnum
            OR split_part(cs.id,':',3)='article-'||lower(regexp_replace(l.secnum,'^Article ','')))
      WHERE cs.corpus = ANY($1) AND cs."sectionTitle" IS NULL`, [LEG_CORPORA])
    await c.query('ROLLBACK')
    console.log(`legislation rows: ${tot.rows[0].n}; projected title matches: ${m.rows[0].matched}`)
  } finally { c.release(); await p.end() }
}

async function apply() {
  const p = pool()
  const c = await p.connect()
  let titled = 0, dated = 0, caseDated = 0
  try {
    // ── Titles: one transaction, temp map, per-corpus UPDATEs ──────────────────
    await c.query('BEGIN')
    await c.query(BUILD_LEG_TEMP)
    for (const corpus of LEG_CORPORA) {
      const r = await c.query(`
        UPDATE corpus_sections cs SET "sectionTitle" = l.title
        FROM _leg_titles l
        WHERE cs.corpus = $1 AND cs."sectionTitle" IS NULL
          AND split_part(cs.id,':',2)=l.gid
          AND (split_part(cs.id,':',3)='section-'||l.secnum
               OR split_part(cs.id,':',3)='article-'||lower(regexp_replace(l.secnum,'^Article ','')))
      `, [corpus])
      console.log(`  titles ${corpus}: +${r.rowCount}`)
      titled += r.rowCount ?? 0
    }
    await c.query('COMMIT')

    // ── itemDate (legislation) from gid year, per corpus, NULL only ────────────
    for (const corpus of LEG_CORPORA) {
      const r = await c.query(`
        UPDATE corpus_sections
        SET "itemDate" = make_date(
          (substring(split_part(id,':',2) from '/([0-9]{4})/'))::int, 1, 1)
        WHERE corpus = $1 AND "itemDate" IS NULL
          AND substring(split_part(id,':',2) from '/([0-9]{4})/') IS NOT NULL
      `, [corpus])
      console.log(`  itemDate ${corpus}: +${r.rowCount}`)
      dated += r.rowCount ?? 0
    }

    // ── itemDate (caselaw) from the neutral-citation year [YYYY] ───────────────
    // tna-caselaw id = "tna-caselaw:[2003] EWCA Civ 1768:1". Other caselaw
    // corpora already carry itemDate (et-decisions/echr/ni-judgments).
    const rc = await c.query(`
      UPDATE corpus_sections
      SET "itemDate" = make_date(
        (substring(split_part(id,':',2) from '\\[([0-9]{4})\\]'))::int, 1, 1)
      WHERE corpus = 'tna-caselaw' AND "itemDate" IS NULL
        AND substring(split_part(id,':',2) from '\\[([0-9]{4})\\]') IS NOT NULL
    `)
    caseDated = rc.rowCount ?? 0
    console.log(`  itemDate tna-caselaw: +${caseDated}`)
  } catch (e) {
    try { await c.query('ROLLBACK') } catch { /* */ }
    throw e
  } finally { c.release() }

  // ── Coverage report ─────────────────────────────────────────────────────────
  const c2 = await p.connect()
  try {
    const cov = await c2.query(`
      SELECT corpus, COUNT(*)::text n,
             COUNT("sectionTitle")::text titled, COUNT("itemDate")::text dated
      FROM corpus_sections WHERE corpus = ANY($1) OR corpus = 'tna-caselaw'
      GROUP BY corpus ORDER BY corpus`, [LEG_CORPORA])
    console.log('\n=== §1.3 coverage after apply ===')
    let tn = 0, tt = 0
    for (const r of cov.rows) {
      const pct = (100 * Number(r.titled) / Number(r.n)).toFixed(1)
      console.log(`  ${r.corpus}\t${r.n}\ttitled=${r.titled} (${pct}%)\tdated=${r.dated}`)
      tn += Number(r.n); tt += Number(r.titled)
    }
    console.log(`\nTITLE coverage (leg+caselaw): ${tt}/${tn} = ${(100*tt/tn).toFixed(1)}%`)
    console.log(`Applied: ${titled} titles, ${dated} legislation dates, ${caseDated} caselaw dates`)
  } finally { c2.release(); await p.end() }
}

async function main() {
  if (process.argv.includes('--apply')) await apply()
  else await measure()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
