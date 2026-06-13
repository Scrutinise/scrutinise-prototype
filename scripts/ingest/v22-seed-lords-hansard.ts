/**
 * v22-seed-lords-hansard.ts — V22 §3: Lords Hansard 1919–1999 (S5L vols 33–606).
 *
 * ⚠️ RUN ONLY AFTER THE V22 PUSH. The deployed V21 parser applies the
 * 1919-02-04 cutoff to BOTH houses — under it every S5L vol ≥ 33 parses to
 * 0 items and writes a bogus 'unavailable' marker (playbook §8:
 * seed-after-push). V22 code cuts Lords at 1999-11-17 (first pwdata-lords
 * day; S5L vol 607 starts exactly then — verified 13 Jun 2026).
 *
 * Seeds S5L under the lifted cap (606, was 32).
 * Idempotent: vols ≤ 32 already in the queue, ON CONFLICT DO NOTHING.
 *
 * V23 — enumeration, not listing walk. The WebForms listing path is CF
 * penalty-boxed for minutes after even a small request burst (the original
 * V22 walk + every V23 retry 403'd, curl and undici alike — CF rate-limits
 * sustained listing walks and the box outlives a 4-min cooloff). But the ZIP
 * path is CF-free (V21 proved it: full seed + Railway canary ran on zip
 * fetches). S5L docIds are deterministic `S5LV{NNNN}P0`; probed 13 Jun 2026 —
 * vols 33/100/300/606 are PK-real, and NO split (`_a/_b`) or multi-part (`P1`)
 * forms exist in the range (S5LV0100P1 + S5LV0040P0_a both soft-404). So we
 * enumerate P0 for vols 33-606 and let the worker's fetchVolumeXml PK-check
 * sort real zips from soft-404 gaps (absent → no-provisions marker, a section
 * row, so a run of gaps can't trip the zero-output breaker). The ~22%
 * digitisation gaps (V21: 595 of 763 nominal) become classified residue,
 * excluded from the ✓ denominator (playbook §1c rule 2).
 *
 * Pilot rates (13 Jun 2026): S5LV0100P0 (1936) 2,408 items / 462k words;
 * S5LV0606P0 (1999) 7,076 items / 806k words → blended ~4k sections/volume
 * for the est increment; ✓ re-baseline at drain.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { HANSARD_SERIES, parseVolumeStem } from './sources/historic-hansard'

const CORPUS = 'historic-hansard'
const CHECKPOINT = path.join(__dirname, 'seed-historic-hansard-checkpoint.json')
const SECTIONS_PER_VOL = 4000 // blended pilot rate (2.4k 1936 ↔ 7.1k 1999)

async function main() {
  if (HANSARD_SERIES.S5L.maxVol !== 606) throw new Error('S5L cap is not 606 — wrong code version?')

  // Enumerate S5L vols 1-606 as P0 stems (the listing walk is CF-blocked — see
  // header). The checkpoint records the enumerated set so the gap-fill seeder's
  // lifted-cap assertion passes.
  const listed: Record<string, string[]> = fs.existsSync(CHECKPOINT)
    ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) : {}
  const priorS5L = listed.S5L?.length ?? 0

  const stems: string[] = []
  for (let v = 1; v <= 606; v++) stems.push(`S5LV${String(v).padStart(4, '0')}P0`)
  console.log(`[seed] enumerated S5L P0 stems 1-606: ${stems.length} (prior checkpoint had ${priorS5L})`)
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
