/**
 * v24-unification-inventory.ts — read-only §6 inventory for UNIFICATION_PLAN.md.
 * Queries Neon (the legacy LegislationSection is duplicated here, so this avoids
 * Railway connection pressure). Establishes legacy-vs-corpus_sections overlap so
 * the conversion/dedup plan is grounded in current numbers.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  console.log('=== LegislationSection (legacy) ===')
  const ls = await pool.query(`
    SELECT COUNT(*)::int n,
      COUNT(*) FILTER (WHERE "originalText" IS NOT NULL)::int has_text,
      COUNT(*) FILTER (WHERE "compiledTextKey" IS NOT NULL)::int has_compiled_key,
      COUNT(*) FILTER (WHERE "originalXmlKey" IS NOT NULL)::int has_orig_xml,
      COUNT(*) FILTER (WHERE "tnaXmlKey" IS NOT NULL)::int has_tna_xml,
      COUNT(*) FILTER (WHERE "lexSummaryKey" IS NOT NULL)::int has_lex
    FROM "LegislationSection"`)
  console.log(JSON.stringify(ls.rows[0], null, 0))

  console.log('\n=== LegislationItem by type ===')
  const li = await pool.query(`
    SELECT "legislationType" t, COUNT(*)::int items, SUM("sectionCount")::int secs
    FROM "LegislationItem" GROUP BY "legislationType" ORDER BY items DESC`)
  for (const r of li.rows) console.log(`${r.t}\titems=${r.items}\tdeclared_sections=${r.secs}`)

  console.log('\n=== corpus_sections legislation corpora (current) ===')
  const cs = await pool.query(`
    SELECT corpus, COUNT(*)::int n, COUNT(*) FILTER (WHERE status='compiled')::int compiled
    FROM corpus_sections
    WHERE corpus IN ('primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010',
      'si-2010plus','regional','retained-eu','eur-lex')
    GROUP BY corpus ORDER BY corpus`)
  for (const r of cs.rows) console.log(`${r.corpus}\t${r.n}\tcompiled=${r.compiled}`)

  // Overlap probe: sample 2000 legacy items, map legislationGovUkId → which
  // corpus_sections docId prefix exists. Tells us how much of the legacy table
  // the new pipeline already re-ingested (the dedup candidate set).
  console.log('\n=== overlap: legacy items already present in corpus_sections (sample 2000) ===')
  const ov = await pool.query(`
    WITH samp AS (
      SELECT "legislationGovUkId" gid FROM "LegislationItem" ORDER BY random() LIMIT 2000
    )
    SELECT
      COUNT(*)::int sampled,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM corpus_sections cs
        WHERE cs.id LIKE '%:' || s.gid || ':%'
      ))::int present_in_corpus
    FROM samp s`)
  console.log(JSON.stringify(ov.rows[0], null, 0))

  console.log('\n=== app-table row counts (Neon copies; Railway is source of truth) ===')
  const app = await pool.query(`
    SELECT relname, n_live_tup::int rows
    FROM pg_stat_user_tables
    WHERE relname IN ('User','Idea','Comment','Vote','LegislationItem','LegislationSection',
      'OperationalSection','OperationalDocument','LegislationAmendment','IdeaLegislation')
    ORDER BY rows DESC`)
  for (const r of app.rows) console.log(`${r.relname}\t${r.rows}`)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
