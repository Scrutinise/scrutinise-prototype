/**
 * v24-seed-niassembly-hansard.ts — V24 §4.1. Seeds one queue row per NI Assembly
 * plenary Hansard report (docId "{reportId}:{date}", sourceType niassembly-hansard).
 *
 * Modes (predict-measure-commit, INGEST_PLAYBOOK):
 *   (default)        dry-run — list reports, print count + date span.
 *   --pilot N        fetch the latest N reports' speeches LOCALLY, measure
 *                    sections/words/report, extrapolate the corpus total. No seed.
 *   --pilot-id ID    pilot one specific reportId.
 *   --seed           insert all report rows (idempotent; ON CONFLICT DO NOTHING).
 *   --canary N       insert only the N most-recent report rows (post-push smoke).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listHansardReports, fetchReportSpeeches } from './sources/niassembly-hansard'

const CORPUS = 'niassembly-hansard'
const SRC = 'niassembly-hansard'

async function main() {
  const argv = process.argv.slice(2)
  const seed = argv.includes('--seed')
  const canaryIdx = argv.indexOf('--canary')
  const canaryN = canaryIdx >= 0 ? Number(argv[canaryIdx + 1]) : 0
  const pilotIdx = argv.indexOf('--pilot')
  const pilotN = pilotIdx >= 0 ? Number(argv[pilotIdx + 1]) : 0
  const pilotIdIdx = argv.indexOf('--pilot-id')
  const pilotId = pilotIdIdx >= 0 ? argv[pilotIdIdx + 1] : null

  const reports = await listHansardReports()
  reports.sort((a, b) => b.date.localeCompare(a.date)) // newest first
  console.log(`reports listed: ${reports.length}  span ${reports[reports.length - 1]?.date} .. ${reports[0]?.date}`)

  if (pilotId || pilotN > 0) {
    const sample = pilotId
      ? reports.filter(r => r.reportId === pilotId)
      : reports.slice(0, pilotN)
    let totSec = 0, totWords = 0, totSpeakers = 0
    for (const r of sample) {
      const items = await fetchReportSpeeches(r.reportId, r.date)
      if (items === null) { console.log(`  ${r.reportId} (${r.date}): FETCH FAILED`); continue }
      const words = items.reduce((s, it) => s + it.text.split(/\s+/).filter(Boolean).length, 0)
      const speakers = new Set(items.filter(i => i.speaker).map(i => i.speaker)).size
      totSec += items.length; totWords += words; totSpeakers += speakers
      console.log(`  ${r.reportId} (${r.date}): ${items.length} sections, ${words.toLocaleString()} words, ${speakers} distinct speakers`)
      if (items.length) {
        const s = items.find(i => i.speaker) ?? items[0]
        console.log(`      e.g. [${s.heading}] ${s.speaker ?? '(procedural)'}: ${s.text.slice(0, 120).replace(/\n/g, ' ')}…`)
      }
    }
    const n = sample.length || 1
    const avgSec = totSec / n
    console.log(`\nPILOT: ${sample.length} reports → avg ${avgSec.toFixed(0)} sections/report, avg ${(totWords / n).toFixed(0)} words/report`)
    console.log(`PREDICTION for ${reports.length} reports ≈ ${Math.round(avgSec * reports.length).toLocaleString()} sections, ≈ ${(avgSec * reports.length * (totWords / totSec) / 1e6).toFixed(1)}M words`)
    await endNeonPool()
    return
  }

  if (!seed && canaryN === 0) {
    console.log('\n(dry-run — pass --pilot N to measure, --canary N or --seed to insert rows)')
    await endNeonPool()
    return
  }

  const toSeed = canaryN > 0 ? reports.slice(0, canaryN) : reports
  const rows = toSeed.map(r => ({
    id: `${CORPUS}:${r.reportId}`,
    corpus: CORPUS,
    docId: `${r.reportId}:${r.date}`,
    sourceType: SRC,
    priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`seeded ${affected} new ${CORPUS} rows (of ${rows.length} ${canaryN > 0 ? 'canary' : 'total'})`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
