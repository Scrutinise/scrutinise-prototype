/**
 * seed-nao-queue.ts — V20 probe 7: NAO reports via WP REST API.
 *
 * ⚠️ RUN ONLY AFTER THE V20 PUSH (sourceType 'nao' unknown to pre-V20 code).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listNaoReports } from './sources/nao'

const CORPUS = 'nao-reports'

async function main() {
  const pool = getNeonPool()
  const reports = await listNaoReports()
  if (reports.length === 0) throw new Error('NAO enumeration returned 0 — refusing to seed')

  const rows = reports.map(r => ({
    id: `${CORPUS}:${r.slug}`,
    corpus: CORPUS,
    docId: r.slug,
    sourceType: 'nao',
    priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] nao-reports: ${affected} new rows of ${reports.length}`)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
    VALUES ($1, 'NAO Reports', $2, false, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = EXCLUDED.est_sections, est_is_confirmed = false, blocked = false, blocked_reason = NULL, retired = false
  `, [CORPUS, reports.length])
  console.log(`[targets] nao-reports est=${reports.length}`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
