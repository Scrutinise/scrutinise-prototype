/**
 * diag-v17.ts — pre-build state check for the V17 consolidation sprint.
 * Read-only against Neon. Prints queue state, column types, rate limits.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 })

  const [byStatus, byCorpus, colTypes, rateLimits, lockRows] = await Promise.all([
    pool.query(`SELECT status, COUNT(*)::int AS n FROM ingest_queue GROUP BY status ORDER BY n DESC`),
    pool.query(`SELECT corpus, "sourceType", status, COUNT(*)::int AS n FROM ingest_queue WHERE status IN ('pending','claimed','failed') GROUP BY corpus, "sourceType", status ORDER BY corpus, status`),
    pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ingest_queue' ORDER BY ordinal_position`),
    pool.query(`SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "isComplete" FROM source_rate_limits ORDER BY "sourceKey"`),
    pool.query(`SELECT id, process_id, locked_at FROM scheduler_lock ORDER BY id`),
  ])

  console.log('\n[queue by status]')
  for (const r of byStatus.rows) console.log(`  ${r.status.padEnd(12)} ${r.n}`)

  console.log('\n[pending/claimed/failed by corpus]')
  for (const r of byCorpus.rows) console.log(`  ${r.corpus.padEnd(34)} ${r.sourceType.padEnd(22)} ${r.status.padEnd(10)} ${r.n}`)

  console.log('\n[ingest_queue columns]')
  for (const r of colTypes.rows) console.log(`  ${r.column_name.padEnd(22)} ${r.data_type}`)

  console.log('\n[source_rate_limits]')
  for (const r of rateLimits.rows) console.log(`  ${r.sourceKey.padEnd(24)} interval=${String(r.intervalMs).padEnd(7)} cap=${String(r.maxConcurrentWorkers).padEnd(4)} suspended=${r.suspended} complete=${r.isComplete}`)

  console.log('\n[scheduler_lock]')
  for (const r of lockRows.rows) console.log(`  id=${r.id} process=${r.process_id} at=${r.locked_at}`)

  const sections = await pool.query(`SELECT COUNT(*)::int AS n FROM corpus_sections`)
  console.log(`\n[corpus_sections total] ${sections.rows[0].n}`)

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
