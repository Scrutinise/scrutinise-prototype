/**
 * v19-seed-et-decisions.ts — V19 §4: Employment Tribunal decisions (2017+)
 * from gov.uk, the first-instance ET record FCL does not carry.
 *
 * Universe measured live 11 Jun 2026: filter_format=employment_tribunal_decision
 * = 131,668 docs (brief's ~72k was low). Each page: metadata body + decision
 * PDF(s) — the V18 govuk-content processor handles both.
 *
 * gov.uk also exposes employment_appeal_tribunal_decision (2,560) — NOT seeded:
 * FCL's EAT court feed is the canonical, fuller EAT record (V19 §4).
 *
 * Seeded P3 (large; behind tax P1 work). Rate: govuk-content 150ms/10 (V18).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { searchWhere } from './sources/govuk-content'

const CORPUS = 'et-decisions'

async function main() {
  const pool = getNeonPool()

  const ingestedRes = await pool.query<{ d: string }>(
    `SELECT DISTINCT split_part(id, ':', 2) AS d FROM corpus_sections WHERE corpus = $1`, [CORPUS])
  const ingested = new Set(ingestedRes.rows.map(r => r.d))
  console.log(`already ingested: ${ingested.size} docs`)

  let seen = 0
  let inserted = 0
  for await (const hits of searchWhere({ filter_format: 'employment_tribunal_decision' })) {
    const rows = hits
      .map(h => h.link.replace(/^\//, ''))
      .filter(d => !ingested.has(d))
      .map(docId => ({ id: `${CORPUS}:${docId}`, corpus: CORPUS, docId, sourceType: 'govuk-content', priority: 3 }))
    seen += hits.length
    const { affected } = await bulkInsertQueueRows(rows)
    inserted += affected
    process.stdout.write(`\r  enumerated ${seen}, inserted ${inserted}`)
  }
  console.log()

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason)
    VALUES ($1, 'Employment Tribunal Decisions (gov.uk 2017+)', $2, false, 3, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE
      SET display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections,
          priority = EXCLUDED.priority, blocked = false, blocked_reason = NULL
  `, [CORPUS, seen])
  console.log(`DONE — ${inserted} rows seeded at P3 (${seen} enumerated)`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
