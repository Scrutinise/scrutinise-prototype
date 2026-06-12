/**
 * seed-historic-hansard-queue.ts — V21 §2: Historic Hansard 1803–1918 from
 * the Parliament bulk archive (per-volume hansard_v12 XML zips).
 *
 * ⚠️ RUN ONLY AFTER THE V21 PUSH (sourceType 'historic-hansard' unknown to
 * pre-V21 deployed code — playbook §8 seed-after-push: old workers markSkipped
 * unknown sourceTypes).
 *
 * Enumerates all six series listings (WebForms postback pagination, ~80 pages
 * at 1000ms — the host soft-404s unknown paths, so the LISTING is the
 * universe). S5 capped at Commons vol 111 / Lords vol 32: vols 112/33 start
 * 1919-02-04, the first pwdata-debates day. Checkpointed per series.
 *
 *   --canary N   seed only the first N volumes of S1 (no corpus_targets write)
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listHistoricHansardVolumes, HANSARD_SERIES } from './sources/historic-hansard'

const CORPUS = 'historic-hansard'
const CHECKPOINT = path.join(__dirname, 'seed-historic-hansard-checkpoint.json')

// V20 probe estimate: ~763 volumes ≈ ~1.1M sections. Refined by the V21 §2
// pilot: S1V0001P0 measured sections/volume drive the corpus_targets est until
// drain re-baselines it.
const EST_SECTIONS = 1_100_000

async function main() {
  const canaryArg = process.argv.indexOf('--canary')
  const canary = canaryArg >= 0 ? Number(process.argv[canaryArg + 1] ?? 3) : 0

  let listed: Record<string, string[]> = {}
  if (fs.existsSync(CHECKPOINT)) {
    listed = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'))
    console.log(`[seed] resuming — series already listed: ${Object.keys(listed).join(', ') || 'none'}`)
  }

  const seriesKeys = canary ? ['S1'] : Object.keys(HANSARD_SERIES)
  for (const key of seriesKeys) {
    if (listed[key]) continue
    console.log(`[seed] listing ${key} (${HANSARD_SERIES[key].dir})…`)
    const stems = await listHistoricHansardVolumes(key)
    console.log(`[seed] ${key}: ${stems.length} volume zips`)
    listed[key] = stems
    fs.writeFileSync(CHECKPOINT, JSON.stringify(listed), 'utf8')
  }

  let stems = seriesKeys.flatMap(k => listed[k])
  if (canary) stems = stems.slice(0, canary)

  const rows = stems.map(stem => ({
    id: `${CORPUS}:${stem}`,
    corpus: CORPUS,
    docId: stem,
    sourceType: 'historic-hansard',
    priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] ${affected} new queue rows (${rows.length} listed${canary ? ', CANARY' : ''})`)

  if (!canary) {
    const pool = getNeonPool()
    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason, notes)
      VALUES ($1, 'Historic Hansard 1803-1918', $2, false, 3, false, NULL,
              'V21: bulk archive volume zips (hansard_v12 XML). Est from V20 sizing probe (~763 vols, S1V1 sample); re-baseline at drain. Hands off to pwdata-debates at 1919-02-04. Lords 1919-1999 remains a separate known hole.')
      ON CONFLICT (corpus_key) DO UPDATE
        SET est_sections = EXCLUDED.est_sections, notes = EXCLUDED.notes,
            blocked = false, blocked_reason = NULL, updated_at = NOW()
    `, [CORPUS, EST_SECTIONS])
    console.log(`[targets] ${CORPUS} est=${EST_SECTIONS} (~, V20 probe; re-baseline at drain)`)
  }
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
