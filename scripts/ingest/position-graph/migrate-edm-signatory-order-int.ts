/**
 * migrate-edm-signatory-order-int.ts — ONE-OFF. Widen `edm_signatory.sponsoring_order` from
 * SMALLINT to INTEGER on a database that already has the first version of the table.
 *
 * ⚠ WHY THIS IS A SEPARATE SCRIPT AND NOT A LINE IN THE DDL. `schema-edm-signatures.sql` is the DDL
 * OF RECORD and `setup-edm-signatures.ts` refuses to run any file containing a DROP. The ALTER
 * cannot run while a view references the column — Postgres: *"cannot alter type of a column used by
 * a view or rule"* — so the change needs the three derived views dropped and rebuilt, and a DROP
 * belongs in a named migration that says what it is rather than hidden in the schema.
 *
 * ⚠ WHY THE COLUMN WAS WRONG. `SponsoringOrder` is not 1..n. The API returns **99999** where no
 * order was recorded (motion 44477, signature 294739, read live) and the first --apply pilot died on
 * `value "99999" is out of range for type smallint`.
 *
 * ⚠ THE GUARD. It refuses once the table holds more than the pilot's rows: dropping the views is
 * only cheap while nothing has been loaded, and "run this migration again" is exactly the
 * instruction somebody follows at the wrong moment. The views are DERIVED and are rebuilt by
 * re-running setup-edm-signatures.ts, which this script ends by telling you to do.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/migrate-edm-signatory-order-int.ts            # report, change nothing
 *   npx tsx position-graph/migrate-edm-signatory-order-int.ts --apply
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const APPLY = process.argv.slice(2).includes('--apply')
/** Above this the table is loaded and dropping its views is no longer a trivially safe operation. */
const MAX_ROWS = 5_000
const VIEWS = ['edm_signature_reconciliation', 'graph_edm_signature_edge_all', 'graph_edm_signature_edge']
const pool = getNeonPool()

async function main() {
  const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
  if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
  console.log(`host ${host}`)

  const { rows: [col] } = await pool.query<{ t: string | null }>(
    `SELECT data_type AS t FROM information_schema.columns
      WHERE table_schema='public' AND table_name='edm_signatory' AND column_name='sponsoring_order'`)
  const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM edm_signatory`)
  console.log(`edm_signatory.sponsoring_order is currently ${col?.t ?? '(column missing)'}`)
  console.log(`edm_signatory holds ${Number(c.n).toLocaleString()} rows`)

  if (col?.t === 'integer') { console.log('\n✓ already integer — nothing to do.'); await endNeonPool(); return }
  if (Number(c.n) > MAX_ROWS) {
    console.error(`\n❌ ${Number(c.n).toLocaleString()} rows is past the ${MAX_ROWS.toLocaleString()} guard. This migration is for a`)
    console.error(`   nearly-empty table. Widen the column another way rather than dropping views over a load.`)
    process.exit(1)
  }
  if (!APPLY) { console.log('\nno --apply: nothing changed.'); await endNeonPool(); return }

  // One transaction: the views come back or the type change does not happen.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const v of VIEWS) { await client.query(`DROP VIEW IF EXISTS ${v}`); console.log(`  dropped view ${v}`) }
    await client.query(`ALTER TABLE edm_signatory ALTER COLUMN sponsoring_order TYPE INTEGER`)
    console.log(`  ✓ sponsoring_order → INTEGER`)
    await client.query('COMMIT')
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }

  const { rows: [after] } = await pool.query<{ t: string }>(
    `SELECT data_type AS t FROM information_schema.columns
      WHERE table_schema='public' AND table_name='edm_signatory' AND column_name='sponsoring_order'`)
  console.log(`\nread back: sponsoring_order is ${after.t}`)
  console.log(`⚠ THE THREE VIEWS ARE GONE. Run this next, and it will recreate them:`)
  console.log(`    npx tsx position-graph/setup-edm-signatures.ts`)
  await endNeonPool()
}
main().catch(async (e) => {
  console.error('[migrate-edm-signatory-order-int] FATAL', e instanceof Error ? e.message : e)
  await endNeonPool().catch(() => {}); process.exit(1)
})
