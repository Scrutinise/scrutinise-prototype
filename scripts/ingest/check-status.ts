/**
 * CLI status check — reads corpus-progress.json from R2 and prints summary table.
 * Usage: npx tsx check-status.ts
 * Completes in < 5 seconds (single R2 GET).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { r2Get, PROGRESS_KEY } from './shared/r2-client'
import { ProgressAggregate, WorkerSummary } from './shared/progress-reporter'
import { readCheckpoint } from './shared/checkpoint'

async function main(): Promise<void> {
  const start = Date.now()

  // Try cached aggregate first — single read, very fast
  let agg: ProgressAggregate | null = null
  const raw = await r2Get(PROGRESS_KEY)
  if (raw) {
    try { agg = JSON.parse(raw) as ProgressAggregate } catch { /* fall through */ }
  }

  if (!agg) {
    // No cached aggregate — read all 10 checkpoints (slower but still < 10s)
    console.log('No aggregate found — reading worker checkpoints directly...')
    const { buildAggregate } = await import('./shared/progress-reporter')
    agg = await buildAggregate()
  }

  const ts = new Date(agg.timestamp).toLocaleString('en-GB', { timeZone: 'Europe/London' })
  console.log(`\nScrutinise Corpus Ingest — Status Report`)
  console.log(`As of: ${ts} BST`)
  console.log(`${'─'.repeat(75)}`)
  console.log(`${'Worker'.padEnd(8)} ${'Corpus'.padEnd(28)} ${'Done'.padStart(8)} ${'Total'.padStart(10)} ${'Pct'.padStart(7)} ${'Err'.padStart(6)}`)
  console.log(`${'─'.repeat(75)}`)

  for (const w of agg.workers) {
    const label = w.corpus.trim().padEnd(28)
    const done = String(w.completed).padStart(8)
    const total = String(w.total).padStart(10)
    const pct = w.pct.padStart(7)
    const err = String(w.failed).padStart(6)
    const phase = w.phase1Complete ? '✓' : w.phase === 2 ? '→P2' : '  '
    console.log(`W${String(w.workerId).padEnd(6)} ${label} ${done} ${total} ${pct} ${err}  ${phase}`)
  }

  console.log(`${'─'.repeat(75)}`)
  const totalLabel = 'TOTAL'.padEnd(36)
  const totalDone = String(agg.totalCompleted).padStart(8)
  const totalEst = String(agg.totalEstimated).padStart(10)
  const totalPct = agg.totalPct.padStart(7)
  const totalErr = String(agg.workers.reduce((s, w) => s + w.failed, 0)).padStart(6)
  console.log(`       ${totalLabel} ${totalDone} ${totalEst} ${totalPct} ${totalErr}`)
  console.log(`${'─'.repeat(75)}`)
  console.log(`\nCompleted in ${Date.now() - start}ms`)

  // Show top errors if any
  const errorWorkers = agg.workers.filter(w => w.failed > 0)
  if (errorWorkers.length > 0) {
    console.log('\nWorkers with errors — run check-errors.ts for detail:')
    for (const w of errorWorkers) {
      console.log(`  Worker ${w.workerId} (${w.corpus.trim()}): ${w.failed} failed`)
    }
  }
}

main().catch(err => {
  console.error('check-status failed:', err)
  process.exit(1)
})
