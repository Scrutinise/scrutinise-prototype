/** v26-failed-check.ts — what are the 115 failed + 1717 pending rows? */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  console.log('=== failed by corpus/sourceType ===')
  console.table((await pool.query(
    `select corpus, "sourceType", count(*)::int n from ingest_queue where status='failed'
     group by corpus,"sourceType" order by n desc limit 30`)).rows)
  console.log('=== pending by corpus/sourceType ===')
  console.table((await pool.query(
    `select corpus, "sourceType", count(*)::int n from ingest_queue where status='pending'
     group by corpus,"sourceType" order by n desc limit 30`)).rows)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
