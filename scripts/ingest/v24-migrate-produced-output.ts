/**
 * v24-migrate-produced-output.ts — add ingest_queue.produced_output (V24 §2).
 * Idempotent (ops.ensureTables also runs this). Run now so the column exists
 * before the worker deploy starts writing it.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()
  await pool.query(`ALTER TABLE ingest_queue ADD COLUMN IF NOT EXISTS produced_output boolean`)
  const col = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name='ingest_queue' AND column_name='produced_output'`)
  console.log('produced_output column:', JSON.stringify(col.rows[0] ?? 'MISSING'))
  const nn = await pool.query(`SELECT COUNT(*)::int n FROM ingest_queue WHERE produced_output IS NOT NULL`)
  console.log('rows with non-null produced_output:', nn.rows[0].n)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
