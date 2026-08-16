/**
 * probe-2d2.ts — bytes before hypotheses, for BRIEF_GRAPH_2D2.
 *
 * Reads only. Answers, with counts rather than impressions:
 *   §1  what is actually in `divisions` / `division_votes`, and how much of it joins the graph
 *   §2  what person ids we hold and where a sweep could get more
 *   §3  what the EDM rows look like — is `speaker` really 100% populated
 *   §4  are consultation responders structured, or prose
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-2d2.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()

async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
  return rows as T[]
}

function head(s: string) { console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 76 - s.length))}`) }

async function tableExists(t: string): Promise<boolean> {
  const r = await q<{ e: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS e`, [t])
  return r[0].e
}

async function cols(t: string) {
  return q<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t])
}

async function main() {
  const url = process.env.NEON_DATABASE_URL ?? ''
  console.log(`host  ${/@([^/:?]+)/.exec(url)?.[1] ?? '(unparsed)'}`)
  const who = await q<{ db: string }>(`SELECT current_database() AS db`)
  console.log(`db    ${who[0].db}`)

  // ── §0 what tables are even here ──────────────────────────────────────────
  head('§0 TABLES')
  for (const t of ['divisions', 'division_votes', 'stage_outcomes', 'graph_entity', 'graph_alias',
                   'graph_edge', 'graph_evidence', 'graph_merge_log', 'corpus_sections', 'corpus_targets']) {
    if (!(await tableExists(t))) { console.log(`  ${t.padEnd(20)} MISSING`); continue }
    const n = await q<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`)
    console.log(`  ${t.padEnd(20)} ${n[0].n.padStart(12)}`)
  }

  // ── §1 divisions ──────────────────────────────────────────────────────────
  head('§1 DIVISIONS AND VOTES')
  if (await tableExists('divisions')) {
    console.table(await q(`SELECT house, COUNT(*)::int AS divisions,
        MIN(division_date) AS first, MAX(division_date) AS last,
        COUNT(*) FILTER (WHERE bill_title IS NOT NULL)::int AS with_bill,
        COUNT(*) FILTER (WHERE stage IS NOT NULL)::int AS with_stage,
        COUNT(*) FILTER (WHERE amendment IS NOT NULL)::int AS with_amendment
      FROM divisions GROUP BY house ORDER BY house`))
    console.log('  context_provenance:')
    console.table(await q(`SELECT house, context_provenance, COUNT(*)::int AS n FROM divisions GROUP BY 1,2 ORDER BY 1,3 DESC`))
  }
  if (await tableExists('division_votes')) {
    console.table(await q(`SELECT house, vote, COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE teller)::int AS tellers,
        COUNT(DISTINCT member_id)::int AS members,
        MIN(division_date) AS first, MAX(division_date) AS last
      FROM division_votes GROUP BY 1,2 ORDER BY 1,2`))
    console.log('  distinct members overall / with a NULL date / party populated:')
    console.table(await q(`SELECT COUNT(DISTINCT member_id)::int AS members,
        COUNT(*) FILTER (WHERE division_date IS NULL)::int AS null_date,
        COUNT(*) FILTER (WHERE party IS NULL)::int AS null_party,
        COUNT(*) FILTER (WHERE constituency IS NULL)::int AS null_constituency
      FROM division_votes`))
    console.log('  orphan votes (no matching divisions row):')
    console.table(await q(`SELECT COUNT(*)::int AS orphan_votes FROM division_votes v
      WHERE NOT EXISTS (SELECT 1 FROM divisions d WHERE d.house=v.house AND d.division_id=v.division_id)`))
    console.log('  sample rows:')
    console.table(await q(`SELECT * FROM division_votes ORDER BY division_date DESC LIMIT 5`))
  }

  // ── the join: division members against graph people ───────────────────────
  head('§1b JOIN AGAINST THE GRAPH')
  if (await tableExists('graph_entity')) {
    console.table(await q(`SELECT kind, key_source, COUNT(*)::int AS n, ROUND(AVG(confidence)::numeric,3) AS avg_conf
      FROM graph_entity GROUP BY 1,2 ORDER BY 1,3 DESC`))
    console.table(await q(`SELECT
        (SELECT COUNT(*)::int FROM graph_entity WHERE kind='person' AND parl_member_id IS NOT NULL) AS people_with_member_id,
        (SELECT COUNT(DISTINCT member_id)::int FROM division_votes) AS distinct_voters,
        (SELECT COUNT(DISTINCT v.member_id)::int FROM division_votes v
           JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind='person') AS voters_already_keyed`))
    console.log('  vote rows covered by an existing keyed person:')
    console.table(await q(`SELECT COUNT(*)::int AS covered_vote_rows FROM division_votes v
      WHERE EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id=v.member_id AND e.kind='person')`))
    console.log('  how many division members match an EXISTING person row by normalised name only:');
    console.table(await q(`SELECT COUNT(*)::int AS distinct_member_names FROM (SELECT DISTINCT member_name FROM division_votes) x`))
  }

  // ── §2 person id sources ──────────────────────────────────────────────────
  head('§2 PERSON ID SOURCES')
  console.table(await q(`SELECT corpus, COUNT(*)::int AS sections FROM corpus_sections
    WHERE corpus LIKE '%hansard%' OR corpus LIKE 'pwdata%' OR corpus LIKE '%debate%'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20`))
  console.log('  corpus_sections columns:')
  console.table(await cols('corpus_sections'))

  // ── §3 EDMs ───────────────────────────────────────────────────────────────
  head('§3 EARLY DAY MOTIONS')
  const edmCorpora = await q<{ corpus: string; n: string }>(
    `SELECT corpus, COUNT(*)::text AS n FROM corpus_sections
     WHERE corpus ILIKE '%day-motion%' OR corpus ILIKE '%edm%' GROUP BY 1 ORDER BY 2 DESC`)
  console.table(edmCorpora)
  if (edmCorpora.length) {
    const c = edmCorpora[0].corpus
    console.table(await q(`SELECT COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE speaker IS NOT NULL AND speaker <> '')::int AS with_speaker,
        COUNT(DISTINCT speaker)::int AS distinct_speakers,
        COUNT(*) FILTER (WHERE "itemDate" IS NOT NULL)::int AS with_date,
        MIN("itemDate") AS first, MAX("itemDate") AS last
      FROM corpus_sections WHERE corpus=$1`, [c]))
    console.log('  sample:')
    console.table(await q(`SELECT id, speaker, LEFT("sectionTitle",60) AS title, "itemDate", "sourceUrl", "parentDocId"
      FROM corpus_sections WHERE corpus=$1 ORDER BY "itemDate" DESC LIMIT 5`, [c]))
    console.log('  top speakers:')
    console.table(await q(`SELECT speaker, COUNT(*)::int AS n FROM corpus_sections
      WHERE corpus=$1 GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, [c]))
    console.log('  how many EDM speakers already match a keyed person by member name?')
    console.table(await q(`SELECT COUNT(DISTINCT speaker)::int AS distinct_edm_speakers FROM corpus_sections WHERE corpus=$1`, [c]))
  }

  // ── §4 consultations ──────────────────────────────────────────────────────
  head('§4 CONSULTATIONS')
  const cons = await q<{ corpus: string; n: string }>(
    `SELECT corpus, COUNT(*)::text AS n FROM corpus_sections
     WHERE corpus ILIKE '%consult%' GROUP BY 1 ORDER BY 2 DESC`)
  console.table(cons)
  for (const cc of cons) {
    console.log(`  ── ${cc.corpus}`)
    console.table(await q(`SELECT COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE speaker IS NOT NULL AND speaker<>'')::int AS with_speaker,
        COUNT(DISTINCT "parentDocId")::int AS parents,
        COUNT(*) FILTER (WHERE format IS NOT NULL)::int AS with_format
      FROM corpus_sections WHERE corpus=$1`, [cc.corpus]))
    console.table(await q(`SELECT format, COUNT(*)::int AS n FROM corpus_sections WHERE corpus=$1 GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, [cc.corpus]))
    console.table(await q(`SELECT id, LEFT("sectionTitle",70) AS title, speaker, "itemDate", LEFT("sourceUrl",90) AS url, LEFT(notes,80) AS notes
      FROM corpus_sections WHERE corpus=$1 LIMIT 6`, [cc.corpus]))
  }

  // ── §5 member_id namespace: is it shared across houses? ───────────────────
  head('§5 MEMBER_ID NAMESPACE')
  console.log('  member_ids appearing in BOTH houses (a collision would break the key):')
  console.table(await q(`SELECT member_id, COUNT(DISTINCT house)::int AS houses,
      STRING_AGG(DISTINCT member_name, ' | ') AS names
    FROM division_votes GROUP BY member_id HAVING COUNT(DISTINCT house) > 1 LIMIT 10`))
  console.log('  member_ids with more than one distinct name (name change vs collision):')
  console.table(await q(`SELECT COUNT(*)::int AS ids_with_multiple_names FROM (
      SELECT member_id FROM division_votes GROUP BY member_id HAVING COUNT(DISTINCT member_name) > 1) x`))
  console.table(await q(`SELECT member_id, STRING_AGG(DISTINCT member_name, ' | ') AS names
    FROM division_votes GROUP BY member_id HAVING COUNT(DISTINCT member_name) > 1 LIMIT 10`))

  await endNeonPool()
}
main().catch((e) => { console.error('[probe-2d2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
