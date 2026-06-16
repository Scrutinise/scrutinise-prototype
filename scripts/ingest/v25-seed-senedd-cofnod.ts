/**
 * v25-seed-senedd-cofnod.ts — V25 §2. Senedd Plenary Cofnod (Record of
 * Proceedings) via record.senedd.wales. One queue row per plenary meeting
 * (docId = "{meetingId}", sourceType senedd-cofnod); the worker fetches
 * /Plenary/{id} and emits one section per English speaker-turn.
 *
 * Enumeration: the meeting-id space is walked and classified by redirect
 * (/Meeting/{id} → /Plenary/{id} = plenary). The on-site search is JS-driven and
 * unreliable for bulk listing, so we scan ids — record.senedd.wales is a plain
 * IIS-class host (no Cloudflare), so a concurrency-limited redirect-only scan is
 * cheap.
 *
 * Modes (predict-measure-commit, INGEST_PLAYBOOK):
 *   (default)        dry-run — density sample over the id range, print the
 *                    estimated plenary universe.
 *   --pilot N        find + fetch the N most-recent plenaries, measure
 *                    sections/words, extrapolate over the estimated universe. No seed.
 *   --pilot-id ID    pilot one specific meeting id.
 *   --seed           full scan of the id range; insert all plenary rows.
 *                    POST-PUSH only (live worker markSkips an unknown sourceType).
 *   --max-id N       override the scan ceiling (default: auto-probe).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { classifyMeeting, fetchPlenary } from './sources/senedd-cofnod'

const CORPUS = 'senedd-cofnod'
const SRC = 'senedd-cofnod'
const DEFAULT_MAX = 16100      // 10/06/2026 = id 16073; small headroom
const SCAN_CONC = 3            // politeness — conc 6 provoked host throttling (V25 first run)

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

// Concurrency-limited classify over [lo, hi]. onPlenary(id) per plenary found.
// Any id that returns 'error' (transient, after classifyMeeting's own retries) is
// collected and re-scanned serially at the end — never dropped, so throttling
// can't false-negative a real plenary (the V25 first-run failure mode).
async function scanRange(lo: number, hi: number, onPlenary: (id: number) => void, onProgress?: (done: number, found: number) => void) {
  const ids: number[] = []
  for (let i = hi; i >= lo; i--) ids.push(i)  // newest first
  let done = 0, found = 0, cursor = 0
  const errors: number[] = []
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++]
      const kind = await classifyMeeting(id)
      done++
      if (kind === 'plenary') { found++; onPlenary(id) }
      else if (kind === 'error') errors.push(id)
      if (onProgress && done % 250 === 0) onProgress(done, found)
    }
  }
  await Promise.all(Array.from({ length: SCAN_CONC }, () => worker()))

  // serial retry pass for transient errors
  if (errors.length) {
    console.log(`[senedd] retrying ${errors.length} transient-error ids serially…`)
    let stillErr = 0
    for (const id of errors) {
      const kind = await classifyMeeting(id, 5)
      if (kind === 'plenary') { found++; onPlenary(id) }
      else if (kind === 'error') stillErr++
    }
    if (stillErr) console.log(`[senedd] WARNING: ${stillErr} ids still erroring after retry — re-run --seed (idempotent) to fill`)
  }
  return { scanned: done, found, errors: errors.length }
}

async function withInsertRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn() }
    catch (e) {
      if (i >= 4) throw e
      console.log(`[senedd] insert attempt ${i + 1} failed (${String(e).slice(0, 60)}) — retrying…`)
      await new Promise(r => setTimeout(r, 3000 * (i + 1)))
    }
  }
}

async function measure(ids: number[]) {
  let totSec = 0, totWords = 0
  for (const id of ids) {
    const p = await fetchPlenary(id)
    if (!p) { console.log(`  Plenary/${id}: FETCH FAILED`); continue }
    const words = p.items.reduce((s, it) => s + it.text.split(/\s+/).filter(Boolean).length, 0)
    const speakers = new Set(p.items.filter(i => i.speaker).map(i => i.speaker)).size
    totSec += p.items.length; totWords += words
    console.log(`  Plenary/${id} (${p.date}): ${p.items.length} sections, ${words.toLocaleString()} words, ${speakers} speakers`)
    const s = p.items.find(i => i.speaker) ?? p.items[0]
    if (s) console.log(`      e.g. [${s.heading}] ${s.speaker ?? '(procedural)'}: ${s.text.slice(0, 110).replace(/\n/g, ' ')}…`)
  }
  return { totSec, totWords, n: ids.length || 1 }
}

async function main() {
  const seed = process.argv.includes('--seed')
  const pilotId = arg('--pilot-id')
  const pilotN = Number(arg('--pilot') ?? 0)
  const maxId = Number(arg('--max-id') ?? DEFAULT_MAX)

  if (pilotId) {
    const m = await measure([Number(pilotId)])
    console.log(`\nPILOT(id ${pilotId}): ${m.totSec} sections, ${m.totWords.toLocaleString()} words`)
    await endNeonPool(); return
  }

  if (pilotN > 0) {
    // Find the N most-recent plenaries by scanning down from maxId.
    const plenaries: number[] = []
    for (let id = maxId; id >= 1 && plenaries.length < pilotN; id--) {
      if (await classifyMeeting(id) === 'plenary') plenaries.push(id)
    }
    console.log(`found ${plenaries.length} recent plenaries: ${plenaries.join(', ')}`)
    const m = await measure(plenaries)
    const avgSec = m.totSec / m.n
    const wPerSec = m.totWords / (m.totSec || 1)

    // Density sample: classify ~300 ids evenly across the range to estimate the
    // plenary fraction, then the universe.
    const SAMPLE = 300
    const step = Math.max(1, Math.floor(maxId / SAMPLE))
    let sampled = 0, plen = 0
    for (let id = 1; id <= maxId; id += step) {
      if (await classifyMeeting(id) === 'plenary') plen++
      sampled++
    }
    const estPlenaries = Math.round((plen / sampled) * maxId)
    console.log(`\ndensity: ${plen}/${sampled} sampled ids are plenary → est ${estPlenaries.toLocaleString()} plenaries over 1..${maxId}`)
    console.log(`PILOT: avg ${avgSec.toFixed(0)} sections/plenary, ${wPerSec.toFixed(0)} words/section`)
    console.log(`PREDICTION ≈ ${Math.round(avgSec * estPlenaries).toLocaleString()} sections, ≈ ${(avgSec * estPlenaries * wPerSec / 1e6).toFixed(1)}M words`)
    await endNeonPool(); return
  }

  if (!seed) {
    // dry-run density estimate
    const SAMPLE = 300
    const step = Math.max(1, Math.floor(maxId / SAMPLE))
    let sampled = 0, plen = 0
    for (let id = 1; id <= maxId; id += step) {
      if (await classifyMeeting(id) === 'plenary') plen++
      sampled++
    }
    console.log(`density ${plen}/${sampled} → est ${Math.round((plen / sampled) * maxId).toLocaleString()} plenaries (1..${maxId})`)
    console.log('(dry-run — pass --pilot N to measure, --seed POST-PUSH to insert rows)')
    await endNeonPool(); return
  }

  // --seed: full scan + insert plenary rows.
  console.log(`[senedd] scanning meeting ids 1..${maxId} (conc ${SCAN_CONC})…`)
  const found: number[] = []
  const { scanned } = await scanRange(1, maxId, id => found.push(id),
    (d, f) => console.log(`  scanned ${d}, plenaries ${f}`))
  console.log(`[senedd] scanned ${scanned}, found ${found.length} plenaries`)
  found.sort((a, b) => a - b)
  const rows = found.map(id => ({
    id: `${CORPUS}:${id}`, corpus: CORPUS, docId: String(id), sourceType: SRC, priority: 3,
  }))
  const { affected } = await withInsertRetry(() => bulkInsertQueueRows(rows))
  const pool = getNeonPool()
  await withInsertRetry(() => pool.query(`
    INSERT INTO corpus_targets (corpus_key, est_sections, est_is_confirmed, blocked, retired, display_label, notes)
    VALUES ($1, $2, false, false, false, $3, $4)
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections=EXCLUDED.est_sections, blocked=false, notes=EXCLUDED.notes`,
    [CORPUS, found.length, 'Senedd Cymru Plenary Cofnod (Record of Proceedings)',
     `V25 §2: ${found.length} plenary meetings via record.senedd.wales, one section per English speaker-turn. OGL v3.0 (Crown copyright, Senedd copyright page verified). est=plenary count; rebaseline at drain.`]))
  console.log(`[senedd] seeded ${affected} new plenary rows (of ${found.length})`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
