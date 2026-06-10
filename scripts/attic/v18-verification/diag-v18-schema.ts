/** diag-v18-schema.ts — corpus_sections columns + twfy-pwdata rate limit (read-only) */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()
  const cols = await pool.query<{ column_name: string; data_type: string }>(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'corpus_sections' ORDER BY ordinal_position
  `)
  console.log('corpus_sections columns:')
  for (const c of cols.rows) console.log(`  ${c.column_name}  (${c.data_type})`)

  const rl = await pool.query(`SELECT * FROM source_rate_limits WHERE "sourceKey" = 'twfy-pwdata'`)
  console.log('\ntwfy-pwdata rate limit row:', JSON.stringify(rl.rows[0] ?? null))

  const sz = await pool.query<{ s: string }>(`SELECT pg_size_pretty(pg_database_size(current_database())) AS s`)
  console.log('Neon DB size:', sz.rows[0].s)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
