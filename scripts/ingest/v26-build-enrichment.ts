/**
 * v26-build-enrichment.ts — Migration A.3. Preserves the legacy compilation layer
 * (the only non-duplicated value: AI-compiled-text R2 pointers, Lex-summary R2
 * pointers, unapplied-amendment JSON) as a low-volume enrichment table keyed by
 * (legislationGovUkId, sectionNumber), so the eventual §6 DROP of LegislationSection
 * does not lose the derived product. Pointer-only — NO text copied into the table
 * (V3 rule); the R2 objects the keys reference persist independently.
 *
 * LegislationAmendment/Correction/CrossRef are all empty (measured) — nothing to
 * preserve there. The search/Lex layer joins this to corpus_sections on demand
 * (wiring = search thread, out of scope).
 *
 * Idempotent: CREATE IF NOT EXISTS + TRUNCATE + repopulate. READ from legacy
 * (duplicated on Neon), WRITE the new Neon table.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

async function main() {
  const apply = process.argv.includes('--apply')
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 300_000, query_timeout: 300_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })

  const expected = (await pool.query(`
    SELECT count(*)::int n FROM "LegislationSection"
    WHERE "compiledTextKey" IS NOT NULL OR "lexSummaryKey" IS NOT NULL
       OR "amendmentCount">0 OR "unappliedAmendments" IS NOT NULL`)).rows[0].n
  console.log(`enriched legacy sections to preserve: ${expected}`)

  if (!apply) { console.log('(dry-run — pass --apply to create + populate)'); await pool.end(); return }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS legislation_compilation_enrichment (
      legislation_gov_uk_id text NOT NULL,
      section_number        text NOT NULL,
      compiled_text_key     text,
      lex_summary_key       text,
      unapplied_amendments  jsonb,
      compilation_status    text,
      confidence            text,
      confidence_reason     text,
      compilation_version   integer,
      compiled_at           timestamptz,
      compiled_by           text,
      PRIMARY KEY (legislation_gov_uk_id, section_number)
    )`)
  await pool.query(`TRUNCATE legislation_compilation_enrichment`)

  const ins = await pool.query(`
    INSERT INTO legislation_compilation_enrichment
      (legislation_gov_uk_id, section_number, compiled_text_key, lex_summary_key,
       unapplied_amendments, compilation_status, confidence, confidence_reason,
       compilation_version, compiled_at, compiled_by)
    SELECT li."legislationGovUkId", ls."sectionNumber", ls."compiledTextKey", ls."lexSummaryKey",
           ls."unappliedAmendments", ls."compilationStatus"::text, ls."confidence"::text,
           ls."confidenceReason", ls."compilationVersion", ls."compiledAt", ls."compiledBy"
    FROM "LegislationSection" ls JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
    WHERE ls."compiledTextKey" IS NOT NULL OR ls."lexSummaryKey" IS NOT NULL
       OR ls."amendmentCount">0 OR ls."unappliedAmendments" IS NOT NULL
    ON CONFLICT (legislation_gov_uk_id, section_number) DO NOTHING`)
  console.log(`inserted ${ins.rowCount} enrichment rows`)

  const got = (await pool.query(`SELECT
      count(*)::int n,
      count(*) FILTER (WHERE compiled_text_key IS NOT NULL)::int compiled,
      count(*) FILTER (WHERE lex_summary_key IS NOT NULL)::int summaries,
      count(*) FILTER (WHERE unapplied_amendments IS NOT NULL)::int unapplied
    FROM legislation_compilation_enrichment`)).rows[0]
  console.table([got])
  console.log(got.n === expected ? '✓ row count matches measured enrichment population' : `⚠ mismatch: expected ${expected}, got ${got.n}`)

  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
