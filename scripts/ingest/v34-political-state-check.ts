/**
 * v34-political-state-check.ts — BRIEF_INGEST_POLITICAL_SOURCES §0.
 *
 * Reads, never writes. Answers three questions before any code is written:
 *   1. What does the DB actually hold for the division-votes corpora that V28
 *      built code for? (queue rows, corpus_targets, corpus_sections)
 *   2. Is there any collection or corpus_targets row for impact assessments or
 *      consultations? (the reachability matrix says no — verify, don't trust)
 *   3. What sourceTypes / corpora exist today, so a new one does not collide.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const DIVISION_CORPORA = ['commons-divisions-votes', 'lords-divisions-votes', 'lda-commonsdivisions', 'lda-lordsdivisions']

async function main() {
  const pool = getNeonPool()

  console.log('=== 1. DIVISION-VOTES: what V28 left behind ===')
  const q = await pool.query(`
    SELECT corpus, status, COUNT(*)::int AS n
    FROM ingest_queue WHERE corpus = ANY($1) GROUP BY corpus, status ORDER BY corpus, status
  `, [DIVISION_CORPORA])
  console.log(q.rows.length ? q.rows : '  (no ingest_queue rows for any division corpus)')

  const t = await pool.query(`
    SELECT corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason, notes, updated_at
    FROM corpus_targets WHERE corpus_key = ANY($1) ORDER BY corpus_key
  `, [DIVISION_CORPORA])
  console.log('corpus_targets:')
  console.log(t.rows.length ? t.rows : '  (none)')

  const s = await pool.query(`
    SELECT corpus, COUNT(*)::int AS sections FROM corpus_sections
    WHERE corpus = ANY($1) GROUP BY corpus ORDER BY corpus
  `, [DIVISION_CORPORA])
  console.log('corpus_sections:')
  console.log(s.rows.length ? s.rows : '  (none)')

  console.log('\n=== 2. IMPACT ASSESSMENTS / CONSULTATIONS: absent, or just unseeded? ===')
  const like = await pool.query(`
    SELECT 'corpus_targets' AS tbl, corpus_key AS k FROM corpus_targets
      WHERE corpus_key ILIKE '%impact%' OR corpus_key ILIKE '%consult%' OR corpus_key ILIKE '%assessment%'
    UNION ALL
    SELECT 'corpus_sections', corpus FROM (
      SELECT DISTINCT corpus FROM corpus_sections
      WHERE corpus ILIKE '%impact%' OR corpus ILIKE '%consult%' OR corpus ILIKE '%assessment%') x
    UNION ALL
    SELECT 'ingest_queue', corpus FROM (
      SELECT DISTINCT corpus FROM ingest_queue
      WHERE corpus ILIKE '%impact%' OR corpus ILIKE '%consult%' OR corpus ILIKE '%assessment%') y
  `)
  console.log(like.rows.length ? like.rows : '  CONFIRMED ABSENT — no corpus_targets, no sections, no queue rows')

  console.log('\n=== 3. Existing sourceTypes in the queue (so a new one does not collide) ===')
  const st = await pool.query(`SELECT DISTINCT "sourceType" FROM ingest_queue ORDER BY 1`)
  console.log(st.rows.map(r => r.sourceType).join(', '))

  console.log('\n=== 4. Queue health right now (is anything running?) ===')
  const h = await pool.query(`
    SELECT status, COUNT(*)::int AS n FROM ingest_queue GROUP BY status ORDER BY n DESC
  `)
  console.log(h.rows)

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
