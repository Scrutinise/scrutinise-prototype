/**
 * v26-state-check.ts — read-only snapshot of corpus + queue state for the V26
 * structural sprint. Checks the §1 precondition (V25 seeds drained?) and prints
 * overall queue / corpus_sections health on Neon.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  console.log('=== CONNECTIVITY ===')
  const now = await pool.query('select now() as ts, current_database() as db')
  console.log('Neon OK:', now.rows[0].ts, '/', now.rows[0].db)

  console.log('\n=== INGEST QUEUE — overall by status ===')
  const byStatus = await pool.query(
    `select status, count(*)::int n from ingest_queue group by status order by n desc`
  )
  console.table(byStatus.rows)

  console.log('\n=== V25 corpora — queue status breakdown ===')
  const v25 = await pool.query(
    `select corpus, status, count(*)::int n
       from ingest_queue
      where corpus in ('senedd-cofnod','bills-api','college-of-policing','inquiry-reports')
      group by corpus, status
      order by corpus, status`
  )
  console.table(v25.rows)

  console.log('\n=== Any tripped breakers / blocked rows by corpus ===')
  const blocked = await pool.query(
    `select corpus, count(*)::int n from ingest_queue where status in ('blocked')
      group by corpus order by n desc limit 20`
  )
  console.table(blocked.rows)

  console.log('\n=== corpus_sections — V25 corpora compiled counts ===')
  const sections = await pool.query(
    `select corpus, count(*)::int n, coalesce(sum("wordCount"),0)::bigint words
       from corpus_sections
      where corpus in ('senedd-cofnod','bills-api','college-of-policing','inquiry-reports')
      group by corpus order by corpus`
  )
  console.table(sections.rows)

  console.log('\n=== corpus_sections — total rows ===')
  const total = await pool.query(`select count(*)::bigint n from corpus_sections`)
  console.log('corpus_sections total:', total.rows[0].n)

  await endNeonPool()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
