/**
 * v36-recovery-run.ts — V36 §2, run through the REAL processor.
 *
 * Drives `processRow` — the same function the Railway workers call — over rows from
 * `v36/worklist.jsonl`, so the pilot exercises the actual write path (TNA fetch →
 * R2 raw + compiled → `corpus_sections` upsert → stale-marker retraction) rather
 * than a reimplementation of it that could succeed where the real one fails.
 *
 * ⚠ IT DOES NOT SEED `ingest_queue`, and that is deliberate. `Ops` restarts
 * `Ingest` within ~25 minutes of work appearing, and `Ingest` runs the code that has
 * been PUSHED. Seeding before the push would hand the whole work list to the version
 * of `enumerateSections` that turns a 429 into a permanent "no text" marker — the
 * defect this sprint exists to fix, re-run at scale (playbook §8, V19 recurrence).
 * The queue-row ids here are `v36-pilot:*` and never exist, so `markDone`/`markFailed`
 * update zero rows; the section and R2 writes are real.
 *
 * Because it writes real data it defaults to a DRY LIST and needs --run.
 *
 * Usage:
 *   tsx v36-recovery-run.ts --n 15                 # list what it would fetch
 *   tsx v36-recovery-run.ts --n 15 --run [--type ukpga] [--seed 3]
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '1000'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const WORK_PATH = path.join(__dirname, 'v36', 'worklist.jsonl')

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const N = Number(arg('n') ?? 15)
const RUN = process.argv.includes('--run')
const TYPE = arg('type')
const SEED = Number(arg('seed') ?? 3)
const OUT = path.join(__dirname, 'v36', `recovery-run-n${N}.json`)

interface WorkRow { docId: string; calendarId: string | null; type: string; year: number; corpus: string; reason: string }

/** Deterministic shuffle — a fixed seed means a re-run is a re-measurement, not a
 *  fresh lottery, and the sample can be quoted alongside its seed. */
function seededPick<T>(items: T[], n: number, seed: number): T[] {
  let s = seed >>> 0 || 1
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

async function main() {
  if (!fs.existsSync(WORK_PATH)) throw new Error(`no work list at ${WORK_PATH} — run v36-reconcile.ts first`)
  let rows: WorkRow[] = fs.readFileSync(WORK_PATH, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  if (TYPE) rows = rows.filter(r => r.type === TYPE)
  // Stratification, because a uniform draw over this list measures one stratum:
  // 5,546 of the 5,808 ukpga items are 1800–1849 local/personal Acts, so 95% of any
  // uniform sample is that population and the pilot silently reports its yield as
  // the whole list's.
  if (arg('reason')) rows = rows.filter(r => r.reason === arg('reason'))
  if (arg('min-year')) rows = rows.filter(r => r.year >= Number(arg('min-year')))
  if (arg('max-year')) rows = rows.filter(r => r.year <= Number(arg('max-year')))
  const sample = seededPick(rows, N, SEED)

  console.log(`[run] work list ${rows.length.toLocaleString()}${TYPE ? ` (${TYPE})` : ''}, sampling ${sample.length} with seed ${SEED}\n`)
  if (!RUN) {
    for (const r of sample) console.log(`  ${r.docId.padEnd(26)} ${r.corpus.padEnd(22)} ${r.reason}`)
    console.log('\n[run] DRY LIST — nothing fetched or written. Re-run with --run.')
    await endNeonPool()
    return
  }

  const { processRow, getSectionsWritten } = await import('./workers/process-row')
  const pool = getNeonPool()
  const results: Record<string, unknown>[] = []
  let ok = 0, failed = 0, sectionsTotal = 0

  for (const r of sample) {
    const before = getSectionsWritten()
    const t = Date.now()
    let outcome = 'OK', err = ''
    try {
      await processRow({
        id: `v36-pilot:${r.corpus}:${r.docId}`,
        corpus: r.corpus, docId: r.docId, sourceType: 'tna-legislation', priority: 3,
        status: 'claimed', claimedBy: null, claimedAt: null, completedAt: null,
        attempts: 0, lastError: null, formatsAvailable: null,
      } as never)
    } catch (e) { outcome = 'FAILED'; err = String(e).slice(0, 140); failed++ }
    if (outcome === 'OK') ok++

    // Read back from the database rather than trusting the counter: the point of
    // the pilot is that a row exists, not that a function returned.
    const { rows: [check] } = await pool.query(
      `SELECT count(*) FILTER (WHERE status='compiled')::int AS compiled,
              count(*) FILTER (WHERE status='unavailable')::int AS unavailable,
              min("errorMsg") AS err
       FROM corpus_sections WHERE corpus = $1 AND id LIKE $2`,
      [r.corpus, `${r.corpus}:${r.docId}:%`])
    sectionsTotal += check.compiled
    results.push({ ...r, outcome, err, compiled: check.compiled, unavailable: check.unavailable, marker: check.err, ms: Date.now() - t, counterDelta: getSectionsWritten() - before })
    console.log(`${r.docId.padEnd(26)} ${outcome.padEnd(7)} compiled=${String(check.compiled).padStart(4)} unavailable=${check.unavailable} ${err || check.err || ''}`)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ seed: SEED, type: TYPE, n: sample.length, ok, failed, sectionsTotal, results }, null, 1))

  const withText = results.filter(r => Number(r.compiled) > 0).length
  console.log(`\n[run] processed ${sample.length}: ${ok} completed, ${failed} threw`)
  console.log(`[run] ${withText}/${sample.length} now hold compiled sections — ${sectionsTotal.toLocaleString()} sections, mean ${(sectionsTotal / Math.max(1, withText)).toFixed(1)} per instrument with text`)
  console.log(`[run] → ${OUT}`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
