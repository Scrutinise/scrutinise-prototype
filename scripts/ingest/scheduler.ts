/**
 * Scheduler — persistent loop, runs immediately then every SCHEDULER_INTERVAL_HOURS (default 1).
 * Deploy as an always-on Railway service (not cron). Remove any Railway cron schedule.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import {
  buildAggregate,
  writeProgressToR2,
  appendCsvRow,
  sendProgressEmail,
  queryCorpusCounts,
  queryNeonCount,
  saveProgressSnapshot,
} from './shared/progress-reporter'
import { queryUnrecognisedFormats, queryFormatBreakdown } from './shared/db-metadata'

const INTERVAL_HOURS = parseInt(process.env.SCHEDULER_INTERVAL_HOURS ?? '1', 10)
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000

async function run(): Promise<void> {
  const capturedAt = new Date()
  console.log('[scheduler] querying corpus counts + Neon')
  const [corpusCounts, neonCount] = await Promise.all([
    queryCorpusCounts(),
    queryNeonCount(),
  ])
  const newTotal = Object.values(corpusCounts).reduce((s, c) => s + c.compiled, 0)
  console.log(`[scheduler] new pipeline: ${newTotal.toLocaleString()} compiled — Neon legacy: ${neonCount.toLocaleString()}`)

  console.log('[scheduler] building checkpoint aggregate (ETA)')
  const agg = await buildAggregate()

  console.log('[scheduler] querying format breakdown + unrecognised formats')
  let unrecognised = []
  let formatBreakdown = []
  try {
    ;[unrecognised, formatBreakdown] = await Promise.all([
      queryUnrecognisedFormats(INTERVAL_HOURS),
      queryFormatBreakdown(),
    ])
    console.log(`[scheduler] format breakdown: ${formatBreakdown.map(r => `${r.format ?? 'null'}=${r.count}`).join(' ')}`)
    console.log(`[scheduler] unrecognised formats (last ${INTERVAL_HOURS}h): ${unrecognised.length}`)
  } catch (err) {
    console.warn('[scheduler] could not query DB for format breakdown:', err)
  }

  console.log('[scheduler] saving progress snapshot')
  try {
    await saveProgressSnapshot(corpusCounts, capturedAt)
  } catch (err) {
    console.warn('[scheduler] snapshot save failed:', err)
  }

  console.log('[scheduler] writing to R2')
  await writeProgressToR2(agg)

  console.log('[scheduler] appending CSV row')
  await appendCsvRow(agg)

  console.log('[scheduler] sending email')
  await sendProgressEmail(agg, corpusCounts, neonCount, unrecognised, formatBreakdown)
}

async function loop(): Promise<never> {
  while (true) {
    await run().catch(err => console.error('[scheduler] run failed:', err))
    console.log(`[scheduler] sleeping ${INTERVAL_HOURS}h`)
    await new Promise(r => setTimeout(r, INTERVAL_MS))
  }
}

loop()
