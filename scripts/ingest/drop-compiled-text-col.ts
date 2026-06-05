/**
 * drop-compiled-text-col.ts
 * Part 4: Updates the FTS trigger (removing compiledText reference) then drops the column.
 * STOP: only run after migration AND backfill are both confirmed complete.
 *
 * Usage:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/drop-compiled-text-col.ts
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })

  // 4a: Replace trigger function — remove compiledText reference.
  // Existing ftsVector values (built during migration) are preserved in place.
  // New rows get null ftsVector; FTS over compiled content is deferred to semantic embeddings.
  console.log('[drop] Updating corpus_sections_fts_update() to remove compiledText reference...')
  await pool.query(`
    CREATE OR REPLACE FUNCTION corpus_sections_fts_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RETURN NEW;
    END;
    $$
  `)

  // Drop and recreate trigger without the UPDATE OF "compiledText" clause
  await pool.query(`DROP TRIGGER IF EXISTS corpus_sections_fts_trigger ON corpus_sections`)
  await pool.query(`
    CREATE TRIGGER corpus_sections_fts_trigger
      BEFORE INSERT OR UPDATE ON corpus_sections
      FOR EACH ROW EXECUTE FUNCTION corpus_sections_fts_update()
  `)
  console.log('[drop] Trigger updated.')

  // 4b: Drop compiledText column
  console.log('[drop] Dropping compiledText column from Neon corpus_sections...')
  await pool.query(`ALTER TABLE corpus_sections DROP COLUMN IF EXISTS "compiledText"`)
  console.log('[drop] compiledText column dropped.')

  // Confirm
  const r = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'corpus_sections' AND column_name = 'compiledText'
  `)
  if (r.rows.length === 0) {
    console.log('[drop] Confirmed: compiledText column no longer exists.')
  } else {
    console.error('[drop] ERROR: compiledText column still exists!')
  }

  await pool.end()
}

main().catch(e => { console.error('[drop] fatal:', e.message); process.exit(1) })
