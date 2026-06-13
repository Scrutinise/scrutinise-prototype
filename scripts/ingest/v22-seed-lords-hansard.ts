/**
 * v22-seed-lords-hansard.ts — V22 §3: Lords Hansard 1919–1999 (S5L vols 33–606).
 *
 * ⚠️ RUN ONLY AFTER THE V22 PUSH. The deployed V21 parser applies the
 * 1919-02-04 cutoff to BOTH houses — under it every S5L vol ≥ 33 parses to
 * 0 items and writes a bogus 'unavailable' marker (playbook §8:
 * seed-after-push). V22 code cuts Lords at 1999-11-17 (first pwdata-lords
 * day; S5L vol 607 starts exactly then — verified 13 Jun 2026).
 *
 * Re-lists S5L under the lifted cap (606, was 32) and seeds the new volumes.
 * Idempotent: vols ≤ 32 already in the queue, ON CONFLICT DO NOTHING.
 *
 * Pilot rates (13 Jun 2026): S5LV0100P0 (1936) 2,408 items / 462k words;
 * S5LV0606P0 (1999) 7,076 items / 806k words → blended ~4k sections/volume
 * for the est increment; ✓ re-baseline at drain.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listHistoricHansardVolumes, HANSARD_SERIES, parseVolumeStem } from './sources/historic-hansard'

const CORPUS = 'historic-hansard'
const CHECKPOINT = path.join(__dirname, 'seed-historic-hansard-checkpoint.json')
const SECTIONS_PER_VOL = 4000 // blended pilot rate (2.4k 1936 ↔ 7.1k 1999)

async function main() {
  if (HANSARD_SERIES.S5L.maxVol !== 606) throw new Error('S5L cap is not 606 — wrong code version?')

  // Re-list S5L under the lifted cap. The V21 checkpoint holds the cap-32
  // listing (27 zips) — drop it so the walk runs fresh, keep other series.
  const listed: Record<string, string[]> = fs.existsSync(CHECKPOINT)
    ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) : {}
  const priorS5L = listed.S5L?.length ?? 0
  delete listed.S5L

  console.log(`[seed] re-listing S5L (cap 606; prior cap-32 listing had ${priorS5L} zips)…`)
  const stems = await listHistoricHansardVolumes('S5L')
  console.log(`[seed] S5L: ${stems.length} volume zips listed`)
  listed.S5L = stems
  fs.writeFileSync(CHECKPOINT, JSON.stringify(listed), 'utf8')

  const newStems = stems.filter(s => (parseVolumeStem(s)?.volume ?? 0) > 32)
  const { affected } = await bulkInsertQueueRows(stems.map(stem => ({
    id: `${CORPUS}:${stem}`,
    corpus: CORPUS,
    docId: stem,
    sourceType: 'historic-hansard',
    priority: 3,
  })))
  console.log(`[seed] ${affected} new queue rows (${newStems.length} above the old cap)`)

  // est increment: new zips × blended pilot rate, on top of the existing est.
  const pool = getNeonPool()
  const inc = newStems.length * SECTIONS_PER_VOL
  await pool.query(`
    UPDATE corpus_targets
    SET est_sections = est_sections + $2, est_is_confirmed = false,
        display_label = 'Historic Hansard 1803-1999',
        notes = 'V21 bulk-archive 1803-1918 (595 zips, est ~850k) + V22 Lords 1919-1999 tranche (' || $3 || ' zips x ~4k blended pilot rate). Per-house pwdata handoffs: Commons 1919-02-04, Lords 1999-11-17 (exact). Re-baseline at drain.'
    WHERE corpus_key = $1`, [CORPUS, inc, newStems.length])
  console.log(`[targets] ${CORPUS} est += ${inc.toLocaleString()} (re-baseline at drain)`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
