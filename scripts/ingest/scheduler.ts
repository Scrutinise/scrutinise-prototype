/**
 * Scheduler — runs as a separate Railway service on cron: 0 *\/4 * * *
 * Aggregates all worker checkpoints, writes progress CSV, sends email.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import {
  buildAggregate,
  writeProgressToR2,
  appendCsvRow,
  sendProgressEmail,
} from './shared/progress-reporter'
import { queryUnrecognisedFormats, disconnectDb } from './shared/db-metadata'

async function run(): Promise<void> {
  console.log('[scheduler] building progress aggregate')
  const agg = await buildAggregate()

  console.log('[scheduler] querying unrecognised formats (last 4hrs)')
  let unrecognised = []
  try {
    unrecognised = await queryUnrecognisedFormats(4)
    console.log(`[scheduler] unrecognised formats: ${unrecognised.length}`)
  } catch (err) {
    console.warn('[scheduler] could not query unrecognised formats:', err)
  }

  console.log('[scheduler] writing to R2')
  await writeProgressToR2(agg)

  console.log('[scheduler] appending CSV row')
  await appendCsvRow(agg)

  console.log('[scheduler] sending email')
  await sendProgressEmail(agg, unrecognised)

  const total = agg.totalCompleted.toLocaleString()
  const est = agg.totalEstimated.toLocaleString()
  console.log(`[scheduler] done — ${total} / ${est} (${agg.totalPct})`)

  await disconnectDb()
}

run().catch(err => {
  console.error('[scheduler] fatal:', err)
  process.exit(1)
})
