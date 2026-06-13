/**
 * seed-judiciaryni-queue.ts — V20 probe 5: NI judicial decisions.
 *
 * ⚠️ RUN ONLY AFTER THE V20 PUSH (sourceType 'judiciaryni' unknown to pre-V20
 * deployed code — playbook §8: seed-after-push).
 *
 * Walks /judicial-decisions?page=0.. until the Drupal 404 (page 396 on
 * 12 Jun 2026 → ~5,900 decisions), checkpointed per page.
 */
import * as fs from 'fs'
import * as path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listNiDecisionsPage } from './sources/judiciaryni'

const CORPUS = 'ni-judgments'
const CHECKPOINT = path.join(__dirname, 'seed-judiciaryni-checkpoint.json')

async function main() {
  const canaryArg = process.argv.indexOf('--canary')
  const canary = canaryArg >= 0 ? Number(process.argv[canaryArg + 1] ?? 2) : 0

  const pool = getNeonPool()
  const ckpt: { page: number; total: number } = !canary && fs.existsSync(CHECKPOINT)
    ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) : { page: 0, total: 0 }

  let emptyStreak = 0
  let complete = false
  for (let page = ckpt.page; ; page++) {
    if (canary && page >= canary) break
    // judiciaryni rate-limits sustained listing walks — retry a failed page
    // after cooling instead of aborting the whole run (V20: two runs stalled
    // at pages 30 and 66 on single transient failures).
    let slugs = await listNiDecisionsPage(page)
    for (let attempt = 1; slugs === null && attempt <= 3; attempt++) {
      console.warn(`[seed] page ${page}: fetch failed — cooling 60s (retry ${attempt}/3)`)
      await new Promise(r => setTimeout(r, 60_000))
      slugs = await listNiDecisionsPage(page)
    }
    if (slugs === null) {
      console.warn(`[seed] page ${page}: still failing after retries — stopping (checkpoint saved, rerun to resume)`)
      break
    }
    if (slugs.length === 0) {
      emptyStreak++
      if (emptyStreak >= 2) { console.log(`[seed] page ${page}: past the end`); complete = true; break }
      continue
    }
    emptyStreak = 0
    const rows = slugs.map(s => ({
      id: `${CORPUS}:${s}`,
      corpus: CORPUS,
      docId: s,
      sourceType: 'judiciaryni',
      priority: 2,
    }))
    const { affected } = await bulkInsertQueueRows(rows)
    ckpt.page = page + 1
    ckpt.total += affected
    if (!canary) fs.writeFileSync(CHECKPOINT, JSON.stringify(ckpt))
    if (page % 20 === 0) console.log(`[seed] page ${page}: +${affected} (total new ${ckpt.total})`)
  }

  console.log(`[seed] ni-judgments: ${ckpt.total} new rows`)
  // V22: est updates only from a FULLY-walked universe (V20 lesson — a stalled
  // run must never clobber the est with a partial count), and from the actual
  // queue-row count, not this run's incremental total.
  if (!canary && complete) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ingest_queue WHERE corpus = $1 AND "docId" NOT LIKE 'list:%'`, [CORPUS])
    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
      VALUES ($1, 'NI Judgments (Judiciary NI)', $2, false, false, NULL)
      ON CONFLICT (corpus_key) DO UPDATE SET est_sections = EXCLUDED.est_sections, blocked = false, blocked_reason = NULL
    `, [CORPUS, rows[0].n])
    console.log(`[targets] ${CORPUS} est=${rows[0].n} (complete walk)`)
  } else if (!canary) {
    console.log('[targets] walk incomplete — est NOT updated (V20 partial-universe rule)')
  }
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
