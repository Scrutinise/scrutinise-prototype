/**
 * One-time migration: create corpus_snapshots table on Neon.
 * Run: NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *        --tsconfig scripts/tsconfig.json scripts/ingest/migrations/create-corpus-snapshots.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch {}
import { Pool } from 'pg'

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  await pool.query(`
    CREATE TABLE IF NOT EXISTS corpus_snapshots (
      id            BIGSERIAL PRIMARY KEY,
      hour          TIMESTAMPTZ NOT NULL,
      corpus_key    TEXT NOT NULL,
      section_count INTEGER NOT NULL,
      compiled_count INTEGER NOT NULL DEFAULT 0,
      source        TEXT NOT NULL DEFAULT 'corpus_sections',
      captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (hour, corpus_key)
    )
  `)
  console.log('corpus_snapshots table created (or already exists)')

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_snapshots_hour ON corpus_snapshots(hour DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_snapshots_corpus ON corpus_snapshots(corpus_key, hour DESC)`)
  console.log('indexes created')

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM corpus_snapshots`)
  console.log(`corpus_snapshots row count: ${rows[0].n}`)

  await pool.end()
}

main().catch((e: any) => { console.error('[migration] fatal:', e.message); process.exit(1) })
