/**
 * v22-pilot-lords-hansard.ts — V22 §3: pilot the Lords 1919–1999 tranche
 * (predict-measure-commit) before lifting the seed.
 *
 * Parses two S5L volumes through the production code path:
 *  - S5LV0100P0 (~1936): mid-tranche shape/rate sample.
 *    PREDICTION (recorded 13 Jun 2026): 800–2,000 items, 150–500k words.
 *  - S5LV0606P0 (Oct–Nov 1999): the cutoff volume — verifies every item date
 *    sits BELOW the 1999-11-17 Lords cutoff (vol 607 starts on it).
 *
 * Parse-only: the zip→parse→item path is V21 production code; the V22 change
 * is per-house cutoffs + the lifted cap, which is exactly what this measures.
 */
import { fetchVolumeXml, parseHansardV12Items, HISTORIC_HANSARD_LORDS_CUTOFF } from './sources/historic-hansard'

async function pilotVolume(docId: string) {
  console.log(`\n=== ${docId} ===`)
  const t0 = Date.now()
  const xml = await fetchVolumeXml(docId)
  if (!xml) { console.log('SOFT-404 — volume absent'); return }
  const items = parseHansardV12Items(xml)
  const ms = Date.now() - t0

  const withSpeaker = items.filter(i => i.speaker).length
  const withHeading = items.filter(i => i.heading).length
  const words = items.reduce((a, i) => a + i.text.split(/\s+/).length, 0)
  const dates = items.map(i => i.itemDate).filter((d): d is string => !!d).sort()
  const houses = new Set(items.map(i => i.house))

  console.log(`xml ${(xml.length / 1e6).toFixed(1)} MB | ${ms} ms fetch+parse`)
  console.log(`items ${items.length} | with speaker ${withSpeaker} | heading coverage ${(100 * withHeading / items.length).toFixed(1)}%`)
  console.log(`words ${words.toLocaleString()}`)
  console.log(`dates ${dates[0]} → ${dates[dates.length - 1]} | houses: ${[...houses].join(',')}`)
  const over = dates.filter(d => d >= HISTORIC_HANSARD_LORDS_CUTOFF)
  console.log(`items ≥ lords cutoff (${HISTORIC_HANSARD_LORDS_CUTOFF}): ${over.length} ${over.length === 0 ? '✓' : '⚠️ CHECK'}`)
  for (const probe of ['£', '—', 'é', '§']) {
    if (items.some(i => i.text.includes(probe))) console.log(`fidelity: contains ${probe}`)
  }
}

async function main() {
  await pilotVolume('S5LV0100P0')
  await new Promise(r => setTimeout(r, 5000))
  await pilotVolume('S5LV0606P0')
}

main().catch(e => { console.error(e); process.exit(1) })
