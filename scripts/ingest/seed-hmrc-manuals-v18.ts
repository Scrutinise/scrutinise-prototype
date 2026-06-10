/**
 * seed-hmrc-manuals-v18.ts — V18 §4: full-depth HMRC manuals corpus.
 *
 * ⚠️ RUN ONLY AFTER THE V18 PUSH — rows use the new 'govuk-content' sourceType;
 * the pre-V18 worker skips unknown sourceTypes.
 *
 * Enumerates every hmrc_manual_section via the GOV.UK search API (85,197 on
 * 10 Jun 2026 — the brief's ~626k estimate was stale; this number is live from
 * the API) and seeds one queue row per manual section page at P2. Dedup
 * against corpus_sections; rerun-safe.
 *
 * Also upserts:
 *  - source_rate_limits 'govuk-content': 150ms interval, 10 concurrent.
 *    Reasoning: GOV.UK asks integrators to stay under ~10 rps sustained;
 *    150ms ≈ 6.7 rps leaves headroom for the web app's other gov.uk calls.
 *  - corpus_targets 'hmrc-manuals' with the live search total as est.
 *
 * Run (pwsh):
 *   $env:NODE_PATH = 'scrutinise-web/node_modules'
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-hmrc-manuals-v18.ts
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { searchByFormat } from './sources/govuk-content'

const CORPUS = 'hmrc-manuals'

async function main() {
  const pool = getNeonPool()

  await pool.query(`
    INSERT INTO source_rate_limits ("sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "isComplete", "updatedAt")
    VALUES ('govuk-content', 150, 10, false, false, NOW())
    ON CONFLICT ("sourceKey") DO UPDATE
      SET "intervalMs" = 150, "maxConcurrentWorkers" = 10, "isComplete" = false, suspended = false, "updatedAt" = NOW()
  `)
  console.log('rate limit: govuk-content 150ms / 10 concurrent')

  const ingestedRes = await pool.query<{ id: string }>(
    `SELECT id FROM corpus_sections WHERE corpus = $1`, [CORPUS]
  )
  const ingested = new Set(ingestedRes.rows.map(r => r.id.split(':')[1]))
  console.log(`already ingested: ${ingested.size} docs`)

  let seen = 0
  let inserted = 0
  for await (const hits of searchByFormat('hmrc_manual_section')) {
    const rows = hits
      .map(h => h.link.replace(/^\//, ''))
      .filter(docId => !ingested.has(docId))
      .map(docId => ({
        id: `${CORPUS}:${docId}`,
        corpus: CORPUS,
        docId,
        sourceType: 'govuk-content',
        priority: 2,
      }))
    seen += hits.length
    const { affected } = await bulkInsertQueueRows(rows)
    inserted += affected
    process.stdout.write(`\r  enumerated ${seen}, inserted ${inserted}`)
  }
  console.log()

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
    VALUES ($1, 'HMRC Manuals (full depth)', $2, false, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE
      SET display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections, blocked = false, blocked_reason = NULL
  `, [CORPUS, seen])
  console.log(`corpus_targets: ${CORPUS} est ${seen}`)
  console.log(`\nDONE — ${inserted} rows seeded at P2 (${seen} enumerated, ${seen - inserted} already present/ingested)`)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
