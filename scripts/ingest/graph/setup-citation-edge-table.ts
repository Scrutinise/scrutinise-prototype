/**
 * setup-citation-edge-table.ts — create the Neon `citation_edge` table + indexes
 * (Sprint 25-H Task 2). Idempotent. Run once before the extractor.
 *
 *   npx tsx graph/setup-citation-edge-table.ts          — create
 *   npx tsx graph/setup-citation-edge-table.ts --status — row counts + table size only
 *
 * WHY THIS IS NOT `legislation_edges`. That table already holds 121,279 `cites`
 * rows and this one duplicates none of its purpose. Three differences, each of
 * which the brief makes load-bearing:
 *
 *   1. EVERY ROW CARRIES ITS OWN EVIDENCE. `legislation_edges` records that A
 *      cites B and nothing else — there is no way to quote the sentence that
 *      says so. An edge with no quotable source is a claim, not a fact, and a
 *      repeal programme that cannot quote its own inputs has nothing to stand
 *      on. `citation_text` and `raw_fragment` are NOT NULL for that reason.
 *   2. THE RAW URI IS KEPT UNMODIFIED beside the normalised id, so a
 *      normalisation bug is recoverable by re-deriving from `target_uri`
 *      instead of by re-extracting from a 1.4 GB source file.
 *   3. ROWS ARE PER CITATION INSTANCE, not per (from, to) pair. Three sections
 *      of an Act citing the same target is three facts about that Act, and
 *      `legislation_edges`' primary key collapses them to one.
 *
 * ⚠⚠ `detection` IS THE MOST IMPORTANT COLUMN IN THIS TABLE. The audit measured
 * that only **2–5% of body-text mentions of an Act carry <Citation> markup** —
 * 5.4% for the Human Rights Act, 1.8% for the Equality Act, 0% for CRAG itself.
 * A table built from the markup alone is therefore ~2% complete, and would have
 * answered "what refers to CRAG Part 1?" with a confident, short, WRONG list.
 * So rows come from two detectors and each says which it is:
 *   `markup` — a <Citation URI="…"> attribute. The URI is the source's own
 *              assertion of identity. `target_uri` is that attribute verbatim.
 *   `text`   — the Act's NAME in running text, resolved against corpus_acts
 *              titles. `target_uri` is DERIVED from the resolved gid, not read
 *              from the document, and must never be quoted as if it were.
 * Never mix them in a count without saying so. A measured fact and an inferred
 * one must not look identical on the page (docs/CLAUDE.md §19).
 *
 * SIZE DISCIPLINE. Neon measured 18 GB before this table existed, against a
 * 17.5 GB alert line that is already crossed. `raw_fragment` is capped at 600
 * characters and `citation_text` at 300 in the extractor for that reason — long
 * enough to quote and to check by hand, short enough that the table lands in
 * hundreds of megabytes rather than gigabytes. --status reports the real number.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export const CITATION_TABLE = 'citation_edge'

const DDL = `
CREATE TABLE IF NOT EXISTS ${CITATION_TABLE} (
  id                    bigserial PRIMARY KEY,
  source_doc_uri        text NOT NULL,   -- the document containing the reference
  source_provision_ref  text,            -- section/regulation/schedule paragraph; NULL if the citation sits above any provision
  target_uri            text NOT NULL,   -- raw URI from the XML, UNMODIFIED
  target_act_id         text,            -- normalised gid; NULL when the URI names no leg.gov.uk instrument
  target_provision_ref  text,            -- NULL when the source names no provision
  citation_text         text NOT NULL,   -- the literal words in the source
  raw_fragment          text NOT NULL,   -- surrounding XML, for evidence
  resolved              boolean NOT NULL, -- target_act_id names an instrument the corpus holds text for
  source_type           text NOT NULL,   -- primary | SI | other
  source_gid            text NOT NULL,   -- denormalised from source_doc_uri: the dominant join key
  detection             text NOT NULL DEFAULT 'markup', -- markup | text — see below
  extracted_from        text NOT NULL,   -- provenance of the bytes, e.g. best-collection-xml.zip@2026-08-24
  extracted_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citation_edge_source_type_ck CHECK (source_type IN ('primary', 'SI', 'other')),
  CONSTRAINT citation_edge_detection_ck CHECK (detection IN ('markup', 'text'))
);
-- idempotent for a table created before the detection column existed.
-- NOTE: no backticks in this string, ever - it is inside a template literal.
ALTER TABLE ${CITATION_TABLE} ADD COLUMN IF NOT EXISTS detection text NOT NULL DEFAULT 'markup';
DO $$ BEGIN
  ALTER TABLE ${CITATION_TABLE} ADD CONSTRAINT citation_edge_detection_ck CHECK (detection IN ('markup', 'text'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- The dominant query is INBOUND, not outbound: "what points at this Act?"
CREATE INDEX IF NOT EXISTS citation_edge_target_act ON ${CITATION_TABLE} (target_act_id);
CREATE INDEX IF NOT EXISTS citation_edge_target_uri ON ${CITATION_TABLE} (target_uri);
-- inbound(target, provision) filters on both; and the pilot groups by source act
CREATE INDEX IF NOT EXISTS citation_edge_target_prov ON ${CITATION_TABLE} (target_act_id, target_provision_ref);
CREATE INDEX IF NOT EXISTS citation_edge_source_gid  ON ${CITATION_TABLE} (source_gid);
`

async function main() {
  const pool = getNeonPool()
  if (!process.argv.includes('--status')) {
    await pool.query(DDL)
    console.log(`[setup-citation-edge] ${CITATION_TABLE} + 4 indexes ensured`)
  }
  const exists = await pool.query(`SELECT to_regclass('${CITATION_TABLE}') AS t`)
  if (!exists.rows[0].t) { console.log('[setup-citation-edge] table does not exist'); await endNeonPool(); return }
  const stats = await pool.query(`
    SELECT source_type, resolved, COUNT(*)::bigint AS n
    FROM ${CITATION_TABLE} GROUP BY 1, 2 ORDER BY n DESC`)
  const size = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size('${CITATION_TABLE}')) AS sz,
                                        pg_size_pretty(pg_database_size(current_database())) AS db`)
  console.log(`[setup-citation-edge] table size: ${size.rows[0].sz} (database: ${size.rows[0].db})`)
  if (stats.rows.length === 0) console.log('[setup-citation-edge] table empty')
  for (const r of stats.rows) console.log(`  ${r.source_type}\tresolved=${r.resolved}\t${r.n}`)
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[setup-citation-edge] FATAL', e); process.exit(1) })
}
