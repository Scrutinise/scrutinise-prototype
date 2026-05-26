/**
 * neon-fts-setup.ts — FTS and pgvector setup for the Neon search DB.
 *
 * Run AFTER `prisma db push --url NEON_DATABASE_URL` has created the schema.
 * Safe to re-run: all operations are idempotent.
 *
 * What this script does:
 *   1. Create legislation_english text search configuration (copy of 'english')
 *      — When a PostgreSQL thesaurus file is available on the server, alter this
 *        config using apply-fts-config.sql. On managed PG (Neon), synonym expansion
 *        is handled at the application layer in lib/search.ts instead.
 *   2. Replace tsvector columns if they were created with wrong type by Prisma
 *   3. Install FTS triggers using legislation_english on LegislationSection
 *      and OperationalSection
 *   4. Create GIN indexes on ftsVector columns
 *   5. Enable pgvector extension
 *   6. Add embedding vector(768) column to LegislationSection (nullable —
 *      populated in V.4-FTS-2 semantic search sprint)
 *
 * Run:
 *   cd scrutinise-web
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/legislation/neon-fts-setup.ts
 */

import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { prismaSearch } from '../../scrutinise-web/lib/prisma-search'

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}
function log(msg: string) { console.log(`[${ts()}] ${msg}`) }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function columnType(table: string, column: string): Promise<string | null> {
  const rows = await prismaSearch.$queryRaw<{ data_type: string }[]>`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = ${table}
      AND column_name  = ${column}
  `
  return rows.length > 0 ? rows[0].data_type : null
}

async function indexExists(indexName: string): Promise<boolean> {
  const rows = await prismaSearch.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ${indexName}
    ) AS exists
  `
  return rows[0].exists
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Create legislation_english text search configuration
// ─────────────────────────────────────────────────────────────────────────────

async function createFtsConfig() {
  log('Step 1: Create legislation_english FTS configuration')

  // Check if it already exists
  const existing = await prismaSearch.$queryRaw<{ cfgname: string }[]>`
    SELECT cfgname FROM pg_ts_config WHERE cfgname = 'legislation_english'
  `

  if (existing.length > 0) {
    log('  legislation_english already exists — skipping')
    return
  }

  // Create as a copy of 'english' — extends the standard configuration.
  // To add thesaurus synonym matching on a self-hosted PostgreSQL server, run
  // apply-fts-config.sql after placing legislation_synonyms.ths in
  // $PGDATA/../share/tsearch_data/. On managed PG (Neon), synonym expansion
  // is handled at the application layer in lib/search.ts.
  await prismaSearch.$executeRawUnsafe(
    `CREATE TEXT SEARCH CONFIGURATION legislation_english ( COPY = english )`
  )
  log('  legislation_english created (copy of english)')
  log('  NOTE: To enable thesaurus synonyms, run apply-fts-config.sql on a')
  log('        self-hosted PostgreSQL after placing legislation_synonyms.ths')
  log('        in $PGDATA/../share/tsearch_data/.')
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Ensure tsvector columns exist
// ─────────────────────────────────────────────────────────────────────────────

async function ensureTsvectorColumns() {
  log('Step 2: Verify tsvector columns')

  const legType = await columnType('LegislationSection', 'ftsVector')
  if (legType === 'tsvector') {
    log('  LegislationSection.ftsVector: tsvector ✓')
  } else if (legType !== null) {
    // Prisma created it with wrong type — drop and re-add
    log(`  LegislationSection.ftsVector is "${legType}" — dropping and re-adding as tsvector`)
    await prismaSearch.$executeRawUnsafe(`ALTER TABLE "LegislationSection" DROP COLUMN "ftsVector"`)
    await prismaSearch.$executeRawUnsafe(`ALTER TABLE "LegislationSection" ADD COLUMN "ftsVector" tsvector`)
    log('  LegislationSection.ftsVector: tsvector ✓ (re-created)')
  } else {
    log('  LegislationSection.ftsVector: missing — adding')
    await prismaSearch.$executeRawUnsafe(`ALTER TABLE "LegislationSection" ADD COLUMN "ftsVector" tsvector`)
    log('  LegislationSection.ftsVector: tsvector ✓')
  }

  const opType = await columnType('OperationalSection', 'ftsVector')
  if (opType === 'tsvector') {
    log('  OperationalSection.ftsVector: tsvector ✓')
  } else if (opType !== null) {
    log(`  OperationalSection.ftsVector is "${opType}" — dropping and re-adding as tsvector`)
    await prismaSearch.$executeRawUnsafe(`ALTER TABLE "OperationalSection" DROP COLUMN "ftsVector"`)
    await prismaSearch.$executeRawUnsafe(`ALTER TABLE "OperationalSection" ADD COLUMN "ftsVector" tsvector`)
    log('  OperationalSection.ftsVector: tsvector ✓ (re-created)')
  } else {
    log('  OperationalSection.ftsVector: missing — adding')
    await prismaSearch.$executeRawUnsafe(`ALTER TABLE "OperationalSection" ADD COLUMN "ftsVector" tsvector`)
    log('  OperationalSection.ftsVector: tsvector ✓')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Install FTS triggers using legislation_english configuration
// ─────────────────────────────────────────────────────────────────────────────

async function installTriggers() {
  log('Step 3: Install FTS triggers (legislation_english configuration)')

  // LegislationSection trigger
  await prismaSearch.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_legislation_section_fts()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW."ftsVector" :=
        setweight(to_tsvector('legislation_english', coalesce(NEW."sectionTitle", '')), 'A') ||
        setweight(to_tsvector('legislation_english', coalesce(NEW."originalText",  '')), 'B');
      RETURN NEW;
    END;
    $$
  `)
  await prismaSearch.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_legislation_section_fts ON "LegislationSection"`
  )
  await prismaSearch.$executeRawUnsafe(`
    CREATE TRIGGER trg_legislation_section_fts
      BEFORE INSERT OR UPDATE OF "sectionTitle", "originalText"
      ON "LegislationSection"
      FOR EACH ROW EXECUTE FUNCTION update_legislation_section_fts()
  `)
  log('  LegislationSection trigger installed')

  // OperationalSection trigger
  await prismaSearch.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_operational_section_fts()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW."ftsVector" :=
        setweight(to_tsvector('legislation_english', coalesce(NEW."pageTitle",     '')), 'A') ||
        setweight(to_tsvector('legislation_english', coalesce(NEW."extractedText", '')), 'B');
      RETURN NEW;
    END;
    $$
  `)
  await prismaSearch.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_operational_section_fts ON "OperationalSection"`
  )
  await prismaSearch.$executeRawUnsafe(`
    CREATE TRIGGER trg_operational_section_fts
      BEFORE INSERT OR UPDATE OF "pageTitle", "extractedText"
      ON "OperationalSection"
      FOR EACH ROW EXECUTE FUNCTION update_operational_section_fts()
  `)
  log('  OperationalSection trigger installed')
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Create GIN indexes
// ─────────────────────────────────────────────────────────────────────────────

async function buildGinIndexes() {
  log('Step 4: Build GIN indexes')

  // LegislationSection GIN index
  // Prisma db push may have already created this via @@index([ftsVector], type: Gin)
  const legIdxExists = await indexExists('LegislationSection_ftsVector_idx')
  if (legIdxExists) {
    log('  LegislationSection_ftsVector_idx: already exists ✓')
  } else {
    const t1 = Date.now()
    log('  Building LegislationSection GIN index...')
    await prismaSearch.$executeRawUnsafe(
      `CREATE INDEX "LegislationSection_ftsVector_idx" ON "LegislationSection" USING GIN ("ftsVector")`
    )
    log(`  LegislationSection GIN index built in ${((Date.now() - t1) / 1000).toFixed(1)}s ✓`)
  }

  // OperationalSection GIN index
  const opIdxExists = await indexExists('OperationalSection_ftsVector_idx')
  if (opIdxExists) {
    log('  OperationalSection_ftsVector_idx: already exists ✓')
  } else {
    const t2 = Date.now()
    log('  Building OperationalSection GIN index...')
    await prismaSearch.$executeRawUnsafe(
      `CREATE INDEX "OperationalSection_ftsVector_idx" ON "OperationalSection" USING GIN ("ftsVector")`
    )
    log(`  OperationalSection GIN index built in ${((Date.now() - t2) / 1000).toFixed(1)}s ✓`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Enable pgvector extension
// ─────────────────────────────────────────────────────────────────────────────

async function enablePgVector() {
  log('Step 5: Enable pgvector extension')

  await prismaSearch.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`)
  log('  pgvector extension: enabled ✓')
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Add embedding column to LegislationSection
// ─────────────────────────────────────────────────────────────────────────────

async function addEmbeddingColumn() {
  log('Step 6: Add embedding column to LegislationSection')

  const embType = await columnType('LegislationSection', 'embedding')
  if (embType !== null) {
    log(`  LegislationSection.embedding: already exists (type: ${embType}) ✓`)
    return
  }

  // vector(768) — nullable. Will be populated in V.4-FTS-2 semantic search sprint
  // using Gemini text-embedding-004 (768 dimensions).
  await prismaSearch.$executeRawUnsafe(
    `ALTER TABLE "LegislationSection" ADD COLUMN IF NOT EXISTS embedding vector(768)`
  )
  log('  LegislationSection.embedding: vector(768) added (nullable, populated in V.4-FTS-2) ✓')
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary: report key indexes and columns
// ─────────────────────────────────────────────────────────────────────────────

async function reportState() {
  log('Summary: Neon schema state')

  const indexes = await prismaSearch.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (indexname LIKE '%ftsVector%' OR indexname LIKE '%embedding%')
    ORDER BY indexname
  `
  for (const idx of indexes) {
    log(`  Index: ${idx.indexname}`)
  }

  const cols = await prismaSearch.$queryRaw<{ column_name: string; data_type: string; udt_name: string }[]>`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'LegislationSection'
      AND column_name IN ('ftsVector', 'embedding')
    ORDER BY column_name
  `
  for (const col of cols) {
    const typeStr = col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type
    log(`  Column LegislationSection.${col.column_name}: ${typeStr}`)
  }

  const tscfg = await prismaSearch.$queryRaw<{ cfgname: string; cfgowner: string }[]>`
    SELECT cfgname, pg_get_userbyid(cfgowner) AS cfgowner
    FROM pg_ts_config
    WHERE cfgname = 'legislation_english'
  `
  if (tscfg.length > 0) {
    log(`  TS config: legislation_english (owner: ${tscfg[0].cfgowner}) ✓`)
  }

  const triggers = await prismaSearch.$queryRaw<{ trigger_name: string; event_object_table: string }[]>`
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name LIKE 'trg_%_fts'
    ORDER BY event_object_table
  `
  for (const t of triggers) {
    log(`  Trigger: ${t.trigger_name} on ${t.event_object_table}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log('V.4-FTS-3 Neon FTS setup starting')

  await createFtsConfig()
  await ensureTsvectorColumns()
  await installTriggers()
  await buildGinIndexes()
  await enablePgVector()
  await addEmbeddingColumn()
  await reportState()

  log('Neon FTS setup complete ✓')
  await prismaSearch.$disconnect()
}

main().catch(async err => {
  console.error(`[${ts()}] Setup failed:`, err)
  await prismaSearch.$disconnect().catch(() => {})
  process.exit(1)
})
