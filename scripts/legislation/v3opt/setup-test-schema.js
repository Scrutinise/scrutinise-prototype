const pg = require('C:/Code/scrutinise-prototype/scrutinise-web/node_modules/pg')
require('dotenv').config({ path: 'C:/Code/scrutinise-prototype/scrutinise-web/.env' })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // 1. Create enum types in v3opt_test
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'v3opt_test' AND t.typname = 'LegislationType') THEN
        CREATE TYPE "v3opt_test"."LegislationType" AS ENUM ('UKPGA','UKSI','UKLA','ASP','SSI','ANAW','WSI','NIER','EUR','OTHER');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'v3opt_test' AND t.typname = 'LegislationTier') THEN
        CREATE TYPE "v3opt_test"."LegislationTier" AS ENUM ('TIER_1','TIER_2','TIER_3','TIER_4');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'v3opt_test' AND t.typname = 'CompilationStatus') THEN
        CREATE TYPE "v3opt_test"."CompilationStatus" AS ENUM ('PENDING','COMPILING','COMPILED','FAILED','NEEDS_REVIEW','PRINT_ONLY');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'v3opt_test' AND t.typname = 'DocumentSourceType') THEN
        CREATE TYPE "v3opt_test"."DocumentSourceType" AS ENUM ('STATUTE','STATUTORY_GUIDANCE','ADMINISTRATIVE_GUIDANCE','EXPLANATORY','PARLIAMENTARY','JUDICIAL','FINANCIAL_DOCUMENT');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'v3opt_test' AND t.typname = 'CompilationConfidence') THEN
        CREATE TYPE "v3opt_test"."CompilationConfidence" AS ENUM ('HIGH','MEDIUM','LOW');
      END IF;
    END
    $$
  `)
  console.log('Enum types ensured in v3opt_test')

  // 2. For each enum column: unconditionally drop default → alter type
  //    (We don't restore defaults for sourceType — it's nullable, never set in ingest)
  const cols = [
    { table: 'LegislationItem', col: 'legislationType',  type: 'LegislationType',     restoreDefault: null },
    { table: 'LegislationItem', col: 'tier',             type: 'LegislationTier',      restoreDefault: null },
    { table: 'LegislationItem', col: 'compilationStatus',type: 'CompilationStatus',    restoreDefault: 'PENDING' },
    { table: 'LegislationItem', col: 'sourceType',       type: 'DocumentSourceType',   restoreDefault: null },
    { table: 'LegislationSection', col: 'compilationStatus', type: 'CompilationStatus', restoreDefault: 'PENDING' },
    { table: 'LegislationSection', col: 'confidence',    type: 'CompilationConfidence', restoreDefault: null },
    { table: 'LegislationSection', col: 'sourceType',    type: 'DocumentSourceType',   restoreDefault: null },
  ]

  for (const { table, col, type, restoreDefault } of cols) {
    const fqType = `"v3opt_test"."${type}"`
    // Always try to drop default (no-ops if there isn't one)
    try { await pool.query(`ALTER TABLE "v3opt_test"."${table}" ALTER COLUMN "${col}" DROP DEFAULT`) } catch (_) {}
    try {
      await pool.query(`
        ALTER TABLE "v3opt_test"."${table}"
          ALTER COLUMN "${col}" TYPE ${fqType}
          USING "${col}"::text::${fqType}
      `)
      console.log(`  ✓ Altered ${table}.${col} → v3opt_test.${type}`)
    } catch (e) {
      console.log(`  ! ${table}.${col}: ${e.message.slice(0, 120)}`)
    }
    if (restoreDefault !== null) {
      await pool.query(`ALTER TABLE "v3opt_test"."${table}" ALTER COLUMN "${col}" SET DEFAULT '${restoreDefault}'::"v3opt_test"."${type}"`)
    }
  }

  // 3. Final check
  const result = await pool.query(`
    SELECT table_name, column_name, udt_schema, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'v3opt_test' AND data_type = 'USER-DEFINED'
    ORDER BY table_name, column_name
  `)
  console.log('\nFinal column types:')
  let allOk = true
  for (const r of result.rows) {
    const ok = r.udt_schema === 'v3opt_test'
    if (!ok) allOk = false
    console.log(`  ${ok ? '✓' : '✗'} ${r.table_name}.${r.column_name}: ${r.udt_schema}.${r.udt_name}`)
  }
  if (!allOk) { console.error('\nSome columns still reference public types.'); process.exit(1) }
  console.log('\nAll columns use v3opt_test types. Ready for pilot.')
}

main().then(() => pool.end())
  .catch(e => { console.error('FATAL:', e.message); pool.end(); process.exit(1) })
