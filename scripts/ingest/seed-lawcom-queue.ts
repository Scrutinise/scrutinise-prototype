/**
 * seed-lawcom-queue.ts — V20 probe 4: Law Commission E&W publications.
 *
 * ⚠️ RUN ONLY AFTER THE V20 PUSH (sourceType 'lawcom' unknown to pre-V20 code).
 *
 * Enumerates via the WordPress REST API (240 publications, 12 Jun 2026) and
 * seeds one row per publication slug.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listLawcomPublications } from './sources/lawcom'

const CORPUS = 'lawcom'

async function main() {
  const pool = getNeonPool()
  const pubs = await listLawcomPublications()
  if (pubs.length === 0) throw new Error('lawcom enumeration returned 0 — refusing to seed')

  const rows = pubs.map(p => ({
    id: `${CORPUS}:${p.slug}`,
    corpus: CORPUS,
    docId: p.slug,
    sourceType: 'lawcom',
    priority: 2,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] lawcom: ${affected} new rows of ${pubs.length} publications`)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
    VALUES ($1, 'Law Commission (E&W)', $2, false, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = EXCLUDED.est_sections, blocked = false, blocked_reason = NULL
  `, [CORPUS, pubs.length])
  console.log(`[targets] lawcom est=${pubs.length}`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
