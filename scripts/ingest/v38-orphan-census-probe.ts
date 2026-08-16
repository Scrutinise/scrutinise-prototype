/**
 * v38-orphan-census-probe.ts — BRIEF_INGEST_V38_STORAGE §4.1, sizing before building. READ-ONLY.
 *
 * S3 put "~23,000 sections of real text held only in the legacy table" — an EXTRAPOLATION from a
 * random n=400 (132 of 350 usable titles found in the corpus, 218 not). This project's own rule
 * about extrapolations is on the record twice: *"an extrapolation from 400 samples is not grounds
 * for flipping 171,700 rows"* (V36), and the V36 pilot that said 6/6 until a random draw said 27.5%.
 * A number that decides whether 1.67 GiB can be dropped should be a census, not an estimate.
 *
 * This probe answers only: how big is the population, and is a full census tractable? It builds
 * nothing.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}
const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const q = async (sql: string, a: any[] = []) => (await pool.query(sql, a)).rows
const n = (v: any) => Number(v).toLocaleString('en-GB')

async function main() {
  head('§4.1a — THE TWO SIDES')
  console.table(await q(`
    SELECT (SELECT COUNT(*) FROM "LegislationSection")::text AS legacy_sections,
           (SELECT COUNT(*) FROM "LegislationItem")::text    AS legacy_instruments,
           (SELECT COUNT(*) FROM corpus_sections)::text      AS corpus_sections`))

  head('§4.1b — WHICH CORPORA HOLD LEGISLATION AT ALL (the census only has to search these)')
  console.table(await q(`
    SELECT corpus, COUNT(*)::text AS sections,
           COUNT(*) FILTER (WHERE "sectionTitle" IS NOT NULL)::text AS with_title
      FROM corpus_sections
     WHERE corpus IN ('primary-acts-2000plus','primary-acts-pre-2000','si-2010plus','si-pre-2010',
                      'retained-eu','regional','draft-si','northern-ireland','scotland','wales')
        OR corpus LIKE 'primary-acts%' OR corpus LIKE 'si-%' OR corpus LIKE '%legislation%'
     GROUP BY 1 ORDER BY 2 DESC`))

  head('§4.1c — PER-INSTRUMENT SHORTFALL (the population §4.1 is about)')
  // The corpus instrument is the middle segment of the section id.
  const rows = await q(`
    WITH legacy AS (
      SELECT li."legislationGovUkId" AS gid, COUNT(*)::int AS legacy_n
        FROM "LegislationSection" ls
        JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
       GROUP BY 1),
    corpus AS (
      SELECT split_part(id, ':', 2) AS gid, COUNT(*)::int AS corpus_n
        FROM corpus_sections
       WHERE id LIKE '%:%:%'
       GROUP BY 1)
    SELECT COUNT(*)::text                                                   AS instruments,
           COUNT(*) FILTER (WHERE COALESCE(c.corpus_n,0) >= l.legacy_n)::text AS covered,
           COUNT(*) FILTER (WHERE COALESCE(c.corpus_n,0) <  l.legacy_n)::text AS short,
           COUNT(*) FILTER (WHERE c.corpus_n IS NULL)::text                 AS absent,
           SUM(GREATEST(l.legacy_n - COALESCE(c.corpus_n,0), 0))::text      AS shortfall_sections
      FROM legacy l LEFT JOIN corpus c ON c.gid = l.gid`)
  console.table(rows)
  console.log(`   ⚠ "absent" here does NOT resolve the regnal/calendar alias, so it overstates.`)
  console.log(`     S3 measured that separately: 1,617 of 1,618 apparent absences were alias artefacts.`)

  head('§4.1d — IS A TITLE CENSUS TRACTABLE?')
  const [t] = await q(`
    SELECT COUNT(*)::text AS titled_corpus_sections
      FROM corpus_sections WHERE "sectionTitle" IS NOT NULL AND "sectionTitle" <> ''`) as any[]
  console.log(`   corpus sections carrying a title: ${n(t.titled_corpus_sections)}`)
  const [l] = await q(`
    SELECT COUNT(*)::text AS titled_legacy
      FROM "LegislationSection" WHERE "sectionTitle" IS NOT NULL AND "sectionTitle" <> ''`) as any[]
  console.log(`   legacy sections carrying a title: ${n(l.titled_legacy)}`)
  console.log(`\n   ⚠ There is NO index on either sectionTitle. A per-row lookup is a seq scan of`)
  console.log(`     ${n(t.titled_corpus_sections)} rows; ${n(l.titled_legacy)} of those is not viable.`)
  console.log(`     A census must do it as ONE hash join over normalised titles, not row by row.`)

  console.log(`\n   how discriminating is a title, though? duplicates in the corpus:`)
  console.table(await q(`
    SELECT COUNT(*)::text AS distinct_titles,
           SUM(c)::text AS rows,
           COUNT(*) FILTER (WHERE c > 1)::text AS titles_used_more_than_once
      FROM (SELECT lower(btrim("sectionTitle")) AS t, COUNT(*) AS c
              FROM corpus_sections
             WHERE "sectionTitle" IS NOT NULL AND "sectionTitle" <> ''
             GROUP BY 1) x`))
  console.log(`   ⚠ A title shared by thousands of sections ("Interpretation", "Citation and`)
  console.log(`     commencement") proves nothing about a specific provision. S3 hit this — 50 of`)
  console.log(`     its 400 had titles "too short to discriminate". A census must scope the match`)
  console.log(`     to the INSTRUMENT, not the whole corpus, or it will find everything everywhere.`)
  await endNeonPool()
}
main().catch((e) => { console.error('[v38-orphan-census-probe] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
