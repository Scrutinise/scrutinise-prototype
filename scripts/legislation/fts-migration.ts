/**
 * V.4-FTS-1: Add tsvector FTS columns, triggers, and GIN indexes to
 * LegislationSection and OperationalSection.
 *
 * Order of operations (per correct index-build strategy):
 *   1. Add tsvector columns
 *   2. Install triggers (keep index current from here on)
 *   3. Backfill existing rows in batches — naturally resumable (WHERE IS NULL)
 *   4. Build GIN indexes on the fully-populated columns
 *
 * Run:
 *   cd scrutinise-web
 *   npx ts-node --project ..\scripts\tsconfig.json ..\scripts\legislation\fts-migration.ts
 *
 * Safe to re-run: columns and triggers are idempotent; backfill skips already-filled rows;
 * index creation drops existing index first.
 */

import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { prisma } from '../../scrutinise-web/lib/prisma'

const BATCH_SIZE = 10_000

// ─────────────────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function log(msg: string) {
  console.log(`[${ts()}] ${msg}`)
}

async function columnType(table: string, column: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ data_type: string }[]>`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = ${table}
      AND column_name  = ${column}
  `
  return rows.length > 0 ? rows[0].data_type : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Add tsvector columns
// ─────────────────────────────────────────────────────────────────────────────

async function addColumns() {
  log('Step 1: Add tsvector columns')

  // LegislationSection — drop placeholder String? column if wrong type, then add tsvector
  const legType = await columnType('LegislationSection', 'ftsVector')
  if (legType === 'tsvector') {
    log('  LegislationSection.ftsVector already tsvector — skipping')
  } else {
    if (legType !== null) {
      log(`  LegislationSection.ftsVector exists as "${legType}" — dropping placeholder`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "LegislationSection" DROP COLUMN "ftsVector"`)
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE "LegislationSection" ADD COLUMN "ftsVector" tsvector`)
    log('  LegislationSection.ftsVector added as tsvector')
  }

  // OperationalSection — add if absent
  const opType = await columnType('OperationalSection', 'ftsVector')
  if (opType === 'tsvector') {
    log('  OperationalSection.ftsVector already tsvector — skipping')
  } else {
    if (opType !== null) {
      log(`  OperationalSection.ftsVector exists as "${opType}" — dropping`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "OperationalSection" DROP COLUMN "ftsVector"`)
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE "OperationalSection" ADD COLUMN "ftsVector" tsvector`)
    log('  OperationalSection.ftsVector added as tsvector')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Install triggers
// ─────────────────────────────────────────────────────────────────────────────

async function installTriggers() {
  log('Step 2: Install FTS triggers')

  // LegislationSection trigger
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_legislation_section_fts()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW."ftsVector" :=
        setweight(to_tsvector('english', coalesce(NEW."sectionTitle", '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW."originalText",  '')), 'B');
      RETURN NEW;
    END;
    $$
  `)
  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_legislation_section_fts ON "LegislationSection"`
  )
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_legislation_section_fts
      BEFORE INSERT OR UPDATE OF "sectionTitle", "originalText"
      ON "LegislationSection"
      FOR EACH ROW EXECUTE FUNCTION update_legislation_section_fts()
  `)
  log('  LegislationSection trigger installed')

  // OperationalSection trigger
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_operational_section_fts()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW."ftsVector" :=
        setweight(to_tsvector('english', coalesce(NEW."pageTitle",     '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW."extractedText", '')), 'B');
      RETURN NEW;
    END;
    $$
  `)
  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_operational_section_fts ON "OperationalSection"`
  )
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_operational_section_fts
      BEFORE INSERT OR UPDATE OF "pageTitle", "extractedText"
      ON "OperationalSection"
      FOR EACH ROW EXECUTE FUNCTION update_operational_section_fts()
  `)
  log('  OperationalSection trigger installed')
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Backfill
// ─────────────────────────────────────────────────────────────────────────────

async function backfillLegislationSection() {
  log('Step 3a: Backfill LegislationSection.ftsVector')

  const totalRes = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "LegislationSection"
  `
  const total = Number(totalRes[0].count)

  const nullRes = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "LegislationSection" WHERE "ftsVector" IS NULL
  `
  const nullCount = Number(nullRes[0].count)

  if (nullCount === 0) {
    log(`  Already fully backfilled (${total.toLocaleString()} rows) — skipping`)
    return
  }

  log(`  Total: ${total.toLocaleString()} rows | Remaining: ${nullCount.toLocaleString()}`)

  const startTime = Date.now()
  let processed = 0
  let batch = 0

  while (true) {
    const affected = await prisma.$executeRawUnsafe(`
      UPDATE "LegislationSection"
      SET "ftsVector" =
        setweight(to_tsvector('english', coalesce("sectionTitle", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("originalText",  '')), 'B')
      WHERE id IN (
        SELECT id FROM "LegislationSection"
        WHERE "ftsVector" IS NULL
        ORDER BY id
        LIMIT ${BATCH_SIZE}
      )
    `)

    if (affected === 0) break

    processed += affected
    batch++
    const pct      = ((processed / nullCount) * 100).toFixed(1)
    const elapsed  = ((Date.now() - startTime) / 1000).toFixed(0)
    const rowsPerS = (processed / ((Date.now() - startTime) / 1000)).toFixed(0)
    log(`  Batch ${batch}: +${affected.toLocaleString()} → ${processed.toLocaleString()} / ${nullCount.toLocaleString()} (${pct}%) — ${elapsed}s @ ${rowsPerS} rows/s`)
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  log(`  Done: ${processed.toLocaleString()} rows in ${totalElapsed}s`)
}

async function backfillOperationalSection() {
  log('Step 3b: Backfill OperationalSection.ftsVector')

  const affected = await prisma.$executeRawUnsafe(`
    UPDATE "OperationalSection"
    SET "ftsVector" =
      setweight(to_tsvector('english', coalesce("pageTitle",     '')), 'A') ||
      setweight(to_tsvector('english', coalesce("extractedText", '')), 'B')
    WHERE "ftsVector" IS NULL
  `)

  log(`  Updated: ${affected} rows`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Build GIN indexes on populated columns
// ─────────────────────────────────────────────────────────────────────────────

async function buildIndexes() {
  log('Step 4: Build GIN indexes')

  // Drop first so re-runs are safe
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "LegislationSection_ftsVector_idx"`
  )
  log('  Building LegislationSection GIN index...')
  const t1 = Date.now()
  await prisma.$executeRawUnsafe(
    `CREATE INDEX "LegislationSection_ftsVector_idx" ON "LegislationSection" USING GIN ("ftsVector")`
  )
  log(`  LegislationSection GIN index built in ${((Date.now() - t1) / 1000).toFixed(1)}s`)

  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "OperationalSection_ftsVector_idx"`
  )
  log('  Building OperationalSection GIN index...')
  const t2 = Date.now()
  await prisma.$executeRawUnsafe(
    `CREATE INDEX "OperationalSection_ftsVector_idx" ON "OperationalSection" USING GIN ("ftsVector")`
  )
  log(`  OperationalSection GIN index built in ${((Date.now() - t2) / 1000).toFixed(1)}s`)
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log('V.4-FTS-1 migration starting')

  await addColumns()
  await installTriggers()
  await backfillLegislationSection()
  await backfillOperationalSection()
  await buildIndexes()

  log('Migration complete ✓')
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(`[${ts()}] Migration failed:`, err)
  await prisma.$disconnect()
  process.exit(1)
})
