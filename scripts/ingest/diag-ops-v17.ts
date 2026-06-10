/**
 * diag-ops-v17.ts — local driver for the DB-only parts of an ops 15-min cycle:
 * table bootstrap, breaker evaluation, pwdata reseed. Deliberately does NOT
 * run the liveness check (it would serviceInstanceRedeploy whatever is on
 * Main) or send email. Safe to re-run.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { ensureTables, evaluateBreakers, reseedExhaustedPwdata, queryBreakerIssues } from './ops'

async function dumpState(label: string) {
  const pool = getNeonPool()
  const q = await pool.query<{ status: string; n: number }>(
    `SELECT status, COUNT(*)::int n FROM ingest_queue GROUP BY status ORDER BY status`
  )
  console.log(`[${label}] queue:`, q.rows.map(r => `${r.status}=${r.n}`).join(' '))
  const s = await pool.query(
    `SELECT source_key, state, zero_output_streak, trip_reason FROM source_status WHERE state = 'tripped' OR zero_output_streak > 0 ORDER BY source_key`
  )
  console.log(`[${label}] source_status (tripped or streak>0):`)
  for (const row of s.rows) console.log('  ', JSON.stringify(row))
}

async function main() {
  await ensureTables()
  await dumpState('before')

  console.log('\n— evaluateBreakers —')
  await evaluateBreakers()

  console.log('\n— reseedExhaustedPwdata —')
  await reseedExhaustedPwdata()

  await dumpState('after')

  console.log('\n— breaker ISSUES lines —')
  for (const line of await queryBreakerIssues()) console.log(' ', line)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
