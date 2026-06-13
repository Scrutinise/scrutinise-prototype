/**
 * v22-seed-hansard-gapfill.ts — V22 §4: HTML gap-fill rows for volumes absent
 * from the bulk archive.
 *
 * ⚠️ RUN ONLY AFTER THE V22 PUSH (sourceType historic-hansard-html unknown to
 * pre-V22 code) AND AFTER v22-seed-lords-hansard.ts (the S5L bulk listing in
 * the checkpoint must reflect the lifted 606 cap, or this script would seed
 * gap rows for Lords volumes the bulk archive actually holds).
 *
 * Method (measured 13 Jun 2026): per series, diff nominal vols 1..cap against
 * (a) the bulk-archive listing (seeder checkpoint) and (b) the HTML site's
 * series index. Bulk-missing ∩ html-present → one gapvol:{series}:{vol} row
 * each; the processor enumerates sitting days from there. Bulk-missing ∩
 * html-absent are genuine digitisation gaps — counted, not seeded (1803–1918
 * measurement: 114 fillable of 170 missing; S1/S2 wholly unfillable).
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { HANSARD_SERIES, HTML_SERIES_CODE, parseVolumeStem } from './sources/historic-hansard'

const CORPUS = 'historic-hansard'
const CHECKPOINT = path.join(__dirname, 'seed-historic-hansard-checkpoint.json')
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
// blended v12 per-volume rate for the 1803–1918 era (V21 canary ~1.2k, later
// series fatter); html gap volumes are era-peers of their series
const SECTIONS_PER_VOL = 1400

// nominal caps per series: S1–S4 full nominal extent; S5 capped at the
// per-house pwdata handoff volume
const NOMINAL_CAPS: Record<string, number> = { S1: 41, S2: 25, S3: 356, S4: 199, S5C: 111, S5L: 606 }

async function main() {
  const listed: Record<string, string[]> = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'))
  if (!listed.S5L || !listed.S5L.some(s => (parseVolumeStem(s)?.volume ?? 0) > 32)) {
    throw new Error('S5L checkpoint still reflects the old cap-32 listing — run v22-seed-lords-hansard.ts first')
  }

  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []
  let totalMissing = 0; let totalFillable = 0
  for (const [key, cap] of Object.entries(NOMINAL_CAPS)) {
    const code = HTML_SERIES_CODE[key]
    const res = await fetch(`https://api.parliament.uk/historic-hansard/volumes/${code}`,
      { redirect: 'follow', headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`series index ${key}: HTTP ${res.status}`)
    const html = await res.text()
    const re = new RegExp(`href="/historic-hansard/volumes/${code}/([0-9]+)"`, 'g')
    const htmlVols = new Set([...html.matchAll(re)].map(m => Number(m[1])).filter(v => v <= cap))
    const bulkVols = new Set((listed[key] ?? []).map(s => parseVolumeStem(s)?.volume ?? 0))
    const missing = [...Array(cap).keys()].map(i => i + 1).filter(v => !bulkVols.has(v))
    const fillable = missing.filter(v => htmlVols.has(v))
    totalMissing += missing.length; totalFillable += fillable.length
    console.log(`[gap] ${key}: ${missing.length} missing from bulk, ${fillable.length} fillable via HTML`)
    for (const v of fillable) {
      rows.push({
        id: `${CORPUS}:gapvol:${key}:${v}`,
        corpus: CORPUS,
        docId: `gapvol:${key}:${v}`,
        sourceType: 'historic-hansard-html',
        priority: 3,
      })
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] ${affected} new gapvol rows (${totalFillable} fillable of ${totalMissing} missing)`)

  const pool = getNeonPool()
  const inc = totalFillable * SECTIONS_PER_VOL
  await pool.query(`
    UPDATE corpus_targets
    SET est_sections = est_sections + $2, est_is_confirmed = false
    WHERE corpus_key = $1`, [CORPUS, inc])
  console.log(`[targets] ${CORPUS} est += ${inc.toLocaleString()} (gap-fill, ~${SECTIONS_PER_VOL}/vol; re-baseline at drain)`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
