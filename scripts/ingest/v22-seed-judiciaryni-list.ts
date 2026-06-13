/**
 * v22-seed-judiciaryni-list.ts — V22 §1.2: queue-driven NI listing rows.
 *
 * ⚠️ RUN ONLY AFTER THE V22 PUSH (list:page: form needs the new
 * processJudiciaryNiList — playbook §8: seed-after-push).
 *
 * The host's per-IP listing budget is ~30 pages/session (local walks cut at
 * p66 12 Jun, p96 13 Jun). Seeds list:page:{N} rows for the unwalked pages —
 * Railway claim loops drip one listing fetch per claim within the (V22-halved)
 * source budget. Also restores the est the 13 Jun partial walk clobbered.
 */
import * as fs from 'fs'
import * as path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

const CORPUS = 'ni-judgments'
const CHECKPOINT = path.join(__dirname, 'seed-judiciaryni-checkpoint.json')
const LAST_PAGE = 396 // Drupal 404 at 396 on 12 Jun 2026 (~15 decisions/page)

async function main() {
  const pool = getNeonPool()
  const ckpt: { page: number } = fs.existsSync(CHECKPOINT)
    ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) : { page: 0 }

  const rows = []
  for (let p = ckpt.page; p <= LAST_PAGE; p++) {
    rows.push({
      id: `${CORPUS}:list:page:${p}`,
      corpus: CORPUS,
      docId: `list:page:${p}`,
      sourceType: 'judiciaryni',
      priority: 1, // listing before decisions — pages feed the item backlog
    })
  }
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] ${affected} of ${rows.length} list rows (pages ${ckpt.page}..${LAST_PAGE})`)

  // Restore the universe est (the 13 Jun partial walk wrote 1,879):
  // ~396 listing pages × ~15 decisions ≈ ~5,900 (V20 measurement).
  await pool.query(`
    UPDATE corpus_targets
    SET est_sections = 5900, est_is_confirmed = false,
        notes = 'V20 measured ~396 listing pages x ~15 ≈ 5,900 decisions; listing queue-driven V22 (host per-IP budget ~30 pages/session). Re-baseline at drain.'
    WHERE corpus_key = $1`, [CORPUS])
  console.log('[targets] ni-judgments est restored to ~5,900 (unconfirmed)')
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
