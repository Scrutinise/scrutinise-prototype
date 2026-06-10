/**
 * diag-v18b.ts — V18 §1 follow-ups (read-only):
 *  1. corpus_sections status split (email counts compiled-only)
 *  2. true TNA caselaw extent via getTotalJudgments() vs ingested sections
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { getTotalJudgments } from './sources/tna-caselaw'

async function main() {
  const pool = getNeonPool()

  console.log('=== corpus_sections by status ===')
  const r = await pool.query<{ status: string; n: string }>(
    'SELECT status, COUNT(*)::text AS n FROM corpus_sections GROUP BY status ORDER BY COUNT(*) DESC'
  )
  for (const row of r.rows) console.log(`  ${row.status.padEnd(12)} ${parseInt(row.n, 10).toLocaleString()}`)

  console.log('\n=== tna-caselaw extent ===')
  const sec = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM corpus_sections WHERE corpus = 'tna-caselaw'`
  )
  const ingested = parseInt(sec.rows[0].n, 10)
  console.log(`  ingested sections: ${ingested.toLocaleString()}`)
  const total = await getTotalJudgments()
  console.log(`  TNA reports total judgments: ${total.toLocaleString()}`)
  console.log(`  last needed page: ${Math.ceil(total / 50)}`)
  console.log(`  approx missing: ${(total - ingested).toLocaleString()}`)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
